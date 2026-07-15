# /assets

Render the episode's Remotion scenes (StarChart with REAL star data, Intro, VerdictCard) and 3
thumbnail variants, and generate the host's session-oriented prep docs (RECORDING.md, VOICE.md,
MEME_LIST.md), then advance `STATE.md` to `assets: done` and record phase metrics. This is the
last automated step before the manual record/edit phase.

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
pnpm chart -- --episode <ep>
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
from the script's hook / `THUMB_HOOKS.md`, `verdict` = this episode's verdict). Then generate the
**mandatory generative logo background** (see the REQUIRED rule below) and render the contact sheet —
together these are the **final step of `/assets`**:

```bash
pnpm scene  -- --episode <ep>   # REQUIRED — bakes the repo logo into a generated background (rule below)
pnpm thumbs -- --episode <ep>
```

This renders every variant to `episodes/<ep>/assets/preview/thumb-vN.png` (+ a 120px copy) and
opens a self-refreshing gallery (`preview/index.html`) for the host to review / A-B test — see
`/thumbs-preview`. The host then iterates by text feedback (agent edits `thumb-variants.json`,
re-runs the render; the page updates in ≤2s) or fine-tunes props live in `pnpm studio`.

All thumbnail text is a programmatic render (channel rule — never generative). Branding is a
swappable prop; `DEFAULT_BRANDING` carries the channel identity (Senior Skeptic, nobg logo mark).

**Open TODO — repo-avatar header slot.** Round-3 spec wants the top-left header identity slot to
show the cached repo owner avatar (`github.com/<owner>.png`, e.g. `thumb/logo-<owner>.png`) with
the `>_` glyph as fallback. Today it renders a static `>_` box only — the cached avatar is used as
the *focal* centre tile, not in the header. Caveat before implementing: the avatar is already the
focal object, so a second copy in the header may read as redundant — decide per layout (a small
monochrome/rounded header mark can still help brand-vs-repo legibility). Not yet wired to a prop.

**Generative background with the repo logo — REQUIRED (host rule).** Every thumbnail variant MUST
ship on a generative background with the repo's real logo baked in — never a flat/empty background,
never the bare `>_` glyph as the only focal mark. Run `pnpm scene`
(= `/gen-thumb-object --mode real-avatar --scene --apply`) **before** `pnpm thumbs`: it fetches the
repo owner avatar (`github.com/<owner>.png`), generates ONE scene via the Gemini image API (accent =
verdict palette), mirrors it to `remotion/public/gen/<ep>/`, and writes `bgImage` +
`objectInScene: true` into every variant of `thumb-variants.json`. One shared scene → the logo sits
in the same place across all variants (this is what keeps a `logo-hero`/`logo-right` set consistent).
It is BILLED (~$0.13); preview the exact prompt for free first with `pnpm scene:dry`.

**If there is NO usable repo logo — STOP and ask the host.** When the owner avatar can't be fetched,
or resolves to a generic GitHub identicon with no real brand mark, do **not** silently fall back to a
plain background or the glyph. Surface it and decide together: `--mode known-logo` with a brand the
host names, a supplied logo file, or a no-logo background as an **explicit, host-approved exception**.
A logo-less thumbnail is never the default.

Generated **objects** (non-scene) are archived but not yet consumed: the `ThumbTemplate` object
layer is a follow-up.

Generated images never contain text (thumbnail text is always a programmatic render) and never
carry a fabricated brand mark — see `/gen-thumb-object` for the per-mode guarantees and the
`--dry-run` audit surface.

---

## Step 4 — Generate prep docs

```bash
pnpm prep -- --episode <ep>
```

This writes the two **session-oriented** docs — one file drives one sitting:

- `episodes/<ep>/RECORDING.md` — the **linear shooting run** (one continuous take, top to bottom).
  A checkbox per `[СКРИНКАСТ #N]` cue in flow order, grouped by beat, with REPRO's exact commands /
  on-screen / WAIT-CUT / reset **inlined** and the evidence inserts woven in at their anchor points,
  plus a back-reference to the voice beat the scene plays under (`Звучит под: «…»` — the tail of the
  preceding voice run, i.e. what the host hears as the scene cuts in). The **`## Чистый лист` wipe
  checklist** is on top, one-shot moments are flagged **`## ⚠️ ОДИН ДУБЛЬ`**, and any off-camera
  prepared states are demoted to a `## Заготовки` note. **No cross-file jump is needed mid-session**
  — `REPRO.md` stays the source of truth; `RECORDING.md` is disposable.
- `episodes/<ep>/VOICE.md` — the **voice session**. `[ГОЛОС]` lines only, in reading order, cues
  stripped, with a margin note per block naming the IDs it covers (`→ #3 · M2`). The Хук and
  Вердикт blocks are marked 🎯 НАИЗУСТЬ (learn verbatim).
- `episodes/<ep>/assets/MEME_LIST.md` — every `[МЕМ M<n>]` cue + a free stock-sound list.
  **Scaffolded only if missing** — a re-run never clobbers the host's filled-in suggestions. Then
  **fill each scaffold** (`**Мем:**` / `**Источник:**`) with a concrete meme and a real download
  link — suggestions + links only, never auto-download copyrighted memes.

`pnpm prep` **hard-fails and writes nothing** if `script.md` and `REPRO.md` disagree (a `#N` with
no `#scene-N` block, or an orphan block with no cue) — the IDs are the contract between them. An
episode written before the ID scheme is detected as legacy: `pnpm prep` skips it with a
message and exits 0.

Re-running is safe: RECORDING/VOICE are regenerated, and ticked scene boxes are carried over **by
scene ID**. A box whose scene content changed since it was ticked is **reset** and marked `⟳` (and
announced on stdout); a tick whose scene no longer exists is dropped and printed as a `⚠` warning —
never silently remapped. `--force` discards all tick state.

---

## Step 5 — Update STATE.md

- Frontmatter: `current_phase: assets`, `phase_status: done`, `verdict:` (if it was empty),
  `updated:` today.
- `## Artifacts`: set the `assets/` line to list the rendered files + prep docs present.
- `## Next action`: replace with the **manual-phase prep checklist**:
  ```
  Manual phase — подготовка к записи (порядок обязателен — ГОЛОС строго ПОСЛЕ съёмки):
  - [ ] Пре-флайт / чистый лист: пройти REPRO.md SETUP с нуля, свериться с prepared states
  - [ ] Музыка: сгенерировать трек в Suno
  - [ ] Скринкаст: снять по RECORDING.md (команды/что на экране/WAIT-CUT — всё внутри)
  - [ ] Голос: записать озвучку по VOICE.md ⚠️ строго ПОСЛЕ съёмки — вердикт и свидетельства существуют только после дубля (хук наизусть)
  - [ ] Мемы и звуки: скачать по assets/MEME_LIST.md
  - [ ] Монтаж в DaVinci Resolve
  - [ ] Сверка таймкодов: записать реальные таймкоды в STATE.md/script.md
  ```
- `## Phase checklist`: check the `assets` box (`- [x] assets`).

Leave every other field/section untouched — this command owns only the assets phase.

---

## Step 6 — Record metrics

Append a `phase_metrics` row (phase `assets`), same inline `db/client.ts` pattern as the
metrics step in `review-repo.md` / `script.md`. `notes` = one line (tier used + point count +
which scenes rendered).

---

## Output contract / side-effects

Writes **only**:
- `episodes/<ep>/assets/` — `StarChart.mp4`, `Intro.mp4`, `VerdictCard.mp4`, `MEME_LIST.md`,
  `thumb-variants.json` (tracked render source — now also carries `bgImage` + `objectInScene` from
  the mandatory scene step), `gen-log.json` (tracked, append-only audit of every generation), the
  cached repo avatar (`logo-<owner>.png`), the gitignored `star-history.raw.json` /
  `StarChart.props.json` cache, the gitignored `gen/` scene archive, and `preview/` (the gitignored
  thumbnail contact sheet: `thumb-vN.png`, `thumb-vN.120.png`, `index.html`).
- `remotion/public/gen/<ep>/` — the gitignored render-surface mirror of the generated scene(s).
- `episodes/<ep>/RECORDING.md` and `episodes/<ep>/VOICE.md` — new files (derived, regenerable).
- `episodes/<ep>/STATE.md` — updated in place (assets phase fields only).
- `db/tracker.sqlite` — one new `phaseMetrics` row.

Rendered media (`*.mp4`, `*.png`, `*.json`) is gitignored — EXCEPT `thumb-variants.json` and
`gen-log.json`, which are tracked (the editable thumbnail source and the generation audit trail); text
prep docs (`MEME_LIST.md`, `RECORDING.md`, `VOICE.md`) are tracked. Network access: the star-history
fetch (read-only GitHub API), the repo-avatar fetch, and the Gemini image API (the billed scene
generation). No third-party repo code is executed.
