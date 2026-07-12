# Live thumbnail preview loop — design

Date: 2026-07-12 · Status: approved

## Goal

Iterate on thumbnails visually without the render→collect→upload cycle. Two surfaces:

1. **Zod prop schema on `ThumbTemplate`** → GUI controls in `npx remotion studio` with instant
   hot reload. The host fine-tunes text/sizes live; the agent gets the layout right.
2. **`/thumbs-preview` contact sheet** → renders all current thumb variants + a self-refreshing
   dark-bg gallery. Text-feedback loop: host reads the sheet, agent edits + re-renders, page
   updates in ≤2 s. No uploads, no manual collection.

Both are episode-agnostic (paths from `STATE.md` / repo root) and plugin-portable.

## Part 1 — Zod schema (Studio editing)

New file `remotion/src/thumb-schema.ts` — single source of truth for the prop shape, exported as
`thumbSchema` (a `z.object`) plus `export type ThumbTemplateProps = z.infer<typeof thumbSchema>`.
Mirrors the current round-3 props exactly; **additive only** (no prop removed/renamed):

| Prop | Zod | Studio control |
|---|---|---|
| `repoName` | `z.string()` | text |
| `verdict` | `z.enum(VERDICTS)` | dropdown (the 4) |
| `layout` | `z.enum(['logo-right','logo-hero','logo-spot']).optional()` | dropdown |
| `verdictPosition` | `z.enum(['top-right','mid-left','top-left']).optional()` | dropdown |
| `logoScale` | `z.number().min(0.4).max(2).optional()` **(NEW)** | number |
| `hook` | `z.array(z.object({ text, size:z.enum(['xl','lg','md']), weight, accent }))` | array editor |
| `logo` | `z.object({ src?, glyph? })` | text fields |
| `accent`, `glowColor` | `zColor().optional()` | color picker |
| `bgImage` | `z.string().optional()` | text |
| `texture` | `z.object({ text, tone? }).optional()` | nested |
| `branding` | `z.object({ channelName, tagline, accent:zColor() }).optional()` | nested |

- `remotion/package.json`: add `zod@^3`, `@remotion/zod-types` (`zColor`); `pnpm install` in `remotion/`.
- `ThumbTemplate.tsx`: import the type from `thumb-schema`; wire `logoScale`
  (`const logoW = cfg.logoW * (logoScale ?? 1)`, scale the glow that references it). Nothing else changes.
- `Root.tsx`: add `schema={thumbSchema}` to the generic `ThumbTemplate` composition and the
  preset-mapped compositions, so GUI controls appear whichever the host opens.

## Part 2 — `/thumbs-preview` contact sheet

Render source: `episodes/<ep>/assets/thumb-variants.json` = `[{ label, props }]` where `props` is a
full `ThumbTemplateProps`. Seeded for ep001 from the three existing astryx presets. Tracked in git
via a gitignore exception (`!episodes/*/assets/thumb-variants.json`); the `preview/` renders stay ignored.

Testable pure logic → `scripts/lib/thumb-preview.ts` (unit-tested): `loadVariants()`, `resolveEpisode()`,
`buildIndexHtml()`. Orchestrator → `scripts/thumbs-preview.ts` (`node --import tsx`, arg pattern like
`fetch-star-history.ts`). Command doc → `.claude/commands/thumbs-preview.md`.

Steps:
1. Resolve episode (`--episode` or newest ep dir with a `thumb-variants.json`).
2. Per variant → write props to a temp JSON → `cd remotion && npx remotion still ThumbTemplate
   <preview>/thumb-vN.png --props=<tmp>` → `downscalePng(..., 120)` → `thumb-vN.120.png`.
3. Write `preview/index.html`: dark bg; per variant a full-size image + the 120px copy shown on
   **both a dark strip and a light strip** (mobile glance + white YouTube/Google SERP test);
   label + `hook text` / `verdict` printed under each; `<meta http-equiv="refresh" content="2">`.
   Cache-bust `?m=<mtime>` baked per image at generation → re-render refetches, meta-refresh between
   renders serves cached (no flicker).
4. `openInBrowser()` **only if `index.html` did not exist at start** (first run); re-renders refresh
   in place. `--open` forces.

### Platform boundary (documented constraint)

macOS-only, consistent with the pipeline (Screen Studio / DaVinci Resolve are macOS). The only
OS-specific touchpoints are two helpers in `scripts/lib/platform.ts`:
- `openInBrowser(path)` → `open` (macOS). Cross-platform swap: `xdg-open` / `start`.
- `downscalePng(src, out, width)` → `sips --resampleWidth`. Cross-platform swap: `npx sharp` or `ffmpeg -vf scale`.

Marketplace portability = a two-function swap, not a codebase grep.

## Part 3 — wiring + docs

- `/assets`: the stale `hookText`/`bgVariant` thumbnail lines no longer match the template — replace
  them with: ensure `thumb-variants.json` exists (seed from script hook + presets) → run the preview
  render as the final step of the phase.
- README: document the Studio + contact-sheet loop in the workflow section.

## Verification

`pnpm test` green (incl. new `thumb-preview` unit tests); `cd remotion && npx remotion compositions`
lists fine; a real `/thumbs-preview` on ep001 produces `preview/` with 3 full + 3×120px PNGs and an
`index.html` that opens.
