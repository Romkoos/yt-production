# /assets

**Status: SKELETON — not implemented. Contract only.**

Render the episode's Remotion scenes (StarChart, Intro, VerdictCard) and 3 thumbnail
variants from the parameterized templates.

## Input
- `--episode <id>` — the episode to render assets for.
- Reads from the episode: the verdict and star-growth data (from `report.md` / STATE.md),
  repo name, episode number.

## Output
- Rendered files in `episodes/<ep>/assets/` (GITIGNORED — binary artifacts).
  - `starchart.mp4`, `intro.mp4`, `verdict.mp4`
  - `thumb-1.png`, `thumb-2.png`, `thumb-3.png`

## Side-effects
- Invokes the standalone Remotion package under `remotion/` (via `remotion render`),
  passing props derived from the episode. All thumbnail TEXT is a programmatic render,
  never generative (channel content rule).

## TODO (not implemented)
- [ ] Extract star-growth series + repo name from the episode into StarChart props.
- [ ] Render StarChart / Intro / VerdictCard via `remotion render` into `assets/`.
- [ ] Render 3 thumbnail variants from `ThumbTemplate` (different composition/emphasis).
- [ ] Update STATE.md (`current_phase: assets`, artifacts) + record `phase_metrics`.
- [ ] Decide how star history is sourced (star-history API vs scraped from GitHub).
