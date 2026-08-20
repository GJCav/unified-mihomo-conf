import { describe, expect, it, vi } from "vitest";
import worker from "./index";

function testEnv(success: boolean) {
  const limit = vi.fn().mockResolvedValue({ success });
  return {
    env: {
      ASSETS: { fetch: vi.fn() } as unknown as Fetcher,
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

  it("returns the Worker-managed subscription URL to the authenticated UI", async () => {
    const { env } = testEnv(true);
    const response = await worker.fetch(
      new Request("https://example.com/auth-context", {
        headers: { authorization: `Basic ${btoa("alice:secret")}` },
      }),
      env,
    );

    expect(await response.json()).toEqual({
      username: "alice",
      password: "secret",
      mainSubscriptionUrl: "https://example.com/subscription",
    });
  });
});
