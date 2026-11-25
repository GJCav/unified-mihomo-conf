<script setup lang="ts">
import {
  Router,
  Server,
  Laptop,
  Tablet,
  Smartphone,
  CircleCheck,
  QrCode,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
} from "@lucide/vue";
import hljs from "highlight.js/lib/core";
import yaml from "highlight.js/lib/languages/yaml";
import QrcodeVue from "qrcode.vue";
import {
  computed,
  nextTick,
  onMounted,
  onBeforeUnmount,
  ref,
  watch,
} from "vue";
import { loadTemplateValues, saveTemplateValues } from "../template-cache";

hljs.registerLanguage("yaml", yaml);
import {
  isProfile,
  profileFields,
  type ProfileId,
} from "../../shared/profiles";
type AuthContext = { username: string; password: string };
const props = defineProps<{ auth: AuthContext; query: string }>();
const params = new URLSearchParams(props.query);
const cachedTemplateValues = loadTemplateValues();
const initial = params.get("profile") ?? "laptop";
const selectedProfile = ref<ProfileId>(isProfile(initial) ? initial : "laptop");
const gatewayServer = ref(
  params.get("s") ?? cachedTemplateValues?.gatewayServer ?? "192.168.55.1",
);
const tailscaleHostname = ref(
  params.get("h") ?? cachedTemplateValues?.tailscaleHostname ?? "ipad-air",
);
const tailscaleAuthKey = ref(
  params.get("k") ?? cachedTemplateValues?.tailscaleAuthKey ?? "",
);

const renderedYaml = ref("");
const renderError = ref("");
const loading = ref(false);
const copied = ref<"import" | "yaml" | null>(null);

const showKey = ref(false),
  showPassword = ref(false);

watch(
  [gatewayServer, tailscaleHostname, tailscaleAuthKey],
  ([
    currentGatewayServer,
    currentTailscaleHostname,
    currentTailscaleAuthKey,
  ]) => {
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
const labels = {
  s: "Gateway address",
  h: "Tailscale hostname",
  k: "Tailscale auth key",
};
const issues = computed(() =>
  fields.value
    .filter((field) => !values[field].value.trim())
    .map((field) => "Enter the " + labels[field].toLowerCase() + "."),
);
function makeUrl(output: boolean, embedCredentials = false) {
  const url = new URL(
    output ? "/v2/config/" + selectedProfile.value + ".yaml" : "/v2/",
    location.origin,
  );
  if (!output) url.searchParams.set("profile", selectedProfile.value);
  if (embedCredentials) {
    url.username = props.auth.username;
    url.password = props.auth.password;
  }
  for (const field of fields.value) {
    const value = values[field].value.trim();
    if (value && (output || field !== "k")) url.searchParams.set(field, value);
  }
  return url.toString();
}

const pageUrl = computed(() => makeUrl(false));
const importUrl = computed(() => makeUrl(true, true));
const displayUrl = computed(() => {
  if (showPassword.value) return importUrl.value;
  const url = new URL(importUrl.value);
  url.password = "••••••";
  if (url.searchParams.has("k")) url.searchParams.set("k", "••••••");
  return url.href.replaceAll("%E2%80%A2", "•");
});
const icons = {
  gateway: Router,
  server: Server,
  laptop: Laptop,
  ipad: Tablet,
  phone: Smartphone,
};
const profileIds = Object.keys(profileFields) as ProfileId[];
const emit = defineEmits<{ announce: [message: string]; expired: [] }>();
function navigate(event: KeyboardEvent) {
  const n = profileIds.indexOf(selectedProfile.value);
  const indices: Record<string, number> = {
    Home: 0,
    End: profileIds.length - 1,
    ArrowRight: n + 1,
    ArrowDown: n + 1,
    ArrowLeft: n - 1,
    ArrowUp: n - 1,
  };
  if (!Object.hasOwn(indices, event.key)) return;
  event.preventDefault();
  selectedProfile.value =
    profileIds[(indices[event.key] + profileIds.length) % profileIds.length];
  nextTick(() =>
    document.getElementById("profile-" + selectedProfile.value)?.focus(),
  );
}
onMounted(() => document.getElementById("setup-title")?.focus());
const titles = {
  gateway: "Gateway",
  server: "Server",
  laptop: "Laptop",
  ipad: "iPad",
  phone: "Phone",
};
const tags = {
  gateway: "LAN gateway · no TUN",
  server: "Proxies via Gateway",
  laptop: "TUN · native Tailscale",
  ipad: "TUN · built-in Tailscale",
  phone: "iPad setup + Tailnet DNS",
};
const hints = {
  s: "LAN IP or hostname of your Gateway's Mihomo HTTP proxy.",
  h: "Name shown for this device in your Tailnet.",
  k: "A reusable or pre-approved key from the Tailscale admin console. Included only in the Import URL and never written to the browser address bar.",
};
const placeholders = { s: "192.168.1.1", h: "my-ipad", k: "tskey-auth-…" };
const previewUrl = computed(() => makeUrl(true));
const highlightedYaml = computed(() =>
  renderedYaml.value
    ? hljs.highlight(renderedYaml.value, { language: "yaml" }).value
    : "",
);

watch(pageUrl, (url) => window.history.replaceState(null, "", url), {
  immediate: true,
});

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
  const controller = new AbortController();
  renderController = controller;
  try {
    const response = await fetch(previewUrl.value, {
      signal: renderController.signal,
    });
    if (response.status === 401) {
      emit("expired");
      throw Error("Your session expired. Open Console again to sign in.");
    }
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
    renderError.value =
      error instanceof Error ? error.message : "Unable to render configuration";
  } finally {
    if (!controller.signal.aborted) loading.value = false;
  }
}

watch(
  [previewUrl, issues],
  () => {
    renderController?.abort();
    loading.value = true;
    renderError.value = "";
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(renderConfiguration, 180);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  window.clearTimeout(renderTimer);
  renderController?.abort();
});

async function copyText(text: string, target: "import" | "yaml") {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const field = document.createElement("textarea");
      field.value = text;
      field.setAttribute("readonly", "");
      field.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(field);
      try {
        field.select();
        if (!document.execCommand("copy")) return;
      } finally {
        field.remove();
      }
    }
  } catch {
    return;
  }
  emit("announce", target === "import" ? "Import URL copied" : "YAML copied");
  copied.value = target;
  window.setTimeout(() => {
    if (copied.value === target) copied.value = null;
  }, 1400);
}
</script>

<template>
  <main>
    <section>
      <small>Console</small>
      <h2 id="setup-title" tabindex="-1">Set up a device</h2>
      <p>
        Choose a profile, fill in any required parameters, then scan the QR code
        or copy the Import URL into Mihomo.
      </p>
      <div class="profile-selector">
        <small id="profile-label">Profile</small>
        <div
          class="profiles"
          role="radiogroup"
          aria-labelledby="profile-label"
          @keydown="navigate"
        >
          <button
            v-for="(_, id) in profileFields"
            :key="id"
            :id="'profile-' + id"
            type="button"
            role="radio"
            :aria-checked="selectedProfile === id"
            :tabindex="selectedProfile === id ? 0 : -1"
            @click="selectedProfile = id"
          >
            <component :is="icons[id]" :size="20" /><strong>{{
              titles[id]
            }}</strong
            ><span>{{ tags[id] }}</span
            ><CircleCheck
              v-if="selectedProfile === id"
              class="checked"
              :size="16"
            />
          </button>
        </div>
      </div>

      <div class="composer">
        <div>
          <article>
            <h3>Parameters</h3>
            <p>Saved locally in this browser for 30 days.</p>
            <p v-if="!fields.length">
              No parameters needed—this profile is ready to import.
            </p>
            <div class="field" v-for="f in fields" :key="f">
              <label :for="f"
                >{{ labels[f] }} <code>{{ f }}</code></label
              >
              <div>
                <input
                  :id="f"
                  :type="f === 'k' && !showKey ? 'password' : 'text'"
                  autocomplete="off"
                  spellcheck="false"
                  autocapitalize="off"
                  :aria-describedby="f + '-hint'"
                  :aria-invalid="!values[f].value.trim()"
                  :placeholder="placeholders[f]"
                  v-model="values[f].value"
                /><button
                  v-if="f === 'k'"
                  @click="showKey = !showKey"
                  :aria-label="showKey ? 'Hide auth key' : 'Show auth key'"
                  :aria-pressed="showKey"
                >
                  <component :is="showKey ? EyeOff : Eye" :size="16" />
                </button>
              </div>
              <small :id="f + '-hint'">{{ hints[f] }}</small>
            </div>
            <aside v-if="issues.length" role="status">
              <strong>Missing parameters</strong>
              <ul>
                <li v-for="issue in issues" :key="issue">{{ issue }}</li>
              </ul>
            </aside>
          </article>
          <article>
            <h3>Import URL</h3>
            <p>
              Paste this URL into Mihomo or your Clash client to import the
              profile.
            </p>
            <template v-if="!issues.length"
              ><div class="url-box">
                <code class="url">{{ displayUrl }}</code>
                <div class="url-actions">
                  <button
                    :aria-pressed="showPassword"
                    @click="showPassword = !showPassword"
                    :aria-label="
                      showPassword ? 'Hide password' : 'Show password'
                    "
                  >
                    <component :is="showPassword ? EyeOff : Eye" :size="16" />
                  </button>
                  <button @click="copyText(importUrl, 'import')">
                    <component
                      :is="copied === 'import' ? Check : Copy"
                      :size="14"
                    />
                    {{ copied === "import" ? "Copied" : "Copy" }}
                  </button>
                </div>
              </div>
              <p class="warning">
                <KeyRound :size="14" /> Contains your sign-in password and
                device keys. Use only on your own devices.
              </p>
              <figure>
                <div class="qr-frame">
                  <QrcodeVue
                    :value="importUrl"
                    :size="200"
                    level="M"
                    render-as="svg"
                    :margin="0"
                    :aria-label="
                      'QR code for the ' +
                      titles[selectedProfile] +
                      ' Import URL'
                    "
                  />
                </div>
                <figcaption>
                  Scan with your camera or Mihomo app to import.
                </figcaption>
              </figure></template
            ><template v-else
              ><p>
                Fill in the required parameters to generate the Import URL.
              </p>
              <figure>
                <div class="qr-frame placeholder"><QrCode :size="32" /></div>
                <figcaption>
                  Fill in all required parameters to generate the QR code.
                </figcaption>
              </figure></template
            >
          </article>
        </div>
        <div class="yaml" :aria-busy="loading">
          <div class="yaml-head">
            <h3>Rendered YAML</h3>
            <code>{{ selectedProfile }}.yaml</code
            ><button
              :disabled="!renderedYaml || loading"
              @click="copyText(renderedYaml, 'yaml')"
            >
              {{ copied === "yaml" ? "Copied" : "Copy YAML" }}
            </button>
          </div>
          <p v-if="renderError">{{ renderError }}</p>
          <p v-else-if="issues.length">
            Fill in the required parameters to preview this profile.
          </p>
          <p v-else-if="loading && !renderedYaml">Rendering…</p>
          <pre
            v-else
            :class="{ updating: loading }"
          ><code class="hljs" v-html="highlightedYaml"></code></pre>
        </div>
      </div>
    </section>
  </main>
</template>
