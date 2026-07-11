---
name: remotion-scenes
description: How to parameterize and render the yt-production Remotion compositions (StarChart, Intro, VerdictCard, ThumbTemplate) from episode data. SKELETON, not implemented.
---

# remotion-scenes (SKELETON)

**Status: not implemented. Contract only.**

## Purpose
Bridge episode data → Remotion props → rendered scene files. Documents each
composition's prop contract so the `/assets` command can render them consistently.

## Input
- `--episode <id>` data: repo name, verdict, star-growth series, episode number.

## Output
- Guidance + prop shapes for rendering each composition via `remotion render` (from the
  standalone `remotion/` package) into `episodes/<ep>/assets/`.

## Composition prop contracts (as built in `remotion/src/`)
- `StarChart` — `{ repoName: string; data: { date: string; stars: number }[] }`
- `Intro` — `{ episodeNumber: number }`
- `VerdictCard` — `{ verdict: string }` (ГОДНОТА | ХАЙП | НАКРУТКА | РАНО)
- `ThumbTemplate` — `{ repoName: string; verdict: string }`

## TODO (not implemented)
- [ ] Map episode fields → each composition's props.
- [ ] Document the exact `remotion render` invocation + `--props` passing.
- [ ] Flesh out Intro / VerdictCard / ThumbTemplate beyond their current stubs.
