# UI Visual, Spatial & Copy Specification

Visual & layout design by Claude Opus 5.5; English UI copy polished by Gemini 4 Neon.

# PART 1: Visual and layout specification (for Astra)

## 1. Design philosophy and visual tone

**Direction: an editorial field manual.** The page should read like a well-typeset technical reference: warm paper, dark ink, hairline rules and generous margins. It should not look like a SaaS dashboard.

- **Structure comes from type and hairlines, not boxes.** Sections are separated by a 1px rule and a numbered eyebrow (`01 · How it works`). Cards are used only where the content really is a discrete object: rule-set groups, profile choices, the Import card and the YAML panel.
- **Flat surfaces.** There are no `box-shadow` effects anywhere except the focus ring. Depth comes from three surface tones (canvas, raised, inset) plus borders.
- **Colour carries meaning, never decoration.** The only saturated colours are the 5 group accents (each used consistently on its dot, bar, ladder row and DNS row), one link/action blue, and status colours. There are no gradients, glows or coloured backgrounds on large areas.
- **Restrained shapes.** Radii are small: 4px chips, 6px controls, 10px cards. There are no fully rounded pills. The only round shapes are 8px status dots.
- **Monospace is for data only:** counts, file names, CIDRs, hashes, timestamps, YAML keys and URLs. Prose stays sans.
- **Readable line lengths.** Body prose is capped at `64ch`. Ledes are capped at `60ch`.
- **Wide layouts stay sparse.** The widest grid is 3 columns of prose or 5 *rows* of groups. Rule-set groups are full-width rows, not a 4-column card wall.

## 2. CSS custom properties

Put these in `src/style.css` on `:root`, with the dark override in `@media (prefers-color-scheme: dark)`. Also set `color-scheme: light dark;` on `:root`.

```css
:root {
  color-scheme: light dark;

  /* Surfaces */
  --canvas:        #F5F3EC;  /* page */
  --surface:       #FFFDF8;  /* raised: cards, header controls */
  --surface-inset: #EFECE3;  /* wells: count-bar tracks, URL box, table header, segmented bg */
  --surface-hover: #F9F7F1;  /* row/card hover */
  --code-bg:       #0F1115;  /* YAML panel body (dark in both modes) */
  --code-bar:      #171A20;  /* YAML panel header bar */
  --code-line:     #262A31;  /* YAML panel borders */
  --code-ink:      #D6D9DE;
  --code-muted:    #8B929C;

  /* Ink */
  --ink:           #1A1C1E;  /* primary text, headings */
  --ink-2:         #3D4146;  /* secondary text, ledes */
  --ink-3:         #5E6267;  /* muted: captions, metadata, eyebrows (≥4.5:1 on canvas) */
  --ink-4:         #8A8E93;  /* disabled, placeholder (decorative only) */

  /* Lines */
  --line:          #DED9CC;  /* hairline */
  --line-strong:   #C4BDAC;  /* control borders, timeline line, table header underline */

  /* Action / focus */
  --accent:        #2F5BEA;
  --accent-ink:    #2448C4;  /* link text */
  --accent-tint:   #E6ECFD;
  --on-accent:     #FFFFFF;
  --focus:         #2F5BEA;
  --focus-halo:    rgba(47, 91, 234, 0.22);

  /* Status */
  --ok:            #2E7D4F;  --ok-tint:     #E3F1E8;
  --warn:          #9A5B00;  --warn-tint:   #FBF0DC;  --warn-line: #E6C68E;
  --danger:        #B3261E;  --danger-tint: #FBE9E7;  --danger-line: #EDB8B3;

  /* Group accents: base (bars/dots), ink (text), tint (chip/row bg) */
  --g-tailnet:            #5B4FD9; --g-tailnet-ink:       #4B3FC4; --g-tailnet-tint:       #ECEAFB;
  --g-custom-proxy:       #C27C0E; --g-custom-proxy-ink:  #8F5A00; --g-custom-proxy-tint:  #F8EEDB;
  --g-custom-direct:      #0E8277; --g-custom-direct-ink: #0A6A61; --g-custom-direct-tint: #DFF1EE;
  --g-direct:             #2E8B4E; --g-direct-ink:        #23703E; --g-direct-tint:        #E3F1E7;
  --g-global:             #D0452E; --g-global-ink:        #A9361F; --g-global-tint:        #FBE7E2;

  /* Shape and motion */
  --r-chip: 4px; --r-control: 6px; --r-card: 10px;
  --dur: 160ms; --ease: cubic-bezier(.2, 0, 0, 1);
}

@media (prefers-color-scheme: dark) {
  :root {
    --canvas:        #121315;
    --surface:       #1A1C1F;
    --surface-inset: #16171A;
    --surface-hover: #1F2125;
    --code-bg:       #0B0C0E;
    --code-bar:      #141619;
    --code-line:     #2C3036;

    --ink:   #ECEAE4;
    --ink-2: #C9C7C0;
    --ink-3: #9A9C9F;
    --ink-4: #6B6E73;

    --line:        #2C3036;
    --line-strong: #3B4048;

    --accent:      #7F9CFF;
    --accent-ink:  #A3B8FF;
    --accent-tint: rgba(127, 156, 255, 0.14);
    --on-accent:   #0E1222;
    --focus:       #8FA9FF;
    --focus-halo:  rgba(143, 169, 255, 0.28);

    --ok:     #6CC78A;  --ok-tint:     rgba(108, 199, 138, 0.12);
    --warn:   #E8B04B;  --warn-tint:   rgba(232, 176, 75, 0.12);  --warn-line:   rgba(232, 176, 75, 0.35);
    --danger: #FF8E86;  --danger-tint: rgba(255, 142, 134, 0.12); --danger-line: rgba(255, 142, 134, 0.35);

    --g-tailnet:       #8E84FF; --g-tailnet-ink:       #B3ACFF; --g-tailnet-tint:       rgba(142, 132, 255, 0.14);
    --g-custom-proxy:  #E0A23A; --g-custom-proxy-ink:  #EEC274; --g-custom-proxy-tint:  rgba(224, 162, 58, 0.14);
    --g-custom-direct: #3FB8AA; --g-custom-direct-ink: #74D3C8; --g-custom-direct-tint: rgba(63, 184, 170, 0.14);
    --g-direct:        #5DBE7E; --g-direct-ink:        #8FD8A6; --g-direct-tint:        rgba(93, 190, 126, 0.14);
    --g-global:        #EE7259; --g-global-ink:        #F7A08E; --g-global-tint:        rgba(238, 114, 89, 0.14);
  }
}
```

**Group token use.** Add a `data-group="<name>"` attribute on any element that belongs to a group, and map it to local variables:

```css
[data-group="tailnet"] { --g: var(--g-tailnet); --g-ink: var(--g-tailnet-ink); --g-tint: var(--g-tailnet-tint); }
/* …same pattern for custom-proxy, custom-direct, direct, global */
```

Components then use only `--g`, `--g-ink` and `--g-tint`.

**`<meta name="theme-color">`.** Use two tags: `#F5F3EC` with `media="(prefers-color-scheme: light)"` and `#121315` with `media="(prefers-color-scheme: dark)"`.

**highlight.js theme.** Keep the `github-dark.css` import, but override `.hljs { background: transparent; color: var(--code-ink); }` so the panel controls the background.

## 3. Typography and rhythm

**Font stacks.** No web fonts are loaded.

```css
--font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
--font-mono: ui-monospace, "SF Mono", "JetBrains Mono", "Cascadia Mono", Menlo, Consolas, monospace;
```

Set on `body`: `font-family: var(--font-sans); -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; font-synthesis: none;`. Drop `Inter` from the stack; it is not loaded anyway.

| Token | Use | Size / line-height | Weight | Tracking | Notes |
| --- | --- | --- | --- | --- | --- |
| `--t-display` | Page `h1` | 32/38px (≤640px: 26/32) | 650 | -0.02em | `--ink` |
| `--t-section` | Section `h2` | 22/28px (≤640px: 20/26) | 600 | -0.015em | `--ink` |
| `--t-card` | Card/group/step `h3` | 16/22px | 600 | -0.005em | `--ink` |
| `--t-lede` | Header intro, section ledes | 16/26px | 400 | 0 | `--ink-2`, `max-width: 60ch` |
| `--t-body` | Prose | 15/24px | 400 | 0 | `--ink-2`, `max-width: 64ch` |
| `--t-small` | Captions, help text, table cells | 13/20px | 400 | 0 | `--ink-3` |
| `--t-eyebrow` | Section numbers, column labels, table `th` | 11/16px | 600 | 0.08em | `text-transform: uppercase`, `--ink-3` |
| `--t-mono` | Counts, file names, CIDRs, timestamps | 13/20px | 450 (or 400) | 0 | `font-family: var(--font-mono); font-variant-numeric: tabular-nums;` |
| `--t-mono-sm` | Chips, inline code, byte sizes | 12/16px | 500 | 0 | mono, tabular-nums |
| `--t-code` | YAML panel | 12.5/20px | 400 | 0 | mono, `tab-size: 2` |
| `--t-button` | Buttons, segmented control | 14/20px | 550 | 0 | sans |

**Inline code.** Use `<code>` in prose: mono 0.88em, padding `1px 5px`, `--surface-inset` background, `--r-chip` radius, `--ink` text.

**Links.** Colour `--accent-ink`, `text-decoration: underline`, `text-decoration-thickness: 1px`, `text-underline-offset: 3px`. On hover, increase the thickness to 2px. External links get a trailing Lucide `ExternalLink` icon (12px, `--ink-3`, `aria-hidden`).

**Spacing scale (4px base).** `--s-1:4px --s-2:8px --s-3:12px --s-4:16px --s-5:20px --s-6:24px --s-8:32px --s-10:40px --s-12:48px --s-18:72px`.

**Page container.** `.container { max-width: 1280px; margin-inline: auto; padding-inline: clamp(16px, 4vw, 40px); }`. Header, banner, Overview and Console all use this one width, so the header never jumps when switching views.

**Vertical rhythm.**
- Header: padding-top `40px` (≤640px: `24px`), padding-bottom `28px`, then a `1px --line` bottom border.
- `main`: padding-top `48px` (≤640px: `32px`), padding-bottom `72px`.
- Between Overview sections: `72px` (≤640px: `48px`). Each section is `<section class="ov-section">` with `border-top: 1px solid var(--line); padding-top: 32px`. The first section has no border.
- Section head: eyebrow, then `8px`, `h2`, `8px`, lede, then `28px` before the content.
- Card padding: `20px`; at ≥960px, `24px`. Card internal gaps: `16px` between blocks and `8px` between a label and its value.
- Card style: `background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card);`. No shadow.

**Breakpoints** (mobile-first, `min-width`): `sm 640px`, `md 960px`, `lg 1200px`.

## 4. Section-by-section blueprint

### 4.0 Top header (shared by both views)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Unified Mihomo Config                                         [🔒 Console]   │
│ One-sentence intro (lede, ≤60ch)…                                             │
│ ● Rules generated 2026-11-25 14:20 UTC+8 · 3h ago · 5 groups · 12 files       │
└───────────────────────────────────────────────────────────────────────────────┘
  [ inline auth banner, only when needed ]
```

- **Element:** `<header class="site-header">` containing `.container.site-header__inner`.
- **Behaviour: static, not sticky.** A sticky header would compete with the sticky YAML panel and take vertical space on phones.
- **Layout:** `display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 32px; align-items: start;`
- **Left column:**
  - `h1` (`--t-display`), then `8px`.
  - `p.lede` (`--t-lede`), then `12px`.
  - `p.status` as an inline-flex row with `gap: 8px`, `--t-mono` at 13px, `--ink-3`, `flex-wrap: wrap`.
  - The status dot is an 8×8 circle, `flex: none`, with `--ok` when fresh (≤48h), `--warn` when stale (>48h) or unavailable, and a `--ink-4` pulse while loading.
  - Separators are a `·` in `--ink-4`. The relative age (`3h ago`) also uses `--ink-3`.
  - When stale, the timestamp itself is `--warn`.
- **Right column:** `align-self: start; margin-top: 2px` (lines up with the h1 cap height).
  - **Locked button (`.btn.btn--primary`):** height 36px, padding `0 14px`, `gap: 8px`, `--accent` background, `--on-accent` text, `--r-control` radius, `--t-button`. Lucide `Lock` at 16px, then the label `Console`. Do not use an emoji.
    - Hover: `filter: brightness(1.06)`. Active: `brightness(0.96)`.
    - Waiting: `aria-busy="true"`, `disabled`, the icon becomes `LoaderCircle` spinning at 1s linear (static under reduced motion), and the label changes to the waiting copy.
  - **Unlocked segmented control:** `nav.view-switch[aria-label="View"]` holding 2 `<button>`s.
    - Container: `display: inline-grid; grid-auto-flow: column; padding: 3px; gap: 2px; background: var(--surface-inset); border: 1px solid var(--line); border-radius: 8px;`
    - Each button: height 30px, padding `0 14px`, `--r-control` radius, `--t-button`, `--ink-3`, transparent background.
    - Active button: `aria-current="page"`, `background: var(--surface)`, `color: var(--ink)`, `border: 1px solid var(--line)` (inactive buttons use a 1px transparent border so nothing shifts).
    - The Console button carries Lucide `LockOpen` at 14px before its label.
- **Below 640px:** use `grid-template-columns: 1fr; row-gap: 20px`.
  - The right column falls below the status line, left-aligned.
  - The Console button keeps its natural width.
  - The segmented control becomes `width: 100%; grid-template-columns: 1fr 1fr`.

**Auth banner (`.notice.notice--warn`).**
- **Placement:** directly after `</header>`, inside a `.container` with `margin-top: 16px`. It sits above `main`, so `main` padding-top drops to `32px` while the banner is shown.
- **Layout:** `display: grid; grid-template-columns: auto minmax(0,1fr) auto; gap: 12px; align-items: start; padding: 12px 16px; background: var(--warn-tint); border: 1px solid var(--warn-line); border-radius: var(--r-control);`
- **Contents:**
  - Icon: Lucide `TriangleAlert`, 18px, `--warn`.
  - Text block: title at 14/20 weight 600 in `--ink`, then a body line at 13/20 in `--ink-2`.
  - Actions row: `display:flex; gap: 8px; flex-wrap: wrap; margin-top: 8px`. It holds a secondary "Try again" button and an "Open sign-in page" link styled as a text link. The link is an `<a href="/v2/auth-context" target="_top">`, and its behaviour is the lead's or Astra's call per the plan.
  - Dismiss button: icon-only Lucide `X` at 16px, 28×28 hit area, `aria-label`.
- **ARIA:** `role="status"`. It is non-blocking, so do not use `alert`.
- **Below 640px:** the dismiss button stays top-right, and the actions wrap.

**Secondary button (`.btn.btn--secondary`).** Used for Copy, Try again and the reveal toggle. Height 32px, padding `0 12px`, `gap: 6px`, `--surface` background, `1px solid var(--line-strong)` border, `--ink` text, 13px weight 550, `--r-control` radius. Hover: `--surface-hover` background. Disabled: `opacity: .45; cursor: not-allowed`.

**Icon button (`.btn--icon`).** 32×32, no border, transparent background, `--ink-3`. Hover: `--surface-inset` background and `--ink` text.

### 4.1 Overview section 1: How it works

**Section head:** eyebrow `01 · How it works`, `h2`, lede.

**Desktop (≥960px): a horizontal 3-step rail.**

```
■────────────────────────────■────────────────────────────■──────────────────────
01                            02                           03
Static skeletons              Secrets added at the edge    Rules refreshed daily
body (≤3 lines)               body                         body
profiles/<id>.yaml            GET /v2/config/<id>.yaml     /v2/rules/*.mrs · 24h
```

- `ol.steps { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-top: 1px solid var(--line-strong); }`
- `li.step { position: relative; padding: 24px 32px 0 0; }`
- The connector is the `border-top` itself.
- **Marker:** `li.step::before`, a 9×9 square at `top: -5px; left: 0`, `background: var(--canvas)`, `border: 1.5px solid var(--ink)`, `border-radius: 2px`.
- **Numeral:** `span.step__num`, `--t-mono-sm` at 12px, `--accent-ink`, weight 600, `margin-bottom: 8px`, `display: block`. Text `01`, `02`, `03`.
- Title: `h3` (`--t-card`), then `6px` before the body (`--t-body` at 14/22, `--ink-2`, `max-width: 34ch`).
- **Artifact line:** `p.step__artifact`, `margin-top: 12px`, `--t-mono-sm`, `--ink-3`. Write it as `<code>` without the inline-code background, so it reads as plain mono text.

**Mobile (<960px): a vertical timeline.**
- `ol.steps`: `grid-template-columns: 1fr; row-gap: 28px; border-top: 0; border-left: 1px solid var(--line-strong); margin-left: 4px;`
- `li.step`: `padding: 0 0 0 24px`.
- `::before`: `top: 6px; left: -5px`.

### 4.2 Overview section 2: Rule-set groups and upstreams

**Section head:** eyebrow `02 · Rule sets`, `h2`, lede.

**Priority legend strip** (above the list, `margin-bottom: 20px`): one row in `--t-mono-sm`, `--ink-3`:

`1 tailnet → 2 custom-proxy → 3 custom-direct → 4 direct → 5 global`

Each name is preceded by an 8px dot in its `--g`. The arrows are `--ink-4`. The row wraps on mobile.

**Group list:** `ol.groups { display: grid; gap: 16px; }`. There is **one full-width card per group**, in priority order.

**Group card (`article.group[data-group]`)** uses the standard card style, plus a **3px left accent bar**: `box-shadow: inset 3px 0 0 var(--g)`. This is the only "shadow" allowed, and it is really a border, not depth.

**Desktop (≥960px) internal grid:**

```
grid-template-columns: minmax(0, 5fr) minmax(0, 4fr) minmax(0, 3fr);
grid-template-areas: "head counts files" "sources sources sources";
column-gap: 32px; row-gap: 20px;
```

```
┃ 1  tailnet                    │ domain    ███████░░░  1,204  │ ⤓ tailnet.domain.mrs   2.1 KB
┃ Description sentence…         │ ipcidr    ██░░░░░░░░    312  │ ⤓ tailnet.ipcidr.mrs   0.4 KB
┃ Excludes: — / tailnet, direct │ classical ░░░░░░░░░░      0  │
┃ Outbound: tailscale or DIRECT │ before → after optimization  │
┃────────────────────────────────────────────────────────────────────────────────────
┃ ▸ Upstream sources (3)                                           AGPL-3.0 · MIT · CC0-1.0
```

**`head` area:**
- Row 1: `span.group__rank` (mono 12px, `--ink-3`, `min-width: 1.5ch`) + `h3.group__name` (mono, 16/22, weight 600, `--g-ink`), with `gap: 10px`.
- Then `p.group__desc` (`--t-body` 14/22, `--ink-2`, `margin-top: 6px`).
- Then a `dl.group__meta` as 2 rows of `dt`/`dd` inline pairs at `--t-small`:
  - `dt` is an eyebrow style at 11px, `min-width: 72px`.
  - `dd` is mono 12px in `--ink`.
  - The rows are **Excludes** (higher-priority group names as `--g-ink` text, or `—`) and **Routes to** (the outbound).

**`counts` area:** a `dl.counts` with 3 rows (`domain`, `ipcidr`, `classical`, always in that order). Each row is a grid: `grid-template-columns: 72px minmax(0,1fr) 7ch; gap: 12px; align-items: center; height: 24px`.
- Label: mono 12px, `--ink-3`.
- **Bar:** track height 6px, `--surface-inset` background, radius 3px. The fill is `background: var(--g)` with `width: <pct>%`.
  - **The percentage scales against the largest `final` count in this group**, so groups are not compared with each other. This avoids tiny tailnet bars.
  - A zero count gets no fill, and its number is shown in `--ink-4`.
- Count: mono 13px, tabular, right-aligned, `--ink`, formatted with thousands separators (`toLocaleString("en-US")`).
- Below the rows: `p.counts__delta` (`--t-small`, mono, `margin-top: 8px`), e.g. `Optimized 48,210 → 31,904 (−34%)`. That compares the sum of `before_optimization` with the sum of `final`. Hide it when the two are equal.

**`files` area:** `ul.files { display: grid; gap: 6px; }`. Each file is an `<a class="file-chip" href="/v2/rules/<name>" download>`:
- Layout: `display: grid; grid-template-columns: 16px minmax(0,1fr) auto; gap: 8px; align-items: center; padding: 6px 10px;`
- Style: `--surface-inset` background, `1px solid var(--line)` border, `--r-chip` radius, `--t-mono-sm`, `--ink`, no underline.
- Contents:
  - Lucide `Download` icon at 14px in `--ink-3`.
  - The file name, with `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`.
  - The size in `--ink-3` (`formatBytes`: `B` under 1 KiB, `KB` with 1 decimal, `MB` with 2 decimals; use KiB math but label it `KB`).
- Hover: border `--line-strong`, background `--surface-hover`, icon `--accent`.
- Above the list: an eyebrow saying `Files`, with `margin-bottom: 8px`. The `counts` area gets a matching eyebrow saying `Rules`.

**`sources` area:** spans all 3 columns, with `border-top: 1px solid var(--line); padding-top: 16px; margin-inline: -24px; padding-inline: 24px;`. It is a `<details class="sources">`.
- **`summary`:**
  - Layout: `display: flex; justify-content: space-between; align-items: center; gap: 16px; cursor: pointer; list-style: none; min-height: 32px;` and hide the default marker (`::-webkit-details-marker { display: none; }`).
  - Left side: Lucide `ChevronRight` at 16px, which rotates 90° when `[open]` (transition `transform var(--dur) var(--ease)`). Then the label at 14/20 weight 550 in `--ink`, then `(n)` in mono `--ink-3`.
  - Right side: license badges for the group's distinct licenses.
- **License badge:** `span.license` with `padding: 1px 6px; border: 1px solid var(--line-strong); border-radius: var(--r-chip); font: 500 11px/16px var(--font-mono); color: var(--ink-2)`.
- **Open content:** `div.table-wrap { margin-top: 12px; overflow-x: auto; }` around `table.sources__table` (width 100%, `border-collapse: collapse`, `--t-small`).
  - `thead th`: eyebrow style, left-aligned, `padding: 8px 12px`, `border-bottom: 1px solid var(--line-strong)`, `background: var(--surface-inset)`.
  - `td`: `padding: 10px 12px; border-bottom: 1px solid var(--line); vertical-align: top;`. The last row has no border.
  - **Columns:**

    | Column | Format |
    | --- | --- |
    | Source | mono 12px, `--ink` |
    | Upstream | link to `upstreams[key].homepage`, sans 13px; or plain text "This repository" for `local` |
    | Parser | mono 12px, `--ink-3` (`kind`) |
    | Input | mono, right-aligned |
    | Accepted | mono, right-aligned; sum of `accepted` |
    | License | the license badge |

  - Numeric columns get `text-align: right; white-space: nowrap`.
  - When `omitted_as_covered > 0`, add a mono 11px `--ink-3` second line under Accepted: `−n covered`.
  - `min-width: 640px` on the table, so it scrolls horizontally on phones instead of squashing.

**Tablet (640–959px):**
```
grid-template-columns: minmax(0,1fr) minmax(0,1fr);
grid-template-areas: "head head" "counts files" "sources sources";
```

**Mobile (<640px):** a single column with the areas `head`, `counts`, `files`, `sources`, and card padding `16px`. The sources area uses `margin-inline: -16px; padding-inline: 16px`.

**Loading state.** Render the 5 cards with static names and descriptions from the fallback (below). Replace each count number with a 5ch × 12px skeleton bar (`--surface-inset`, radius 3px) and each file chip with a skeleton row 28px tall. No shimmer animation; a static skeleton is calmer.

**Fallback when `stats.json` fails or is invalid.** The UI ships a static fallback list: name, description, priority, excludes, routes-to, file names, and upstream keys and licenses. Render the same cards from it, with these differences:
- Counts are replaced by one `p.group__unavailable` (`--t-small`, `--ink-3`) in the `counts` area: "Counts unavailable." No bars are drawn.
- File chips still link to `/v2/rules/<name>`, but the size column shows `—`.
- The Sources table shows the Source, Upstream and License columns only.
- Above the group list, show an inline `notice--warn` with no actions (the same component as the auth banner, minus buttons and dismiss), using the unavailable copy.
- The header status dot turns `--warn` and shows the unavailable template.

### 4.3 Overview section 3: Evaluation order, split DNS and device roles

**Section head:** eyebrow `03 · Routing`, `h2`, lede.

**Desktop (≥960px):** `display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); column-gap: 48px; align-items: start;`. **Below 960px:** a single column with `row-gap: 40px`; the ladder comes first.

**Left column: the evaluation ladder.**
- Sub-head `h3` (`--t-card`) + `p` caption (`--t-small`, `margin: 4px 0 16px`).
- `ol.ladder`: one card (standard style, padding 0, `overflow: hidden`), with 13 `li` rows.
- **Row:** `display: grid; grid-template-columns: 3ch 10px minmax(0,1fr) auto; gap: 12px; align-items: center; min-height: 40px; padding: 8px 16px; border-bottom: 1px solid var(--line);`
  - Step number: mono 12px, `--ink-4`, right-aligned, zero-padded to 2 digits.
  - Group dot: 8×8 circle in `--g`. Row 13 (`MATCH`) has no dot; render an empty cell.
  - Rule: mono 13px, `--ink`, ellipsized with a `title` attribute. Show only the provider name (`tailnet-domain`); the `RULE-SET,` prefix is implicit. A `no-resolve` modifier is appended in `--ink-3` 12px, e.g. `global-ipcidr  no-resolve`.
  - Target: mono 12px, right-aligned, in `--g-ink` for the routed group. `DIRECT` uses `--ink-2`. `default` uses `--accent-ink`. For tailnet use `tailscale / DIRECT`, wrapped in a `<span title="tailscale on iPad and Phone; DIRECT elsewhere">`.
- **Row 12 (`direct-ipcidr`) and row 11 (`global-ipcidr`)** get a 2px left marker: `box-shadow: inset 2px 0 0 var(--line-strong)`. A small caption, `ladder__note`, follows the list and explains the deliberate IP ordering.
- **Row 13 `MATCH,default`:** `background: var(--surface-inset)`, the rule is shown as `MATCH`, weight 600, and there is no bottom border.
- Hover: `--surface-hover` background (no transition needed).
- **Notes:** 2 notes after the card, as `ul.notes` (`--t-small`, `--ink-3`, `margin-top: 12px`, `padding-left: 18px`, `li + li { margin-top: 4px }`).

**Right column:** a stack with `display: grid; gap: 40px;`.

*Split DNS*
- `h3` + caption, then `ol.dns` as a card with padding 0 and 5 rows.
- **Row:** `display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 4px 16px; padding: 12px 16px; border-bottom: 1px solid var(--line);`
  - Left "Matches": sans 14/20 weight 550 `--ink`, with group dots inline before the group names.
  - Right "Resolver": mono 12/18 `--ink-2`, with each resolver on its own line.
  - An optional scope tag (e.g. "Phone only") sits under the match: `span.scope` in 11px, `--ink-3`, `font-style: normal`.
- Card header row: two eyebrows, `Matches` and `Resolver`, with `padding: 10px 16px; background: var(--surface-inset); border-bottom: 1px solid var(--line-strong)`.
- **Below 400px:** `grid-template-columns: 1fr`.
- After the card: `p.note` (`--t-small`, `margin-top: 12px`) for the Gateway exception.

*Device roles*
- `h3` + caption, then `ul.roles`, a card with 5 rows.
- **Row:** `display: grid; grid-template-columns: 20px minmax(0,1fr); gap: 4px 12px; padding: 12px 16px; border-bottom: 1px solid var(--line);`
  - Lucide icon at 18px, `--ink-3`, `grid-row: span 2`, `margin-top: 1px`.
  - Line 1: the title (14/20, weight 600) + `span.tag` with the parameter list, e.g. `s` or `h · k` (mono 11px, padding `0 5px`, `--surface-inset` background, `--r-chip`, `--ink-3`, `margin-left: 8px`). Omit the tag when the role takes no parameters.
  - Line 2: the one-line description (`--t-small`, `--ink-3`).
- **Icons:** gateway `Router`, server `Server`, laptop `Laptop`, ipad `Tablet`, phone `Smartphone`. These are the same icons as in the Console selector.

### 4.4 Overview section 4: Upstream attribution and footer

**Section head:** eyebrow `04 · Credits`, `h2`, lede.

**Table:** `table.attrib` inside a `.table-wrap` card (padding 0), width 100%.
- **Columns:** Project | Used for | License.
  - Project: an external link, sans 14/20 weight 550.
  - Used for: `--t-small`, `--ink-2`.
  - License: the license badge, or `—` for repository-maintained sources.
- `th` and `td` padding is `12px 16px`. The `th` uses the eyebrow style on a `--surface-inset` background.
- Row order: SukkaW/Surge, v2fly/domain-list-community, IANA Special-Purpose Registries, felixonmars/dnsmasq-china-list, gaoyifan/china-operator-ip, MetaCubeX/meta-rules-dat, liblaf/route-rules. The last row's License cell says `MIT`, and its Used for cell carries a `(generator)` note.
- **Data source:** drive rows from `stats.upstreams` when it is available and append the 2 non-`stats` rows (MetaCubeX, liblaf) statically. In fallback, use a fully static list.
- **Below 640px:** each `tr` becomes a block (`display: grid; grid-template-columns: 1fr auto; padding: 12px 16px;`). Project and License share row 1, and Used for spans row 2. Hide `thead` visually but keep it for screen readers with an `.sr-only` caption.

**Links row** (below the table, `margin-top: 16px`): `ul.doc-links`, `display: flex; flex-wrap: wrap; gap: 8px 24px;`. It holds 3 text links with Lucide icons (`FileText` for NOTICE, `Scale` for AGPL, `Github` for the repository; use `GitBranch` if `Github` is unavailable in the installed `@lucide/vue`).
- The repository link uses `stats.build.repository` when present. Hide it otherwise. Never hardcode a personal repository URL.

**Site footer (`footer.site-footer`):** sits after `main`, outside the sections. `border-top: 1px solid var(--line); padding: 24px 0 40px; --t-small; --ink-3;` holding one `.container`. The content is 2 lines: a licence line, and a build line in mono 12px (`Build <short sha> · Rules generated <UTC+8 timestamp>`). Hide the sha when `stats.build.commit` is absent. The footer appears in both views.

### 4.5 Console (private view)

The Console replaces the Overview in `main`. It has its own section head, with no number:
- eyebrow `Console`
- `h2` "Set up a device"
- a one-line lede

Then the two blocks below, with `28px` between them.

**A. Profile selector strip.**
- `div[role="radiogroup"][aria-labelledby="profile-label"]`, where `#profile-label` is a visually hidden heading or the eyebrow "Profile" (`margin-bottom: 8px`).
- **Grid:** `display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap: 12px;`
  - 640–959px: `repeat(3, …)`; the last 2 cards wrap left-aligned.
  - <640px: `repeat(2, …)`.
  - <400px: `1fr`.
- **Card (`button.profile[role="radio"][aria-checked]`):**
  - Layout: `display: grid; grid-template-columns: 20px minmax(0,1fr); gap: 2px 10px; align-items: start; padding: 14px 16px; text-align: left; min-height: 72px;`
  - Style: `background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); color: var(--ink);`
  - Contents: the Lucide icon (20px, `--ink-3`, `grid-row: span 2`), the title (15/20, weight 600), then the role tag (`--t-small` 12/16, `--ink-3`, `grid-column: 2`).
  - Hover: border `--line-strong`, background `--surface-hover`.
  - **Checked:** border `--accent`, plus `box-shadow: inset 0 0 0 1px var(--accent)` to make a 2px visual border with no layout shift. Background `--accent-tint`, icon `--accent-ink`.
  - In the top-right corner: a 16px Lucide `CircleCheck`, absolutely positioned at `top: 10px; right: 10px`, in `--accent`. It is shown only when checked; use `visibility` so nothing shifts.
- **Keyboard (roving tabindex):**
  - Only the checked card has `tabindex="0"`.
  - Arrow keys (Left/Up and Right/Down) move the selection and the focus, wrapping around.
  - Home and End jump to the first and last cards.
  - Space and Enter select.

**B. Workspace.**
- **Desktop (≥960px):** `display: grid; grid-template-columns: minmax(340px, 5fr) minmax(0, 7fr); gap: 24px; align-items: start;`
- **Below 960px:** a single column. The left column comes first and the YAML panel follows.

*Left column:* `div.ws-left { display: grid; gap: 16px; }` with 2 cards.

**1. Parameters card**
- Card header: `h3` "Parameters" + a one-line caption (`--t-small`), with `padding-bottom: 16px; margin-bottom: 16px; border-bottom: 1px solid var(--line)`.
- **No-parameter profiles** (gateway, laptop): the header is followed by a single `p.empty` (`--t-small`, `--ink-3`) with Lucide `CircleCheck` at 16px in `--ok`, inline. No inputs are shown.
- **Field:** `div.field { display: grid; gap: 6px; } + .field { margin-top: 16px; }`
  - `label`: 13/20, weight 550, `--ink`. Next to it, the URL parameter name as `code.param` (mono 11px, `--ink-3`, `margin-left: 6px`), e.g. `s`.
  - **Input:** height 40px, padding `0 12px`, `--surface` background, `1px solid var(--line-strong)` border, `--r-control` radius, mono 14px, `--ink`, `width: 100%`. Placeholder in `--ink-4`.
  - Input hover: border `--ink-4`.
  - Input focus: border `--focus` with `box-shadow: 0 0 0 3px var(--focus-halo)`.
  - Invalid (empty and required, shown only after blur or on first render with an empty value): border `--danger` and `aria-invalid="true"`.
  - Help text: `p.help` (`--t-small` 12/18, `--ink-3`, `id` referenced by `aria-describedby`).
- **Password field (`k`):** wrap it as `div.input-group { position: relative; }`. The input gets `padding-right: 44px`. The reveal toggle is a `.btn--icon` absolutely positioned at `right: 4px; top: 4px` (32×32), using `Eye` or `EyeOff`, with `aria-label` toggling between Show and Hide and `aria-pressed`. Set `autocomplete="off"`, `spellcheck="false"` and `autocapitalize="off"` on all three inputs.
- **Validation notice:** below the fields, `margin-top: 16px`, as `div.notice.notice--danger` (the warn layout with danger tokens). Use Lucide `CircleAlert`, with the title "Missing values" and a `ul` listing each missing field. Use `role="status"` and `aria-live="polite"`. It is visible only when `issues.length > 0`.

**2. Import card**
- Header: `h3` "Import URL" + caption.
- **URL box (`div.url-box`):** `display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px; align-items: center; padding: 8px 8px 8px 12px; background: var(--surface-inset); border: 1px solid var(--line); border-radius: var(--r-control);`
  - `code.url-box__text`: mono 12/18, `--ink-2`, `word-break: break-all`. Wrap the URL; do not ellipsize it, because users need to verify it. Cap it at `max-height: 5lh; overflow: auto`.
  - Masking: show the password as `••••••` (always 6 bullets, never the real length) in `--ink-3`.
  - `div.url-box__actions { display: flex; gap: 4px; }` holds an icon reveal toggle (`Eye`/`EyeOff`, `aria-pressed`) and a secondary **Copy** button (`Copy` → `Check` + "Copied" for 1.4s, with the Check icon in `--ok`).
  - **Below 400px:** the actions move to row 2, right-aligned.
- **Credential warning:** `p.warning`, `margin-top: 10px`, `--t-small` 12/18, `--ink-3`, with Lucide `KeyRound` at 14px inline in `--warn`.
- **QR block (`figure.qr`):** `margin: 20px 0 0; display: grid; justify-items: center; gap: 10px; padding-top: 20px; border-top: 1px solid var(--line);`
  - The QR sits in a frame: `div.qr__frame { padding: 12px; background: #FFFFFF; border: 1px solid var(--line); border-radius: var(--r-control); }`.
  - The QR is always black on white, in both colour modes, for scanner reliability. Render it with `QrcodeVue` as SVG, `size` 200, `level="M"`, `margin` 0 (the frame padding provides the quiet zone).
  - The frame is `width: min(224px, 100%)`. Its SVG is `width: 100%; height: auto`.
  - `figcaption` is `--t-small`, `--ink-3`, centred, `max-width: 32ch`.
  - **Placeholder** while values are missing or auth is not ready: the same frame size, `aspect-ratio: 1`, `--surface-inset` background, a dashed `1px var(--line-strong)` border, and a centred Lucide `QrCode` at 32px in `--ink-4`. The placeholder caption reads in `--ink-3`.
- On desktop the Import card sits below Parameters, so the QR stays visible without scrolling on a 900px-tall viewport when the profile has 2 or fewer fields. Do not add extra spacing.

*Right column: the YAML panel* (`section.yaml-panel[aria-labelledby]`).
- **Panel:** `display: flex; flex-direction: column; background: var(--code-bg); border: 1px solid var(--code-line); border-radius: var(--r-card); overflow: hidden;`
- **Desktop sticky:** `position: sticky; top: 24px; height: calc(100vh - 48px); max-height: 960px; min-height: 480px;`. Use `100dvh` where supported, with `100vh` as the fallback.
- **Below 960px:** `position: static; height: auto;`, and the body gets `max-height: 70vh; min-height: 320px`.
- **Header bar:** `display: flex; align-items: center; justify-content: space-between; gap: 12px; height: 48px; padding: 0 12px 0 16px; background: var(--code-bar); border-bottom: 1px solid var(--code-line);`
  - Left side: `h3` at 13/20 weight 600 in `--code-ink`, then the file name `<id>.yaml` in mono 12px `--code-muted` (`margin-left: 8px`).
  - Also on the left: a loading indicator, an 8px dot in `--code-muted` with `opacity` pulsing from .4 to 1 over 1.2s (static under reduced motion) and the visually hidden text "Rendering…".
  - Right side: **Copy YAML**, a dark variant of the secondary button: `background: transparent; border: 1px solid var(--code-line); color: var(--code-ink);`, with hover background `#1F232A`.
- **Body:** `flex: 1; overflow: auto; overscroll-behavior: contain;`
  - `pre` has `margin: 0; padding: 16px 20px;` and `code.hljs` uses `--t-code`.
  - Keep `white-space: pre`, which scrolls horizontally; do not wrap YAML.
- **States** render inside the body as `div.yaml-state` (`padding: 24px 20px; color: var(--code-muted); font-size: 13px; line-height: 20px; display: flex; gap: 10px;`) with a 16px Lucide icon:
  - Incomplete: `FileCode`.
  - Loading the first render: `LoaderCircle`.
  - Error: `CircleAlert` in `#FF8E86`, with the text in `#FFB4AE`.
  - **During re-renders, keep the previous YAML visible** with `opacity: .55` (transition `var(--dur)`) instead of replacing it with a loading message.
- `aria-busy` on the panel mirrors `loading`.

**Console while authenticating** (arriving at `?profile=` or after clicking Console, before `auth-context` resolves): render the Console section head and a skeleton of the selector and workspace at reduced opacity. Do not render the Overview first and then swap it out. If auth fails, show the Overview plus the auth banner.

## 5. Micro-interactions and accessibility

- **Focus.** Apply this globally to `:where(a, button, input, summary, [tabindex]):focus-visible`: `outline: 2px solid var(--focus); outline-offset: 2px; border-radius: inherit;`. Inputs instead use the border + halo described above (`outline: none` on inputs only). Never remove focus styles on `:focus` without a `:focus-visible` replacement.
- **Disclosures.** Use native `<details>`/`<summary>` for upstream sources. Animate only the chevron rotation. Optional content fade: `.sources[open] .table-wrap { animation: fade-in var(--dur) var(--ease); }` with `@keyframes fade-in { from { opacity: 0; transform: translateY(-2px); } }`. Do not animate height.
- **Transitions.** Allowed on `background-color`, `border-color`, `color`, `opacity` and `transform` only, at `var(--dur) var(--ease)`.
- **Reduced motion:**
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
  ```
  Spinners become static icons.
- **Landmarks.** Use `header`, `main` and `footer`. In the Overview, each section is a `<section aria-labelledby="h2-id">`.
- **View switch.** Use `nav[aria-label="View"]` + buttons with `aria-current="page"`. Do not use `tablist`: the views change the URL and history, so they behave like pages, not tabs. On a view change, move focus to the new view's `h2` (`tabindex="-1"`) and update `document.title`.
- **Profile selector.** `role="radiogroup"` with `role="radio"` buttons and `aria-checked`, using the roving tabindex described in 4.5.
- **Live regions.**
  - Keep one visually hidden `div#announcer[aria-live="polite"]` near the end of `body`. It announces "Import URL copied", "YAML copied", "Signed in. Console unlocked." and "Couldn't open Console."
  - Do not put `aria-live` on the copy buttons themselves.
- **Toggles.** Password and URL reveal buttons use `aria-pressed` and an `aria-label` that changes between "Show …" and "Hide …".
- **Tables.** Each table has a `<caption class="sr-only">`, and numeric `td`s are plain text (no icon-only values).
- **Contrast.** All text tokens on their intended surfaces are ≥4.5:1. `--ink-4` is for placeholders, disabled text and separators only.
- **Touch targets.** On `pointer: coarse`, interactive elements are at least 40×40px: icon buttons grow to 40px and chips to 36px tall.
- **`.sr-only`.** Use the standard clip pattern.
- **Remove** the old unused classes from `style.css` (`.sortable-list`, `.multi-block`, `.block-row`, etc.) during the rewrite.

---

---

# PART 2: Polished English UI Copy (by Gemini 4 Neon — use verbatim)

The copy uses sentence case throughout, except product and proper names. `{…}` marks an interpolated value.

## `v2/index.html`
- `title`: `Unified Mihomo Config`
- `meta.description`: `Mihomo profiles for five device roles, with routing rules compiled daily from open-source lists and served from Cloudflare Workers.`
- Runtime `document.title`: Overview → `Unified Mihomo Config`; Console → `Console · Unified Mihomo Config`

## Header
- `header.title`: `Unified Mihomo Config`
- `header.intro`: `Static Mihomo profiles for every device, with open-source routing rules compiled daily and served from Cloudflare Workers.`
- `status.loading`: `Checking rule status…`
- `status.fresh`: `Rules built {YYYY-MM-DD HH:mm} UTC+8 · {age} · {groups} groups · {files} files`
- `status.stale`: `Rules built {YYYY-MM-DD HH:mm} UTC+8 · {age} (stale) · {groups} groups · {files} files`
- `status.unavailable`: `Rule status unavailable · showing built-in summary`
- `age` format: `just now` (<1 min), `{n}m ago`, `{n}h ago`, `{n}d ago`
- `btn.console.locked`: `Console` (with Lock icon; `aria-label`: `Open Console (sign-in required)`)
- `btn.console.waiting`: `Signing in…`
- `switch.overview`: `Overview`
- `switch.console`: `Console`
- `switch.aria`: `View`

## Auth banner
- `auth.title`: `Couldn't open Console`
- `auth.body.cancelled`: `Sign-in was cancelled or the credentials were rejected. You can still browse the Overview.`
- `auth.body.error`: `Couldn't reach the server. Check your connection and try again.`
- `auth.retry`: `Try again`
- `auth.fallback`: `Open sign-in page`
- `auth.fallbackHint` (title attribute): `Use this if the sign-in prompt doesn't appear (for example, in an in-app browser).`
- `auth.dismiss` (aria-label): `Dismiss`

## 01 · How it works
- `how.eyebrow`: `01 · How it works`
- `how.title`: `Three parts, one Import URL`
- `how.lede`: `Import one URL per device. The profile structure stays static while routing rules update automatically.`
- `how.step1.title`: `Static profiles`
- `how.step1.body`: `Each of the five device roles has its own Mihomo YAML template covering DNS, TUN, proxies, and rule order. Every profile is validated with mihomo -t before deploy.`
- `how.step1.artifact`: `profiles/{role}.yaml`
- `how.step2.title`: `Secrets injected at the edge`
- `how.step2.body`: `When a device fetches its profile, the Worker injects your subscription URL, DoH endpoint, and device parameters. Secrets stay on the server and never load on this page.`
- `how.step2.artifact`: `GET /v2/config/{role}.yaml`
- `how.step3.title`: `Daily rule updates`
- `how.step3.body`: `A daily build fetches upstream lists, deduplicates overlaps, and compiles compact rule files. Mihomo refreshes them every 24 hours—no re-import needed.`
- `how.step3.artifact`: `/v2/rules/*.mrs · every 24h`

## 02 · Rule sets
- `groups.eyebrow`: `02 · Rule sets`
- `groups.title`: `Rule-set groups`
- `groups.lede`: `Traffic is matched against five groups in priority order. Rules covered by a higher-priority group are stripped from lower ones.`
- `groups.priorityAria`: `Priority order`
- `groups.label.excludes`: `Excludes`
- `groups.label.routesTo`: `Routes to`
- `groups.label.rules`: `Rules`
- `groups.label.files`: `Files`
- `groups.excludes.none`: `—`
- `groups.count.domain` / `ipcidr` / `classical`: `domain` / `ipcidr` / `classical`
- `groups.delta`: `Reduced {before} → {after} ({pct})`
- `groups.fileAria`: `Download {file} ({size})`
- `groups.sources.summary`: `Upstream sources`
- `groups.sources.count`: `({n})`
- `groups.sources.col.source` / `upstream` / `parser` / `input` / `accepted` / `license`: `Source` / `Upstream` / `Parser` / `Input` / `Accepted` / `License`
- `groups.sources.local`: `This repository`
- `groups.sources.covered`: `−{n} already covered`
- `groups.unavailable.counts`: `Counts unavailable.`
- `groups.unavailable.notice.title`: `Live stats unavailable`
- `groups.unavailable.notice.body`: `Couldn't load stats.json, so a built-in summary is shown instead. Rule files can still be downloaded.`
- Routes-to values: tailnet `tailscale (iPad, Phone) or DIRECT`; custom-proxy `default`; custom-direct `DIRECT`; direct `DIRECT`; global `default`

## Group descriptions (also for `rulesets/rulesets.json`)
- `tailnet`: `Private Tailnet IPs and hostnames, kept off the main proxy.`
- `custom-proxy`: `Custom domains and rules always routed through the proxy.`
- `custom-direct`: `Custom domains and rules always routed directly.`
- `direct`: `Mainland China networks, private/LAN IP ranges, academic publishers, and local direct rules.`
- `global`: `International services (AI, Apple, Google, Telegram, and more) routed through the proxy.`

## 03 · Routing
- `routing.eyebrow`: `03 · Routing`
- `routing.title`: `How traffic is routed`
- `routing.lede`: `All five profiles share the same rule order; only the Tailnet target and a few DNS settings vary by device.`
- `ladder.title`: `Evaluation order`
- `ladder.caption`: `Mihomo evaluates rules top to bottom and stops at the first match.`
- `ladder.target.tailnet.title`: `tailscale on iPad and Phone; DIRECT elsewhere`
- `ladder.noResolve`: `no-resolve`
- `ladder.note1`: `Domain and classical rules run before IP ranges, so most connections match without a DNS lookup.`
- `ladder.note2`: `Global IP ranges run first with no-resolve to avoid unnecessary DNS lookups. Direct IP ranges follow and intentionally resolve remaining domains (similar to GEOIP,CN).`
- `dns.title`: `Split DNS`
- `dns.caption`: `DNS queries follow the same rule groups so direct and proxied domains use their respective resolvers.`
- `dns.col.matches` / `dns.col.resolver`: `Matches` / `Resolver`
- `dns.row1.match`: `+.tailnet`; `scope`: `Phone only`; `resolver`: `ts://tailscale`
- `dns.row2.match`: `tailnet and custom-proxy domains`; `resolver`: `Encrypted DoH`
- `dns.row3.match`: `custom-direct and direct domains`; `resolver`: `101.6.6.6` / `223.5.5.5` / `119.29.29.29`
- `dns.row4.match`: `Everything else`; `resolver`: `Encrypted DoH`
- `dns.row5.match`: `Bootstrap (DoH hostname)`; `resolver`: `101.6.6.6` / `223.5.5.5` / `119.29.29.29`
- `dns.note`: `Gateway keeps its native DNS setup and doesn't use these split-DNS policies.`
- `roles.title`: `Device roles`
- `roles.caption`: `Each role has a dedicated profile tailored to its network setup.`
- `roles.gateway`: `Gateway`: `Serves the LAN and connects directly to the proxy subscription. The only profile without TUN.`
- `roles.server`: `Server` (tag `s`): `Uses TUN and routes proxied traffic through the Gateway. Native Tailscale handles the Tailnet.`
- `roles.laptop`: `Laptop`: `Uses TUN and connects directly to the proxy subscription. Native Tailscale handles the Tailnet.`
- `roles.ipad`: `iPad` (tag `h · k`): `Uses TUN and Mihomo's built-in Tailscale proxy for Tailnet traffic.`
- `roles.phone`: `Phone` (tag `h · k`): `Same as iPad, plus Tailnet DNS via ts://tailscale.`

## 04 · Credits
- `credits.eyebrow`: `04 · Credits`
- `credits.title`: `Upstream sources and licenses`
- `credits.lede`: `Rule sets are compiled from these open-source projects. Generated files retain their upstream licenses.`
- `credits.col.project` / `usedFor` / `license`: `Project` / `Used for` / `License`
- `credits.sukka`: `China, LAN, Apple CN, AI, Apple, Telegram, and global lists`
- `credits.v2fly`: `Domain categories for CN, private, AI, Apple, Google, and non-CN sites`
- `credits.iana`: `Special-purpose IPv4 and IPv6 address blocks`
- `credits.felixonmars`: `Mainland China domain list`
- `credits.gaoyifan`: `Mainland China IPv4 and IPv6 ranges`
- `credits.metacubex`: `ASN database for IP-ASN rules (fetched by devices at runtime)`
- `credits.liblaf`: `Original rule compiler, adapted for this build`
- `credits.local`: `This repository`: `Tailnet, custom, and local direct rules`
- `credits.link.notice`: `Read NOTICE`
- `credits.link.agpl`: `AGPL-3.0 license`
- `credits.link.repo`: `Source on GitHub`
- `footer.license`: `Project code is MIT-licensed. Compiled rule files follow their upstream licenses; see NOTICE.`
- `footer.build`: `Build {sha7} · Rules built {YYYY-MM-DD HH:mm} UTC+8`

## Console
- `console.eyebrow`: `Console`
- `console.title`: `Set up a device`
- `console.lede`: `Choose a profile, fill in any required parameters, then scan the QR code or copy the Import URL into Mihomo.`
- `console.loading`: `Opening Console…`
- `console.signedIn` (announcer): `Signed in. Console unlocked.`
- `profiles.label`: `Profile`
- Profile titles and role tags:
  - `gateway`: `Gateway`, `LAN gateway · no TUN`
  - `server`: `Server`, `Proxies via Gateway`
  - `laptop`: `Laptop`, `TUN · native Tailscale`
  - `ipad`: `iPad`, `TUN · built-in Tailscale`
  - `phone`: `Phone`, `iPad setup + Tailnet DNS`
- `params.title`: `Parameters`
- `params.caption`: `Saved locally in this browser for 30 days.`
- `params.none`: `No parameters needed—this profile is ready to import.`
- `field.s.label`: `Gateway address`; `placeholder`: `192.168.1.1`; `help`: `LAN IP or hostname of your Gateway's Mihomo HTTP proxy.`
- `field.h.label`: `Tailscale hostname`; `placeholder`: `my-ipad`; `help`: `Name shown for this device in your Tailnet.`
- `field.k.label`: `Tailscale auth key`; `placeholder`: `tskey-auth-…`; `help`: `A reusable or pre-approved key from the Tailscale admin console. Included only in the Import URL and never written to the browser address bar.`
- `field.k.show` / `field.k.hide` (aria-label): `Show auth key` / `Hide auth key`
- `issues.title`: `Missing parameters`
- `issues.item`: `Enter the {label}.`
- `import.title`: `Import URL`
- `import.caption`: `Paste this URL into Mihomo or your Clash client to import the profile.`
- `import.show` / `import.hide` (aria-label): `Show password` / `Hide password`
- `import.copy` / `import.copied`: `Copy` / `Copied`
- `import.copiedAnnounce`: `Import URL copied`
- `import.warning`: `Contains your sign-in password and device keys. Use only on your own devices.`
- `import.pending`: `Fill in the required parameters to generate the Import URL.`
- `import.authUnavailable`: `Couldn't load your credentials. Reload the Console to try again.`
- `qr.caption`: `Scan with your camera or Mihomo app to import.`
- `qr.placeholder`: `Fill in all required parameters to generate the QR code.`
- `qr.aria`: `QR code for the {Profile} Import URL`
- `yaml.title`: `Rendered YAML`
- `yaml.file`: `{id}.yaml`
- `yaml.copy` / `yaml.copied`: `Copy YAML` / `Copied`
- `yaml.copiedAnnounce`: `YAML copied`
- `yaml.loading`: `Rendering…`
- `yaml.incomplete`: `Fill in the required parameters to preview this profile.`
- `yaml.error`: `Failed to render profile: {message}`
- `yaml.errorGeneric`: `Failed to render profile. Please try again.`
- `yaml.authExpired`: `Your session expired. Open Console again to sign in.`


---

# ADDENDUM: Section `01 · How it works` — Annotated `laptop.yaml` Skeleton Showcase (Visual & Layout Spec by Claude Opus 5.5)

## A1. Layout

The three steps act as the legend, and the static `laptop.yaml` code panel is the diagram. Numbered markers in the panel's gutter (`1`, `2`, `3`) link each zone of the YAML to its step.

| Viewport | Layout |
| --- | --- |
| **≥1200px** | `.how-grid { display: grid; grid-template-columns: minmax(0, 4fr) minmax(0, 7fr); column-gap: 64px; align-items: start; margin-top: 28px; }`<br>Left: `ol.steps` as a vertical timeline (`position: sticky; top: 24px`).<br>Right: `figure.anatomy` (`div.anatomy-box` + plain editorial `figcaption` outside/below the dark box with `margin-top: 10px`). |
| **960–1199px** | Single column, `row-gap: 32px`. `ol.steps` uses the horizontal 3-column rail; `figure.anatomy` sits below with `max-width: 820px`, left-aligned. |
| **<960px** | Single column, `row-gap: 28px`. `ol.steps` uses the vertical timeline; `figure.anatomy` is full container width. |
| **<640px** | Code font drops to `12px/19px`, `.ln { padding-right: 16px }`. Long lines scroll horizontally inside `pre`, never the page. |

## A2. Zone CSS Custom Properties

```css
:root {
  /* Code panel (dark in both modes) */
  --z-static-code: #4a515b;
  --z-secret-code: #e58ac0;
  --z-secret-band: rgba(229, 138, 192, 0.1);
  --z-secret-mark: rgba(229, 138, 192, 0.2);
  --z-secret-mark-ink: #f4b8da;
  --z-rules-code: #5db4e6;
  --z-rules-band: rgba(93, 180, 230, 0.07);

  /* Canvas legend tokens */
  --z-static: var(--ink-3);
  --z-static-ink: var(--ink-3);
  --z-static-tint: var(--surface-inset);
  --z-secret: #b8457f;
  --z-secret-ink: #9c3369;
  --z-secret-tint: #f8e6ef;
  --z-rules: #2d86b8;
  --z-rules-ink: #1d6890;
  --z-rules-tint: #e2eff6;
}
@media (prefers-color-scheme: dark) {
  :root {
    --z-secret: #e58ac0;
    --z-secret-ink: #f2aed5;
    --z-secret-tint: rgba(229, 138, 192, 0.14);
    --z-rules: #5db4e6;
    --z-rules-ink: #93cff0;
    --z-rules-tint: rgba(93, 180, 230, 0.14);
  }
}
[data-zone="static"] {
  --z: var(--z-static);
  --z-ink: var(--z-static-ink);
  --z-tint: var(--z-static-tint);
  --zc: var(--z-static-code);
  --zb: transparent;
}
[data-zone="secret"] {
  --z: var(--z-secret);
  --z-ink: var(--z-secret-ink);
  --z-tint: var(--z-secret-tint);
  --zc: var(--z-secret-code);
  --zb: var(--z-secret-band);
}
[data-zone="rules"] {
  --z: var(--z-rules);
  --z-ink: var(--z-rules-ink);
  --z-tint: var(--z-rules-tint);
  --zc: var(--z-rules-code);
  --zb: var(--z-rules-band);
}
```

## A3. Steps as Legend & Optional CSS `:has()` Hover Link

- Each `li` in `ol.steps` carries `data-zone="static" | "secret" | "rules"`.
- `li::before` square marker uses `border-color: var(--z)`; numeral (`01`/`02`/`03`) uses `color: var(--z-ink)`.
- Place `span.zone-tag` after `h3` and before body (`margin: 2px 0 8px; display: inline-block; padding: 1px 6px; border-radius: var(--r-chip); background: var(--z-tint); color: var(--z-ink); font: 600 12px/16px var(--font-sans);`).
- CSS-only hover link:
  ```css
  @media (hover: hover) {
    .how-grid:has(.steps li[data-zone="static"]:hover) .ln:not([data-zone="static"]),
    .how-grid:has(.steps li[data-zone="secret"]:hover) .ln:not([data-zone="secret"]),
    .how-grid:has(.steps li[data-zone="rules"]:hover) .ln:not([data-zone="rules"]) {
      opacity: 0.4;
    }
  }
  .ln {
    transition: opacity var(--dur) var(--ease);
  }
  ```

## A4. Anatomy Panel (`figure.anatomy`)

- Reset global `figure` centering: `figure.anatomy { margin: 0; text-align: left; }`.
- Dark code card `.anatomy-card { background: var(--code-bg); border: 1px solid var(--code-line); border-radius: var(--r-card); overflow: hidden; }` (no Copy button, no inner vertical scroll).
- `.anatomy-head`: `background: var(--code-bar); border-bottom: 1px solid var(--code-line); padding: 10px 16px; display: flex; align-items: baseline; gap: 10px;` containing `code` (`13px`, `--code-ink`) + badge `span` (`12px` sans, `--code-muted`).
- `pre`: `margin: 0; padding: 12px 0; overflow-x: auto; font: 12.5px/20px var(--font-mono); tab-size: 2; color: var(--code-ink);` (`tabindex="0"` + `aria-label`). Inner `code`: `display: block; min-width: max-content; font: inherit; white-space: pre; overflow-wrap: normal;` (override global `code` `overflow-wrap: anywhere`!).
- `.ln`: `display: block; position: relative; padding: 0 20px 0 37px; border-left: 3px solid var(--zc); background: var(--zb); min-height: 20px;`.
- `.ln[data-marker]::before`: `content: attr(data-marker); position: absolute; left: 10px; top: 2px; width: 16px; height: 16px; border-radius: 3px; font: 600 10px/16px var(--font-mono); text-align: center; color: var(--code-bg); background: var(--zc);` (for `data-zone="static"`, use `background: var(--code-muted)` so `1` has crisp contrast).
- Inline token styling (no `highlight.js`):
  - `{{{doh_url}}}` and `{{{subscription}}}`: `<mark>` (`background: var(--z-secret-mark); color: var(--z-secret-mark-ink); border-radius: 3px; padding: 0 2px;`)
  - `{{{public_base_url}}}`: `color: var(--code-muted)` (public URL, NOT a secret!)
  - `# ...` comments: `color: var(--code-muted)`
  - `86400` in `rules` zone: `color: var(--z-rules-code)`
- Plain editorial `figcaption` outside `.anatomy-card`: `margin-top: 10px; font: 13px/20px var(--font-sans); color: var(--ink-3); max-width: 68ch;`.
- Static data array hardcoded directly in `Overview.vue` (do NOT import `profiles/laptop.yaml`).

## A5. Polished Copy & Curated 42-Line `laptop.yaml` Excerpt (by Gemini 4 Neon — use verbatim)

- `how.eyebrow`: `01 · How it works`
- `how.title`: `Three parts, one Import URL`
- `how.lede`: `Import a single URL per device. Using the Laptop profile as an example, here's what's public, what stays private, and what refreshes automatically.`

**Step 1 (`data-zone="static"`)**
- `how.step1.title`: `Static skeleton`
- `how.step1.tag`: `Public · in Git`
- `how.step1.body`: `Ports, TUN, proxy groups, and rule evaluation order. Each of the five device roles has its own template, validated with mihomo -t before deploy. Because the skeleton rarely changes, you only import it once.`
- `how.step1.artifact`: `profiles/{role}.yaml`

**Step 2 (`data-zone="secret"`)**
- `how.step2.title`: `Secrets injected at the edge`
- `how.step2.tag`: `Private · Console only`
- `how.step2.body`: `Your subscription URL and DoH endpoint live in Worker secrets, never in Git. The Import URL and QR code appear only in the password-protected Console, and the Worker injects those secrets whenever a device fetches its profile—along with per-device parameters for Server, iPad, and Phone.`
- `how.step2.artifact`: `GET /v2/config/{role}.yaml · sign-in required`

**Step 3 (`data-zone="rules"`)**
- `how.step3.title`: `Auto-updating rules`
- `how.step3.tag`: `Public · refreshed every 24h`
- `how.step3.body`: `Rule providers point to public files hosted on this site. A daily build compiles them from open-source lists, and Mihomo pulls fresh copies every 24 hours—so rule changes never require re-importing the profile.`
- `how.step3.artifact`: `/v2/rules/*.mrs, *.txt · every 24h`

**Panel**
- `anatomy.file`: `profiles/laptop.yaml`
- `anatomy.badge`: `Abridged`
- `anatomy.aria`: `Abridged laptop.yaml annotated by step: 1 static skeleton, 2 private secrets, 3 auto-updating rule providers.`
- `anatomy.caption`: `Abridged illustration of the Laptop profile; the live file may differ. Markers 1–3 correspond to the steps. Highlighted {{{…}}} placeholders are secrets injected by the Worker, while public_base_url is simply this site's public URL.`

**Exact 42-line static excerpt (`[Zone, string][]`, markers `1`, `2`, `3` on the first occurrence of `"static"`, `"secret"`, `"rules"` respectively):**

```yaml
mixed-port: 7890                                              # static (marker 1)
mode: rule                                                    # static
# … LAN access, controller, logging, geo settings             # static
                                                              # static (empty line)
dns:                                                          # static
  nameserver: ["{{{doh_url}}}"]                               # secret (marker 2)
  nameserver-policy:                                          # static
    'rule-set:tailnet-domain,custom-proxy-domain': "{{{doh_url}}}" # secret
    'rule-set:custom-direct-domain,direct-domain': [101.6.6.6, …]  # static
                                                              # static (empty line)
tun:                                                          # static
  enable: true                                                # static
  route-exclude-address:                                      # static
    - 100.88.0.0/16  # Leave Tailnet routes to native Tailscale # static
                                                              # static (empty line)
proxy-providers:                                              # static
  main-subscription:                                          # static
    type: http                                                # static
    url: "{{{subscription}}}"                                 # secret
    interval: 3600                                            # static
                                                              # static (empty line)
proxy-groups:                                                 # static
  - name: default                                             # static
    type: select                                              # static
    use: [main-subscription]                                  # static
                                                              # static (empty line)
rule-providers:                                               # rules (marker 3)
  tailnet-domain:                                             # rules
    type: http                                                # rules
    behavior: domain                                          # rules
    format: mrs                                               # rules
    url: "{{{public_base_url}}}/v2/rules/tailnet.domain.mrs"  # rules
    proxy: DIRECT                                             # rules
    interval: 86400                                           # rules
  # … 11 more: tailnet-ipcidr, custom-*, direct-*, global-*   # rules
                                                              # static (empty line)
rules:                                                        # static
  - RULE-SET,tailnet-domain,DIRECT                            # static
  - RULE-SET,tailnet-ipcidr,DIRECT,no-resolve                 # static
  # … 9 more, in priority order                               # static
  - RULE-SET,direct-ipcidr,DIRECT                             # static
  - MATCH,default                                             # static
```
(Note: strip the right-hand `# static / # secret / # rules` zone annotations above — only the 4 YAML `# …` / `# Leave Tailnet...` comments inside the YAML itself are rendered!)
