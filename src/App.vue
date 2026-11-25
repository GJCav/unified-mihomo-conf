<script setup lang="ts">
import { Check, Copy } from "@lucide/vue";
import hljs from "highlight.js/lib/core";
import yaml from "highlight.js/lib/languages/yaml";
import QrcodeVue from "qrcode.vue";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { loadTemplateValues, saveTemplateValues } from "./template-cache";

hljs.registerLanguage("yaml", yaml);
import { isProfile, profileFields, type ProfileId } from "../shared/profiles";
type AuthContext = { username: string; password: string };
const params = new URLSearchParams(location.search);
const cachedTemplateValues = loadTemplateValues();
const initial = params.get("profile") ?? "laptop";
const selectedProfile = ref<ProfileId>(isProfile(initial) ? initial : "laptop");
const gatewayServer = ref(params.get("s") ?? cachedTemplateValues?.gatewayServer ?? "192.168.55.1");
const tailscaleHostname = ref(params.get("h") ?? cachedTemplateValues?.tailscaleHostname ?? "ipad-air");
const tailscaleAuthKey = ref(params.get("k") ?? cachedTemplateValues?.tailscaleAuthKey ?? "");

const renderedYaml = ref("");
const renderError = ref("");
const loading = ref(false);
const copied = ref<"import" | "yaml" | null>(null);

const authContext = ref<AuthContext | null>(null);
const authContextError = ref("");

watch(
  [gatewayServer, tailscaleHostname, tailscaleAuthKey],
  ([currentGatewayServer, currentTailscaleHostname, currentTailscaleAuthKey]) => {
    saveTemplateValues({
      gatewayServer: currentGatewayServer,
      tailscaleHostname: currentTailscaleHostname,
      tailscaleAuthKey: currentTailscaleAuthKey,
    });
  },
  { immediate: true },
);

const fields = computed(() => profileFields[selectedProfile.value]);
const values = { s: gatewayServer, h: tailscaleHostname, k: tailscaleAuthKey };
const labels = { s: "Gateway server", h: "Tailscale hostname", k: "Tailscale auth key" };
const issues = computed(() => fields.value.filter(field => !values[field].value.trim()).map(field => "Enter " + labels[field] + "."));
function makeUrl(output: boolean, embedCredentials = false) {
  const url = new URL(output ? "/v2/config/" + selectedProfile.value + ".yaml" : "/v2/", location.origin);
  if (!output) url.searchParams.set("profile", selectedProfile.value);
  if (embedCredentials && authContext.value) {
    url.username = authContext.value.username;
    url.password = authContext.value.password;
  }
  for (const field of fields.value) url.searchParams.set(field, values[field].value.trim());
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
    const response = await fetch("/v2/auth-context", {
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
      <h1>Mihomo Compose</h1>
      <label class="profile-select">Profile
        <select v-model="selectedProfile"><option v-for="(_, id) in profileFields" :key="id" :value="id">{{ id }}</option></select>
      </label>
    </section>
    <section class="composer-row">
      <div class="editor-column">
        <label v-for="field in fields" :key="field" class="input-row">
          <span>{{ labels[field] }}</span><input v-model="values[field].value" :type="field === 'k' ? 'password' : 'text'" autocomplete="off" />
        </label>
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
