# /script

Draft `episodes/<ep>/script.md` from the episode's `report.md`, following the
channel's five-beat script structure (already encoded in `templates/script.md`),
then advance `STATE.md` to `script: done` and record phase metrics. This is the
handoff between the automated review and the manual record/edit phase.

**Usage:** `/script [--episode <id>]`

- `--episode <id>` — optional. Work on this specific episode (e.g. `2026-07-ep003`).
- Default (no `--episode`): pick the **most recent** episode whose review phase is
  done — `current_phase: review` with `phase_status: done`, or the `review` box
  checked in `## Phase checklist` — that has an `episodes/<ep>/report.md` on disk
  but does **not** yet have an `episodes/<ep>/script.md`. "Most recent" means the
  highest episode id / number among the candidates. If no episode qualifies, stop
  and tell the host there's nothing ready for `/script` (e.g. review hasn't
  finished, or every reviewed episode already has a script).

---

## Step 1 — Read inputs

Before writing anything, read, in this order:

1. `episodes/<ep>/STATE.md` — for `current_phase`, `phase_status`, the checklist,
   `repo_url`, `title`, `number`, and the draft `verdict` from review.
2. `episodes/<ep>/report.md` — the source material: Заявлено / Работает /
   Сломалось / Подозрительно / Моменты для видео / Черновой вердикт.
3. The project `CLAUDE.md` — for the channel's tone, script-structure conventions,
   and the verdict scale (ГОДНОТА / ХАЙП / НАКРУТКА / РАНО). `templates/script.md`
   already encodes the five required beats and the tag legend; treat `CLAUDE.md`
   as the source of tone and any structural nuance beyond what the template
   spells out, not as a replacement for it.

**Resume-friendly / no clobbering:** if `episodes/<ep>/script.md` already exists,
or the `script` box in `## Phase checklist` is already checked, **stop** and tell
the host the script already exists for this episode rather than overwriting it.
If the host explicitly wants a redo, that's a separate, deliberate action outside
this command's default behavior — do not take it on implicitly.

---

## Step 2 — Write the script

Copy the template into the episode directory:

```bash
cp templates/script.md episodes/<ep>/script.md
```

Then fill in every placeholder (`{{REPO}}`, `{{VERDICT}}`, and each `...`) using
the content from `report.md` — do not leave any template placeholder text in the
final file. The five beats, in order, and what each draws from:

- **Хук (0–15 сек)** — the single most surprising or provocative fact about the
  repo (a suspicious stat from "Подозрительно", a striking claim from "Заявлено",
  or the sharpest line from "Черновой вердикт") — written to make someone stop
  scrolling.
- **Что это за репо (15–60 сек)** — a plain-language summary of what the project
  claims to do, drawn from "Заявлено".
- **Живой тест (основа)** — the core of the video. Walk through what actually
  happened in the sandbox: pull from both "Работает" and "Сломалось", in the
  order the host should demonstrate them. This is where most `[СКРИНКАСТ: ...]`
  cues belong.
- **Где README врёт** — the gap between claim and reality: contrast "Заявлено"
  against "Сломалось" / "Подозрительно" — where the README overpromises or omits
  a problem.
- **Вердикт** — restate the "Черновой вердикт" argument in the host's voice, and
  land on one of the four verdict words for `{{VERDICT}}`.

Use `report.md`'s "Моменты для видео" entries as the primary source for
`[СКРИНКАСТ: ...]` cues in the "Живой тест" and "Где README врёт" beats — each
video moment from the report should surface as a screencast cue somewhere in the
script.

**Tags — use exactly these, exactly as written.**

**Cue IDs — assign them as you write.** `script.md` is the SINGLE source of cue
identity; every other doc (REPRO's `#scene-N` anchors, `RECORDING.md`, `VOICE.md`,
`MEME_LIST.md`) derives its numbering from here. Number each kind sequentially from
1, in narrative (document) order:

- `[ГОЛОС]` — a voiceover line. Plain narration the host will read/record. **No ID.**
- `[СКРИНКАСТ #N: <what to show>]` — a SEMANTIC shooting instruction for the host
  (`#1, #2, #3…`). Describe the *action* to film (e.g. `[СКРИНКАСТ #4: run `npm
  start` on a fresh clone, let the crash happen on screen]`) — this is "clock (b)":
  the screencast is recorded later, during the manual phase. It is never a reference
  to an existing recording, and never a timecode.
- `[АНИМАЦИЯ A<n>: ...]` — a Remotion scene cue (`A1, A2…`), e.g. `[АНИМАЦИЯ A1:
  StarChart — рост звёзд]`, `[АНИМАЦИЯ A2: VerdictCard — {{VERDICT}}]`.
- `[МЕМ M<n>: ...]` — a meme cue (`M1, M2…`): what meme/reaction image and why it
  fits the beat.
- `[SHORT cut S<n>: <narrative beat>]` — marks a narrative beat that would make a
  good standalone Short (`S1, S2…`). This is a CANDIDATE only — "clock (c)": the
  real final-video timecodes get reconciled later, after the Resolve edit, and only
  `/cut-shorts` consumes those reconciled timecodes. Never write an actual timecode
  here — describe the beat itself (e.g. `[SHORT cut S1: the fresh-clone crash and
  the host's reaction]`), not when it occurs.

No gaps, no duplicates, no out-of-order numbers — `pnpm prep` hard-fails on all
three, and writes nothing.

**Forbidden in this file:** do not write any clock-style timestamp notation (the
pattern of two digits, a colon, then two digits, e.g. minutes-colon-seconds) for
any cue in this script, and do not use the phrase "из теста" anywhere. Every
`[СКРИНКАСТ: ...]` and `[SHORT cut: ...]` cue must describe *what happens/what to
film*, never *when* — timing for both is resolved in later phases, not here.

---

## Step 3 — Align the reproduction protocol (REPRO.md ↔ script)

`/review-repo` already wrote `episodes/<ep>/REPRO.md` as the **linear user flow**: `## Clean
slate`, `## User flow` (numbered `<a id="scene-N">` steps), `## Evidence inserts` (anchored proofs),
`## Environment caveats`, and optional `## Prepared states` (read the **Recording doctrine** in
`CLAUDE.md`). Your `[СКРИНКАСТ #N]` cues in Step 2 must reference these scenes **in the same linear
order** — the narrative order **is** the shooting order. Now align the two:

- **Each `[СКРИНКАСТ #N]` cue points at exactly one REPRO scene** — a `## User flow` step or an
  `## Evidence insert` carrying `<a id="scene-N"></a>`. Confirm the bijection: every `#N` has a
  scene block and every scene block has a `#N`. `pnpm prep` refuses to generate anything otherwise.
- **The anchors must ascend along the flow** (`scene-1`, `scene-2`, … top to bottom). Because you
  number the `[СКРИНКАСТ #N]` cues in narrative order and the flow is already linear, they line up
  by construction. `pnpm prep` hard-fails if the REPRO anchors don't ascend — fix the numbering, do
  **not** reorder the honest flow to match a bad cue order.
- **If the flow is missing a moment your script needs to show**, add the step (or evidence insert)
  to `REPRO.md` at the right point in the flow — with what the user **does** / **sees**, or the
  proof + its `Anchor` bullet — and renumber so the anchors stay ascending. Keep it a real step a
  user would hit, not a staged setup. Clock (b): shooting instructions, **never** timecodes.
- **`Recording time budget`** (the top line) — the estimated total time for **one linear take** if
  the flow is followed. Call out any single long wait (e.g. a ~70s test run) that the host should
  plan the take around.

**Acceptance test for this file:** the host can record the whole flow, top to bottom, without
making a decision that isn't written in `REPRO.md`. If a step needs a choice `REPRO.md` doesn't
answer, it's incomplete — fix it here.

If `episodes/<ep>/REPRO.md` is missing (an episode from before this artifact existed), create it
from `templates/REPRO.md` and fill **all** sections, not just the flow.

---

## Step 4 — Update STATE.md

Edit `episodes/<ep>/STATE.md`:

- Frontmatter: set `current_phase: script`, `phase_status: done`, and `updated:`
  to today's date (`YYYY-MM-DD`).
- `## Artifacts`: update the `script.md` line to `script.md: present`, and the
  `REPRO.md` line to `REPRO.md: present` (flow ↔ #СКРИНКАСТ cues aligned — Step 3).
- `## Next action`: replace it with `Manual phase: record voice + screencast, edit
  in Resolve, then reconcile timecodes`.
- `## Phase checklist`: check the `script` box (`- [x] script`).

Leave every other field and section (repo_url, title, number, verdict,
youtube_video_id, `report.md`/`sandbox/`/`assets/` artifact lines, the rest of
the checklist) untouched — this command owns the script phase and the REPRO scene
blocks (Step 3), nothing else.

---

## Step 5 — Record metrics

Append a `phase_metrics` row for this run (phase `script`). The `episodes` row
for this episode should already exist from `/review-repo`'s Step 8 — only insert
it if it's somehow missing. Track `startedAt` from when you began Step 1 and
`endedAt` when Step 4 finishes; count `iterations` as 1 unless you had to redo a
beat because the report was ambiguous or incomplete.

Run something shaped like this (adapt the values — episode id, number from
STATE.md's frontmatter, repo URL, timestamps, iteration count, notes — to the
actual run), following the same inline pattern used in `review-repo.md` Step 7:

```bash
node --import tsx -e "
import { openDb, schema } from './db/client.ts';
import { eq } from 'drizzle-orm';

const db = openDb();
const episodeId = '<ep>';
const now = Math.floor(Date.now() / 1000);

const existing = db.select().from(schema.episodes).where(eq(schema.episodes.id, episodeId)).all();
if (existing.length === 0) {
  db.insert(schema.episodes).values({
    id: episodeId,
    number: <number from STATE.md frontmatter>,
    repoUrl: '<repo_url from STATE.md frontmatter>',
    createdAt: now,
  }).run();
}

db.insert(schema.phaseMetrics).values({
  episodeId,
  phase: 'script',
  startedAt: <epoch when Step 1 began>,
  endedAt: now,
  durationS: now - <epoch when Step 1 began>,
  iterations: <number of beat rewrites>,
  notes: '<one-line summary, e.g. verdict word and beat count>',
}).run();
"
```

This creates/updates `db/tracker.sqlite` (WAL mode, via `openDb()` from
`db/client.ts`). If `db/tracker.sqlite` doesn't exist yet, `openDb()` creates it,
but the schema must already be migrated (`pnpm db:migrate`) — run that first if
the tables don't exist.

---

## Output contract / side-effects

This command writes **only**:
- `episodes/<ep>/script.md` — new file, filled in from `report.md`.
- `episodes/<ep>/REPRO.md` — updated in place: the flow ↔ `[СКРИНКАСТ #N]` alignment (adding
  or renumbering `<a id="scene-N">` blocks only if the flow was missing a moment) and the
  `Recording time budget` line (Step 3).
- `episodes/<ep>/STATE.md` — updated in place (script phase fields only).
- `db/tracker.sqlite` — one new `phaseMetrics` row (and the `episodes` row, only
  if it didn't already exist).

Nothing outside `episodes/<ep>/` and `db/tracker.sqlite` is touched, and no
network access or code execution against any third-party repo happens in this
command — it only reads `report.md`/`STATE.md`/`CLAUDE.md` and writes text.
