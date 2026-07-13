# /thumbs-preview

Render every thumbnail variant of an episode into a **self-refreshing contact sheet** and open it,
so the host iterates on thumbnails visually — no render→collect→upload cycle. Runs standalone or as
the final step of `/assets`.

**Usage:** `/thumbs-preview [--episode <id>] [--open]`

- `--episode <id>` — optional. Default: the **newest** episode that has an
  `episodes/<ep>/assets/thumb-variants.json`.
- `--open` — force-open the sheet even if it already exists (default: open only on the first run;
  later re-renders just refresh the page in place).

---

## What it does

```bash
pnpm thumbs                              # newest episode with a thumb-variants.json
pnpm thumbs -- --episode <id> --open     # a specific one, force-opened
```

The render source is **`episodes/<ep>/assets/thumb-variants.json`** — a tracked array of
`{ label, props }`, where `props` is a full `ThumbTemplate` prop object (validated against
`thumbSchema` at render time). For each variant the script:

1. Renders the generic `ThumbTemplate` composition as a still →
   `episodes/<ep>/assets/preview/thumb-vN.png` (1280×720).
2. Makes a **120px-wide** copy → `thumb-vN.120.png` (the mobile-glance test).
3. Regenerates `preview/index.html` — a dark-bg gallery showing each variant full-size plus its
   120px copy on **both a dark and a light strip** (YouTube feed vs. white search/SERP), with the
   variant label + its hook text / verdict printed underneath. `<meta http-equiv="refresh"
   content="2">` self-updates the page; images carry an `?m=<mtime>` cache-bust so a re-render
   refetches while the 2s refresh between renders serves the cached image (no flicker).
4. Opens the sheet once (macOS `open`) on the first run.

## The loop

1. Run `/thumbs-preview` — the sheet opens.
2. The host reads it and gives text feedback (e.g. *"v2: hook smaller, logo up"*).
3. The agent edits `episodes/<ep>/assets/thumb-variants.json` (or the host fine-tunes live in
   `pnpm studio`, then the tuned values go back into the JSON) and **re-runs the render
   step** — same command, no `--open`.
4. The page self-updates within 2s. Repeat.

A generated background enters the same loop through `pnpm scene` (`/gen-thumb-object --scene
--apply`), which writes `bgImage` + `objectInScene` into every variant itself — so the full leg is
`pnpm scene && pnpm thumbs`.

## Platform note

macOS-only, consistent with the pipeline (Screen Studio / DaVinci Resolve are macOS). The only
OS-specific calls — `open` and `sips` — live in `scripts/lib/platform.ts` (`openInBrowser`,
`downscalePng`); cross-platform swaps are `xdg-open`/`start` and `npx sharp`/`ffmpeg`.

## Output contract / side-effects

Writes **only** under `episodes/<ep>/assets/preview/` (`thumb-vN.png`, `thumb-vN.120.png`,
`index.html` — all gitignored). Reads `thumb-variants.json` (tracked). No network access; renders
only the first-party `ThumbTemplate` composition — no third-party repo code is executed.
