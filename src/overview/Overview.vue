<script setup lang="ts">
import { computed } from "vue";
import {
  Download,
  ChevronRight,
  Router,
  Server,
  Laptop,
  Tablet,
  Smartphone,
  FileText,
  Scale,
  GitBranch,
} from "@lucide/vue";
import {
  summary,
  upstreams,
  behaviors,
  type Group,
  type Stats,
} from "../lib/stats";
import { evaluationOrder } from "../../shared/rule-order";
const props = defineProps<{ stats?: Stats; checking: boolean }>();
const groups = computed<Group[]>(() => props.stats?.rulesets ?? summary);
const catalog = computed(() => props.stats?.upstreams ?? upstreams);
const routes: Record<string, string> = {
  tailnet: "tailscale (iPad, Phone) or DIRECT",
  "custom-proxy": "default",
  "custom-direct": "DIRECT",
  direct: "DIRECT",
  global: "default",
};
const steps = [
  {
    zone: "static",
    title: "Static skeleton",
    tag: "Public · in Git",
    body: "Ports, TUN, proxy groups, and rule evaluation order. Each of the five device roles has its own template, validated with mihomo -t before deploy. Because the skeleton rarely changes, you only import it once.",
    artifact: "profiles/{role}.yaml",
  },
  {
    zone: "secret",
    title: "Secrets injected at the edge",
    tag: "Private · Console only",
    body: "Your subscription URL and DoH endpoint live in Worker secrets, never in Git. The Import URL and QR code appear only in the password-protected Console, and the Worker injects those secrets whenever a device fetches its profile—along with per-device parameters for Server, iPad, and Phone.",
    artifact: "GET /v2/config/{role}.yaml · sign-in required",
  },
  {
    zone: "rules",
    title: "Auto-updating rules",
    tag: "Public · refreshed every 24h",
    body: "Rule providers point to public files hosted on this site. A daily build compiles them from open-source lists, and Mihomo pulls fresh copies every 24 hours—so rule changes never require re-importing the profile.",
    artifact: "/v2/rules/*.mrs, *.txt · every 24h",
  },
] as const;
type Zone = (typeof steps)[number]["zone"];
const excerpt: [Zone, string][] = [
  ["static", "mixed-port: 7890"],
  ["static", "mode: rule"],
  ["static", "# … LAN access, controller, logging, geo settings"],
  ["static", ""],
  ["static", "dns:"],
  ["secret", '  nameserver: ["{{{doh_url}}}"]'],
  ["static", "  nameserver-policy:"],
  [
    "secret",
    "    'rule-set:tailnet-domain,custom-proxy-domain': \"{{{doh_url}}}\"",
  ],
  [
    "static",
    "    'rule-set:custom-direct-domain,direct-domain': [101.6.6.6, …]",
  ],
  ["static", ""],
  ["static", "tun:"],
  ["static", "  enable: true"],
  ["static", "  route-exclude-address:"],
  ["static", "    - 100.88.0.0/16  # Leave Tailnet routes to native Tailscale"],
  ["static", ""],
  ["static", "proxy-providers:"],
  ["static", "  main-subscription:"],
  ["static", "    type: http"],
  ["secret", '    url: "{{{subscription}}}"'],
  ["static", "    interval: 3600"],
  ["static", ""],
  ["static", "proxy-groups:"],
  ["static", "  - name: default"],
  ["static", "    type: select"],
  ["static", "    use: [main-subscription]"],
  ["static", ""],
  ["rules", "rule-providers:"],
  ["rules", "  tailnet-domain:"],
  ["rules", "    type: http"],
  ["rules", "    behavior: domain"],
  ["rules", "    format: mrs"],
  ["rules", '    url: "{{{public_base_url}}}/v2/rules/tailnet.domain.mrs"'],
  ["rules", "    proxy: DIRECT"],
  ["rules", "    interval: 86400"],
  ["rules", "  # … 11 more: tailnet-ipcidr, custom-*, direct-*, global-*"],
  ["static", ""],
  ["static", "rules:"],
  ["static", "  - RULE-SET,tailnet-domain,DIRECT"],
  ["static", "  - RULE-SET,tailnet-ipcidr,DIRECT,no-resolve"],
  ["static", "  # … 9 more, in priority order"],
  ["static", "  - RULE-SET,direct-ipcidr,DIRECT"],
  ["static", "  - MATCH,default"],
];
const annotatedLines = excerpt.map(([zone, text], index) => ({
  zone,
  marker:
    excerpt.findIndex(([z]) => z === zone) === index
      ? steps.findIndex((step) => step.zone === zone) + 1
      : undefined,
  tokens: text
    .split(
      /(\{\{\{(?:doh_url|subscription|public_base_url)\}\}\}|#.*|\b86400\b)/,
    )
    .filter(Boolean),
}));
const anatomyCaption =
  "Abridged illustration of the Laptop profile; the live file may differ. Markers 1–3 correspond to the steps. Highlighted {{{…}}} placeholders are secrets injected by the Worker, while public_base_url is simply this site's public URL.";
const roles = [
  [
    "Gateway",
    "Serves the LAN and connects directly to the proxy subscription. The only profile without TUN.",
  ],
  [
    "Server",
    "Uses TUN and routes proxied traffic through the Gateway. Native Tailscale handles the Tailnet.",
  ],
  [
    "Laptop",
    "Uses TUN and connects directly to the proxy subscription. Native Tailscale handles the Tailnet.",
  ],
  [
    "iPad",
    "Uses TUN and Mihomo's built-in Tailscale proxy for Tailnet traffic.",
  ],
  ["Phone", "Same as iPad, plus Tailnet DNS via ts://tailscale."],
];
const roleIcons = [Router, Server, Laptop, Tablet, Smartphone];
const dns = [
  ["+.tailnet (Phone only)", "ts://tailscale"],
  ["tailnet and custom-proxy domains", "Encrypted DoH"],
  ["custom-direct and direct domains", "101.6.6.6 / 223.5.5.5 / 119.29.29.29"],
  ["Everything else", "Encrypted DoH"],
  ["Bootstrap (DoH hostname)", "101.6.6.6 / 223.5.5.5 / 119.29.29.29"],
];
const uses: Record<string, string> = {
  sukka: "China, LAN, Apple CN, AI, Apple, Telegram, and global lists",
  v2fly:
    "Domain categories for CN, private, AI, Apple, Google, and non-CN sites",
  iana: "Special-purpose IPv4 and IPv6 address blocks",
  felixonmars: "Mainland China domain list",
  gaoyifan: "Mainland China IPv4 and IPv6 ranges",
  local: "Tailnet, custom, and local direct rules",
};
function size(n: number) {
  return n < 1024
    ? n + " B"
    : n < 1048576
      ? (n / 1024).toFixed(1) + " KB"
      : (n / 1048576).toFixed(2) + " MB";
}
function total(counts: Record<string, number>) {
  return Object.values(counts).reduce((a, b) => a + b, 0);
}
</script>
<template>
  <main>
    <section aria-labelledby="how">
      <small>01 · How it works</small>
      <h2 id="how" tabindex="-1">Three parts, one Import URL</h2>
      <p>
        Import a single URL per device. Using the Laptop profile as an example,
        here's what's public, what stays private, and what refreshes
        automatically.
      </p>
      <div class="how-grid">
        <ol class="steps">
          <li
            v-for="(step, i) in steps"
            :key="step.zone"
            :data-zone="step.zone"
          >
            <small>0{{ i + 1 }}</small>
            <h3>{{ step.title }}</h3>
            <span class="zone-tag">{{ step.tag }}</span>
            <p>{{ step.body }}</p>
            <code>{{ step.artifact }}</code>
          </li>
        </ol>
        <figure class="anatomy">
          <div class="anatomy-card">
            <div class="anatomy-head">
              <code>profiles/laptop.yaml</code><span>Abridged</span>
            </div>
            <pre
              tabindex="0"
              aria-label="Abridged laptop.yaml annotated by step: 1 static skeleton, 2 private secrets, 3 auto-updating rule providers."
            ><code><span v-for="(line,i) in annotatedLines" :key="i" class="ln" :data-zone="line.zone" :data-marker="line.marker"><template v-for="(token,j) in line.tokens" :key="j"><mark v-if="token==='{{{doh_url}}}' || token==='{{{subscription}}}'" v-text="token"></mark><span v-else :class="{muted:token.startsWith('#') || token==='{{{public_base_url}}}', interval:line.zone==='rules' && token==='86400'}" v-text="token"></span></template></span></code></pre>
          </div>
          <figcaption>{{ anatomyCaption }}</figcaption>
        </figure>
      </div>
    </section>
    <section aria-labelledby="groups">
      <small>02 · Rule sets</small>
      <h2 id="groups" tabindex="-1">Rule-set groups</h2>
      <p>
        Traffic is matched against five groups in priority order. Rules covered
        by a higher-priority group are stripped from lower ones.
      </p>
      <aside v-if="!checking && !stats">
        <strong>Live stats unavailable</strong>
        <p>
          Couldn't load stats.json, so a built-in summary is shown instead. Rule
          files can still be downloaded.
        </p>
      </aside>
      <nav aria-label="Priority order">
        <a
          v-for="(g, index) in groups"
          :key="g.name"
          :href="'#' + g.name"
          :data-group="g.name"
          class="chip"
          >{{ index + 1 }} {{ g.name }}</a
        >
      </nav>
      <article
        v-for="(g, index) in groups"
        :id="g.name"
        :key="g.name"
        class="group"
        :data-group="g.name"
      >
        <div>
          <h3>
            <small>{{ index + 1 }}</small> {{ g.name }}
          </h3>
          <p>{{ g.description }}</p>
          <small>Excludes</small> {{ g.excluded.join(", ") || "—" }}<br /><small
            >Routes to</small
          >
          {{ routes[g.name] }}
        </div>
        <div>
          <small>Rules</small
          ><template v-if="g.final"
            ><div v-for="b in behaviors" :key="b" class="count">
              <code>{{ b }}</code
              ><meter
                :value="g.final[b]"
                :max="Math.max(1, ...Object.values(g.final))"
              /><code>{{ g.final[b].toLocaleString("en-US") }}</code>
            </div>
            <small
              v-if="
                g.before_optimization &&
                total(g.before_optimization) !== total(g.final)
              "
              >Reduced {{ total(g.before_optimization) }} →
              {{ total(g.final) }} (−{{
                Math.round(
                  100 *
                    (1 -
                      total(g.final) /
                        Math.max(1, total(g.before_optimization))),
                )
              }}%)</small
            ></template
          >
          <p v-else>Counts unavailable.</p>
        </div>
        <div>
          <small>Files</small
          ><a
            class="file"
            v-for="f in g.files"
            :key="f.name"
            :href="'/v2/rules/' + f.name"
            download
            :aria-label="
              'Download ' +
              f.name +
              (f.bytes === undefined ? '' : ' (' + size(f.bytes) + ')')
            "
            ><Download :size="13" /><span>{{ f.name }}</span>
            <span v-if="f.bytes !== undefined">{{ size(f.bytes) }}</span></a
          >
        </div>
        <details>
          <summary>
            <ChevronRight :size="16" /> Upstream sources ({{
              g.sources.length
            }})
            <span class="licenses"
              ><span
                v-for="license in new Set(
                  g.sources.map((s) => catalog[s.upstream!].license),
                )"
                :key="license"
                >{{ license }}</span
              ></span
            >
          </summary>
          <div class="scroll">
            <table>
              <thead>
                <tr>
                  <th
                    v-for="h in stats
                      ? [
                          'Source',
                          'Upstream',
                          'Parser',
                          'Input',
                          'Accepted',
                          'License',
                        ]
                      : ['Source', 'Upstream', 'License']"
                    :key="h"
                  >
                    {{ h }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in g.sources" :key="s.name">
                  <td>{{ s.name }}</td>
                  <td>
                    <a
                      v-if="s.upstream !== 'local'"
                      :href="catalog[s.upstream!].homepage"
                      >{{ catalog[s.upstream!].name }}</a
                    ><template v-else>This repository</template>
                  </td>
                  <td v-if="stats">{{ s.kind }}</td>
                  <td v-if="stats">{{ s.input_rules ?? "—" }}</td>
                  <td v-if="stats">
                    {{ s.accepted ? total(s.accepted) : "—" }}
                    <small v-if="s.omitted_as_covered"
                      >−{{ s.omitted_as_covered }} already covered</small
                    >
                  </td>
                  <td>{{ catalog[s.upstream!].license }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
      </article>
    </section>
    <section aria-labelledby="routing">
      <small>03 · Routing</small>
      <h2 id="routing" tabindex="-1">How traffic is routed</h2>
      <p>
        All five profiles share the same rule order; only the Tailnet target and
        a few DNS settings vary by device.
      </p>
      <div class="routing">
        <div>
          <h3>Evaluation order</h3>
          <p>
            Mihomo evaluates rules top to bottom and stops at the first match.
          </p>
          <ol class="ladder">
            <li
              v-for="(r, i) in evaluationOrder('tailscale / DIRECT')"
              :key="r"
              :data-group="groups.find((g) => r.startsWith(g.name + '-'))?.name"
            >
              <small>{{ String(i + 1).padStart(2, "0") }}</small
              ><i></i
              ><code :title="r"
                >{{ r.split(",")[0] }}
                <small>{{ r.split(",")[2] }}</small></code
              ><code
                :title="
                  i < 2
                    ? 'tailscale on iPad and Phone; DIRECT elsewhere'
                    : undefined
                "
                >{{ r.split(",")[1] }}</code
              >
            </li>
          </ol>
          <p>
            Domain and classical rules run before IP ranges, so most connections
            match without a DNS lookup.
          </p>
          <p>
            Global IP ranges run first with no-resolve to avoid unnecessary DNS
            lookups. Direct IP ranges follow and intentionally resolve remaining
            domains (similar to GEOIP,CN).
          </p>
        </div>
        <div>
          <h3>Split DNS</h3>
          <p>
            DNS queries follow the same rule groups so direct and proxied
            domains use their respective resolvers.
          </p>
          <table>
            <thead>
              <tr>
                <th>Matches</th>
                <th>Resolver</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="[m, r] in dns" :key="m">
                <td>{{ m }}</td>
                <td>
                  <code
                    v-for="item in r.split(' / ')"
                    :key="item"
                    class="resolver"
                    >{{ item }}</code
                  >
                </td>
              </tr>
            </tbody>
          </table>
          <p>
            Gateway keeps its native DNS setup and doesn't use these split-DNS
            policies.
          </p>
          <h3>Device roles</h3>
          <p>
            Each role has a dedicated profile tailored to its network setup.
          </p>
          <div v-for="([name, desc], i) in roles" :key="name" class="role">
            <component :is="roleIcons[i]" :size="18" /><strong
              >{{ name }}
              <code v-if="i === 1 || i > 2">{{
                i === 1 ? "s" : "h · k"
              }}</code></strong
            >
            <p>{{ desc }}</p>
          </div>
        </div>
      </div>
    </section>
    <section aria-labelledby="credits">
      <small>04 · Credits</small>
      <h2 id="credits" tabindex="-1">Upstream sources and licenses</h2>
      <p>
        Rule sets are compiled from these open-source projects. Generated files
        retain their upstream licenses.
      </p>
      <table>
        <thead>
          <tr>
            <th>Project</th>
            <th>Used for</th>
            <th>License</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="id in Object.keys(upstreams)" :key="id">
            <td>
              <a :href="catalog[id].homepage">{{ catalog[id].name }}</a>
            </td>
            <td>{{ uses[id] }}</td>
            <td>{{ catalog[id].license }}</td>
          </tr>
          <tr>
            <td>
              <a href="https://github.com/MetaCubeX/meta-rules-dat"
                >MetaCubeX/meta-rules-dat</a
              >
            </td>
            <td>
              ASN database for IP-ASN rules (fetched by devices at runtime)
            </td>
            <td>GeoLite2</td>
          </tr>
          <tr>
            <td>
              <a href="https://github.com/liblaf/route-rules"
                >liblaf/route-rules</a
              >
            </td>
            <td>Original rule compiler, adapted for this build</td>
            <td>MIT</td>
          </tr>
        </tbody>
      </table>
      <nav>
        <a href="/v2/rules/NOTICE"><FileText :size="14" /> Read NOTICE</a
        ><a href="/v2/rules/AGPL-3.0.txt"
          ><Scale :size="14" /> AGPL-3.0 license</a
        ><a v-if="stats?.build" :href="stats.build.repository"
          ><GitBranch :size="14" /> Source on GitHub</a
        >
      </nav>
    </section>
  </main>
</template>
