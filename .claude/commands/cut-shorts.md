# /cut-shorts

**Status: SKELETON — not implemented. Contract only.**

Slice Shorts out of the finished, edited video and burn in Russian subtitles.

## ⚠️ TIMECODE DISCIPLINE (read before implementing — "clock (c)")

This command consumes the **reconciled, real final-video timecodes** — the ones written
into `STATE.md` / `script.md` during the manual phase's timecode-reconciliation step,
AFTER the DaVinci Resolve edit.

It must **NOT** slice by the `[SHORT cut: <narrative beat>]` markers that `/script`
wrote into the draft `script.md`. Those are **candidate narrative beats only** — they are
NOT real timecodes and do not correspond to any position in the rendered video. A future
implementation that treats script-draft markers as real timecodes is a bug. Only real,
post-edit, reconciled timecodes are valid input here.

## Input
- `--episode <id>`.
- The finished/rendered long video for the episode (path provided by the host).
- The RECONCILED real timecodes (start–end per Short) from STATE.md/script.md.

## Output
- `episodes/<ep>/shorts/*.mp4` (GITIGNORED) — one file per Short.
- Russian subtitle files / burned-in subs per Short.

## Side-effects
- FFmpeg (slicing, subtitle burn-in).
- Whisper (Russian transcription → subtitles) — see the `whisper-subs` skill.

## TODO (not implemented)
- [ ] Read reconciled real timecodes from STATE.md/script.md (NOT the `[SHORT cut]` drafts).
- [ ] FFmpeg-slice each Short from the finished video by start–end.
- [ ] Transcribe Russian audio via Whisper and burn in subtitles.
- [ ] Write outputs to `episodes/<ep>/shorts/`; update STATE.md + `phase_metrics`.
- [ ] Define the exact reconciled-timecode format the manual phase writes.
