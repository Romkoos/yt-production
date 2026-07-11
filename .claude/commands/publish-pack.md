# /publish-pack

**Status: SKELETON — not implemented. Contract only.**

Prepare the publish bundle: descriptions, tags, and hand-off artifacts for the host's
EXISTING Late API pipeline. This command does NOT publish anything itself.

## Input
- `--episode <id>`.
- The finished long video + the Shorts (from `/cut-shorts`).

## Output
- A hand-off bundle (e.g. `episodes/<ep>/publish/`): generated Russian title candidates,
  description, tags/keywords, per-Short captions — structured for the Late API pipeline
  to consume.

## Side-effects
- None external. Prepares files only; the actual upload/publish is done by the host's
  separate Late API pipeline (out of scope for this repo).

## TODO (not implemented)
- [ ] Generate title candidates + description from report.md / script.md / verdict.
- [ ] Generate tags/keywords (channel niche + repo topics).
- [ ] Produce per-Short captions.
- [ ] Emit the bundle in the exact shape the Late API pipeline expects (format TBD).
- [ ] Update STATE.md (`current_phase: publish`) + record `phase_metrics`.
