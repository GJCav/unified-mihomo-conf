import { describe, expect, it, vi } from "vitest";
import worker from "./index";

function testEnv(success: boolean) {
  const limit = vi.fn().mockResolvedValue({ success });
  return {
    env: {
      ASSETS: { fetch: vi.fn(async () => new Response("asset")) } as unknown as Fetcher,
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
    const response = await worker.fetch(new Request("https://example.com/"), env);

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
    const get = (route: string) => worker.fetch(new Request("https://example.invalid" + route, { headers }), testEnv(true).env);
    const legacy = await get("/nested/import?o=y");
    expect(legacy.headers.get("content-type")).toContain("text/yaml");
    expect(await legacy.text()).toBe(await (await get("/config.yaml?o=y")).text());
    expect(await (await get("/health?o=y")).json()).toEqual({ ok: true });
    expect(await (await get("/v2/nested/import?o=y")).text()).toBe("asset");
  });
  it.each(["/", "/?profile=server&k=placeholder", "/?g=g&r=b"])("drops the query when redirecting %s", async route => {
    const response = await worker.fetch(new Request("https://example.invalid" + route, { headers }), testEnv(true).env);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/v2/");
  });
  it.each(["/health", "/v2/", "/v2/config/laptop.yaml", "/v2/auth-context", "/config.yaml", "/v2/assets/app.js", "/auth-context"])("authenticates %s", async route => {
    expect((await worker.fetch(new Request("https://example.invalid" + route), testEnv(true).env)).status).toBe(401);
  });
  it.each([
    ["/health", 200], ["/v2/", 200], ["/v2/config/laptop.yaml", 200],
    ["/v2/config/unknown.yaml", 404], ["/v2/config/server.yaml", 400],
  ] as const)("serves authenticated %s", async (route, status) => {
    const response = await worker.fetch(new Request("https://example.invalid" + route, { headers }), testEnv(true).env);
    expect(response.status).toBe(status);
  });
});
