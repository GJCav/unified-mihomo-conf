import { readdirSync } from "node:fs";

const formats = {
  tailnet: ["domain.mrs", "ipcidr.mrs"],
  "custom-direct": ["domain.txt", "classical.txt"],
  "custom-proxy": ["domain.txt", "classical.txt"],
  direct: ["domain.mrs", "ipcidr.mrs", "classical.txt"],
  global: ["domain.mrs", "ipcidr.mrs", "classical.txt"],
};
const expected = new Set(["AGPL-3.0.txt", "NOTICE", "stats.json", ...Object.entries(formats).flatMap(
  ([group, suffixes]) => suffixes.map(suffix => group + "." + suffix),
)]);
for (const entry of readdirSync(new URL("../public/v2/rules/", import.meta.url), { withFileTypes: true })) {
  if (!entry.isFile() || !expected.delete(entry.name)) throw new Error("Unexpected rule asset: " + entry.name);
}
if (expected.size) throw new Error("Missing rule assets: " + [...expected].join(", "));
