# Linear-take recording doctrine — design

**Date:** 2026-07-15
**Status:** implemented

## Problem

The first real recording session proved the old "scenes as isolated setups" model wrong. The host
was shooting prepared states and jumping between scenes out of order; evidence proofs were staged
separately from the moments they proved; and one-shot moments (e.g. the Gatekeeper block dialog,
which macOS won't re-show after the first Open) were being blown because nothing flagged them.

## Principle (the doctrine)

The host records **the user's path**, live, in **one continuous linear take** on a **clean machine
state** — the steps a real user would take, in the order they'd take them. No sandbox shortcuts on
camera, no prepared states in frame, no *«оставь на потом»*, no out-of-order jumping. Evidence
moments are woven **into the flow** at the point the narrative needs them. The edit carves scenes
out of one honest take; scenes are never shot as isolated setups. Prepared states are allowed only
off-camera (pre-downloading model weights), never as an in-frame shortcut.

## REPRO.md structure (new)

Replaces `## Prepared states` / `## SETUP` / `## Scenes` / `## Failure recipes` with:

| Section | Owner | Content |
|---|---|---|
| `## Clean slate` | `/review-repo` | commands to wipe all prior product state on the recording path → first-run |
| `## User flow` | `/review-repo` | numbered linear path; each step `<a id="scene-N">` + `### FLOW N`, with Do/On screen/Wait-Cut/Reset; README breaks happen live in the flow |
| `## Evidence inserts` | `/review-repo` | each proof `<a id="scene-N">` + `### EVIDENCE N`, an `Anchor` bullet to its flow step, and the ⚠️ honesty-scoping bullets carried as-is |
| `## Environment caveats` | `/review-repo` | one-shot moments ("этот кадр только в первом прогоне") |
| `## Prepared states` | `/review-repo` | OPTIONAL, off-camera time savings only |

## Decisions

- **Anchor model:** both User-flow steps and Evidence inserts carry `<a id="scene-N">`; the parser
  gathers anchors **doc-wide** (not from a single section). The `[СКРИНКАСТ #N]` ↔ `#scene-N`
  bijection and the fingerprint/tick-carry-over machinery are unchanged.
- **Sections fate:** failures fold into the flow (a stubborn user hits the break live); prepared
  states demoted to an optional off-camera section; `## SETUP` and `## Failure recipes` removed.
- **Monotonic guard:** `pnpm prep` hard-fails if the REPRO anchors don't ascend along the flow —
  narrative order = shooting order by construction. By-number lookup stays as defensive internal
  behavior (parser unit test still asserts it); the old out-of-order gen-prep test is repurposed to
  assert the guard rejects descending anchors and writes nothing.
- **Decision E (who authors the anchored flow):** `/review-repo` writes the anchored flow (it walked
  the real path, so it is authoritative and can number in flow order). `/script` writes the
  `[СКРИНКАСТ #N]` cues in the same order and confirms the alignment; `pnpm prep` enforces
  agreement. `script.md` stays the numbering source; the flow's linear order is what that numbering
  follows.

## RECORDING.md (derived)

The linear shooting run: `## Чистый лист` wipe checklist on top, a prominent `## ⚠️ ОДИН ДУБЛЬ`
block from the env caveats, off-camera prepared states demoted to `## Заготовки`, then a checkbox
per `[СКРИНКАСТ #N]` in flow order (evidence inserts interleaved at their script-order position).
No `## Failure recipes` footer. Tick carry-over unchanged.

## Files touched

- `CLAUDE.md` — Recording doctrine subsection; cue-ID table + `pnpm prep` hard-fail note.
- `templates/REPRO.md` — new section skeleton.
- `scripts/lib/repro.ts` — `ReproDoc` fields (`cleanSlate`/`envCaveats`, drop
  `scenesPreamble`/`failureRecipes`); doc-wide anchor gather; relaxed `SCENE_HEADER`.
- `scripts/lib/script-cues.ts` — monotonic-along-flow guard in `validateScript`.
- `scripts/gen-prep-docs.ts` — new pre-flight; `Anchor` label; drop failure-recipes footer.
- `.claude/commands/{review-repo,script,assets}.md` — command doctrine.
- Fixtures + tests — `repro-mini.md` rewritten; `repro.test.ts`, `gen-prep-docs.test.ts`,
  `script-cues.test.ts` updated. Honesty-guard and tick-carry-over tests kept passing.

No episode to regenerate (pilots deleted); episode #1 is born under this doctrine.
