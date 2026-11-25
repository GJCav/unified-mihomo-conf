# Unified Mihomo Config

One Import URL gives each device its own Mihomo configuration. A gateway can serve the LAN while a phone uses Tailnet DNS and a laptop keeps its native Tailscale connection. The profiles share routing policy, so a change to the rules reaches all five roles on their next daily refresh.

Browse the public Overview at `/v2/` to inspect the live rule groups, their sources and the last generation time. Open **Console** to sign in, choose a device and scan its QR code.

## How it works

Five static YAML skeletons in `profiles/` describe the devices. On an authenticated request the Cloudflare Worker fills the selected skeleton with runtime secrets and the device parameters. Separately, the Go compiler in `rulesets/` downloads and validates upstream lists, then publishes compact providers alongside the Worker. Mihomo caches each provider locally. Devices can refresh their rules without a new Import URL.

## Network model

The machines have five distinct roles:

```text
Gateway       -> main proxy subscription
Normal server -> Gateway -> main proxy subscription
Laptop        -> main proxy subscription
                 local Tailscale process (excluded from Mihomo TUN)
iPad          -> main proxy subscription
                 Mihomo Tailscale proxy for Tailnet traffic
Phone         -> main proxy subscription
                 Mihomo Tailscale proxy and Tailnet DNS policy
```

- The gateway exposes Mihomo to the LAN and connects to subscription proxies
  directly. It is the only profile without TUN mode.
- Normal servers use TUN mode and relay unmatched traffic through the gateway.
- The laptop uses TUN mode and connects to subscription proxies independently.
  Its separate native Tailscale process owns Tailnet routes.
- The iPad uses TUN mode and connects to subscription proxies independently.
  Mihomo itself provides its Tailscale connection, but its client does not use
  the Tailnet DNS policy.
- The phone uses the same proxy/TUN arrangement as the iPad, with the
  additional Tailnet DNS policy required by its client.
- The private Tailnet is `100.88.0.0/16`.
- IPv6 is intentionally enabled. THU IPv4 and IPv6 networks are handled by
  ordered routing rules rather than TUN route exclusions.
- The old Shadowsocks inbound on the gateway was intentionally removed.

## Profiles

| Profile | Upstream | TUN | Tailnet handling | External UI |
| --- | --- | --- | --- | --- |
| Gateway | Main subscription | Disabled | Normal rules | Enabled |
| Normal Server | Gateway HTTP proxy | Basic + route exclusion | Excluded for native Tailscale | Disabled |
| Laptop | Main subscription | Basic + route exclusion | Excluded for native Tailscale | Enabled |
| iPad | Main subscription | Basic | Mihomo Tailscale proxy + bypass rule | Disabled |
| Phone | Main subscription | Basic | Mihomo Tailscale proxy + DNS policy | Disabled |

Each file in `profiles/` is a complete YAML skeleton. The browser and Worker share the profile parameters in `shared/profiles.ts`. The server profile takes `s` (gateway address). iPad and phone take `h` (Tailscale hostname) and `k` (auth key). Gateway and laptop have no parameters.

## Routes and credentials

| Route | Behavior |
| --- | --- |
| `/v2/`, `/v2/index.html`, `/v2/assets/*` | Public Overview and browser assets. |
| `/v2` | Redirect to `/v2/` and retain the query, except for legacy `o=y`. |
| `/v2/?profile=<id>` | Select a profile, enter its parameters, preview YAML or copy the Import URL. |
| `/v2/config/<id>.yaml` | Render the selected skeleton with Worker secrets. |
| `/favicon.ico` | Public, empty response for browsers that request a fallback icon. The Overview includes its icon inline. |
| `/v2/sign-in` | Authenticate in a top-level page, then return to Console for the requested profile (default: laptop). |
| `/v2/auth-context` | Return the authenticated username and password for local QR generation. |
| `/v2/rules/*` | Serve public static providers, generation statistics and attribution. Missing files return 404. |
| `/config.yaml` and legacy paths with `o=y` | Render a frozen legacy configuration with its original rule order. |
| `/` with other queries | Redirect to `/v2/` and discard the query. |
| `/health` | Return the authenticated health check. |

Cloudflare serves public rule files and hashed browser assets directly. The Worker requires HTTPS and limits requests to 60 per client IP per minute. Public HTML and redirects are available before authentication. Opening Console requests the private auth context. A profile bookmark triggers that same sign-in flow. The address bar omits the Tailscale key. The UI bundles its dependencies. The browser caches editable parameters for 30 days. The displayed Import URL masks credentials until revealed. The copied URL and visible QR code contain credentials, and authenticated YAML previews can contain the upstream subscription. Configuration and auth-context responses use private, no-store caching.

## Routing and DNS

Tailnet rules come first, followed by custom proxy, custom direct, direct domains and classical rules, global domains and classical rules, global IP ranges, direct IP ranges and the final default outbound. Global IP matching uses `no-resolve`. Tailnet uses the Tailscale proxy on iPad and phone and DIRECT on other devices.

The generator downloads the upstreams listed in `rulesets/rulesets.json`. It merges and deduplicates domain and classical rules and subtracts higher-priority IP ranges exactly. Direct retains the parts of `100.64.0.0/10` outside the private tailnet. A parent domain can remain in a later set when an earlier set owns a child suffix. The first matching rule wins. Process-name and destination-port inputs are filtered. IP-ASN rules use GeoLite2-ASN.

Add Mihomo rules without outbound names to `rulesets/sources/custom-proxy.txt` or `rulesets/sources/custom-direct.txt`. Domain and classical text providers support empty custom lists. Each profile already references both, so devices pick up edits on their next provider refresh.

Server, laptop, iPad and phone send direct-domain queries to 101.6.6.6, 223.5.5.5 and 119.29.29.29. Tailnet and custom-proxy domain providers take precedence and use the configured DoH service, also used for unmatched domains. Phone gives `+.tailnet` highest priority through `ts://tailscale`. Gateway keeps its existing DNS behavior.

## Where the rules come from

| Group | Inputs | Subtraction |
| --- | --- | --- |
| Tailnet | Repository Tailnet domains and IP ranges | None |
| Custom proxy | Local proxy overrides | None |
| Custom direct | Local direct overrides | None |
| Direct | SukkaW/Surge, v2fly/domain-list-community, IANA special registries, felixonmars/dnsmasq-china-list, gaoyifan/china-operator-ip and local additions | Tailnet |
| Global | v2fly international categories and Sukka service lists | Tailnet and direct |

Each build publishes 12 providers and a schema-v2 `stats.json` alongside NOTICE and the AGPL license. The report includes the UTC build time, source and output hashes, per-group counts and upstream licenses. The Overview displays that time in UTC+8. The compiler derives from liblaf/route-rules. Devices fetch the MetaCubeX ASN database at runtime.

## Development

Install Node 24, Go 1.26.11, curl and mihomo v1.19.34. Copy `.dev.vars.example` to untracked `.dev.vars` and supply local values. From the repository root run:

```sh
npm ci
(cd rulesets && go test ./... && go run . -mihomo "$(command -v mihomo)")
MIHOMO_BIN="$(command -v mihomo)" npm test
npm run build
npm run dev
```

Open the local HTTPS URL at `/v2/`. The build requires all 12 rule files, stats.json, NOTICE and AGPL-3.0.txt in `public/v2/rules/`. Generated assets stay out of Git.

## Fork & Self-Host

1. Fork and clone this repository. Use a Cloudflare account with a zone for the HTTPS hostname you plan to serve. Enable GitHub Actions in your fork.
2. Set the Worker name and custom domain in `wrangler.jsonc`. Set `PUBLIC_BASE_URL` to the matching HTTPS origin. Give the rate limiter a namespace ID appropriate for your account.
3. Adapt `rulesets/sources/tailnet.txt`, the custom policy lists, and the assertions in `rulesets/rulesets.json`. Replace network-specific values such as `100.88.0.0/16` and `gjm20.top` consistently in the configuration, assertions and profile routes. Update the local upstream homepage for your fork.
4. Follow **Development** above. Set the five runtime bindings in your private local environment. Use a strong `username:password` pair for `BASIC_AUTH_CREDENTIALS`, your provider endpoint for `MAIN_SUBSCRIPTION_URL`, your resolver for `DOH_URL`, your coordination endpoint for `TAILSCALE_CONTROL_URL`, and the public origin for `PUBLIC_BASE_URL`.
5. Generate assets and build locally. For the first deployment, authenticate Wrangler to your account and run `npx wrangler deploy --secrets-file "$secrets_file"` with a private JSON file containing those five bindings. Keep the file outside the repository. Confirm the custom domain is bound.
6. Create a GitHub environment named `production` restricted to `main`. Add the five runtime bindings as environment secrets, plus `CLOUDFLARE_ACCOUNT_ID` and a scoped `CLOUDFLARE_API_TOKEN` that can publish Workers to this account.
7. Run the deployment workflow on `main`. A push to that branch, a daily schedule, or a manual dispatch rebuilds and validates the providers before uploading and activating the Worker version. Pull requests run generation, tests and the build without production secrets.
8. Open the public Overview, inspect the generation time and download a rule file. Open Console, authenticate, select a role, and import its QR code or URL. Check the protected health endpoint with the same credentials.

To change domains, update the route and public origin, apply the binding with `npx wrangler triggers deploy`, then publish the version. Rolling back a Worker version restores its code and assets together. After rotating bindings, refresh legacy configurations and re-import affected v2 profiles.

## Licenses

Project code is distributed under the [MIT License](LICENSE). Generated providers retain the applicable upstream licenses. Each build distributes [NOTICE](rulesets/NOTICE) and [AGPL-3.0.txt](rulesets/AGPL-3.0.txt) alongside the rule files.

<details>
<summary>Legacy v1 Import URLs and compatibility</summary>


Existing devices can keep their Import URLs indefinitely. Re-import a v2 profile to switch to independently refreshed rules. The legacy renderer and frozen fragments live together in `server/legacy/`.

The compact parameters are:

- `g=b|g`: basic or gateway general settings
- `e=b`: enable `external-ui: ui`
- `d=b|t|n`: basic DNS, basic DNS plus the Tailnet policy, or none. Existing
  iPad URLs use `d=b` and remain unchanged; the phone profile uses `d=t`.
- `t=be|n`: TUN snippets (`b` basic, `e` Tailnet route exclusion), or none
- `pp=m`: main provider
- `pg=m`: main proxy group
- `p=gt`: fixed proxies (`g` gateway, `t` Tailscale)
- `r=ticahw`: rules in render order: `t` Tailnet, `i` special IPs, `c` Chinese
  websites, `a` academic publishers, `h` THU networks, and `w` proxy/final
  rules. Legacy `b` expands to the five shared default rule snippets.
- `s`, `h`, `k`: gateway server, Tailscale hostname, and Tailscale auth key
- `o=y`: render YAML

Legacy `/config.yaml` routes are accepted. Outside `/v2/`, any path with `o=y` renders legacy YAML, except the health check at `/health`. Legacy `u` subscription parameters
are deliberately ignored because the authoritative subscription is now held by
the Worker.

Compatibility includes gateway and laptop external UI, normal-server Tailnet route exclusion, iPad's Mihomo-managed Tailscale path, IPv6 support and THU networks in the rule layer. The Basic Auth realm and 30-day browser cache key are stable.

</details>
