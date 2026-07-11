---
name: thumb-gen
description: Programmatic thumbnail generation — 3 variants per episode, text always rendered (never generative). SKELETON, not implemented.
---

# thumb-gen (SKELETON)

**Status: not implemented. Contract only.**

## Purpose
Produce 3 thumbnail variants per episode from the `ThumbTemplate` Remotion composition.
Channel content rule: **all thumbnail text is a programmatic render, never generative** —
the audience is developers and the slop detector is instant.

## Input
- Repo name, verdict, episode number; optional hook phrase.

## Output
- `episodes/<ep>/assets/thumb-1.png`, `thumb-2.png`, `thumb-3.png` (GITIGNORED).

## TODO (not implemented)
- [ ] Define the 3 variant strategies (e.g. verdict-forward, question-forward, logo-forward).
- [ ] Render each via `remotion render ThumbTemplate` (1280×720) with per-variant props.
- [ ] Keep all text vector/rendered — no generative/AI imagery for text.
- [ ] Optional: A/B thumbnail hook wording sourced from the script.
