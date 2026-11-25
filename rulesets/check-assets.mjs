import { parseStats } from "../src/lib/stats.ts";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";

const formats = {
  tailnet: ["domain.mrs", "ipcidr.mrs"],
  "custom-direct": ["domain.txt", "classical.txt"],
  "custom-proxy": ["domain.txt", "classical.txt"],
  direct: ["domain.mrs", "ipcidr.mrs", "classical.txt"],
  global: ["domain.mrs", "ipcidr.mrs", "classical.txt"],
};
const expected = new Set([
  "AGPL-3.0.txt",
  "NOTICE",
  "stats.json",
  ...Object.entries(formats).flatMap(([group, suffixes]) =>
    suffixes.map((suffix) => group + "." + suffix),
  ),
]);
for (const entry of readdirSync(
  new URL("../public/v2/rules/", import.meta.url),
  { withFileTypes: true },
)) {
  if (!entry.isFile() || !expected.delete(entry.name))
    throw new Error("Unexpected rule asset: " + entry.name);
}
if (expected.size)
  throw new Error("Missing rule assets: " + [...expected].join(", "));

const dir = new URL("../public/v2/rules/", import.meta.url);
const stats = parseStats(
  JSON.parse(readFileSync(new URL("stats.json", dir), "utf8")),
);
for (const group of stats.rulesets) {
  for (const file of group.files) {
    const bytes = readFileSync(new URL(file.name, dir));
    if (
      bytes.length !== file.bytes ||
      createHash("sha256").update(bytes).digest("hex") !== file.sha256
    ) {
      throw new Error("Artifact differs from stats.json: " + file.name);
    }
  }
}
if (!readFileSync(new URL("NOTICE", dir), "utf8").includes(stats.generated_at))
  throw new Error("NOTICE timestamp mismatch");
