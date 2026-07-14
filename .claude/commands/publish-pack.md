# /publish-pack

Prepare the long-video publish bundle — titles, description, tags, and Short pitches — as
git-tracked text the host uses when uploading (via their separate Late API pipeline). This
command does NOT publish anything, and runs **pre-manual** (before recording): it reads
`report.md` / `script.md` / `STATE.md`, not the finished video.

**Usage:** `/publish-pack [--episode <id>]`

- `--episode <id>` — optional. Default: the most recent episode that has a `script.md` on disk
  and no `episodes/<ep>/publish/` bundle yet.

**Scope (Phase 2):** long-video part only. Per-Short **captions** remain an explicit TODO until
`/cut-shorts` exists (they need the reconciled final-video timecodes). This command produces
one-line Short **pitches** now, but not full captions.

**Resume guard:** guard on the **existence of `publish/` files**, not on phase state (see the
STATE note below). If `episodes/<ep>/publish/` already has the bundle, stop and tell the host
rather than overwriting.

---

## Step 1 — Read inputs

1. `episodes/<ep>/STATE.md` — `repo_url`, `number`, `verdict`, `title`.
2. `episodes/<ep>/report.md` — Заявлено / Работает / Сломалось / Подозрительно / вердикт.
3. `episodes/<ep>/script.md` — the hook, the beats, and the `[SHORT cut]` candidates.
4. Project `CLAUDE.md` — tone (irony of an experienced dev, **no clickbait hysteria**) and the
   verdict scale.

---

## Step 2 — Write the bundle to `episodes/<ep>/publish/`

All files are Russian text, git-tracked. Create the directory if missing.

- **`titles.md`** — 3–5 title options, each **≤ 100 characters**, no clickbait hysteria (per
  CLAUDE.md tone). Draw from the hook and verdict; vary the angle (question / verdict-forward /
  the single most surprising fact). Note the char count per line.
- **`description.md`** — the video description:
  - 2–3 sentence Russian intro to the episode.
  - A **placeholder timecode block** to fill after the Resolve edit (real timecodes are clock
    (c), known only post-edit):
    ```
    Таймкоды (заполнить после монтажа):
    00:00 — Хук
    00:00 — Что за репо
    00:00 — Живой тест
    00:00 — Где README врёт
    00:00 — Вердикт
    ```
  - The repo link (`repo_url`).
  - A **channel-boilerplate placeholder** (subscribe line / socials — the channel has no name
    yet, so leave a clearly marked `<!-- channel boilerplate: заполнить -->` block).
- **`tags.txt`** — a comma- or newline-separated tag list: channel niche (разбор репозиториев,
  open source, обзор) + repo topics (e.g. дизайн-система, React, StyleX). One coherent set.
- **`shorts-pitches.md`** — one line per `[SHORT cut S<n>]` candidate in `script.md`. Enumerate
  them with the tested parser, then write a one-line pitch (the hook of that Short) per beat.
  Carry each cue's **ID** (`S1`, `S2`…) into the file — `VOICE.md`'s margin notes reference the
  same IDs, so the editor can find which voice beat the cut sits under:
  ```bash
  node --import tsx -e "import {parseScript} from './scripts/lib/script-cues.ts'; import {readFileSync} from 'node:fs'; for (const c of parseScript(readFileSync('episodes/<ep>/script.md','utf8')).cues.filter(c => c.kind === 'short')) console.log(c.id+' ['+c.beat+'] '+c.raw)"
  ```
  (An episode predating the ID scheme — ep001 — has no `S<n>` tags; `c.id` is empty there and the
  pitches simply carry no ID.)

---

## Step 3 — Update STATE.md (metrics-only; DO NOT advance the phase)

The pipeline order is **assets → manual → publish**. A pre-manual pack must **not** claim the
publish phase is done — that would break resume guards and checklist semantics (publish "done"
while manual hasn't started). Therefore:

- **Leave `current_phase`, `phase_status`, and the `## Phase checklist` UNTOUCHED.** The
  `publish` box gets checked later, at the real post-edit publish handoff.
- `## Artifacts`: add `publish/: present (pre-pack)`.
- Optionally bump `updated:` to today.

Then record a `phase_metrics` row with `phase: 'publish'` and `notes: 'pre-manual pack'`
(metrics may reference a phase without advancing the state machine), same inline `db/client.ts`
pattern as `review-repo.md` Step 7.

---

## Output contract / side-effects

Writes **only**:
- `episodes/<ep>/publish/` — `titles.md`, `description.md`, `tags.txt`, `shorts-pitches.md`
  (all git-tracked text).
- `episodes/<ep>/STATE.md` — `## Artifacts` line + `updated:` only (phase state untouched).
- `db/tracker.sqlite` — one `phaseMetrics` row (phase `publish`, notes `pre-manual pack`).

No external publish, no network, no third-party code execution. The actual upload is the host's
separate Late API pipeline (out of scope for this repo).

## TODO (future)

- [ ] Per-Short captions, once `/cut-shorts` produces reconciled timecodes.
