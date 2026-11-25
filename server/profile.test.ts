import { evaluationOrder } from "../shared/rule-order";
import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { profileFields, type ProfileId } from "../shared/profiles";
import { renderProfile } from "./profile";

const env = {
  DOH_URL: "https://dns.invalid/query",
  PUBLIC_BASE_URL: "https://rules.invalid",
  MAIN_SUBSCRIPTION_URL: "https://subscription.invalid",
  TAILSCALE_CONTROL_URL: "https://control.invalid",
};
describe.each(Object.keys(profileFields) as ProfileId[])(
  "%s skeleton",
  (id) => {
    const params = new URLSearchParams({
      s: "gateway.invalid",
      h: "device",
      k: "placeholder",
    });
    const yaml = renderProfile(id, params, env);
    it("references twelve distinct rule files and resolves every placeholder", () => {
      expect(
        new Set(yaml.match(/https:\/\/rules\.invalid\/v2\/rules\/[^"]+/g)).size,
      ).toBe(12);
      expect(yaml).not.toContain("{{{");
      expect(yaml.endsWith("  - MATCH,default\n")).toBe(true);
      expect(yaml.includes("'+.tailnet'")).toBe(id === "phone");
      for (const field of profileFields[id]) {
        const special = new URLSearchParams(params);
        special.set(field, 'a"\\\n中');
        expect(renderProfile(id, special, env)).toContain(
          JSON.stringify(special.get(field)),
        );
        special.delete(field);
        expect(() => renderProfile(id, special, env)).toThrow(
          "Missing required value",
        );
      }
    });
    it("keeps provider declarations, DNS precedence and outbound order consistent", () => {
      const providers = yaml
        .split("\nrule-providers:\n")[1]
        .split("\nrules:\n")[0];
      const reference = renderProfile("laptop", params, env)
        .split("\nrule-providers:\n")[1]
        .split("\nrules:\n")[0];
      expect(providers).toBe(reference);
      const outbound = id === "ipad" || id === "phone" ? "tailscale" : "DIRECT";
      expect(yaml.split("\nrules:\n")[1].trimEnd().split("\n")).toEqual(
        evaluationOrder(outbound).map(
          (item) =>
            "  - " + (item.startsWith("MATCH,") ? item : "RULE-SET," + item),
        ),
      );
      if (id !== "gateway") {
        expect(
          yaml.indexOf("'rule-set:tailnet-domain,custom-proxy-domain'"),
        ).toBeGreaterThan(0);
        expect(
          yaml.indexOf("'rule-set:custom-direct-domain,direct-domain'"),
        ).toBeGreaterThan(
          yaml.indexOf("'rule-set:tailnet-domain,custom-proxy-domain'"),
        );
      }
    });
    it.skipIf(!process.env.MIHOMO_BIN)("passes mihomo -t", () => {
      const dir = mkdtempSync(join(tmpdir(), "profile-check-"));
      try {
        const file = join(dir, "config.yaml");
        writeFileSync(file, yaml);
        execFileSync(process.env.MIHOMO_BIN!, ["-t", "-d", dir, "-f", file], {
          timeout: 30000,
        });
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  },
);
