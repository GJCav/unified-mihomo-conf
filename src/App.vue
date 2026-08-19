<script setup lang="ts">
import { Check, ChevronDown, ChevronUp, Copy, GripVertical } from "@lucide/vue";
import hljs from "highlight.js/lib/core";
import yaml from "highlight.js/lib/languages/yaml";
import QrcodeVue from "qrcode.vue";
import { computed, onBeforeUnmount, ref, watch } from "vue";

hljs.registerLanguage("yaml", yaml);

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
type ProfileId = "gateway" | "server" | "laptop" | "ipad";

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

interface AuthContext {
  username: string;
  password: string;
}

const basicRules: RulesChoice[] = [
  "bypass-special-IP",
  "bypass-CN-websites",
  "bypass-academic-publishers",
  "bypass-THU-IP",
  "proxy-websites",
];
const allRules: RulesChoice[] = ["bypass-tailnet", ...basicRules];

function decodeRules(value: string | null): RulesChoice[] {
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
  for (const code of value ?? "") {
    const mapped = codes[code];
    if (!mapped) continue;
    for (const rule of Array.isArray(mapped) ? mapped : [mapped]) {
      if (!result.includes(rule)) result.push(rule);
    }
  }
  return result;
}

const profilePlans: Array<{ id: ProfileId; name: string; info: string; plan: Plan }> = [
  {
    id: "gateway",
    name: "Gateway",
    info: "LAN access; connects to the main subscription directly.",
    plan: { general: "gateway", externalUi: "basic", dns: "none", tun: [], providers: ["main"], groups: ["main"], proxies: [], rules: [...basicRules] },
  },
  {
    id: "server",
    name: "Normal server",
    info: "Relays unmatched traffic through the gateway.",
    plan: { general: "basic", externalUi: "none", dns: "basic", tun: ["basic"], providers: [], groups: [], proxies: ["gateway"], rules: [...basicRules] },
  },
  {
    id: "laptop",
    name: "Laptop",
    info: "Uses the main subscription independently.",
    plan: { general: "basic", externalUi: "basic", dns: "basic", tun: ["basic", "tailscale-route-exclusion"], providers: ["main"], groups: ["main"], proxies: [], rules: [...basicRules] },
  },
  {
    id: "ipad",
    name: "iPad",
    info: "Uses the main subscription with the Tailscale proxy and rules.",
    plan: { general: "basic", externalUi: "none", dns: "basic", tun: ["basic"], providers: ["main"], groups: ["main"], proxies: ["tailscale"], rules: ["bypass-tailnet", ...basicRules] },
  },
];

const params = new URLSearchParams(window.location.search);
const hasCompactPlan = params.has("g");
const initialPlan: Plan = hasCompactPlan
  ? {
      general: params.get("g") === "g" ? "gateway" : "basic",
      externalUi: params.get("e") === "b" ? "basic" : "none",
      dns: params.get("d") === "b" ? "basic" : "none",
      tun: [
        ...(params.get("t")?.includes("b") ? (["basic"] as TunChoice[]) : []),
        ...(params.get("t")?.includes("e")
          ? (["tailscale-route-exclusion"] as TunChoice[])
          : []),
      ],
      providers: params.get("pp")?.includes("m") ? ["main"] : [],
      groups: params.get("pg")?.includes("m") ? ["main"] : [],
      proxies: [
        ...(params.get("p")?.includes("g") ? (["gateway"] as ProxyChoice[]) : []),
        ...(params.get("p")?.includes("t") ? (["tailscale"] as ProxyChoice[]) : []),
      ],
      rules: decodeRules(params.get("r")),
    }
  : structuredClone(profilePlans.find((profile) => profile.id === "laptop")!.plan);

const plan = ref<Plan>(initialPlan);
const subscriptionUrl = ref(params.get("u") ?? "");
const gatewayServer = ref(params.get("s") ?? "192.168.55.1");
const tailscaleHostname = ref(params.get("h") ?? "ipad-air");
const tailscaleAuthKey = ref(params.get("k") ?? "");
const selectedProfile = ref<ProfileId | "custom">(hasCompactPlan ? "custom" : "laptop");
const renderedYaml = ref("");
const renderError = ref("");
const loading = ref(false);
const copied = ref<"import" | "yaml" | null>(null);
const draggedRule = ref<RulesChoice | null>(null);
const authContext = ref<AuthContext | null>(null);
const authContextError = ref("");

const ruleItems = computed(() => {
  const ordered = [...plan.value.rules];
  for (const rule of allRules) {
    if (!ordered.includes(rule)) ordered.push(rule);
  }
  return ordered;
});

const selectedProfileInfo = computed(() =>
  selectedProfile.value === "custom"
    ? "Custom combination of the snippets below."
    : profilePlans.find((profile) => profile.id === selectedProfile.value)?.info ?? "",
);

function applyProfile(id: ProfileId | "custom") {
  if (id === "custom") return;
  const profile = profilePlans.find((item) => item.id === id);
  if (profile) plan.value = structuredClone(profile.plan);
}

function markCustom() {
  selectedProfile.value = "custom";
}

function toggleRule(rule: RulesChoice, enabled: boolean) {
  if (enabled && !plan.value.rules.includes(rule)) plan.value.rules.push(rule);
  if (!enabled) plan.value.rules = plan.value.rules.filter((item) => item !== rule);
  markCustom();
}

function moveRule(rule: RulesChoice, direction: -1 | 1) {
  const order = ruleItems.value;
  const from = order.indexOf(rule);
  const to = from + direction;
  if (to < 0 || to >= order.length) return;
  const reordered = [...order];
  [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
  plan.value.rules = reordered.filter((item) => plan.value.rules.includes(item));
  markCustom();
}

function dropRule(target: RulesChoice) {
  const source = draggedRule.value;
  if (!source || source === target) return;
  const reordered = [...ruleItems.value];
  const from = reordered.indexOf(source);
  const to = reordered.indexOf(target);
  reordered.splice(from, 1);
  reordered.splice(to, 0, source);
  plan.value.rules = reordered.filter((item) => plan.value.rules.includes(item));
  draggedRule.value = null;
  markCustom();
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const issues = computed(() => {
  const result: string[] = [];
  const hasProvider = plan.value.providers.includes("main");
  const hasGroup = plan.value.groups.includes("main");
  const hasGateway = plan.value.proxies.includes("gateway");
  const hasTailscale = plan.value.proxies.includes("tailscale");

  if (hasProvider !== hasGroup) result.push("Main provider and group must be selected together.");
  if (hasGateway && hasGroup) result.push("Gateway proxy conflicts with the main group named default.");
  if (!hasGateway && !hasGroup) result.push("This combination does not define the default outbound.");
  if (plan.value.rules.includes("bypass-tailnet") && !hasTailscale) result.push("Tailnet bypass rules require the Tailscale proxy.");
  if (plan.value.tun.includes("tailscale-route-exclusion") && !plan.value.tun.includes("basic")) result.push("Tailscale route exclusion requires the basic TUN snippet.");
  if (plan.value.rules.length === 0) result.push("Select at least one rules snippet.");
  if (hasProvider && !isHttpUrl(subscriptionUrl.value)) result.push("Enter a valid subscription URL.");
  if (hasGateway && !gatewayServer.value.trim()) result.push("Enter the gateway address.");
  if (hasTailscale && !tailscaleHostname.value.trim()) result.push("Enter a Tailscale hostname.");
  if (hasTailscale && !tailscaleAuthKey.value.trim()) result.push("Enter a Tailscale auth key.");
  return result;
});

function makeUrl(output: boolean, embedCredentials = false) {
  const url = new URL("/", window.location.origin);
  if (embedCredentials && authContext.value) {
    url.username = authContext.value.username;
    url.password = authContext.value.password;
  }
  url.searchParams.set("g", plan.value.general === "gateway" ? "g" : "b");
  if (plan.value.externalUi === "basic") url.searchParams.set("e", "b");
  url.searchParams.set("d", plan.value.dns === "basic" ? "b" : "n");
  const tunCodes = plan.value.tun
    .map((item) => (item === "basic" ? "b" : "e"))
    .join("");
  url.searchParams.set("t", tunCodes || "n");
  if (plan.value.providers.length) url.searchParams.set("pp", "m");
  if (plan.value.groups.length) url.searchParams.set("pg", "m");
  const proxyCodes = plan.value.proxies.map((item) => (item === "gateway" ? "g" : "t")).join("");
  if (proxyCodes) url.searchParams.set("p", proxyCodes);
  const codes: Record<RulesChoice, string> = {
    "bypass-special-IP": "i",
    "proxy-websites": "w",
    "bypass-CN-websites": "c",
    "bypass-academic-publishers": "a",
    "bypass-THU-IP": "h",
    "bypass-tailnet": "t",
  };
  const ruleCodes = plan.value.rules.map((item) => codes[item]).join("");
  if (ruleCodes) url.searchParams.set("r", ruleCodes);
  if (plan.value.providers.includes("main")) url.searchParams.set("u", subscriptionUrl.value.trim());
  if (plan.value.proxies.includes("gateway")) url.searchParams.set("s", gatewayServer.value.trim());
  if (plan.value.proxies.includes("tailscale")) {
    url.searchParams.set("h", tailscaleHostname.value.trim());
    url.searchParams.set("k", tailscaleAuthKey.value.trim());
  }
  if (output) url.searchParams.set("o", "y");
  return url.toString();
}

const pageUrl = computed(() => makeUrl(false));
const importUrl = computed(() => makeUrl(true, true));
const previewUrl = computed(() => makeUrl(true));
const highlightedYaml = computed(() =>
  renderedYaml.value ? hljs.highlight(renderedYaml.value, { language: "yaml" }).value : "",
);

watch(pageUrl, (url) => window.history.replaceState(null, "", url), { immediate: true });

let renderTimer: number | undefined;
let renderController: AbortController | undefined;

async function renderConfiguration() {
  renderController?.abort();
  if (issues.value.length) {
    renderedYaml.value = "";
    renderError.value = "";
    loading.value = false;
    return;
  }
  loading.value = true;
  renderController = new AbortController();
  try {
    const response = await fetch(previewUrl.value, { signal: renderController.signal });
    const text = await response.text();
    if (!response.ok) {
      const data = JSON.parse(text) as { error?: string };
      throw new Error(data.error ?? "Unable to render configuration");
    }
    renderedYaml.value = text;
    renderError.value = "";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    renderedYaml.value = "";
    renderError.value = error instanceof Error ? error.message : "Unable to render configuration";
  } finally {
    loading.value = false;
  }
}

watch([previewUrl, issues], () => {
  window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(renderConfiguration, 180);
}, { immediate: true });

async function loadAuthContext() {
  try {
    const response = await fetch("/auth-context", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error("Unable to load Basic Auth credentials");
    authContext.value = (await response.json()) as AuthContext;
  } catch (error) {
    authContextError.value =
      error instanceof Error ? error.message : "Unable to load Basic Auth credentials";
  }
}

void loadAuthContext();

onBeforeUnmount(() => {
  window.clearTimeout(renderTimer);
  renderController?.abort();
});

async function copyText(text: string, target: "import" | "yaml") {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
  } else {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(field);
    field.select();
    document.execCommand("copy");
    field.remove();
  }
  copied.value = target;
  window.setTimeout(() => { if (copied.value === target) copied.value = null; }, 1400);
}
</script>

<template>
  <main class="page">
    <section class="profiles-row compact-profiles">
      <div class="profile-intro">
        <h1>Mihomo configuration</h1>
      </div>
      <label class="profile-select">
        <span>Frequent profile</span>
        <select v-model="selectedProfile" @change="applyProfile(selectedProfile)">
          <option value="custom">Custom configuration</option>
          <option v-for="profile in profilePlans" :key="profile.id" :value="profile.id">
            {{ profile.name }}
          </option>
        </select>
      </label>
      <p class="profile-info">{{ selectedProfileInfo }}</p>
    </section>

    <section class="composer-row">
      <div class="editor-column">
        <div class="column-heading"><h2>Skeleton</h2></div>

        <div class="block-list">
          <label class="block-row">
            <span><strong>general</strong></span>
            <select v-model="plan.general" @change="markCustom">
              <option value="basic">basic.yaml</option><option value="gateway">gateway.yaml</option>
            </select>
          </label>
          <label class="block-row">
            <span><strong>external-ui</strong></span>
            <select v-model="plan.externalUi" @change="markCustom">
              <option value="basic">basic.yaml</option><option value="none">none</option>
            </select>
          </label>
          <label class="block-row">
            <span><strong>dns</strong></span>
            <select v-model="plan.dns" @change="markCustom">
              <option value="basic">basic.yaml</option><option value="none">none</option>
            </select>
          </label>
          <fieldset class="multi-block">
            <legend><strong>tun</strong></legend>
            <div class="checkbox-list">
              <label><input v-model="plan.tun" type="checkbox" value="basic" @change="markCustom" /> basic.yaml</label>
              <label><input v-model="plan.tun" type="checkbox" value="tailscale-route-exclusion" @change="markCustom" /> tailscale-route-exclusion.yaml</label>
            </div>
          </fieldset>

          <fieldset class="multi-block">
            <legend><strong>proxy-providers</strong></legend>
            <label><input v-model="plan.providers" type="checkbox" value="main" @change="markCustom" /> main.yaml</label>
          </fieldset>
          <fieldset class="multi-block">
            <legend><strong>proxy-groups</strong></legend>
            <label><input v-model="plan.groups" type="checkbox" value="main" @change="markCustom" /> main.yaml</label>
          </fieldset>
          <fieldset class="multi-block">
            <legend><strong>proxies</strong></legend>
            <div class="checkbox-list">
              <label><input v-model="plan.proxies" type="checkbox" value="gateway" @change="markCustom" /> gateway.yaml</label>
              <label><input v-model="plan.proxies" type="checkbox" value="tailscale" @change="markCustom" /> tailscale.yaml</label>
            </div>
          </fieldset>

          <fieldset class="rules-block">
            <legend><strong>rules</strong></legend>
            <ol class="sortable-list">
              <li
                v-for="(rule, index) in ruleItems"
                :key="rule"
                draggable="true"
                @dragstart="draggedRule = rule"
                @dragover.prevent
                @drop="dropRule(rule)"
              >
                <GripVertical class="drag-handle" :size="15" />
                <label>
                  <input
                    type="checkbox"
                    :checked="plan.rules.includes(rule)"
                    @change="toggleRule(rule, ($event.target as HTMLInputElement).checked)"
                  />
                  {{ rule }}.yaml
                </label>
                <span class="order-buttons">
                  <button type="button" title="Move up" :disabled="index === 0" @click="moveRule(rule, -1)"><ChevronUp :size="14" /></button>
                  <button type="button" title="Move down" :disabled="index === ruleItems.length - 1" @click="moveRule(rule, 1)"><ChevronDown :size="14" /></button>
                </span>
              </li>
            </ol>
          </fieldset>
        </div>

        <div class="placeholder-section">
          <h3>Template values</h3>
          <label v-if="plan.providers.includes('main')" class="input-row">
            <span>main_subscription_url</span><input v-model="subscriptionUrl" type="url" placeholder="https://provider.example/subscription" autocomplete="off" />
          </label>
          <label v-if="plan.proxies.includes('gateway')" class="input-row">
            <span>gateway_server</span><input v-model="gatewayServer" type="text" placeholder="192.168.55.1" autocomplete="off" />
          </label>
          <template v-if="plan.proxies.includes('tailscale')">
            <label class="input-row"><span>tailscale_hostname</span><input v-model="tailscaleHostname" type="text" placeholder="ipad-air" autocomplete="off" /></label>
            <label class="input-row"><span>tailscale_auth_key</span><input v-model="tailscaleAuthKey" type="password" placeholder="tskey-auth-…" autocomplete="off" /></label>
          </template>
          <p v-if="!plan.providers.length && !plan.proxies.length" class="empty-note">This selection has no template values.</p>
        </div>

        <ul v-if="issues.length" class="issues"><li v-for="issue in issues" :key="issue">{{ issue }}</li></ul>

        <div class="import-url">
          <div><strong>Import URL</strong><code>{{ importUrl }}</code></div>
          <button type="button" :disabled="issues.length > 0 || !authContext" @click="copyText(importUrl, 'import')">
            <Check v-if="copied === 'import'" :size="15" /><Copy v-else :size="15" />
            {{ copied === "import" ? "Copied" : "Copy" }}
          </button>
        </div>
        <p v-if="authContextError" class="auth-context-error">{{ authContextError }}</p>
        <div
          v-if="authContext && issues.length === 0"
          class="import-qr"
          aria-label="Import URL QR code"
        >
          <QrcodeVue
            :value="importUrl"
            :size="196"
            level="M"
            render-as="svg"
            :margin="2"
          />
        </div>
      </div>

      <div class="result-column">
        <div class="column-heading result-heading">
          <div><h2>{{ loading ? "Rendering YAML…" : "Rendered YAML" }}</h2></div>
          <button type="button" :disabled="!renderedYaml" @click="copyText(renderedYaml, 'yaml')">
            <Check v-if="copied === 'yaml'" :size="15" /><Copy v-else :size="15" />
            {{ copied === "yaml" ? "Copied" : "Copy YAML" }}
          </button>
        </div>
        <div class="code-panel">
          <p v-if="renderError" class="result-message error">{{ renderError }}</p>
          <p v-else-if="issues.length" class="result-message">Complete the required values to render this configuration.</p>
          <pre v-else><code class="hljs language-yaml" v-html="highlightedYaml"></code></pre>
        </div>
      </div>
    </section>
  </main>
</template>
