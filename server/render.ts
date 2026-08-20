import Mustache from "mustache";

import skeleton from "../snippet/skeleton.yaml?raw";
import dnsBasic from "../snippet/dns/basic.yaml?raw";
import generalBasic from "../snippet/general/basic.yaml?raw";
import generalGateway from "../snippet/general/gateway.yaml?raw";
import externalUiBasic from "../snippet/external-ui/basic.yaml?raw";
import tunBasic from "../snippet/tun/basic.yaml?raw";
import tunTailscaleRouteExclusion from "../snippet/tun/tailscale-route-exclusion.yaml?raw";
import proxyGateway from "../snippet/proxies/gateway.yaml?raw";
import proxyTailscale from "../snippet/proxies/tailscale.yaml?raw";
import proxyGroupMain from "../snippet/proxy-groups/main.yaml?raw";
import proxyProviderMain from "../snippet/proxy-providers/main.yaml?raw";
import rulesBypassAcademic from "../snippet/rules/bypass-academic-publishers.yaml?raw";
import rulesBypassCn from "../snippet/rules/bypass-CN-websites.yaml?raw";
import rulesBypassSpecialIp from "../snippet/rules/bypass-special-IP.yaml?raw";
import rulesBypassThuIp from "../snippet/rules/bypass-THU-IP.yaml?raw";
import rulesProxyWebsites from "../snippet/rules/proxy-websites.yaml?raw";
import rulesBypassTailnet from "../snippet/rules/bypass-tailnet.yaml?raw";

type GeneralChoice = "basic" | "gateway";
type ExternalUiChoice = "basic" | "none";
type DnsChoice = "basic" | "none";
type TunChoice = "basic" | "tailscale-route-exclusion";
type ProviderChoice = "main";
type GroupChoice = "main";
type ProxyChoice = "gateway" | "tailscale";
type RulesChoice =
  | "bypass-special-IP"
  | "proxy-websites"
  | "bypass-CN-websites"
  | "bypass-academic-publishers"
  | "bypass-THU-IP"
  | "bypass-tailnet";

const basicRules: RulesChoice[] = [
  "bypass-special-IP",
  "bypass-CN-websites",
  "bypass-academic-publishers",
  "bypass-THU-IP",
  "proxy-websites",
];

function compactRules(value: string | null): RulesChoice[] {
  if (!value) return [];
  const codes: Record<string, RulesChoice | RulesChoice[]> = {
    i: "bypass-special-IP",
    w: "proxy-websites",
    c: "bypass-CN-websites",
    a: "bypass-academic-publishers",
    h: "bypass-THU-IP",
    t: "bypass-tailnet",
    b: basicRules,
  };
  const result: RulesChoice[] = [];
  for (const code of value) {
    const mapped = codes[code];
    if (!mapped) throw new PlanError(`Unknown rules snippet code: ${code}`);
    for (const item of Array.isArray(mapped) ? mapped : [mapped]) {
      if (result.includes(item)) throw new PlanError(`Duplicate rules snippet: ${item}`);
      result.push(item);
    }
  }
  return result;
}

interface Plan {
  general: GeneralChoice;
  externalUi: ExternalUiChoice;
  dns: DnsChoice;
  tun: TunChoice[];
  providers: ProviderChoice[];
  groups: GroupChoice[];
  proxies: ProxyChoice[];
  rules: RulesChoice[];
}

export class PlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanError";
  }
}

function choice<T extends string>(value: string | null, allowed: readonly T[], label: string): T {
  if (!value || !allowed.includes(value as T)) {
    throw new PlanError(`Unknown ${label} snippet: ${value ?? ""}`);
  }
  return value as T;
}

function compactList<T extends string>(
  value: string | null,
  codes: Record<string, T>,
  label: string,
): T[] {
  if (!value) return [];
  const result: T[] = [];
  for (const code of value) {
    const item = codes[code];
    if (!item) throw new PlanError(`Unknown ${label} snippet code: ${code}`);
    if (result.includes(item)) throw new PlanError(`Duplicate ${label} snippet: ${item}`);
    result.push(item);
  }
  return result;
}

function legacyChoice<T extends string>(
  params: URLSearchParams,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  return choice(params.get(key) ?? fallback, allowed, key);
}

function parsePlan(params: URLSearchParams): Plan {
  if (params.has("g")) {
    return {
      general: choice(params.get("g"), ["b", "g"], "general") === "g" ? "gateway" : "basic",
      externalUi: params.get("e") === "b" ? "basic" : "none",
      dns: choice(params.get("d") ?? "n", ["b", "n"], "dns") === "b" ? "basic" : "none",
      tun:
        params.get("t") === "n"
          ? []
          : compactList(
              params.get("t"),
              { b: "basic", e: "tailscale-route-exclusion" },
              "tun",
            ),
      providers: compactList(params.get("pp"), { m: "main" }, "proxy-providers"),
      groups: compactList(params.get("pg"), { m: "main" }, "proxy-groups"),
      proxies: compactList(params.get("p"), { g: "gateway", t: "tailscale" }, "proxies"),
      rules: compactRules(params.get("r")),
    };
  }

  const proxy = legacyChoice(params, "proxies", ["none", "gateway", "tailscale"], "none");
  const rule = legacyChoice(
    params,
    "rules",
    ["basic", "tailscale"],
    proxy === "tailscale" ? "tailscale" : "basic",
  );
  return {
    general: legacyChoice(params, "general", ["basic", "gateway"], "basic"),
    externalUi: legacyChoice(params, "external-ui", ["basic", "none"], "none"),
    dns: legacyChoice(params, "dns", ["basic", "none"], "basic"),
    tun:
      legacyChoice(params, "tun", ["basic", "none"], "none") === "basic"
        ? ["basic"]
        : [],
    providers:
      legacyChoice(params, "proxy-providers", ["main", "none"], "main") === "main"
        ? ["main"]
        : [],
    groups:
      legacyChoice(params, "proxy-groups", ["main", "none"], "main") === "main"
        ? ["main"]
        : [],
    proxies: proxy === "none" ? [] : [proxy],
    rules:
      rule === "tailscale" ? ["bypass-tailnet", ...basicRules] : [...basicRules],
  };
}

function required(params: URLSearchParams, compactKey: string, legacyKey: string): string {
  const value = params.get(compactKey)?.trim() || params.get(legacyKey)?.trim();
  if (!value) throw new PlanError(`Missing required value: ${compactKey}`);
  return value;
}

function requireHttpUrl(value: string, key: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new PlanError(`${key} must be a valid URL`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new PlanError(`${key} must use HTTP or HTTPS`);
  }
  return value;
}

function escapeQuoted(value: string): string {
  return JSON.stringify(value).slice(1, -1);
}

function joinSnippets(items: string[]): string {
  return items.map((item) => item.trim()).join("\n");
}

export function renderConfiguration(
  params: URLSearchParams,
  mainSubscriptionUrl?: string,
): string {
  const plan = parsePlan(params);
  const hasMainProvider = plan.providers.includes("main");
  const hasMainGroup = plan.groups.includes("main");
  const hasGateway = plan.proxies.includes("gateway");
  const hasTailscale = plan.proxies.includes("tailscale");
  const hasTailscaleRules = plan.rules.includes("bypass-tailnet");
  const hasTunBase = plan.tun.includes("basic");
  const hasTailscaleRouteExclusion = plan.tun.includes(
    "tailscale-route-exclusion",
  );

  if (hasMainProvider !== hasMainGroup) {
    throw new PlanError("The main provider and group snippets must be selected together");
  }
  if (hasGateway && hasMainGroup) {
    throw new PlanError("The gateway proxy conflicts with the main group named default");
  }
  if (!hasGateway && !hasMainGroup) {
    throw new PlanError("The plan does not define the default outbound");
  }
  if (hasTailscaleRules && !hasTailscale) {
    throw new PlanError("Tailscale rules require the Tailscale proxy snippet");
  }
  if (plan.rules.length === 0) {
    throw new PlanError("Select at least one rules snippet");
  }
  if (hasTailscaleRouteExclusion && !hasTunBase) {
    throw new PlanError("The Tailscale route exclusion requires the basic TUN snippet");
  }

  const values: Record<string, string | boolean> = {
    "external-ui": plan.externalUi === "basic",
    dns: plan.dns === "basic",
    tun: plan.tun.length > 0,
    "proxy-providers": plan.providers.length > 0,
    "proxy-groups": plan.groups.length > 0,
    proxies: plan.proxies.length > 0,
  };

  if (hasMainProvider) {
    values.main_subscription_url = escapeQuoted(
      requireHttpUrl(mainSubscriptionUrl?.trim() ?? "", "MAIN_SUBSCRIPTION_URL"),
    );
  }
  if (hasGateway) {
    values.gateway_server = escapeQuoted(required(params, "s", "gateway_server"));
  }
  if (hasTailscale) {
    values.tailscale_hostname = escapeQuoted(required(params, "h", "tailscale_hostname"));
    values.tailscale_auth_key = escapeQuoted(required(params, "k", "tailscale_auth_key"));
  }

  const partials: Record<string, string> = {
    general: plan.general === "gateway" ? generalGateway : generalBasic,
    rules: joinSnippets(
      plan.rules.map((item) => {
        if (item === "bypass-tailnet") return rulesBypassTailnet;
        if (item === "bypass-special-IP") return rulesBypassSpecialIp;
        if (item === "bypass-CN-websites") return rulesBypassCn;
        if (item === "bypass-academic-publishers") return rulesBypassAcademic;
        if (item === "bypass-THU-IP") return rulesBypassThuIp;
        return rulesProxyWebsites;
      }),
    ),
  };
  if (plan.externalUi === "basic") partials["external-ui"] = externalUiBasic;
  if (plan.dns === "basic") partials.dns = dnsBasic;
  if (plan.tun.length) {
    partials.tun = joinSnippets(
      plan.tun.map((item) =>
        item === "basic" ? tunBasic : tunTailscaleRouteExclusion,
      ),
    );
  }
  if (hasMainProvider) partials["proxy-providers"] = proxyProviderMain;
  if (hasMainGroup) partials["proxy-groups"] = proxyGroupMain;
  partials.proxies = joinSnippets(
    plan.proxies.map((item) => (item === "gateway" ? proxyGateway : proxyTailscale)),
  );

  return `${Mustache.render(skeleton, values, partials).trim()}\n`;
}
