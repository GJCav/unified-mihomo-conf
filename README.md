# Mihomo Compose

Select a device profile at `/v2/` and scan its Import URL into Mihomo. The authenticated Worker renders the device configuration. Mihomo subsequently refreshes its public routing providers every 24 hours and caches each file locally.

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
| `/v2/?profile=<id>` | Select a profile, enter its parameters, preview YAML or copy the Import URL. |
| `/v2/config/<id>.yaml` | Render the selected skeleton with Worker secrets. |
| `/v2/auth-context` | Return the authenticated username and password for local QR generation. |
| `/v2/rules/*` | Serve public static providers, generation statistics and attribution. Missing files return 404. |
| `/config.yaml` and legacy paths with `o=y` | Render a frozen legacy configuration with its original rule order. |
| `/` with other queries | Redirect to `/v2/` and discard the query. |
| `/health` | Return the authenticated health check. |

Cloudflare serves the public rules directly. Other application requests pass through HTTPS enforcement, a Worker-scoped limit of 60 requests per client IP per minute, and Basic authentication. The UI bundles its dependencies. The browser caches editable parameters for 30 days. The Import URL and QR code contain credentials, and authenticated YAML previews can contain the upstream subscription. Configuration and auth-context responses use private, no-store caching.

## Routing and DNS

Tailnet rules come first, followed by custom proxy, custom direct, direct domains and classical rules, global domains and classical rules, global IP ranges, direct IP ranges and the final default outbound. Global IP matching uses `no-resolve`. Tailnet uses the Tailscale proxy on iPad and phone and DIRECT on other devices.

The generator downloads the upstreams listed in `rulesets/rulesets.json`. It merges and deduplicates domain and classical rules and subtracts higher-priority IP ranges exactly. Direct retains the parts of `100.64.0.0/10` outside the private tailnet. A parent domain can remain in a later set when an earlier set owns a child suffix. The first matching rule wins. Process-name and destination-port inputs are filtered. IP-ASN rules use GeoLite2-ASN.

Add Mihomo rules without outbound names to `rulesets/sources/custom-proxy.txt` or `rulesets/sources/custom-direct.txt`. Domain and classical text providers support empty custom lists. Each profile already references both, so devices pick up edits on their next provider refresh.

Server, laptop, iPad and phone send direct-domain queries to 101.6.6.6, 223.5.5.5 and 119.29.29.29. Tailnet and custom-proxy domain providers take precedence and use the configured DoH service, also used for unmatched domains. Phone gives `+.tailnet` highest priority through `ts://tailscale`. Gateway keeps its existing DNS behavior.

## Legacy imports

Existing devices can keep their Import URLs indefinitely. Re-import a v2 profile to switch to independently refreshed rules. The legacy renderer and frozen fragments live in `server/legacy/` and `snippet/`.

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

## Deployment

Pull requests run generation, tests and the production build without secrets. A main-branch push, daily schedule or manual dispatch generates a fresh rule artifact before publishing. The dnsmasq importer accepts one or more slash-separated domains followed by an IP address. Source downloads and redirects require HTTPS. The generator checks numeric IP-ASN values locally and loads the remaining classical entries into an isolated mihomo process. Empty custom groups are valid. Upstream, assertion, classical validation or MRS round-trip failures stop publication. The deploy job uses the main-only GitHub `production` environment. Set `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `BASIC_AUTH_CREDENTIALS`, `MAIN_SUBSCRIPTION_URL`, `DOH_URL`, `TAILSCALE_CONTROL_URL` and `PUBLIC_BASE_URL` there. The public base URL must match the custom domain in `wrangler.jsonc`.

The workflow assumes the Worker already exists with its custom domain bound. For first creation, generate the assets, build the app, and run `npx wrangler deploy --secrets-file "$secrets_file"` with a private JSON file containing the five runtime bindings. To change domains, update the custom domain in `wrangler.jsonc` and the production `PUBLIC_BASE_URL`, apply the binding with `npx wrangler triggers deploy`, and publish the updated Worker version.

The workflow uploads the five Worker bindings with the new version, then activates that version. Roll back the Worker version to restore its code and rules together. Devices with cached providers can continue using their last successful download. After a binding rotation, refresh legacy configurations and re-import affected v2 skeletons.

Preserve gateway and laptop external UI, normal-server Tailnet route exclusion, iPad's Mihomo-managed Tailscale path, IPv6 support and THU networks in the rule layer.
