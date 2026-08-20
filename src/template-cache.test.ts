import { describe, expect, it } from "vitest";
import {
  loadTemplateValues,
  saveTemplateValues,
  TEMPLATE_VALUE_CACHE_TTL_MS,
  type TemplateValues,
} from "./template-cache";

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

const values: TemplateValues = {
  gatewayServer: "192.168.55.1",
  tailscaleHostname: "ipad-air",
  tailscaleAuthKey: "test-key",
};

describe("template value cache", () => {
  it("keeps values for 30 days", () => {
    const storage = new MemoryStorage();
    saveTemplateValues(values, storage, 1_000);

    expect(loadTemplateValues(storage, 1_000 + TEMPLATE_VALUE_CACHE_TTL_MS - 1)).toEqual(values);
  });

  it("discards values when the 30-day lifetime expires", () => {
    const storage = new MemoryStorage();
    saveTemplateValues(values, storage, 1_000);

    expect(loadTemplateValues(storage, 1_000 + TEMPLATE_VALUE_CACHE_TTL_MS)).toBeNull();
    expect(storage.values.size).toBe(0);
  });

  it("discards malformed cache data", () => {
    const storage = new MemoryStorage();
    storage.setItem("mihomo-compose:template-values:v1", "not-json");

    expect(loadTemplateValues(storage)).toBeNull();
    expect(storage.values.size).toBe(0);
  });
});
