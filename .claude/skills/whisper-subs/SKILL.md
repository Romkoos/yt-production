---
name: whisper-subs
description: Generate Russian subtitles from episode audio via Whisper, for burning into Shorts. SKELETON, not implemented.
---

# whisper-subs (SKELETON)

**Status: not implemented. Contract only.**

## Purpose
Transcribe Russian audio into subtitles (SRT/VTT) for the `/cut-shorts` command to burn
into each Short.

## Input
- An audio/video file (a Short or the full episode) with Russian speech.

## Output
- Subtitle files (SRT/VTT) with Russian text and word/segment timings, ready for FFmpeg
  burn-in.

## TODO (not implemented)
- [ ] Choose the Whisper implementation (whisper.cpp / faster-whisper / API) + model size.
- [ ] Transcribe with `language=ru`; tune for developer jargon / English tech terms mixed in.
- [ ] Emit SRT/VTT with timings aligned to the sliced Short (not the full video).
- [ ] Optional: post-edit pass for correct casing of tool/repo names.
