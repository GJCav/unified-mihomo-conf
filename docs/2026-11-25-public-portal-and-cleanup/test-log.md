# Test log: Unified Mihomo Config — Public Portal, Legacy Consolidation & README

- Installed missing dependencies with `npm ci`.
- `MIHOMO_BIN=/usr/sbin/mihomo npm test -- server/legacy/golden.test.ts server/legacy/render.test.ts` passed all 47 tests across both suites.
- `MIHOMO_BIN=/usr/sbin/mihomo npm test` passed 86 of 88 tests. The iPad and Phone Mihomo validation cases failed. Running the designated binary with `-t` against a placeholder-rendered Phone skeleton reported “unsupport proxy type: tailscale”. `/usr/sbin/mihomo -v` reports v1.19.22 with_gvisor. CI pins v1.19.34. Resolution pending.

- With Go 1.26.11 first in PATH, `cd rulesets && go test ./... && go run . -mihomo /tmp/mh/mihomo` passed. All four Go packages passed and the generator published the 15 expected files.
- `MIHOMO_BIN=/tmp/mh/mihomo npm test` passed 102 tests including all five profile checks. This resolves the earlier local-toolchain failure.
- `node rulesets/check-assets.mjs` verified the generated asset set, metadata and hashes.

- Initial frontend integration: `npm run build` passed asset checks, vue-tsc and both Vite bundles.
- Expanded Go coverage: `go test ./...` initially failed to compile a new attribution test missing context, os and filepath imports. Added the imports and reran successfully with the pinned toolchain.
- `MIHOMO_BIN=/tmp/mh/mihomo npm test && npm run build` passed at 113 tests after adding frontend library tests. After extending HTTPS/404 coverage, the same gates passed at 116 tests. Reran after the final Console field, QR and security-header changes: all 116 tests passed across nine suites and the production build passed.
- Final compiler gates: `(cd rulesets && export PATH="/tmp/mihomo-go/go/bin:$PATH" MIHOMO_BIN=/tmp/mh/mihomo && go test ./... && go run . -mihomo /tmp/mh/mihomo)` passed all four packages and regenerated 15 files. The output test verifies the actual text artifact digest, size and count.
- `node rulesets/check-assets.mjs` passed on generated assets. Running that checker against isolated copies rejected an altered rule file, a missing file, an extra file and an invalid stats document.
- `git diff --check` passed. A targeted source and documentation scan for common private key headers, Tailscale auth keys and GitHub token patterns found no matches. Wrangler warned that the five production bindings were absent during the local build. Type checking and both Worker and client bundles succeeded. Browser rendering and a deployed Cloudflare environment were not exercised.

### Round 1 fixes
- `(cd rulesets && PATH="/tmp/mihomo-go/go/bin:$PATH" go test ./...)` passed all four packages.
- `node rulesets/check-assets.mjs` passed against the generated assets with the stricter remote-fetch validation.
- The first `MIHOMO_BIN=/tmp/mh/mihomo npm test` run passed 127 tests and failed the new Vue navigation test because its lazy-component mock was incompatible with Vue's module unwrapping. Replaced the mock with the real Console and verified the revealed URL after each successful sign-in.
- `MIHOMO_BIN=/tmp/mh/mihomo npm test` then passed 128 tests across 10 suites. The new tests exercise GET and HEAD sign-in challenges and redirects, rejected remote metadata, rotated credentials, rejected re-entry, and both page titles.
- `npm run build` passed asset validation, vue-tsc, and both Vite bundles. Wrangler reported the expected absent local runtime bindings.

### Follow-up after live preview
- With the pinned Go directory first in PATH and MIHOMO_BIN=/tmp/mh/mihomo, ran `go test ./...` and `go run . -mihomo /tmp/mh/mihomo` in rulesets. All four packages passed and generation succeeded.
- `node rulesets/check-assets.mjs`, `MIHOMO_BIN=/tmp/mh/mihomo npm test`, and `npm run build` passed before and after the contrast adjustment. Vitest passed 141 tests in 10 suites, including the mounted public showcase, favicon and dev routing regressions. The build passed type checking and generated both bundles.
- Started `npm run dev -- --host 127.0.0.1 --port 5419 --strictPort` and traversed the landing HTML and its static module imports over local HTTPS, including the stats and favicon requests. All 20 distinct resources returned 200 or 204 without a WWW-Authenticate header. Stopped the server after the check.
- Calculated WCAG relative-luminance ratios for the zone legend and annotated code colors, including translucent backgrounds. Minimum normal contrast was 5.19:1 light and 5.48:1 dark. Minimum dimmed code contrast at 92% opacity was 4.62:1 light and 4.82:1 dark. Responsive geometry was not visually inspected. `git diff --check` passed.
