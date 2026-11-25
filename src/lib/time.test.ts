import { expect, it } from "vitest";
import { formatUtc8, relativeAge } from "./time";
it("formats UTC+8 across year boundaries", () =>
  expect(formatUtc8("2026-12-31T16:01:00Z")).toBe("2027-01-01 00:01 UTC+8"));
it.each([
  [0, "just now"],
  [60, "1m ago"],
  [3600, "1h ago"],
  [86400, "1d ago"],
] as const)("formats age at %s seconds", (seconds, label) =>
  expect(relativeAge("1970-01-01T00:00:00Z", seconds * 1000)).toBe(label),
);
