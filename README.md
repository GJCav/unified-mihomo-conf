# Mihomo Compose

Mihomo Compose is a deliberately small Cloudflare Worker and Vue 3 application
for building machine-specific Mihomo/Clash configurations from shared YAML
snippets. The browser selects a profile or individual snippets, while the
Worker renders a complete YAML configuration that Mihomo can import directly.

This document records the project state and design decisions as of 2026-08-25.

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

## Built-in profiles

Profiles are named combinations of snippets defined in `src/App.vue`. They are
convenient defaults, not a second configuration format; choosing a profile
simply updates the same composable editor state.

| Profile | Upstream | TUN | Tailnet handling | External UI |
| --- | --- | --- | --- | --- |
| Gateway | Main subscription | Disabled | Normal rules | Enabled |
| Normal Server | Gateway HTTP proxy | Basic + route exclusion | Excluded for native Tailscale | Disabled |
| Laptop | Main subscription | Basic + route exclusion | Excluded for native Tailscale | Enabled |
| iPad | Main subscription | Basic | Mihomo Tailscale proxy + bypass rule | Disabled |
| Phone | Main subscription | Basic | Mihomo Tailscale proxy + DNS policy | Disabled |

The gateway and laptop must continue to render `external-ui: ui`. The normal
server enables `tun/tailscale-route-exclusion.yaml` by default.

The shared default rule order is:

1. Special/private IP bypasses
2. Chinese website bypasses
3. Academic publisher bypasses
4. THU IPv4/IPv6 bypasses
5. Proxy website rules and final `MATCH`

The iPad and phone prepend the Tailnet bypass rule. Rule order is significant
and is preserved by the sortable editor.

## Composition model

`snippet/skeleton.yaml` describes the final document. General settings remain
top-level fragments; the skeleton owns structural keys such as `dns`, `tun`,
`proxy-providers`, `proxy-groups`, `proxies`, and `rules`, into which the
selected snippets are inserted.

```text
snippet/
  skeleton.yaml
  general/          basic, gateway
  external-ui/      basic
  dns/              basic, tailnet
  tun/              basic, tailscale-route-exclusion
  proxy-providers/  main
  proxy-groups/     main
  proxies/          gateway, tailscale
  rules/            independent, order-sensitive rule sets
```

`general`, `external-ui`, and `dns` are single-choice parts. The `tailnet` DNS
choice composes the shared `basic` DNS fragment with its small policy overlay.
TUN snippets, providers, groups, proxies, and rules are independently
composable; rules are also sortable. Mustache provides the few required
runtime placeholders:

- `gateway_server` for the normal-server gateway proxy
- `tailscale_hostname` and `tailscale_auth_key` for the Mihomo Tailscale proxy
- `main_subscription_url`, supplied only by the Worker secret

The renderer in `server/render.ts` validates required values and rejects unsafe
or nonsensical combinations, including a provider/group mismatch, conflicting
gateway and main group names, missing default outbound rules, Tailnet rules
without a Tailscale proxy, route exclusion without basic TUN, and an empty rule
list.

This insertion-based model was chosen instead of a general YAML deep-merge
engine. It keeps the project and the resulting configuration easy to inspect.

## Browser and URL behavior

The page is a responsive two-row compositor. The top row contains the compact
profile chooser. The lower row contains the snippet/value editor and a
syntax-highlighted rendered preview, side by side when space permits and
stacked on narrow screens.

The complete editable plan lives in the page query string and changes
reactively. The Import URL uses the same schema with `o=y`, which tells the
Worker to return YAML instead of the application. This makes a URL both a
shareable plan and a stable Mihomo subscription endpoint.

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

Legacy `/config.yaml` routes are accepted. Legacy `u` subscription parameters
are deliberately ignored because the authoritative subscription is now held by
the Worker.

The browser remembers editable placeholder values for 30 days in
origin-scoped local storage. URL values take precedence over the cache, and
expired or malformed entries are discarded. The main subscription URL is
read-only and is never cached by this mechanism. A Tailscale auth key may
therefore exist in local storage and in generated URLs; both must be treated as
secrets.

The Import URL embeds the authenticated username and password using standard
`https://username:password@host/...` URL userinfo so Mihomo clients can fetch it
without a separate credential prompt. A QR code for that same URL is generated
entirely in the browser with `qrcode.vue`; it consumes no Worker CPU. Treat the
full Import URL and QR code as credentials.

## Worker state and security

The deployed Worker requires two encrypted secrets:

- `BASIC_AUTH_CREDENTIALS`: one `username:password` string, split at the first
  colon
- `MAIN_SUBSCRIPTION_URL`: the complete HTTP or HTTPS subscription URL

The main subscription is centralized so changing the secret updates every
device without changing its Import URL. The UI displays the current value as a
read-only field.

Changing a Worker secret from this web page was considered and intentionally
rejected. A Worker cannot directly mutate its own secret binding. Giving it a
Cloudflare API token would allow self-deployment and make that powerful token
part of the application's attack surface. KV plus a dedicated admin endpoint
would make browser editing possible, but would add mutable state, eventual
consistency, CSRF/admin-auth concerns, and more code. For this small private
application, `wrangler secret put` remains the administrative interface.

The request path has these defenses:

- Cloudflare serves only the custom domain `mihomo-conf.crychic.uk`;
  `workers.dev` and preview URLs are disabled.
- The Worker rejects non-HTTPS requests.
- Every route, including assets, health checks, and rendered YAML, requires
  valid HTTP Basic Authentication.
- Before authentication, a Worker-scoped Rate Limiting binding permits 60
  requests per client IP per 60-second period and returns HTTP 429 with
  `Retry-After: 60` when exceeded. This binding was preferred over a zone-wide
  rule so unrelated sites and Workers are unaffected. Cloudflare enforcement
  is distributed and should be viewed as abuse mitigation, not an exact global
  counter.
- Frontend dependencies are bundled; the deployed page loads no JavaScript or
  CSS from third-party CDNs.

Basic Authentication protects transport and access but is not encryption by
itself; HTTPS is essential. Any authenticated user can see the subscription URL
and credentials needed to construct Import URLs, which is intentional for this
single-user administration model.

## Development

```sh
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

Replace the subscription placeholder in `.dev.vars`. The ignored local file
uses `dev:dev` for `BASIC_AUTH_CREDENTIALS`. Vite runs the application with the
Cloudflare Workers runtime and uses the basic SSL plugin to serve HTTPS with a
self-signed certificate. Accept its browser warning once for local use.

Useful checks:

```sh
npm test
npm run build
```

Important implementation locations:

- `src/App.vue`: UI, profile defaults, reactive URL state, and local cache
- `server/index.ts`: HTTPS, rate limiting, Basic Auth, routing, and assets
- `server/render.ts`: URL decoding, validation, and YAML composition
- `snippet/`: the reusable Mihomo fragments and skeleton
- `wrangler.jsonc`: custom domain, bindings, and deployment settings

The `reference/` directory contains the old independently managed
configurations used to derive this design. It is intentionally ignored by Git
because those live files may contain credentials. Never copy their secrets
into tracked snippets.

## Deployment and maintenance

Authenticate Wrangler with the intended Cloudflare account, then set secrets
interactively so they do not enter shell history or source control:

```sh
npx wrangler secret put BASIC_AUTH_CREDENTIALS
npx wrangler secret put MAIN_SUBSCRIPTION_URL
npm run deploy
```

Updating `MAIN_SUBSCRIPTION_URL` through Wrangler deploys a new Worker version;
existing device URLs remain valid. The normal application deployment bundles
Vue 3, Mustache, syntax highlighting, icons, QR generation, snippets, and the
Worker—there are no runtime package/CDN installation steps.

When adding a snippet:

1. Put it under `snippet/<part>/<purpose>.yaml`.
2. Add its stable one-character URL code and UI label.
3. Decide whether it is single-choice, multi-select, or order-sensitive.
4. Add validation for any new dependencies or conflicts.
5. Update profile defaults only when the new behavior is intentional.
6. Extend renderer and Worker tests before deploying.

In particular, preserve these compatibility decisions unless deliberately
revisiting the network design: gateway and laptop external UI, normal-server
Tailnet route exclusion, iPad's Mihomo-managed Tailscale path, IPv6 support,
and THU networks remaining in the rule layer.
