<script setup lang="ts">
import {
  computed,
  nextTick,
  watch,
  defineAsyncComponent,
  onMounted,
  onBeforeUnmount,
  ref,
  shallowRef,
} from "vue";
import { isProfile } from "../shared/profiles";
import { Lock } from "@lucide/vue";
import Overview from "./overview/Overview.vue";
import { requestAuthContext, type Credentials } from "./lib/auth";
import { parseStats, type Stats } from "./lib/stats";
import { formatUtc8, relativeAge } from "./lib/time";

const ConsoleView = defineAsyncComponent(
  () => import("./console/ConsoleView.vue"),
);
const auth = shallowRef<Credentials>();
const stats = shallowRef<Stats>();
const checking = ref(true),
  waiting = ref(false),
  consoleOpen = ref(false),
  error = ref("");
const announcement = ref("");
const query = ref(""),
  revision = ref(0);
const signInUrl = computed(() => {
  const profile = new URLSearchParams(query.value).get("profile") ?? "";
  return isProfile(profile) ? "/v2/sign-in?profile=" + profile : "/v2/sign-in";
});
let attempt = 0;
function readAddress() {
  const params = new URLSearchParams(location.search);
  query.value = params.toString();
  revision.value++;
  const bookmark = params.has("profile");
  params.delete("k");
  history.replaceState(null, "", bookmark ? "/v2/?" + params : "/v2/");
  if (bookmark) void openConsole(false);
  else {
    attempt++;
    waiting.value = false;
    consoleOpen.value = false;
    error.value = "";
  }
}
async function openConsole(push = true) {
  const current = ++attempt;
  auth.value = undefined;
  consoleOpen.value = false;
  waiting.value = true;
  error.value = "";
  try {
    const credentials = await requestAuthContext();
    if (current !== attempt) return;
    auth.value = credentials;
    if (push) history.pushState(null, "", "/v2/");
    consoleOpen.value = true;
    announcement.value = "Signed in. Console unlocked.";
  } catch (e) {
    if (current === attempt) {
      announcement.value = "Couldn't open Console.";
      error.value =
        e instanceof Error && e.message === "cancelled" ? "cancelled" : "error";
      history.replaceState(null, "", "/v2/");
    }
  } finally {
    if (current === attempt) waiting.value = false;
  }
}
function sessionExpired() {
  query.value = location.search;
  auth.value = undefined;
  consoleOpen.value = false;
  error.value = "cancelled";
  history.replaceState(null, "", "/v2/");
}
function overview() {
  if (!consoleOpen.value) return;
  query.value = "";
  history.pushState(null, "", "/v2/");
  consoleOpen.value = false;
}
watch(
  consoleOpen,
  async (open, wasOpen) => {
    document.title = open
      ? "Console · Unified Mihomo Config"
      : "Unified Mihomo Config";
    if (!open && wasOpen) {
      await nextTick();
      document.getElementById("how")?.focus();
    }
  },
  { immediate: true },
);
onMounted(async () => {
  readAddress();
  window.addEventListener("popstate", readAddress);
  try {
    const r = await fetch("/v2/rules/stats.json");
    if (r.ok) stats.value = parseStats(await r.json());
  } catch {
    /* The Overview uses its built-in summary when the build is unavailable. */
  } finally {
    checking.value = false;
  }
});
onBeforeUnmount(() => window.removeEventListener("popstate", readAddress));
const status = computed(() => {
  const s = stats.value;
  if (!s)
    return checking.value
      ? "Checking rule status…"
      : "Rule status unavailable · showing built-in summary";
  const stale = Date.now() - Date.parse(s.generated_at) > 48 * 3600000;
  return `Rules built ${formatUtc8(s.generated_at)} · ${relativeAge(s.generated_at)}${stale ? " (stale)" : ""} · ${s.priority.length} groups · ${s.rulesets.reduce((n, g) => n + g.files.length, 0)} files`;
});
</script>
<template>
  <header>
    <div class="container header">
      <div>
        <h1>Unified Mihomo Config</h1>
        <p>
          Static Mihomo profiles for every device, with open-source routing
          rules compiled daily and served from Cloudflare Workers.
        </p>
        <small
          role="status"
          :class="{ fresh: stats && !status.includes('stale') }"
          >{{ status }}</small
        >
      </div>
      <nav aria-label="View">
        <button
          v-if="auth"
          @click="overview"
          :aria-current="!consoleOpen ? 'page' : undefined"
        >
          Overview</button
        ><button
          class="action"
          :aria-current="consoleOpen ? 'page' : undefined"
          @click="openConsole()"
          :disabled="waiting || consoleOpen"
          :aria-label="auth ? 'Console' : 'Open Console (sign-in required)'"
        >
          <Lock v-if="!auth" :size="16" />{{
            waiting ? "Signing in…" : "Console"
          }}
        </button>
      </nav>
    </div>
  </header>
  <div class="container">
    <aside v-if="error" role="status">
      <strong>Couldn't open Console</strong>
      <p>
        {{
          error === "cancelled"
            ? "Sign-in was cancelled or the credentials were rejected. You can still browse the Overview."
            : "Couldn't reach the server. Check your connection and try again."
        }}
      </p>
      <button @click="openConsole()">Try again</button>
      <a
        :href="signInUrl"
        title="Use this if the sign-in prompt doesn't appear (for example, in an in-app browser)."
        >Open sign-in page</a
      >
      <button aria-label="Dismiss" @click="error = ''">×</button>
    </aside>
    <main v-if="waiting" aria-busy="true">
      <section>
        <small>Console</small>
        <h2>Set up a device</h2>
        <p>Opening Console…</p>
        <div class="skeleton"></div>
      </section>
    </main>
    <ConsoleView
      @announce="announcement = $event"
      @expired="sessionExpired"
      v-else-if="consoleOpen && auth"
      :key="revision"
      :auth="auth"
      :query="query"
    /><Overview v-else :stats="stats" :checking="checking" />
  </div>
  <footer>
    <div class="container">
      Project code is MIT-licensed. Compiled rule files follow their upstream
      licenses; see <a href="/v2/rules/NOTICE">NOTICE</a>.
      <div v-if="stats">
        <code
          >{{
            stats.build
              ? "Build " + stats.build.commit.slice(0, 7) + " · "
              : ""
          }}Rules built {{ formatUtc8(stats.generated_at) }}</code
        >
      </div>
    </div>
  </footer>
  <div class="sr-only" aria-live="polite">{{ announcement }}</div>
</template>
