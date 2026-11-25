# Development log: Unified Mihomo Config — Public Portal, Legacy Consolidation & README

## Entries

## Review decisions

Written by the lead.

### Round 1, 2026-11-25

Reviewer: independent GPT-6.2 Astra agent (`R1`–`R4`); `L1` noted by Lead during inspection.

| # | Finding | Severity | Decision (fix now / defer / reject) | Reason | Result |
| --- | --- | --- | --- | --- | --- |
| R1 | Fallback "Open sign-in page" link (`src/App.vue:159`) navigates top-level to `/v2/auth-context`, leaving the user on raw JSON displaying their username and password in plaintext | Medium | fix now | Real credential-exposure UX hazard on fallback sign-in; trivial to add authenticated `GET /v2/sign-in` redirecting (`302`, `private, no-store`) to `/v2/?profile=<profile or laptop>` | Fixed: added authenticated `GET`/`HEAD /v2/sign-in` redirect in `server/index.ts`, updated `src/App.vue` & `README.md`, verified in `server/index.test.ts` |
| R2 | Reopening Console (`src/App.vue:51`) reuses cached `auth.value` instead of re-fetching `/v2/auth-context`, producing stale Import URL / QR credentials after a password rotation | Medium | fix now | Direct correctness bug in credential lifecycle; always awaiting `requestAuthContext()` on Console entry is cheap and keeps credentials fresh | Fixed: `openConsole` clears `auth.value` and fetches fresh credentials on every entry; covered by `happy-dom` rotation & rejected re-entry tests in `src/App.test.ts` |
| R3 | `parseStats` (`src/lib/stats.ts:123`) accepts remote sources without `fetches` (`url`, `bytes`, `sha256`), weakening upstream snapshot auditability | Medium | fix now | Enforces the promised schema-v2 audit guarantee for non-`*-file` sources | Fixed: `parseStats` requires valid HTTPS URL, positive byte count, and 64-hex SHA-256 on all non-`*-file` sources; verified in `src/lib/stats.test.ts` and `check-assets.mjs` |
| R4 | Pre-existing `copyText` (`src/console/ConsoleView.vue:228`) announces "Copied" even when `execCommand("copy")` returns `false` or Clipboard API rejects | Low | fix now | Tiny safeguard while touching `ConsoleView.vue` | Fixed: `copyText` guards Clipboard API & `execCommand("copy")` success before announcing |
| L1 | `document.title` in `src/App.vue:82` sets `"Overview · Unified Mihomo Config"` instead of `"Unified Mihomo Config"` on Overview (`ui-spec.md` Part 2) | Low | fix now | 1-line conformance fix while editing `src/App.vue` | Fixed: `document.title` uses `"Unified Mihomo Config"` on Overview and `"Console · Unified Mihomo Config"` on Console |

### Step 1 — Frozen legacy renderer
Generated 18 exported strings directly from the original UTF-8 bytes, moved fixtures and regression tests under server/legacy, and removed the old fragment tree. Both legacy test suites passed. Full-suite verification exposed a pre-existing toolchain mismatch. The designated local Mihomo v1.19.22 rejects the Tailscale proxy in the unchanged mobile skeletons. CI pins v1.19.34. The approved plan also specifies 14 published files while its artifact list contains 15.

### Step 2
Added per-source attribution, upstream catalog, build time and revision, fetch and artifact SHA-256 hashes, and synchronized NOTICE metadata. Generated all 15 assets and checked them against their descriptors. The application and build checker share the stats parser.

### Step 3
Separated public reads from credential checks after HTTPS and rate limiting. Canonicalized both public HTML paths to the directory index for the asset binding. Shared the evaluation order between profile tests and the portal.

### Step 4
Implemented the public Overview and lazy-loaded Console with the specified light and dark palette, source disclosures, routing ladder, DNS and device roles, responsive profile cards, keyboard selection, local template cache, and immediate QR preview. The displayed URL masks both the password and device key. Copy and QR use the full URL. Browser history omits the key. Added unit coverage for time, metadata parsing, static fallback and authentication.

### Step 5
Added the root MIT license and rewrote the English README with the architecture, route and license boundaries, upstream groups, fork setup and a collapsed legacy reference. Updated only the introductory paragraph of AGENTS.md. Marked the change ready for review in the documentation index.

### Step 6
Verified the generated files against byte lengths and SHA-256 digests, and verified rejection of corrupted, missing, unexpected and malformed inputs in a temporary copy. Completed all four verification gates using the CI toolchain. A targeted secret-pattern scan found no private key header, realistic Tailscale auth key or GitHub token in the examined source and documentation. The production build used no runtime credentials.

### Round 1 fixes
- Added a private GET/HEAD sign-in redirect and documented it in the routes table. The fallback link carries only a validated profile ID. Invalid or absent IDs select laptop.
- Console now clears previous credentials before every entry and fetches the current auth context. Added happy-dom as a development dependency to exercise the mounted Vue application, including its lazy Console and displayed Import URL, through credential rotation and rejected re-entry.
- Remote rule sources must supply HTTPS fetch records with positive safe byte counts and lowercase SHA-256 digests. Local file sources can omit fetch records.
- Clipboard feedback now requires confirmed success. The legacy clipboard path removes its temporary textarea even if copying throws.
- Set the initial Overview title and restored it when leaving Console.

### Follow-up after live preview
Added an inline icon, the requested landing-page description and a public, cacheable 204 favicon fallback. During development, the Worker passes frontend modules and the Vite client helpers used by this app to the asset binding. Kept arbitrary Vite filesystem and virtual-module lookups outside the public allowlist.

Replaced the opening rail with the specified three zone tags and a responsive, annotated 42-line Laptop example. The excerpt is static and uses text nodes for placeholder highlighting. Nonmatching lines on hover use 92% opacity and 40% stripe color intensity to preserve the required text contrast in both themes.
