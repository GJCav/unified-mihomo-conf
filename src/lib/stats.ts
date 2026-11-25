import config from "../../rulesets/rulesets.json" with { type: "json" };

export const behaviors = ["domain", "ipcidr", "classical"] as const;
type Behavior = (typeof behaviors)[number];
type Counts = Record<Behavior, number>;
type Upstream = { name: string; homepage: string; license: string };
type Artifact = {
  name: string;
  format: string;
  behavior: Behavior;
  count: number;
  bytes: number;
  sha256: string;
};
type Source = {
  name: string;
  kind: string;
  upstream: string;
  input_rules: number;
  accepted: Counts;
  fetches?: { url: string; bytes: number; sha256: string }[];
  omitted_as_covered?: number;
};
export type Group = {
  name: string;
  description: string;
  excluded: string[];
  final?: Counts;
  before_optimization?: Counts;
  after_optimization?: Counts;
  files: { name: string; bytes?: number }[];
  sources: Partial<Source>[];
};
export interface Stats {
  schema_version: 2;
  generated_at: string;
  build?: { repository: string; commit: string };
  priority: string[];
  fallback: string;
  upstreams: Record<string, Upstream>;
  license_files: string[];
  rulesets: (Group & { files: Artifact[]; sources: Source[]; final: Counts })[];
}

export const summary = config.rulesets.map((group) => {
  const formats = group.name.startsWith("custom-")
    ? ["domain.txt", "classical.txt"]
    : group.name === "tailnet"
      ? ["domain.mrs", "ipcidr.mrs"]
      : ["domain.mrs", "ipcidr.mrs", "classical.txt"];
  return {
    name: group.name,
    description: group.description,
    excluded: group.exclude ?? [],
    files: formats.map((format) => ({ name: group.name + "." + format })),
    sources: group.sources.map(({ name, kind, upstream }) => ({
      name,
      kind,
      upstream,
    })),
  };
}) satisfies Group[];
export const upstreams: Record<string, Upstream> = config.upstreams;
const integer = (n: unknown) => Number.isSafeInteger(n) && Number(n) >= 0;
const counts = (c: Counts) => c && behaviors.every((key) => integer(c[key]));
const same = (a: string[], b: string[]) =>
  Array.isArray(a) && a.length === b.length && b.every((v, i) => a[i] === v);

export function parseStats(value: unknown): Stats {
  const s = value as Stats;
  if (
    !s ||
    s.schema_version !== 2 ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(s.generated_at) ||
    !Number.isFinite(Date.parse(s.generated_at)) ||
    !same(s.priority, config.priority) ||
    s.fallback !== config.fallback ||
    !same(s.license_files, ["NOTICE", "AGPL-3.0.txt"]) ||
    !s.upstreams ||
    !Array.isArray(s.rulesets) ||
    !same(
      s.rulesets.map((g) => g.name),
      s.priority,
    ) ||
    (s.build && (!s.build.commit || !/^https:\/\//.test(s.build.repository)))
  )
    throw Error("Invalid rule metadata");
  for (const key of Object.keys(upstreams)) {
    const u = s.upstreams[key];
    if (
      !u ||
      typeof u.name !== "string" ||
      !u.name ||
      typeof u.license !== "string" ||
      !u.license ||
      !/^https:\/\//.test(u.homepage)
    )
      throw Error("Invalid upstream catalog");
  }
  for (const [i, g] of s.rulesets.entries()) {
    if (
      !g.description ||
      !same(g.excluded, summary[i].excluded) ||
      !counts(g.final) ||
      !counts(g.before_optimization!) ||
      !counts(g.after_optimization!) ||
      !Array.isArray(g.sources) ||
      !g.sources.length ||
      !same(
        g.files.map((f) => f.name).sort(),
        summary[i].files.map((f) => f.name).sort(),
      )
    )
      throw Error("Invalid rule group");
    for (const f of g.files as Artifact[]) {
      if (
        f.name !== [g.name, f.behavior, f.format].join(".") ||
        !integer(f.bytes) ||
        f.count !== g.final[f.behavior] ||
        !/^[0-9a-f]{64}$/.test(f.sha256)
      )
        throw Error("Invalid rule file");
    }
    for (const source of g.sources as Source[]) {
      const u = s.upstreams[source.upstream];
      if (
        !u?.name ||
        !u.license ||
        !/^https:\/\//.test(u.homepage) ||
        !source.name ||
        !source.kind ||
        !integer(source.input_rules) ||
        !counts(source.accepted)
      )
        throw Error("Invalid rule source");
      if (!source.kind.endsWith("-file") || source.fetches !== undefined) {
        if (
          !Array.isArray(source.fetches) ||
          !source.fetches.length ||
          !source.fetches.every(
            (f) =>
              f &&
              typeof f.url === "string" &&
              /^https:\/\//.test(f.url) &&
              integer(f.bytes) &&
              f.bytes > 0 &&
              typeof f.sha256 === "string" &&
              /^[0-9a-f]{64}$/.test(f.sha256),
          )
        )
          throw Error("Invalid source fetch metadata");
      }
    }
  }
  return s;
}
