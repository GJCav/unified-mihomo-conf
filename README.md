# Mihomo Compose

A small Cloudflare Worker and Vue 3 page that composes the YAML fragments in
`snippet/` into importable Mihomo configurations.

## Development

```sh
npm install
npm run dev
```

The local page is served by Vite with the Cloudflare Workers runtime. The
renderer is available at `/config.yaml`; the page constructs its query string
from the selected snippets and values.

Useful checks:

```sh
npm test
npm run build
```

## Deploy

The Worker requires one encrypted secret named `BASIC_AUTH_CREDENTIALS`. Its
value is the Basic Authentication username and password joined by the first
colon:

```text
username:password
```

Set it interactively so the value is not written to shell history or source:

```sh
npx wrangler secret put BASIC_AUTH_CREDENTIALS
```

For local Worker development, copy `.dev.vars.example` to `.dev.vars` and
replace its placeholder. `.dev.vars` is ignored by Git. `npm run dev` uses
Vite's basic SSL plugin and serves HTTPS with a self-signed certificate. The
browser will require the certificate warning to be accepted once.

After authenticating Wrangler with the target Cloudflare account, deploy with:

```sh
npm run deploy
```

Vite packages Vue, the icon components, Mustache, the YAML snippets, and the
Worker into `dist/`. The deployed application does not load JavaScript or CSS
dependencies from a CDN.

## URL contract

The editor state lives in the page URL. Adding `o=y` to the same URL makes the
Worker return rendered YAML instead of the page.

The compact parameters are:

- `g=b|g`: basic or gateway general settings
- `e=b`: enable the `external-ui: ui` snippet
- `d=b|n`: basic DNS or none
- `t=be|n`: selected TUN snippets (`b` basic, `e` Tailscale route exclusion),
  or none
- `pp=m`: selected provider snippets
- `pg=m`: selected group snippets
- `p=gt`: selected proxy snippets (`g` gateway, `t` Tailscale)
- `r=ticahw`: selected rules in render order. The codes are
  `t` Tailnet bypass, `i` special IPs, `c` CN websites, `a` academic publishers,
  `h` THU IP, and `w` proxied websites. Legacy code `b` expands to the five
  former basic-rule snippets.
- `u`, `s`, `h`, `k`: subscription URL, gateway server, Tailscale hostname,
  and Tailscale auth key
- `o=y`: return YAML

Selection parameters are compact lists, so future snippets can receive another
single-character code without changing the schema. Required values and
incompatible combinations are rejected with HTTP 400. Legacy `/config.yaml`
URLs remain accepted.

The resulting import URL can contain subscription credentials or a Tailscale
auth key. Treat the complete URL as a secret and distribute it only through the
intended secure channel.

All routes—including static assets, `/health`, and rendered YAML—require HTTPS
and the correct HTTP Basic Authorization header. The compositor embeds the
authenticated username and password into copied Import URLs using standard
`https://username:password@host/...` URL credentials. Treat the complete URL as
a password and verify that the importing client supports HTTP URL userinfo. A
QR code for the same URL is generated entirely in the browser with
`qrcode.vue`; no Worker CPU is used for QR rendering.

The browser remembers the latest template values in origin-scoped local
storage for 30 days. Values supplied in a page URL take precedence, and expired
or malformed cache entries are removed automatically.

Before authentication, the Worker applies a per-IP rate limit of 60 requests
per 60 seconds using Cloudflare's Rate Limiting binding. Rejected requests
receive HTTP 429 with `Retry-After: 60`.
