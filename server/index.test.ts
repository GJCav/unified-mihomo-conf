import { describe, expect, it, vi } from "vitest";
import worker from "./index";

function testEnv(success: boolean) {
  const limit = vi.fn().mockResolvedValue({ success });
  return {
    env: {
      ASSETS: {
        fetch: vi.fn(async () => new Response("asset")),
      } as unknown as Fetcher,
      PUBLIC_BASE_URL: "https://rules.invalid",
      DOH_URL: "https://dns.invalid/query",
      TAILSCALE_CONTROL_URL: "https://control.invalid",
      BASIC_AUTH_CREDENTIALS: "alice:secret",
      MAIN_SUBSCRIPTION_URL: "https://example.com/subscription",
      REQUEST_RATE_LIMITER: { limit } as RateLimit,
    },
    limit,
  };
}

describe("request rate limiting", () => {
  it("rate limits by Cloudflare client IP before authentication", async () => {
    const { env, limit } = testEnv(false);
    const response = await worker.fetch(
      new Request("https://example.com/", {
        headers: { "cf-connecting-ip": "192.0.2.10" },
      }),
      env,
    );

    expect(limit).toHaveBeenCalledWith({ key: "192.0.2.10" });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("continues to authentication when the request is allowed", async () => {
    const { env } = testEnv(true);
    const response = await worker.fetch(
      new Request("https://example.com/health"),
      env,
    );

    expect(response.status).toBe(401);
  });

  it("returns only Basic credentials to the authenticated UI", async () => {
    const { env } = testEnv(true);
    const response = await worker.fetch(
      new Request("https://example.com/v2/auth-context", {
        headers: { authorization: `Basic ${btoa("alice:secret")}` },
      }),
      env,
    );

    expect(await response.json()).toEqual({
      username: "alice",
      password: "secret",
    });
  });
});

describe("Worker routes", () => {
  const headers = { authorization: "Basic " + btoa("alice:secret") };
  it("preserves arbitrary legacy paths and gives health and v2 priority", async () => {
    const get = (route: string) =>
      worker.fetch(
        new Request("https://example.invalid" + route, { headers }),
        testEnv(true).env,
      );
    const legacy = await get("/nested/import?o=y");
    expect(legacy.headers.get("content-type")).toContain("text/yaml");
    expect(await legacy.text()).toBe(
      await (await get("/config.yaml?o=y")).text(),
    );
    expect(await (await get("/health?o=y")).json()).toEqual({ ok: true });
    expect(await (await get("/v2/nested/import?o=y")).text()).toBe("asset");
  });
  it.each(["/", "/?profile=server&k=placeholder", "/?g=g&r=b"])(
    "drops the query when redirecting %s",
    async (route) => {
      const response = await worker.fetch(
        new Request("https://example.invalid" + route, { headers }),
        testEnv(true).env,
      );
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe("/v2/");
    },
  );
  it.each([
    "/health",
    "/?o=y",
    "/nested?o=y",
    "/v2?o=y",
    "/v2/config/laptop.yaml",
    "/v2/auth-context",
    "/config.yaml",
    "/auth-context",
  ])("authenticates %s", async (route) => {
    expect(
      (
        await worker.fetch(
          new Request("https://example.invalid" + route),
          testEnv(true).env,
        )
      ).status,
    ).toBe(401);
  });
  it.each([
    ["/health", 200],
    ["/v2/", 200],
    ["/v2/config/laptop.yaml", 200],
    ["/v2/config/unknown.yaml", 404],
    ["/v2/config/server.yaml", 400],
  ] as const)("serves authenticated %s", async (route, status) => {
    const response = await worker.fetch(
      new Request("https://example.invalid" + route, { headers }),
      testEnv(true).env,
    );
    expect(response.status).toBe(status);
  });
});

describe.each(["GET", "HEAD"])("%s public routes", (method) => {
  it.each([
    "/",
    "/v2?profile=phone",
    "/v2/",
    "/v2/index.html",
    "/favicon.ico",
    "/v2/assets/app.js",
    "/v2/rules/missing",
  ])("handles %s without secrets", async (route) => {
    const { env } = testEnv(true);
    for (const key of Object.keys(env).filter(
      (key) => !["ASSETS", "REQUEST_RATE_LIMITER"].includes(key),
    )) {
      Object.defineProperty(env, key, {
        get() {
          throw Error(key);
        },
      });
    }
    vi.mocked(env.ASSETS.fetch).mockResolvedValue(
      new Response(null, { status: route.endsWith("missing") ? 404 : 200 }),
    );
    const response = await worker.fetch(
      new Request("https://example.invalid" + route, { method }),
      env,
    );
    expect(response.headers.has("www-authenticate")).toBe(false);
    if (route === "/favicon.ico") {
      expect(response.status).toBe(204);
      expect(response.headers.get("cache-control")).toBe(
        "public, max-age=86400",
      );
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    } else if (route === "/" || route.startsWith("/v2?")) {
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(
        route === "/" ? "/v2/" : "/v2/?profile=phone",
      );
    } else {
      expect(response.status).toBe(route.endsWith("missing") ? 404 : 200);
      if (route === "/v2/" || route.endsWith("html")) {
        expect(response.headers.get("x-frame-options")).toBe("DENY");
        expect(response.headers.get("cache-control")).toBe("no-cache");
        expect(response.headers.get("x-content-type-options")).toBe("nosniff");
        expect(response.headers.get("referrer-policy")).toBe("no-referrer");
        expect(response.headers.get("content-security-policy")).toBe(
          "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
        );
      }
    }
  });
});
it("protects non-read requests", async () => {
  expect(
    (
      await worker.fetch(
        new Request("https://example.invalid/v2/", { method: "POST" }),
        testEnv(true).env,
      )
    ).status,
  ).toBe(401);
});
it("enforces HTTPS before rate limiting", async () => {
  const { env, limit } = testEnv(true);
  expect(
    (await worker.fetch(new Request("http://example.invalid/v2/"), env)).status,
  ).toBe(403);
  expect(limit).not.toHaveBeenCalled();
});
it.each(["/v2/rules/missing.mrs", "/v2/assets/missing.js"])(
  "preserves the asset binding's 404 for %s",
  async (path) => {
    const { env } = testEnv(true);
    vi.mocked(env.ASSETS.fetch).mockResolvedValue(
      new Response(null, { status: 404 }),
    );
    const response = await worker.fetch(
      new Request("https://example.invalid" + path),
      env,
    );
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
  },
);

describe.each(["GET", "HEAD"])("%s sign-in fallback", (method) => {
  it.each([
    ["", "laptop"],
    ["?profile=phone&k=placeholder", "phone"],
    ["?profile=invalid", "laptop"],
  ])("authenticates before redirecting %s", async (query, profile) => {
    const url = "https://example.invalid/v2/sign-in" + query;
    const { env } = testEnv(true);
    const challenge = await worker.fetch(new Request(url, { method }), env);
    expect(challenge.status).toBe(401);
    expect(challenge.headers.get("www-authenticate")).toContain("Basic");
    const response = await worker.fetch(
      new Request(url, {
        method,
        headers: { authorization: "Basic " + btoa(env.BASIC_AUTH_CREDENTIALS) },
      }),
      env,
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/v2/?profile=" + profile);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).toBe("");
  });
});

it.each([
  "/@vite/client",
  "/__vite_ping",
  "/src/main.ts",
  "/shared/profiles.ts",
  "/node_modules/.vite/deps/vue.js",
  "/rulesets/rulesets.json",
])("passes frontend dev module %s to assets", async (path) => {
  const { env } = testEnv(true);
  const response = await worker.fetch(
    new Request("https://example.invalid" + path),
    env,
  );
  expect(response.status).toBe(200);
  expect(env.ASSETS.fetch).toHaveBeenCalledOnce();
});
it.each([
  "/server/index.ts",
  "/.dev.vars",
  "/v2/auth-context",
  "/v2/config/laptop.yaml",
])("keeps %s private in development", async (path) => {
  expect(
    (
      await worker.fetch(
        new Request("https://example.invalid" + path),
        testEnv(true).env,
      )
    ).status,
  ).toBe(401);
});
