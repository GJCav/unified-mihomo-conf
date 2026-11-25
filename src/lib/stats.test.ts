import { expect, it } from "vitest";
import { parseStats, summary, upstreams } from "./stats";
const counts = { domain: 0, ipcidr: 0, classical: 0 };
function fixture() {
  return {
    schema_version: 2,
    generated_at: "2026-11-25T00:00:00Z",
    priority: summary.map((g) => g.name),
    fallback: "global",
    license_files: ["NOTICE", "AGPL-3.0.txt"],
    upstreams,
    rulesets: summary.map((g) => ({
      ...g,
      final: counts,
      before_optimization: counts,
      after_optimization: counts,
      sources: g.sources.map((s) => ({
        ...s,
        fetches: s.kind.endsWith("-file")
          ? undefined
          : [
              {
                url: "https://example.invalid/rules",
                bytes: 1,
                sha256: "a".repeat(64),
              },
            ],
        input_rules: 0,
        accepted: counts,
      })),
      files: g.files.map((f) => ({
        ...f,
        behavior: f.name.split(".")[1],
        format: f.name.split(".")[2],
        bytes: 0,
        count: 0,
        sha256: "0".repeat(64),
      })),
    })),
  };
}
it("retains all twelve fallback downloads", () =>
  expect(summary.flatMap((g) => g.files)).toHaveLength(12));
it("accepts a complete v2 report", () =>
  expect(parseStats(fixture()).rulesets).toHaveLength(5));
it("rejects mixed or incomplete builds", () => {
  const s = fixture();
  s.rulesets[1].files.pop();
  expect(() => parseStats(s)).toThrow();
  const t = fixture();
  t.rulesets[0].sources[0].upstream = "missing";
  expect(() => parseStats(t)).toThrow();
});

it.each([
  { fetches: undefined },
  { fetches: [] },
  {
    fetches: [
      { url: "http://example.invalid", bytes: 1, sha256: "a".repeat(64) },
    ],
  },
  {
    fetches: [
      { url: "https://example.invalid", bytes: 0, sha256: "a".repeat(64) },
    ],
  },
  {
    fetches: [
      { url: "https://example.invalid", bytes: 1, sha256: "A".repeat(64) },
    ],
  },
])("rejects invalid remote fetch metadata %#", ({ fetches }) => {
  const s = fixture();
  const source = s.rulesets
    .flatMap((g) => g.sources)
    .find((source) => !source.kind.endsWith("-file"))!;
  source.fetches = fetches;
  expect(() => parseStats(s)).toThrow("Invalid source fetch metadata");
});
