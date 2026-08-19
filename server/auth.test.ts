import { describe, expect, it } from "vitest";
import {
  isAuthorized,
  isHttps,
  isValidCredentialSecret,
  splitCredentials,
} from "./auth";

describe("Worker access protection", () => {
  it("rejects HTTP and accepts Cloudflare HTTPS metadata", () => {
    expect(isHttps(new Request("http://example.com/"))).toBe(false);
    expect(
      isHttps(
        new Request("http://example.com/", {
          headers: { "x-forwarded-proto": "https" },
        }),
      ),
    ).toBe(true);
  });

  it("validates the combined username and password secret", () => {
    expect(isValidCredentialSecret("alice:correct horse battery staple")).toBe(true);
    expect(isValidCredentialSecret("missing-password:")).toBe(false);
    expect(isValidCredentialSecret(undefined)).toBe(false);
  });

  it("accepts only the exact Basic authorization value", async () => {
    const valid = new Request("https://example.com/", {
      headers: { authorization: `Basic ${btoa("alice:secret")}` },
    });
    const invalid = new Request("https://example.com/", {
      headers: { authorization: `Basic ${btoa("alice:wrong")}` },
    });

    await expect(isAuthorized(valid, "alice:secret")).resolves.toBe(true);
    await expect(isAuthorized(invalid, "alice:secret")).resolves.toBe(false);
  });

  it("splits credentials only at the first colon", () => {
    expect(splitCredentials("alice:secret:with:colons")).toEqual({
      username: "alice",
      password: "secret:with:colons",
    });
  });
});
