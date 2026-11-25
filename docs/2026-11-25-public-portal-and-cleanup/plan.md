# Plan: Unified Mihomo Config — Public Portal, Legacy Consolidation & README

Status: approved (2026-11-25)

## Goal and background

With the repository moving to public open-source hosting, the project needs a welcoming, well-structured public face while protecting personal configuration endpoints behind HTTP Basic Authentication and tucking frozen v1 compatibility code out of the spotlight:

1. Consolidate v1 legacy code and remove the top-level `snippet/` directory tree while keeping legacy Import URLs 100% byte-compatible.
2. Audit all rule-set upstreams and enrich `public/v2/rules/stats.json` with upstream metadata, output file descriptors, and an exact generation timestamp so the UI can display the last update time in `UTC+8`.
3. Redesign `/v2/` in English as **Unified Mihomo Config**, separating an unauthenticated **Public Overview** (project architecture, rule-set groups, upstream attributions, evaluation/DNS order, and `UTC+8` update timestamp) from the Basic-Auth-protected **Console** (personal profile configuration, QR code, Import URL, and rendered YAML preview).
4. Rewrite `README.md` in English with clear narrative pacing so visitors quickly understand the system and can fork and self-host their own deployment, and add a standard root MIT `LICENSE`.

## Requirements

1. **Legacy v1 consolidation**:
   - Remove the top-level `snippet/` directory and its nested subdirectories.
   - Consolidate all frozen v1 fragments, rendering code, and golden regression tests under `server/legacy/`.
   - Keep every legacy Import URL (`/config.yaml?...`, `/?...&o=y`, arbitrary non-`/v2/` paths with `o=y`, compact and full-word parameters, `r=b`, error responses, and Basic Auth protection) byte-for-byte identical.
   - Remove stale `snippet/` references from `AGENTS.md` and `README.md`.
2. **Rule-set upstream audit & `stats.json` metadata**:
   - Catalog all rule-set groups (`tailnet`, `custom-proxy`, `custom-direct`, `direct`, `global`) and their upstream sources, licenses, and subtraction rules.
   - Emit structured metadata in `public/v2/rules/stats.json` including `generated_at` (UTC RFC3339 timestamp shared with `NOTICE`), output artifact metadata, group descriptions, rule counts, and machine-readable upstream attributions/licenses.
3. **Web UI (`/v2/`) Public & Private separation (English)**:
   - `/` (without `o=y`) redirects (`302`, dropping query parameters) to `/v2/` without requiring Basic Auth.
   - `/v2/` and its static assets load without Basic Auth, opening the **Overview** (public area) with zero unsolicited password prompts.
   - Header displays **`Unified Mihomo Config`**, a concise project introduction and `UTC+8` rule generation status underneath, and a **`Console`** action button on the right.
   - **Overview (public)** presents how static skeletons + dynamic rule-sets work, the 5 rule-set groups in priority order with counts and downloadable `/v2/rules/*` files, upstream sources and licenses per group, routing & split-DNS precedence, and the 5 device roles.
   - **Console (private)** is unlocked via HTTP Basic Auth (`GET /v2/auth-context` and `GET /v2/config/<id>.yaml`), providing profile selection (`gateway`, `server`, `laptop`, `ipad`, `phone`), parameter inputs (`s`, `h`, `k`) with 30-day local caching, Import URL copy, QR code, and syntax-highlighted YAML preview. Bookmarks to `/v2/?profile=<id>` auto-enter the console and prompt for Basic Auth.
   - Secrets (`MAIN_SUBSCRIPTION_URL`, `DOH_URL`, `TAILSCALE_CONTROL_URL`, `BASIC_AUTH_CREDENTIALS`) never appear in public endpoints or client bundles. Missing `/v2/rules/*` files return `404` (never HTML `200`).
   - Frontend workflow: Claude Opus 5.5 produces the visual style/layout guide and draft UI copy, Gemini 4 Neon refines all English copy for natural readability (`ui-spec.md`), and GPT-6.2 Astra implements the layout and components.
4. **Rewritten `README.md` (English) & root `LICENSE`**:
   - Introduce **Unified Mihomo Config** with a clear, readable progression: motivation, architecture, device profiles, routing & split-DNS rules, rule-set pipeline & upstream attributions, public vs. private routes & security model, local development, a complete **Fork & Self-Host** guide, and a low-profile legacy compatibility appendix.
   - Add standard MIT `LICENSE` (`Copyright (c) 2026 GJCav`) at repository root, while noting in `README.md` that compiled rule artifacts under `/v2/rules/` follow upstream licenses in `NOTICE` and `AGPL-3.0.txt`.

## Out of scope

- Changing the 5 v2 YAML skeletons in `profiles/*.yaml`, `shared/profiles.ts` parameter definitions, or v2 `/v2/config/<id>.yaml` output bytes.
- Changing rule-set upstream lists, routing priority, DNS servers, or legacy parameter semantics.
- Replacing HTTP Basic Auth with sessions, OAuth, or custom JS credential storage.
- Deploying to Cloudflare or pushing to `main`.

## Acceptance criteria

1. Top-level `snippet/` and `server/golden*` no longer exist; all legacy code, frozen fragments, and the 34 golden regression cases live under `server/legacy/` and pass byte-for-byte.
2. Unauthenticated `GET /` (without `o=y`) returns `302` to `/v2/`; unauthenticated `GET /v2/`, `/v2/index.html`, `/v2/assets/*`, and existing `/v2/rules/*` succeed (`200`); missing `/v2/rules/*` and `/v2/assets/*` return `404` (never HTML `200`).
3. Unauthenticated requests to `/v2/auth-context`, `/v2/config/<id>.yaml`, `/health`, `/config.yaml`, and any non-`/v2/` path with `o=y` (including `/?o=y` and `/v2?o=y`) return `401` with `WWW-Authenticate`.
4. `public/v2/rules/stats.json` includes `generated_at` (matching `NOTICE`), `upstreams`, and per-group `description`, `counts`, `files`, and `sources`; `rulesets/check-assets.mjs` validates both file presence and `stats.json` schema.
5. Opening `/v2/` renders **Unified Mihomo Config** in English without triggering Basic Auth, displaying the project overview, all 5 rule-set groups, their upstream sources/licenses, evaluation & DNS order, and the last generation timestamp formatted in `UTC+8`.
6. Clicking **Console** (or visiting `/v2/?profile=<id>`) authenticates via `/v2/auth-context`, renders the 5-profile configurator, preserves 30-day cached inputs, masks credentials in the displayed Import URL while keeping full credentials in Copy and QR code, avoids echoing `k` into the browser address bar, and previews highlighted YAML.
7. `README.md` is rewritten in English with an end-to-end Fork & Self-Host guide and preserves all project compatibility invariants; root MIT `LICENSE` is added; `AGENTS.md` has no stale `snippet/` description.
8. `go test ./...`, `go run . -mihomo <bin>`, `MIHOMO_BIN=<bin> npm test`, and `npm run build` all pass.

## Design

### 1. Legacy v1 consolidation (`server/legacy/`)

All v1 compatibility artifacts are tucked into `server/legacy/` and the nested `snippet/` directory structure is removed:

```text
server/legacy/
  README.md          Frozen v1 compatibility notice ("do not modify outputs")
  snippets.ts        All 18 frozen YAML templates inlined verbatim from snippet/**
  render.ts          Legacy planner + Mustache renderer importing ./snippets
  render.test.ts     Unit tests for compact & full-word v1 parameters
  golden.test.ts     34 byte-for-byte endpoint regression tests (moved from server/)
  golden/            Frozen .yaml and .json golden fixtures (moved from server/golden/)
```

- `snippets.ts` is generated programmatically from the exact UTF-8 contents of the 18 files in `snippet/` before `snippet/` is deleted, eliminating any risk of whitespace or newline drift.
- `golden.test.ts` adds an assertion verifying that the root `snippet/` directory does not exist.

### 2. Rule-set upstream audit & `stats.json` v2

#### Audited groups and upstreams

| Priority | Group | Excludes | Published files | Outbound & DNS | Upstreams & licenses |
| --- | --- | --- | --- | --- | --- |
| 1 | `tailnet` | — | `tailnet.domain.mrs`, `tailnet.ipcidr.mrs` | `tailscale` (iPad/Phone) or `DIRECT`; DoH (`+.tailnet` via `ts://tailscale` on Phone) | Repository `sources/tailnet.txt` (`100.88.0.0/16`, `+.tailnet`, control domain) |
| 2 | `custom-proxy` | — | `custom-proxy.domain.txt`, `custom-proxy.classical.txt` | `default`; DoH | Repository `sources/custom-proxy.txt` (hot-reloadable custom proxy overrides) |
| 3 | `custom-direct` | — | `custom-direct.domain.txt`, `custom-direct.classical.txt` | `DIRECT`; Domestic UDP (`101.6.6.6`, `223.5.5.5`, `119.29.29.29`) | Repository `sources/custom-direct.txt` (hot-reloadable custom direct overrides) |
| 4 | `direct` | `tailnet` | `direct.domain.mrs`, `direct.ipcidr.mrs`, `direct.classical.txt` | `DIRECT` (`direct-ipcidr` evaluated after `global-ipcidr`); Domestic UDP | `SukkaW/Surge` (`lan`, `apple_cn`, `direct`, `domestic`, `microsoft_cdn`; AGPL-3.0), `v2fly/domain-list-community` (`private`, `cn`, `elsevier`, `sciencedirect`, `*@cn`; MIT), `IANA Special Registries` (IPv4/IPv6 local blocks; CC0-1.0), `felixonmars/dnsmasq-china-list` (WTFPL), `gaoyifan/china-operator-ip` (`china46.txt`; MIT), repository `public-tailscale.txt` & `local-direct.txt` (`optional_if_covered`: THU IPv4/IPv6, CGNAT outside `100.88.0.0/16`, academic publishers, CN domains) |
| 5 | `global` | `tailnet`, `direct` | `global.domain.mrs`, `global.ipcidr.mrs`, `global.classical.txt` | `default` (`global-ipcidr` uses `no-resolve`); DoH | `v2fly/domain-list-community` (`anthropic`, `apple`, `category-ai-!cn`, `google`, `google-deepmind`, `google-gemini`, `openai`, `geolocation-!cn`; MIT), `SukkaW/Surge` (`ai`, `apple_services`, `telegram`, `global`; AGPL-3.0) |

Runtime `IP-ASN` classical rules use `MetaCubeX/meta-rules-dat` (`GeoLite2-ASN.mmdb` via jsDelivr), and the Go compiler builds on `liblaf/route-rules` (MIT).

#### `rulesets/rulesets.json` & `stats.json` v2 schema

Add top-level `upstreams` catalog and per-ruleset `description` + per-source `upstream` key to `rulesets/rulesets.json` (validated in `build.LoadConfig` so forkers have a single source of truth):

- `upstreams`: `sukka` (AGPL-3.0), `v2fly` (MIT), `iana` (CC0-1.0), `felixonmars` (WTFPL), `gaoyifan` (MIT), `local` (repository-maintained).
- `FetchMetadata` adds `sha256` of downloaded bytes so upstream snapshots (including `releases/latest`) are auditable.
- `main.go` computes `generatedAt := time.Now().UTC().Truncate(time.Second)` once (or reads `SOURCE_DATE_EPOCH` when set for reproducible tests) and passes `generatedAt` and optional GitHub build metadata (`GITHUB_SERVER_URL`, `GITHUB_REPOSITORY`, `GITHUB_SHA`) to both `output.Write` and `publishNotices`.
- `output.Write` writes `stats.json`:

```json
{
  "schema_version": 2,
  "generated_at": "2026-11-25T06:20:00Z",
  "build": {
    "repository": "https://github.com/<owner>/<repo>",
    "commit": "<sha>"
  },
  "priority": ["tailnet", "custom-proxy", "custom-direct", "direct", "global"],
  "fallback": "global",
  "upstreams": {
    "sukka": { "name": "SukkaW/Surge", "homepage": "https://github.com/SukkaW/Surge", "license": "AGPL-3.0" }
  },
  "license_files": ["NOTICE", "AGPL-3.0.txt"],
  "rulesets": [
    {
      "name": "direct",
      "description": "Domestic networks, private/LAN ranges, academic publishers, and local direct rules.",
      "excluded": ["tailnet"],
      "before_optimization": { "domain": 0, "classical": 0, "ipcidr": 0 },
      "after_optimization": { "domain": 0, "classical": 0, "ipcidr": 0 },
      "final": { "domain": 0, "classical": 0, "ipcidr": 0 },
      "files": [
        { "name": "direct.domain.mrs", "behavior": "domain", "format": "mrs", "count": 0, "bytes": 0, "sha256": "..." }
      ],
      "sources": [
        {
          "name": "SukkaW/Surge:direct",
          "kind": "clash",
          "upstream": "sukka",
          "input_rules": 0,
          "accepted": { "domain": 0, "classical": 0, "ipcidr": 0 },
          "ignored": {},
          "omitted_as_covered": 0,
          "fetches": [{ "url": "...", "bytes": 0, "sha256": "..." }]
        }
      ]
    }
  ]
}
```

- `rulesets/check-assets.mjs` verifies the exact 15 files in `public/v2/rules/` (12 rule files + `stats.json` + `NOTICE` + `AGPL-3.0.txt`) and validates `stats.json` (`schema_version === 2`, valid `generated_at`, matching `rulesets` and `files` lists, valid `upstream` references).
- `src/lib/time.ts` implements deterministic `formatUtc8(iso: string): string` using fixed `+08:00` epoch offset (`ms + 8 * 3600_000` formatted via `getUTC*` -> `YYYY-MM-DD HH:mm UTC+8`) plus relative age (`e.g. 3h ago`), avoiding browser ICU/timezone inconsistencies.

### 3. Worker routing & security boundary

`wrangler.jsonc`:
```jsonc
"assets": {
  "binding": "ASSETS",
  "not_found_handling": "none",
  "run_worker_first": ["/*", "!/v2/rules/*", "!/v2/assets/*"]
}
```
Static rule files and hashed frontend bundles are served directly by Cloudflare Edge without consuming the 60 req/min Worker rate limit; missing files return `404` (`not_found_handling: "none"`).

Request flow in `server/index.ts`:
1. `!isHttps(request)` -> `403 HTTPS required` (`private, no-store`).
2. `REQUEST_RATE_LIMITER.limit({ key: clientIp })` -> `429 Too Many Requests` if exceeded.
3. Define `legacy = url.pathname === "/config.yaml" || (!url.pathname.startsWith("/v2/") && url.searchParams.get("o") === "y")`.
4. **Public unauthenticated branch** (only `GET` or `HEAD`, when `!legacy` and `url.pathname !== "/health"`):
   - `url.pathname === "/"` -> `302` redirect to `/v2/` (query string dropped).
   - `url.pathname === "/v2"` -> `302` redirect to `/v2/` (preserving `url.search` so `/v2?profile=ipad` lands on `/v2/?profile=ipad`, while `/v2?o=y` already matched `legacy` above).
   - `url.pathname === "/v2/"` or `url.pathname === "/v2/index.html"` -> `env.ASSETS.fetch(request)` with security headers (`cache-control: no-cache`, `x-content-type-options: nosniff`, `referrer-policy: no-referrer`, `x-frame-options: DENY`, `content-security-policy: frame-ancestors 'none'; base-uri 'self'; object-src 'none'`).
   - `url.pathname.startsWith("/v2/assets/")` or `url.pathname.startsWith("/v2/rules/")` -> `env.ASSETS.fetch(request)` (handles local/test fallback; missing files return `404`).
   - Note: Public routes never read `env` secrets.
5. **Authenticated branch** (all other requests):
   - Validate `BASIC_AUTH_CREDENTIALS` (`500` if malformed) and `isAuthorized` (`401` with `WWW-Authenticate: Basic realm="Mihomo Compose", charset="UTF-8"` — keeping the existing realm preserves saved browser credentials).
   - `/v2/auth-context` -> JSON `{ username, password }` (`private, no-store`).
   - `/v2/sign-in` -> `302` redirect (`private, no-store`) to `/v2/?profile=<validated profile or laptop>` so the top-level sign-in fallback authenticates and returns to Console without exposing raw JSON credentials on screen.
   - `/health` -> JSON `{ ok: true }` (`private, no-store`).
   - `/v2/config/<id>.yaml` -> rendered v2 profile YAML (`private, no-store`).
   - `legacy` -> `renderConfiguration(...)` (`private, no-store`).
   - Otherwise -> `env.ASSETS.fetch(request)` (`404` under `not_found_handling: "none"`).

### 4. Web UI redesign (`/v2/`)

- **Private area name**: **`Console`** (concise, natural English; avoids literal "Private Area" or redundant "Device").
- **Aesthetic & copy pipeline**: Claude Opus 5.5 defines the visual tokens and spatial layout (`ui-spec.md`), Gemini 4 Neon polishes all draft English copy for natural, idiomatic phrasing, and GPT-6.2 Astra implements the components.
- **Aesthetic direction ("Editorial Field Manual")**:
  - Light palette: warm paper `#F5F3EC`, card surface `#FFFDF8`, primary ink `#1A1C1E`, muted `#5E6267`, hairline `#DED9CC`, accent `#2F5BEA`.
  - Automatic dark mode (`prefers-color-scheme: dark`): `#121315` canvas, `#1A1C1F` surface, `#ECEAE4` ink, `#2C3036` hairlines.
  - Semantic group accents used consistently across badges, rule bars, and ladder rows: `tailnet` indigo `#5B4FD9`, `custom-proxy` amber `#C27C0E`, `custom-direct` teal `#0E8277`, `direct` emerald `#2E8B4E`, `global` vermilion `#D0452E`.
  - System sans-serif headlines (`-0.02em` tracking) + tabular monospace (`ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace`, `font-variant-numeric: tabular-nums`) for counts, hashes, CIDRs, and timestamps. Zero external font requests.
- **Header (shared across both views)**:
  - Left: `<h1>Unified Mihomo Config</h1>`, underneath it a clear project introduction and a live monospace status line (`UTC+8` generation timestamp, group/artifact summary; amber indicator if `stats.json` is unavailable or >48h old).
  - Right: Primary button **`Console`** (with lock icon) while locked; once unlocked, a segmented switcher **`Overview` | `Console`** so the owner can move freely between public documentation and personal configuration.
- **Public view (`Overview`)**:
  1. **How It Works**: 3-step horizontal architecture strip (`1. Static Skeletons` -> `2. Edge Secret Injection` -> `3. 24h Rule-Provider Sync`).
  2. **Rule-Set Groups & Upstreams**: 5 cards in priority order driven by `/v2/rules/stats.json` (with graceful static fallback if `stats.json` hasn't been generated in local dev):
     - Group badge, description, excluded higher-priority groups,
     - Domain / IP-CIDR / Classical final counts with proportional visual bars and optimization delta,
     - Direct download chips for each published `.mrs` / `.txt` file (`/v2/rules/<file>`) with byte size,
     - Expandable **Upstream Sources** table showing source name, upstream link, parser kind, input vs. accepted rules, and license badge.
  3. **Evaluation Order & Split DNS**: Two-column reference grid:
     - **13-step Evaluation Ladder** (`RULE-SET` lines ending in `MATCH, default`), backed by `shared/rule-order.ts` and verified against all 5 `profiles/*.yaml` in tests.
     - **Split DNS Policy** table (`+.tailnet` on Phone -> `ts://tailscale`; `tailnet` & `custom-proxy` domains -> encrypted DoH; `custom-direct` & `direct` domains -> `101.6.6.6 / 223.5.5.5 / 119.29.29.29`; unmatched -> DoH; Gateway keeps native DNS).
  4. **Five Device Roles**: Compact 5-tile topology overview (`Gateway`, `Normal Server`, `Laptop`, `iPad`, `Phone`) summarizing upstream path, TUN mode, and Tailnet integration.
  5. **Upstream Attribution & Open-Source Notices**: Structured upstream directory (`SukkaW/Surge`, `v2fly/domain-list-community`, `IANA`, `felixonmars/dnsmasq-china-list`, `gaoyifan/china-operator-ip`, `MetaCubeX/meta-rules-dat`, and `liblaf/route-rules` generator credit) with direct links to `/v2/rules/NOTICE` and `/v2/rules/AGPL-3.0.txt`.
- **Private view (`Console`)**:
  - Lazy-loaded via `defineAsyncComponent` (`src/console/ConsoleView.vue`) so `highlight.js` and `qrcode.vue` stay out of the initial public bundle.
  - **Authentication flow**:
    - Plain `/v2/` never calls authenticated endpoints.
    - Clicking **`Console`** (or arriving at `/v2/?profile=<id>`) calls `GET /v2/auth-context` (`cache: "no-store"`, `credentials: "same-origin"`), triggering the browser's native Basic Auth prompt.
    - If cancelled or `401`, displays a clean non-blocking inline banner with a retry button plus a direct top-level sign-in fallback link for embedded webviews, and remains usable on `Overview`.
  - **Configurator layout**:
    - Accessible 5-card profile selector (`gateway`, `server`, `laptop`, `ipad`, `phone`) showing role metadata.
    - Parameter inputs (`s`, `h`, `k` with password reveal toggle on `k`), preserving the existing 30-day `localStorage` key (`mihomo-compose:template-values:v1`).
    - **Import URL & QR card**: Masks the Basic Auth password visually on screen (`https://user:••••••@host/...`) with a reveal toggle while copying the full authenticated URL and rendering the crisp SVG QR code immediately when inputs are valid.
    - **Rendered YAML panel**: Dark syntax-highlighted preview (`highlight.js` YAML) with Copy YAML button and loading/error states.
  - **URL hygiene**: On `Overview`, URL stays `/v2/` (no `?profile=` written). On `Console`, incoming `s`, `h`, `k` query parameters are still read for compatibility, while `history.replaceState` writes `?profile=<id>` (and `s`/`h` if non-empty, never echoing secret `k` into the address bar). Browser Back/Forward (`popstate`) switches cleanly between `Overview` and `Console`.

### 5. `README.md` rewrite (English)

Structured with clear pacing for both visitors and forkers:
1. **Unified Mihomo Config** — concise pitch and architecture highlights.
2. **Why & How It Works** — static device skeletons + Worker secret injection + daily compiled static rule-sets on Cloudflare Assets.
3. **Network Model & Device Profiles** — topology diagram and 5-profile table (`gateway`, `server`, `laptop`, `ipad`, `phone`).
4. **Routing & Split DNS** — 13-rule evaluation order, exact IP subtraction (`100.64.0.0/10` minus `100.88.0.0/16`), DNS precedence, and adding custom rules via `rulesets/sources/custom-*.txt`.
5. **Rule-Set Compiler & Upstreams** — pipeline stages, validation gates, `stats.json` v2 overview, and upstream license/attribution table.
6. **Routes & Security Model** — public vs. Basic-Auth-protected routes, rate limiting, `no-store` headers, and credential boundaries.
7. **Fork & Self-Host Guide** — step-by-step checklist: prerequisites, updating `wrangler.jsonc` (`name`, custom domain, rate-limit namespace), customizing `profiles/*.yaml` and replacing personal Tailnet/domain entries & assertions in `rulesets/`, bootstrapping the Cloudflare Worker, configuring the 7 `production` GitHub Environment secrets, enabling the daily schedule, and rollback/secret rotation.
8. **Local Development & Testing** — exact Go, `mihomo`, and Node commands.
9. **Legacy v1 Compatibility** — concise `<details>` reference documenting `server/legacy/` and frozen v1 query parameters, followed by the project's non-negotiable compatibility invariants.

### Where the two proposals differed

| Topic | Lead (Gemini 4 Carbon) | Planner (Claude Opus 5.5) | Decision and reason |
| --- | --- | --- | --- |
| Removing `snippet/` | Inline all 18 frozen YAML files into a single `server/legacy/snippets.ts` module and move `golden*` into `server/legacy/` | `git mv snippet/* server/legacy/fragments/*` keeping the 9 nested subdirectories | **Lead (`snippets.ts`) + Opus (`server/legacy/README.md` & `golden/` move)**. User explicitly asked not to keep a separate `snippet` and its nested internal structure; programmatic inlining preserves exact bytes while collapsing 18 files + 9 directories into one module. |
| Upstream metadata source | Enrich `stats.json` with `generated_at` in Go and maintain upstream metadata in UI | Put `upstreams` catalog + ruleset `description` in `rulesets.json`, validate in `LoadConfig`, emit full `stats.json` v2 (`files`, `sha256`, `build`, `upstreams`) | **Planner**. Single source of truth in `rulesets.json` makes both the UI and forks cleaner and machine-checked. |
| `UTC+8` formatting | `Intl.DateTimeFormat` with `Asia/Shanghai` | Pure arithmetic (`epochMs + 8h` + `getUTC*` -> `YYYY-MM-DD HH:mm UTC+8`) | **Planner**. Zero ICU/locale variance and trivial to unit-test across date/year rollovers. |
| Private area name | `Device Studio` | `Device Console` | **`Console`** (per user feedback: concise, clean, drops redundant "Device"). |
| QR code visibility & URL masking | Always show QR when valid | Mask password in displayed URL text; collapse QR behind "Show QR" disclosure; stop writing `k` to address bar | **Hybrid**: Adopt password masking in displayed URL text and stop writing `k` into the address bar, but keep QR code **visible by default** in `Console` since scanning QR is the primary user workflow. |
| Security headers on `/v2/` | Standard `nosniff` / cache headers | Full restrictive script/style CSP in prod + `X-Frame-Options` + `Referrer-Policy` | **Pragmatic middle ground**: Set `x-content-type-options: nosniff`, `referrer-policy: no-referrer`, `x-frame-options: DENY`, and `content-security-policy: frame-ancestors 'none'; base-uri 'self'; object-src 'none'` so framing/base-injection are blocked without risking breakage of Vue/Vite runtime styles. |

## Compatibility and migration

- **Legacy v1 Import URLs**: Unchanged (`200`/`400`/`401` status codes, headers, and YAML/JSON bytes verified by 34 golden fixtures).
- **v2 Device Import URLs (`/v2/config/<id>.yaml`)**: Unchanged. Basic Auth realm (`"Mihomo Compose"`) and 30-day `localStorage` key (`mihomo-compose:template-values:v1`) remain unchanged so saved browser credentials and cached template inputs keep working.
- **Public routes**: `/`, `/v2`, `/v2/`, `/v2/index.html`, and `/v2/assets/*` become publicly readable (`GET`/`HEAD`) without Basic Auth; `/v2/rules/*` remains public.
- **Bookmarks**: `/v2/?profile=<id>` continues to open `Console` for that profile and prompts for Basic Auth.
- **`stats.json`**: Upgraded to schema v2 object (only consumed by this Web UI and human inspection; Mihomo clients only fetch `.mrs`/`.txt` rule files).
- **Rollback**: Rolling back the Cloudflare Worker version atomically restores Worker routing, static UI assets, and rule files together.

## Affected files

- **Delete / Move**:
  - Remove `snippet/**` (inlined into `server/legacy/snippets.ts`)
  - Move `server/golden/**` -> `server/legacy/golden/**`
  - Move `server/golden.test.ts` -> `server/legacy/golden.test.ts`
- **Create**:
  - `LICENSE` (MIT License at repository root)
  - `server/legacy/snippets.ts`, `server/legacy/README.md`
  - `shared/rule-order.ts`
  - `src/lib/time.ts`, `src/lib/time.test.ts`
  - `src/lib/stats.ts`, `src/lib/stats.test.ts`
  - `src/lib/auth.ts`, `src/lib/auth.test.ts`
  - `src/overview/*.vue` (Overview sections: hero/pipeline, rule groups & upstream drawer, evaluation ladder & DNS table, device roles, upstream attributions)
  - `src/console/ConsoleView.vue`
  - `docs/2026-11-25-public-portal-and-cleanup/ui-spec.md` (Opus visual/layout guide + Neon-polished copy)
- **Modify**:
  - `server/legacy/render.ts`
  - `server/index.ts`, `server/index.test.ts`, `server/profile.test.ts`, `wrangler.jsonc`
  - `rulesets/rulesets.json`, `rulesets/main.go`, `rulesets/main_test.go`, `rulesets/internal/build/{config,config_test,build,build_test,source,source_test}.go`, `rulesets/internal/output/{write,write_test}.go`, `rulesets/check-assets.mjs`
  - `v2/index.html`, `src/App.vue`, `src/style.css`
  - `README.md`, `AGENTS.md`, `docs/README.md`

## Steps

1. **Consolidate v1 legacy code**: Programmatically generate `server/legacy/snippets.ts` from `snippet/**`, update `server/legacy/render.ts`, move `golden/` and `golden.test.ts` into `server/legacy/`, delete `snippet/`, add `server/legacy/README.md` and no-`snippet/` assertion, and verify `npm test`.
2. **Upgrade rule-set metadata & `stats.json` v2**: Add `upstreams` and `description` to `rulesets/rulesets.json` and `build.LoadConfig`, record `sha256` in `FetchMetadata`, pass unified `generatedAt` (`SOURCE_DATE_EPOCH`-aware) and GitHub build info from `main.go` to `output.Write` and `publishNotices`, emit `stats.json` v2 with `files`, update Go tests and `rulesets/check-assets.mjs`, and regenerate `public/v2/rules/` with `mihomo`.
3. **Update Worker routing & shared rule order**: Update `wrangler.jsonc` (`!/v2/assets/*`) and `server/index.ts` public/private routing + security headers; add `shared/rule-order.ts` verified against all 5 `profiles/*.yaml`; expand `server/index.test.ts` route-matrix tests (including throwing secret-getter tests on public routes).
4. **Build frontend libraries & redesigned Web UI (`ui-spec.md`)**: Implement and unit-test `src/lib/{time,stats,auth}.ts`; follow `docs/2026-11-25-public-portal-and-cleanup/ui-spec.md` (Opus visual/layout guide + Neon-polished English copy) to build the `Overview` components and lazy-loaded `ConsoleView.vue` inside `src/App.vue` + `src/style.css` + `v2/index.html`.
5. **Rewrite `README.md`, add `LICENSE`, & sync docs**: Add root MIT `LICENSE`; rewrite `README.md` in English with the Fork & Self-Host guide, license note, and collapsed legacy section; update stale `snippet/` description in `AGENTS.md` and status in `docs/README.md`.
6. **Full verification**: Run `go test ./...`, `go run . -mihomo <bin>`, `MIHOMO_BIN=<bin> npm test`, and `npm run build`, recording commands and outcomes in `dev-log.md` and `test-log.md`.

## Test plan

- **Legacy regression**: `server/legacy/golden.test.ts` (34 golden endpoints byte-for-byte + `snippet/` absence check) and `server/legacy/render.test.ts`.
- **Go compiler & assets**: `go test ./...` covering `upstreams`/`description` validation, `SOURCE_DATE_EPOCH`, `stats.json` v2 output, `sha256` & `files` accuracy, and synchronized `NOTICE` timestamp; live/local `go run . -mihomo <bin>` + `node rulesets/check-assets.mjs` positive/negative checks.
- **Worker security & routing**: `server/index.test.ts` matrix testing HTTP->`403`, rate-limit->`429`, unauthenticated public routes (`200`/`302`/`404`) with inaccessible secrets, and `401` on all private/legacy routes (`/v2/auth-context`, `/v2/config/*`, `/health`, `/config.yaml`, `/?o=y`, `/v2?o=y`, `/nested?o=y`, `POST /v2/`).
- **Profile & rule-order consistency**: `server/profile.test.ts` verifying all 5 skeletons pass `mihomo -t` and match `shared/rule-order.ts`.
- **Frontend unit & build checks**: Vitest suites for `formatUtc8` (midnight/year rollover), `stats.json` parsing/fallback, `auth.ts` `200`/`401`/error handling, `template-cache.test.ts`, and `npm run build` (`vue-tsc --noEmit && vite build`).

## Risks

- **Accidental byte change in legacy YAML**: Mitigated by programmatic generation of `server/legacy/snippets.ts` and the 34 byte-exact golden tests.
- **Embedded webviews suppressing fetch-triggered Basic Auth dialogs**: Mitigated by providing a direct top-level sign-in fallback link in the error banner when `fetch("/v2/auth-context")` returns `401`.
- **Forkers keeping personal assertions (`gjm20.top`, `100.88.0.0/16`) and failing CI**: Mitigated by an explicit step in the `README.md` Fork & Self-Host checklist calling out `rulesets/rulesets.json` assertions and `rulesets/sources/tailnet.txt`.

## Open questions

None (resolved 2026-11-25: private area named `Console`; add root MIT `LICENSE`).

## Plan changes

- 2026-11-25: Approved with private area renamed to `Console`, root MIT `LICENSE` included, and Opus visual/layout guide + Neon copy-polish step recorded in `ui-spec.md` prior to Astra implementation.
- 2026-11-25: Corrected total asset count wording in Section 2 from 14 to 15 files (12 rule files + `stats.json` + `NOTICE` + `AGPL-3.0.txt`), matching `rulesets/check-assets.mjs`.
- 2026-11-25: Added authenticated `GET /v2/sign-in` redirect endpoint (Review R1) so top-level fallback sign-in returns to Console instead of displaying `/v2/auth-context` JSON.
- 2026-11-25: Follow-up after live user preview:
  1. Prevent unsolicited Basic Auth prompts when opening `/v2/`: handle `/favicon.ico` (plus inline SVG favicon in `v2/index.html`) without requiring Basic Auth, and allow Vite dev-server module paths (`/@*`, `/src/*`, `/shared/*`, `/node_modules/*`, `/rulesets/rulesets.json*`) when `import.meta.env.DEV` is true so `npm run dev` also loads `/v2/` with zero `401` subrequests.
  2. Enrich Overview Section `01 · How it works` with a static, self-contained annotated `laptop` YAML skeleton showcase (designed by Opus, copy-polished by Neon, implemented by Astra) visually distinguishing: (a) static profile structure in Git, (b) private secrets & Console-protected Import URL injected under Basic Auth, and (c) daily compiled public `rule-providers` refreshed automatically by Mihomo every 24 hours without re-importing the profile. Decoupled from `profiles/laptop.yaml` so future edits to `laptop.yaml` do not affect the Overview example.
