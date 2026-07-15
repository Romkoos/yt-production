# yt-production — project charter

`yt-production` is the repo working name (NOT the channel name); the channel is **Senior
Skeptic** — a Russian-language YouTube channel. This file is the source of truth for a fresh
Claude Code session: read it and you understand the channel, the pipeline, and the rules — no
external context needed.

---

## The channel

**Niche:** разбор трендовых GitHub-репозиториев. The format: *«репозиторий на подъёме —
заслуженно или хайп?»*. The host actually clones, runs, and tests a trending repo, then
delivers an ironic-but-honest verdict: what in the README is true, what is a lie, whether
the stars are inflated.

**Stylistic reference:** Fireship — fast pacing, screencasts, code animations, memes, no
face on camera, a live human voice.

**Tone:** irony of an experienced developer. No cringe, no clickbait hysteria. Verdicts are
honest and argued — we roast hype, but we give credit where it's due. We never fake a
reaction we didn't have.

**Cadence:** 1 long video (8–12 min) + 3 Shorts per week. Budget ~3–6 h/week, three evenings
per episode. The pipeline automates everything EXCEPT the host's voice, the final verdict,
the humor, and the DaVinci Resolve edit.

---

## Script structure (with timing)

Every long-form script follows this shape:

1. **Хук (0–15 сек)** — the sharpest hook. The claim vs. the suspicion.
2. **Что за репо (15–60 сек)** — what it is, why it's trending (StarChart animation here).
3. **Живой тест (основа)** — the core: actually running it, what works, what breaks.
4. **Где README врёт** — the discrepancies between the promise and reality.
5. **Вердикт** — the call, on the fixed scale below (VerdictCard animation here).

### Cue IDs (cross-document contract)

`script.md` is the **single source of cue identity**. `/script` numbers each cue kind
sequentially from 1, in narrative order, and every derived doc reads its numbering from there:

| Tag | Form | Derived into |
|-----|------|--------------|
| `[СКРИНКАСТ #N: …]` | `#1, #2…` | `REPRO.md`'s `<a id="scene-N">` (on a `## User flow` step or an `## Evidence insert`), `RECORDING.md`'s checkboxes |
| `[АНИМАЦИЯ A<n>: …]` | `A1, A2…` | the edit; `VOICE.md` margin notes |
| `[МЕМ M<n>: …]` | `M1, M2…` | `assets/MEME_LIST.md` headers |
| `[SHORT cut S<n>: …]` | `S1, S2…` | `/cut-shorts` (post-edit) |

`[ГОЛОС]` takes no ID. `pnpm prep` hard-fails (writing nothing) on a missing ID, a gap or
duplicate, a `#N` ↔ `#scene-N` mismatch in **either** direction, or REPRO flow anchors that don't
**ascend** (narrative order = shooting order). Episodes written before this scheme (ep001) are
detected as legacy: `pnpm prep` skips them with a message and **exits 0**.

## Verdict scale (FIXED — do not invent new labels)

- **ГОДНОТА** — genuinely good; delivers on its claims.
- **ХАЙП** — overhyped; it works, but nowhere near the buzz/promise.
- **НАКРУТКА** — inflated stars / manufactured traction; the popularity is fake.
- **РАНО** — promising but too early; not usable yet, come back later.

---

## The pipeline (7 phases)

Each phase is an independently runnable command. State lives in the episode's `STATE.md`
(+ its files), so any phase can be resumed in a fresh session after a break.

| # | Phase | Command | Status (Phase 1) |
|---|-------|---------|------------------|
| 1 | scout | `/scout` | skeleton |
| 2 | review | `/review-repo <url>` | **implemented** |
| 3 | script | `/script` | **implemented** |
| 4 | assets | `/assets` | skeleton |
| 5 | manual | (human) | — |
| 6 | publish | `/publish-pack` | skeleton |
| 7 | retro | `/retro` | skeleton |

**Transitions:** scout → review → script → assets → **manual** → publish → retro. The
`manual` phase is the human one (record voice, record screencast in Screen Studio, edit in
DaVinci Resolve). The pipeline waits there.

### Recording doctrine (IMPORTANT — the linear take)

The host records **the user's path**, live, in **one continuous linear take** on a **clean machine
state** — exactly the steps a real user would take, in the order a real user would take them. No
sandbox shortcuts on camera, no prepared states shown in frame, no *«оставь на потом»*, no jumping
between scenes out of order. **Evidence moments** (the `spctl` / `lsof` / `strings` / `git log`
proofs) are woven **into the flow** at the point the narrative needs them — the host proves the
hypothesis right where the user would hit the problem. **The edit carves scenes out of one honest
take**; scenes are never shot as isolated setups.

**Voice records *after* the take, never before** — the take decides what is true: the verdict and the
on-screen evidence only exist once the shooting is done, so the manual-phase order is always
screencast → voice.

Prepared states are allowed **only for off-camera time savings** (e.g. pre-downloading model
weights before the session) and must **never appear in frame as a shortcut the user wouldn't have
taken**. Beware one-shot moments: some evidence exists **only in the first run from a clean slate**
(e.g. Gatekeeper caches its verdict, so the block dialog is unreproducible after the first Open) —
`REPRO.md` flags these and `RECORDING.md` surfaces them as **⚠️ ОДИН ДУБЛЬ**.

`REPRO.md` implements this: `## Clean slate` (wipe to first-run state) → `## User flow` (the numbered
linear path, each step a `<a id="scene-N">` block) → `## Evidence inserts` (each proof anchored to a
flow step) → `## Environment caveats` (one-shot moments). Because narrative order **is** shooting
order by construction, the `[СКРИНКАСТ #N]` cues and the REPRO anchors ascend together — `pnpm prep`
hard-fails if the flow anchors don't ascend.

**Manual-phase docs — one file drives one sitting.** `/assets` generates `RECORDING.md` (the
**linear shooting run**: the wipe checklist on top, then a checkbox per `[СКРИНКАСТ #N]` in flow
order with commands / on-screen / evidence inserts inline and the voice beat each scene plays under,
one-shot moments marked ⚠️ ОДИН ДУБЛЬ) and `VOICE.md` (the voice session: `[ГОЛОС]` only, in reading
order, hook + verdict marked learn-verbatim). Both are **derived and regenerable** — `script.md` and
`REPRO.md` are the sources of truth. Re-running `pnpm prep` carries the host's ticked boxes over by
scene ID; a scene whose content changed since it was ticked is reset and flagged. (`SHOTLIST.md` is
gone — `RECORDING.md` supersedes it.)

### STATE.md contract

Every episode owns `episodes/<id>/STATE.md`. Any phase command **reads it first** (to
resume) and **writes it last**. Frontmatter fields: `episode`, `number`, `repo_url`,
`title`, `current_phase`, `phase_status` (pending|in_progress|blocked|done), `verdict`,
`youtube_video_id`, `updated`. Body: `## Phase checklist`, `## Next action`, `## Artifacts`.

**Checklist markers:** `- [ ]` pending · `- [~]` in progress · `- [x]` done · `- [-]`
skipped (always with a reason). A phase that never ran for this episode is *skipped*, not
pending — e.g. an episode started directly with `/review-repo` (no scout) records
`- [-] scout (skipped — direct review)` so it never looks perpetually pending.

### Episode identity

Folder `YYYY-MM-epNNN` (e.g. `2026-07-ep001`). `NNN` is a **channel-wide sequential number
that never resets** — "Episode #17" is a channel concept used in titles/retro/analytics.
The `YYYY-MM` prefix is for folder sorting only. New episodes: `pnpm episode:init <url>`.

---

## Three clocks — timecode discipline (IMPORTANT)

Three distinct clocks exist and must never be conflated:

- **(a) Sandbox test time** (review) — there is NO recording of the agent's test run.
  So `report.md` "video moments" are described **semantically** ("the moment install
  crashes with error X"), never with timecodes.
- **(b) Host screencast time** (manual) — the screencast is recorded AFTER the script
  exists. The script is a **shooting plan**: screencast cues are semantic —
  `[СКРИНКАСТ: <what to show>]`, never a reference to an existing recording.
- **(c) Final edit time** — real video timecodes are known only AFTER the Resolve edit.
  `[SHORT cut: <narrative beat>]` markers in `script.md` are **candidate beats only**. The
  manual phase ends with a **timecode reconciliation** step that writes the real
  final-video timecodes into STATE.md/script.md; only `/cut-shorts` consumes those.

Never write an `MM:SS`-style timecode in a report or script draft.

---

## Content rules (non-negotiable)

- **No AI voice. No AI video b-roll.** The audience is developers; the slop detector is
  instant. Voice and screencast are the host's, always.
- **Thumbnail text is always a programmatic render** (Remotion `ThumbTemplate`), never
  generative imagery.
- **Verdicts are honest.** We don't manufacture outrage or praise for the algorithm.
- **Charts render measured data only.** Star/metric charts (e.g. StarChart) show **real data
  only** — preference order: real → sparse real → no chart. Reconstructed or modeled data
  curves are **permanently banned**: never plot interpolated/synthesized points as if they
  were measurements. A star-forensics channel that fabricates a star curve is dead on arrival.
  When only sparse real points are available, plot those and label the source (e.g. `по снимкам
  Wayback Machine`, `по двум опорным точкам`); when none are available, render no chart.
  This applies to **every published claim, not just charts** — titles, descriptions, thumbnails.
  Every quantitative claim we assert as fact must be backed by `report.md` or cached fetch data
  (a repo's own README claim may be *quoted as a claim*, never stated as our verified finding).

## Conventions

- **Content language: Russian** (scripts, report section content, on-screen text).
- **Code + commit messages: English.**
- Package manager: **pnpm**. Node 22. Tests: vitest (`pnpm test`).
- **The CLI tail of the pipeline is pnpm scripts** — `pnpm flow` (where am I / what's next),
  `pnpm scene` + `pnpm thumbs` (the thumbnail leg), `pnpm studio`, `pnpm chart`, `pnpm prep`. They
  are the stable programmatic surface (a future UI sits on them): prefer them over raw
  `tsx scripts/…` invocations, and add a script rather than documenting a long one. Each defaults to
  the newest episode; target another with `pnpm <script> -- --episode <id>`. Names must not shadow an
  npm/pnpm built-in — `stars` does, and pnpm silently runs npm's instead of yours.
- Metrics DB is local: `db/tracker.sqlite` (Drizzle). It has NO connection to any global
  tracker. Migrate with `pnpm db:migrate`.
- Remotion is a **standalone package** under `remotion/` (own lockfile). **Install** it from there
  with the flag — `cd remotion && pnpm install --ignore-workspace` — and add deps with
  `pnpm add <pkg> --ignore-workspace`. (Running it is just `pnpm studio` from the root; only the
  install is dangerous.) **pnpm 9 has no `ignore-workspace` .npmrc key** (CLI flag only):
  a plain `pnpm install` silently writes a `remotion:` importer into the **root** `pnpm-lock.yaml`.
  If a root `pnpm-lock.yaml` diff ever contains a `remotion:` importer, the install was run wrong —
  `git checkout HEAD -- pnpm-lock.yaml`, then reinstall with `--ignore-workspace`. The
  `scripts/workspace-hygiene.test.ts` tripwire fails on exactly this.

---

## `/review-repo` safety rules (running untrusted code)

`/review-repo` clones and runs third-party code. Hard rules:

- Clone and run ONLY inside `episodes/<ep>/sandbox/`. Install nothing globally.
- **Safety gate before executing anything:** scan for `postinstall`/`preinstall` scripts,
  `curl … | sh` / `wget … | bash`, obfuscated payloads, network calls in build scripts.
  Any hit → record under "Подозрительно" and STOP for the host's explicit approval.
- **Always show the host the candidate repo and get explicit go-ahead before executing any
  of its code** — even a clean-looking `npm install`.
- Never expose secrets/credentials to the sandboxed code.
