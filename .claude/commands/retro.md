# /retro

**Status: SKELETON — not implemented. Contract only.**

Close the loop on an episode: pull YouTube Analytics into the local metrics DB, compare
against past episodes, record hypotheses, and convert this session's friction into
concrete skill/command fixes.

## Input
- `--episode <id>` — requires `youtube_video_id` to be set in the episode's STATE.md
  (and/or the `episodes.youtube_video_id` column in `db/tracker.sqlite`).

## Output
- YouTube metrics rows in `db/tracker.sqlite` (views, retention, CTR, etc. — schema
  columns to be added when this phase is built).
- Retro notes (what worked, what didn't, hypotheses for next episode).
- A prioritized list of skill/command improvements — feeds the build-order principle:
  *automate next whatever phase hurt most in the last retro.*

## Side-effects
- Reads the YouTube Analytics API (auth setup TBD).
- Writes to `db/tracker.sqlite`.

## TODO (not implemented)
- [ ] Wire YouTube Analytics API auth + fetch by `youtube_video_id`.
- [ ] Add analytics columns to the Drizzle schema (views/retention/CTR/…) + migration.
- [ ] Store metrics; compare against prior episodes' `phase_metrics` + analytics.
- [ ] Record hypotheses + a ranked list of pipeline improvements.
- [ ] Update STATE.md (`current_phase: retro`, `phase_status: done`).
