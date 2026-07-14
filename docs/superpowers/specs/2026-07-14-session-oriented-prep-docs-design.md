# Session-oriented prep docs + cross-document scene IDs

**Date:** 2026-07-14
**Status:** approved
**Supersedes (in part):** `2026-07-11-phase-2-dor-design.md` (the `SHOTLIST.md` artifact)

## Problem

After the first real recording session (ep001), two frictions surfaced:

1. **Doc juggling.** The host had `script.md`, `SHOTLIST.md` and `REPRO.md` open at once. The
   checklist said *what* to shoot, the protocol said *how*, the script said *why* — one sitting,
   three files.
2. **No scene identity.** Script cues carry no ID, so the script↔footage mapping lived only in the
   host's head. `SHOTLIST` item N ↔ `REPRO` `#scene-N` held together purely by positional counting:
   insert one cue and every downstream number silently shifts.

## Solution in one line

Give every asset cue a **stable ID assigned in `script.md`**, and restructure the derived docs so
that **one file drives one sitting**: `RECORDING.md` for the screencast, `VOICE.md` for the voice.

---

## 1. ID scheme — `script.md` is the single source

`/script` assigns IDs at generation time, in narrative (document) order:

| Tag | Form | Example |
|---|---|---|
| Screencast | `[СКРИНКАСТ #N: …]` | `[СКРИНКАСТ #3: два вызова spctl подряд…]` |
| Animation | `[АНИМАЦИЯ A<n>: …]` | `[АНИМАЦИЯ A1: StarChart — рост звёзд]` |
| Meme | `[МЕМ M<n>: …]` | `[МЕМ M2: «you had one job»]` |
| Short candidate | `[SHORT cut S<n>: …]` | `[SHORT cut S1: README обещает четыре шага…]` |

`[ГОЛОС]` is unchanged (voice lines are not addressable individually; voice *runs* are — §3).

Every other document derives its numbering from these IDs. `REPRO.md`'s `<a id="scene-N"></a>`
anchors now mean "the block for script cue `#N`", not "the Nth block in the file".

Shorts get `S<n>` even though nothing cross-references them today: the backlogged `/cut-shorts`
spec requires a standalone ~30-sec narration paragraph per candidate, and those `VOICE.md` blocks
will have to address their cut. Introducing S-IDs later would mean a second format migration of
every script.

## 2. Validation — fail loudly, on migrated scripts only

`validateScript(script, repro)` runs inside `pnpm prep` **before anything is written** and
hard-fails (non-zero exit, no partial output) on:

- a cue with no ID (e.g. `[СКРИНКАСТ: …]` without `#N`) — the error quotes the offending cue;
- `#N` / `A<n>` / `M<n>` / `S<n>` not sequential from 1 in document order (gap, duplicate, or
  out-of-order);
- a `#N` in `script.md` with no `<a id="scene-N">` block in `REPRO.md`, or a REPRO scene block with
  no matching `#N` in the script. Both directions.

**Legacy episodes exit 0.** ep001 predates the ID scheme and is not migrated (it is already
recorded). A script with *zero* IDs on *any* cue is a legacy script: `pnpm prep` prints
*«script.md без ID-тегов (эпизод до введения #N) — миграция не проводилась, пропускаю»*, writes
nothing, and **exits 0**. An unmigrated legacy episode is a statement, not an error — a future
all-episodes wrapper must not break on it. Non-zero is reserved for real validation failures on
scripts that *do* carry IDs.

## 3. Voice↔scene association — derived once, used twice

The script is a linear sequence of voice runs and cues. A **voice run** is a maximal run of
consecutive `[ГОЛОС]` lines, broken by any cue or any `##` heading. A cue's window is the
**nearest** voice run in each direction: the association walks **past any intervening cues**, and
stops dead at a `##` heading — a beat is a hard barrier, so a cue never borrows voice from a
different beat.

Walking past cues, rather than requiring strict positional adjacency, is load-bearing: cues cluster
(a `[МЕМ]` right after a `[СКРИНКАСТ]`, a `[SHORT cut]` right before an `[АНИМАЦИЯ]`), and an
adjacency-only rule would leave every cue wedged between two other cues associated with **no** run
at all — its ID would then appear in no margin note in `VOICE.md`, silently holing the editor's
footage mapping. Two consequences, both intended: consecutive cues share a run, and one run can
accumulate several IDs (`→ #3 · M2 · S1` in §6). A cue at the end of a beat, with nothing but a
heading after it, still gets an empty *«Дальше»*.

One function computes this association; both docs read it, in opposite directions:

- **`RECORDING.md`**, per scene — *«Звучит под: …»* and *«Дальше: …»*. The host knows the scene's
  job without opening `script.md`.
  - *«Звучит под»* quotes the **tail** of the preceding voice run — its final sentence / last
    words. The semantic is **"what the host hears right before this scene cuts in"**, so the tail
    is the correct end of the run, not its opening words.
  - *«Дальше»* quotes the **head** of the following voice run — what the scene plays into.
- **`VOICE.md`**, per voice block — a margin note listing the IDs adjacent to that block
  (`→ #3 · M2 · S1`). The reader sees text; the future editor sees the footage mapping.

Because both derive from the same function, the two docs cannot disagree.

## 4. `RECORDING.md` — drives the screencast sitting

Derived from `script.md` + `REPRO.md`. `gen-prep-docs` gains a REPRO parser.

```
# RECORDING — 2026-07-ep002 (meetily)
Recording time budget: …                      ← copied from REPRO

## Pre-flight
<Prepared states, verbatim from REPRO>

## Живой тест
- [ ] #3 — приложение нотаризовано, коробка нет      <!-- fp:a91c40 -->
      Звучит под: «И самое обидное — они почти всё сделали правильно.»
      Дальше:     «Приложение — нотаризовано. У них настоящий платный…»
      Делать:     ```bash …```                       ← REPRO's Do, verbatim
      На экране:  …                                  ← REPRO's On screen
      Wait/Cut:   …
      Reset:      …

## Failure recipes
<verbatim copy from REPRO>
```

- **SETUP stays in `REPRO.md`** — it is pre-session material (zero-to-running, run once before the
  sitting), not something consulted mid-take.
- **Failure recipes are copied verbatim** into `RECORDING.md` so no cross-file jump is ever needed
  mid-session.
- `REPRO.md` remains the source of truth and the editable file. `RECORDING.md` is disposable.

## 5. Tick carry-over

Each scene block carries an invisible `<!-- fp:<8-hex> -->` fingerprint computed over its **derived
payload** (title + Do + On screen + Wait/Cut + Reset + voice refs) — not over the raw file text, so
the host's own scribbles inside a block never false-positive as "changed".

On regeneration, old→new blocks are matched **by scene ID, never by position**:

| Case | Result |
|---|---|
| ID matches, fingerprint matches | tick carries over |
| ID matches, fingerprint differs | box reset to `- [ ]` + visible marker `(⟳ сцена изменилась после отметки — переснять?)` |
| Old ticked ID absent from new script | tick dropped, never guessed or remapped |

A ticked box on changed content would claim footage exists for a scene that no longer matches it —
hence the reset. Renumbering (a scene inserted or removed) can never silently migrate a tick onto a
different scene.

**Both events must print to `pnpm prep`'s stdout at regeneration time**, not merely live in the
file:

```
$ pnpm prep -- --episode 2026-07-ep002
[gen-prep-docs] 2026-07-ep002:
  RECORDING.md  9 scenes · 3 ticks carried · ⟳ 1 reset (#3 — сцена изменилась)
  ⚠ dropped ticks: #4, #7 (сцены больше нет в script.md)
  VOICE.md      14 blocks
  assets/MEME_LIST.md  kept — already present
```

The host regenerates in the evening and opens `RECORDING.md` at the next session; mid-recording is
the worst possible place to discover a reset tick.

`--force` regenerates from scratch, discarding all tick state.

**Regeneration policy per file:** `RECORDING.md` — regenerate + merge ticks. `VOICE.md` — always
regenerated (no hand-edits, no ticks). `assets/MEME_LIST.md` — write-if-missing, unchanged from
today (host fills it by hand).

## 6. `VOICE.md` — drives the voice sitting

`[ГОЛОС]` lines only, cues stripped, in reading order. Big readable blocks separated by beat
headings and scene separators. Each block is prefixed with its margin note (`→ #3 · M2`). The
**Хук** and **Вердикт** blocks are marked **🎯 НАИЗУСТЬ** — the two learn-verbatim moments. No
`[ГОЛОС]` prefix noise, no commands, nothing to skip past.

## 7. `SHOTLIST.md` — removed

`RECORDING.md` is a strict superset (same checkboxes, same beat grouping, plus the commands
inline). A second checkbox list means a second place to tick things off — the exact juggling the
change exists to fix.

- `buildShotlist` deleted; `SHOTLIST.md` removed from `/assets` output, templates, `README.md`,
  `flow.ts`, and the STATE.md manual-phase checklist.
- `episodes/2026-07-ep002/SHOTLIST.md` deleted (regenerated as `RECORDING.md`).
- `episodes/2026-07-ep001/SHOTLIST.md` **left on disk** as a frozen artifact: ep001 is unmigrated
  and gets no `RECORDING.md`, so deleting it buys nothing.

---

## Blast radius

**Code**
- `scripts/lib/script-cues.ts` — cue IDs, cue types, voice runs, validation.
- `scripts/lib/repro.ts` *(new)* — parse REPRO scene blocks + the failure-recipes section.
- `scripts/lib/recording-merge.ts` *(new)* — fingerprints and tick carry-over.
- `scripts/gen-prep-docs.ts` — build `RECORDING.md` + `VOICE.md`; `buildShotlist` deleted; `--force`.

**Docs / templates**
- `templates/script.md` (ID forms in the tag legend), `templates/REPRO.md` (anchors derive from `#N`).
- `.claude/commands/script.md` (assign IDs at generation), `.claude/commands/assets.md` (emit
  RECORDING + VOICE; STATE.md manual-phase checklist).
- `CLAUDE.md` — script-structure section.
- `README.md` — `pnpm prep` row. `scripts/lib/flow.ts` — manual-phase text + prep row.

**Episode data (ep002)**
- `script.md` — add `#1..#9`, `A1..A2`, `M1..M3`, `S1..S3`.
- `assets/MEME_LIST.md` — hand-add `M<n>` headers (file is hand-filled; generator won't touch it).
- `STATE.md` — artifacts + manual-phase checklist.
- `SHOTLIST.md` deleted; `RECORDING.md` + `VOICE.md` generated.

## Acceptance

1. `pnpm test` green, including the three tick-carry-over tests: tick → regenerate unchanged → tick
   survives; tick → change scene text → box reset with `⟳` marker (and printed); tick → renumber →
   warning printed listing the dropped ticks.
2. `pnpm prep -- --episode 2026-07-ep002` regenerates docs whose IDs match 1:1 across
   `script.md` ↔ `REPRO.md` ↔ `RECORDING.md` ↔ `VOICE.md`.
3. `pnpm prep -- --episode 2026-07-ep001` prints the legacy message and exits 0.
4. A deliberate desync fails loudly (non-zero exit, nothing written) in **both** directions the
   validation claims to cover:
   a. a `#N` in `script.md` whose REPRO scene block was deleted → fail;
   b. an orphan REPRO scene block with no matching `#N` in `script.md` → fail.
