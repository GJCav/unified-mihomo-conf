import { afterEach, expect, it, vi } from "vitest";
import { requestAuthContext } from "./auth";
afterEach(() => vi.unstubAllGlobals());
it("loads credentials only on request", async () => {
  const credentials = { username: "test", password: "placeholder" };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(credentials)));
  expect(await requestAuthContext()).toEqual(credentials);
});
it("identifies a cancelled challenge", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
  );
  await expect(requestAuthContext()).rejects.toThrow("cancelled");
});
it("reports network failures", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Error("offline")));
  await expect(requestAuthContext()).rejects.toThrow("offline");
});
