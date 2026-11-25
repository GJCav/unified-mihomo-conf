import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import worker from "./index";
import cases from "./golden/cases.json";

describe("frozen import endpoints", () => {
  for (const [name, route] of Object.entries(cases)) {
    it(name, async () => {
      const response = await worker.fetch(new Request("https://example.invalid" + route, {
        headers: { authorization: "Basic " + btoa("test:test") },
      }), {
        PUBLIC_BASE_URL: "https://rules.invalid",
        DOH_URL: "https://dns.invalid/query",
        TAILSCALE_CONTROL_URL: "https://control.invalid",
        BASIC_AUTH_CREDENTIALS: "test:test",
        MAIN_SUBSCRIPTION_URL: name === "bad-url" ? "invalid" : name === "bad-scheme" ? "ftp://example.invalid" : "https://subscription.invalid",
        ASSETS: {} as Fetcher,
        REQUEST_RATE_LIMITER: { limit: async () => ({ success: true }) } as RateLimit,
      });
      const invalid = name.startsWith("bad-") || name === "missing-gateway";
      expect(response.status).toBe(invalid ? 400 : 200);
      const actual = await response.text();
      const path = new URL("./golden/" + name + (invalid ? ".json" : ".yaml"), import.meta.url);
      const expected = readFileSync(path, "utf8");
      expect(actual === expected).toBe(true);
    });
  }
});
