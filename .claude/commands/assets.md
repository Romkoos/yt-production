# /assets

Render the episode's Remotion scenes (StarChart with REAL star data, Intro, VerdictCard) and 3
thumbnail variants, and generate the host's pre-record prep docs (SHOTLIST.md, MEME_LIST.md),
then advance `STATE.md` to `assets: done` and record phase metrics. This is the last automated
step before the manual record/edit phase.

**Usage:** `/assets [--episode <id>]`

- `--episode <id>` — optional. Work on this specific episode.
- Default (no `--episode`): pick the **most recent** episode whose `script` phase is done
  (`current_phase: script` with `phase_status: done`, or the `script` box checked) that has an
  `episodes/<ep>/script.md` on disk but no rendered assets yet (`assets` box unchecked). If none
  qualifies, stop and tell the host there's nothing ready for `/assets`.

**Resume-friendly / no clobbering:** if the `assets` box in `## Phase checklist` is already
checked, **stop** and tell the host assets already exist for this episode. Re-rendering is a
deliberate action outside the default (pass `--refresh` intent explicitly).

---

## Step 1 — Read inputs

Read, in this order:
1. `episodes/<ep>/STATE.md` — `repo_url`, `number`, `verdict`, the checklist, resume guard.
2. `episodes/<ep>/script.md` — source of the hook (for thumbnail text) and the cue tags.
3. The project `CLAUDE.md` — content rules, especially: **charts render measured data only**
   (real → sparse real → no chart; modeled curves are banned).

If `verdict` is empty in STATE.md frontmatter, read it from the script's Вердикт beat
(`[АНИМАЦИЯ: VerdictCard — <verdict>]`) — it must be one of ГОДНОТА / ХАЙП / НАКРУТКА / РАНО.

---

## Step 2 — Fetch real star history

```bash
node --import tsx scripts/fetch-star-history.ts --episode <ep>
```

This fetches the repo's REAL star history via tiered sources (GraphQL `starredAt` → REST
`star+json` → Wayback snapshots → 2 real anchor points), caches raw JSON in
`episodes/<ep>/assets/star-history.raw.json` (gitignored), and writes
`episodes/<ep>/assets/StarChart.props.json`. The auth token comes from `GITHUB_TOKEN` or
`gh auth token` — **never** write it to a file or expose it. The cache is reused on re-runs;
pass `--refresh` to re-fetch. The chart caption (`sourceLabel`) derives automatically from the
tier that succeeded — do not hand-edit it, and never substitute modeled data.

---

## Step 3 — Render the Remotion scenes

From the standalone `remotion/` package (install first only if `node_modules` is missing).
Render into `episodes/<ep>/assets/` (paths below are relative to repo root):

```bash
cd remotion
npx remotion render StarChart   ../episodes/<ep>/assets/StarChart.mp4   --props=../episodes/<ep>/assets/StarChart.props.json
npx remotion render Intro       ../episodes/<ep>/assets/Intro.mp4       --props='{"episodeNumber": <number>}'
npx remotion render VerdictCard ../episodes/<ep>/assets/VerdictCard.mp4 --props='{"verdict":"<verdict>","repoName":"<owner/repo>"}'
```

Thumbnails are NOT rendered with ad-hoc CLI props. Instead they are driven by a tracked
per-episode file, `episodes/<ep>/assets/thumb-variants.json` — an array of `{ label, props }`
where `props` is a full `ThumbTemplate` prop object (`repoName`, `verdict`, the styled `hook`
lines, `logo`, `layout`, optional `accent`/`glowColor`/`logoScale`/`texture` — validated against
`thumbSchema` at render time). If the file is missing, create it (2–3 variants, hook lines drawn
from the script's hook / `THUMB_HOOKS.md`, `verdict` = this episode's verdict). Then render the
contact sheet — this is the **final step of `/assets`**:

```bash
node --import tsx scripts/thumbs-preview.ts --episode <ep>
```

This renders every variant to `episodes/<ep>/assets/preview/thumb-vN.png` (+ a 120px copy) and
opens a self-refreshing gallery (`preview/index.html`) for the host to review / A-B test — see
`/thumbs-preview`. The host then iterates by text feedback (agent edits `thumb-variants.json`,
re-runs the render; the page updates in ≤2s) or fine-tunes props live in `npx remotion studio`.

All thumbnail text is a programmatic render (channel rule — never generative). Branding is a
swappable prop with a neutral placeholder default; the channel has no name yet.

---

## Step 4 — Generate prep docs

```bash
node --import tsx scripts/gen-prep-docs.ts --episode <ep>
```

This writes `episodes/<ep>/SHOTLIST.md` (every `[СКРИНКАСТ]` cue, numbered checkboxes by beat —
the host's Screen Studio checklist) and scaffolds `episodes/<ep>/assets/MEME_LIST.md` (every
`[МЕМ]` cue + a free stock-sound list). Then **fill each MEME_LIST scaffold** (`**Мем:**` /
`**Источник:**`) with a concrete meme suggestion and a real download link — suggestions + links
only, never auto-download copyrighted memes.

---

## Step 5 — Update STATE.md

- Frontmatter: `current_phase: assets`, `phase_status: done`, `verdict:` (if it was empty),
  `updated:` today.
- `## Artifacts`: set the `assets/` line to list the rendered files + prep docs present.
- `## Next action`: replace with the **manual-phase prep checklist**:
  ```
  Manual phase — подготовка к записи:
  - [ ] Музыка: сгенерировать трек в Suno
  - [ ] Голос: записать озвучку по script.md
  - [ ] Скринкаст: снять по SHOTLIST.md (Screen Studio)
  - [ ] Мемы и звуки: скачать по assets/MEME_LIST.md
  - [ ] Монтаж в DaVinci Resolve
  - [ ] Сверка таймкодов: записать реальные таймкоды в STATE.md/script.md
  ```
- `## Phase checklist`: check the `assets` box (`- [x] assets`).

Leave every other field/section untouched — this command owns only the assets phase.

---

## Step 6 — Record metrics

Append a `phase_metrics` row (phase `assets`), same inline `db/client.ts` pattern as
`review-repo.md` / `script.md` Step 7. `notes` = one line (tier used + point count + which
scenes rendered).

---

## Output contract / side-effects

Writes **only**:
- `episodes/<ep>/assets/` — `StarChart.mp4`, `Intro.mp4`, `VerdictCard.mp4`, `MEME_LIST.md`,
  `thumb-variants.json` (tracked render source), the gitignored `star-history.raw.json` /
  `StarChart.props.json` cache, and `preview/` (the gitignored thumbnail contact sheet:
  `thumb-vN.png`, `thumb-vN.120.png`, `index.html`).
- `episodes/<ep>/SHOTLIST.md` — new file.
- `episodes/<ep>/STATE.md` — updated in place (assets phase fields only).
- `db/tracker.sqlite` — one new `phaseMetrics` row.

Rendered media (`*.mp4`, `*.png`, `*.json`) is gitignored — EXCEPT `thumb-variants.json`, which is
tracked (it is the editable source for the thumbnail loop, not a render output); text prep docs
(`MEME_LIST.md`, `SHOTLIST.md`) are tracked. The only network access is the star-history fetch
(read-only GitHub API); no third-party repo code is executed.
