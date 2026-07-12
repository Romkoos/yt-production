---
name: thumbnail-brief
description: Thumbnail brief + critique methodology — title-thumbnail synergy check, focal/composition/color/text specs with exact hex, A/B variant discipline (change ONE variable), mobile legibility check, quality criteria. Use when briefing, rendering, or critiquing thumbnail variants.
---

# Thumbnail Brief + Critique Methodology

> **Source:** adapted from `AgriciDaniel/claude-youtube → skills/claude-youtube/sub-skills/thumbnail.md`.
> **PROJECT ADAPTATION (yt-production):** we take the **brief + critique methodology only**.
> We DISCARD the original's image-generation path (NanoBanana MCP, DataForSEO, `generate_image`
> prompts that render text). Our channel rule stands: **thumbnail text is always a programmatic
> Remotion render (`ThumbTemplate`), never generative**. AI is allowed only as a background
> texture layer. Use this file to produce the brief and to CRITIQUE variants before rendering.

## Execution Steps

1. **Analyze the title.** Identify what the title already communicates. The thumbnail must add
   NEW information — never duplicate the title verbatim.
2. **Determine focal strategy.** Faceless channel → object-driven, text-driven, comparison, or
   transformation. (Face-driven is N/A for us.)
3. **Build the primary brief** (template below) — specific enough to render without ambiguity.
4. **Create A/B variants** — each changes exactly ONE meaningful variable.
5. **Run the synergy check** — verify the title↔thumbnail information split.
6. **Validate against Quality Criteria** before presenting.

## Brief Template (per variant)

```
### Focal Point
- Primary object: [terminal screenshot / code frame / logo / chart — the real thing to look at]
- Position: [rule-of-thirds placement, e.g. "object right-third, hook text left"]
- Size: [% of frame, target 30–50%]
- Depth treatment: [shadow / glow / slight rotation — never a flat sticker]

### Text Overlay
- Hook text: [≤3 words ideal, ≤6 max — must NOT repeat the title]
- Weight/size ladder: [one HUGE word (700), secondary line much smaller (400)]
- Accent: [which word gets the accent color]
- Position: [must not overlap the focal object or a safe-zone corner]
- Stroke/shadow: [outline/shadow spec for legibility]

### Color Palette (exact hex, max 3)
- Primary [#hex, name] — role: background/dominant
- Secondary [#hex, name] — role: accent/text
- Contrast [#hex, name] — role: pop element that draws the eye

### Composition
- Layout: [rule-of-thirds description]
- Negative space: [where + ~30–40%]
- Visual flow: [entry point → exit point]

### Mobile Legibility Check (120px / 168×94px)
- Must remain visible: [focal object, hook word, verdict]
- Becomes noise at small size: [what to drop]

### DO NOT Include (≥3 items)
- [element to avoid + why]
```

## A/B Variant Discipline

Each variant changes **exactly ONE** variable from the primary (focal object, OR color scheme,
OR composition, OR text) — not several at once. For each: state what changes, the hypothesis,
and the predicted CTR direction. For us the 3 variants must be **genuinely different
compositions**, not the same layout with swapped text.

## Title + Thumbnail Synergy Check

| Rule | Status | Detail |
|------|--------|--------|
| Information split (no duplication) | PASS/FAIL | title says X, thumb shows Y |
| Emotional alignment | PASS/FAIL | title tone matches thumb emotion |
| Curiosity amplification | PASS/FAIL | together > either alone |
| Text overlap check | PASS/FAIL | thumb text ≠ title words |
| Mobile readability | PASS/FAIL | both work at mobile size |

**Synergy verdict:** Strong / Moderate / Weak — one-sentence assessment. On any FAIL, state the fix.

## Quality Criteria (reject if unmet)

- Hook text ≤6 words (ideally ≤3).
- Palette uses exact hex codes, not just names; max 3 colors.
- Each A/B variant changes exactly ONE variable.
- Synergy check evaluates all 5 rules; flags failures with fixes.
- Mobile legibility explicitly addressed (120px test).
- "DO NOT Include" has ≥3 specific items.
- Composition directions are spatial and actionable ("object right third, 3px stroke"), not "make it look good".
- No thumbnail duplicates title information.
- **(yt-production)** No generative text anywhere in the image; no fabricated numbers — every
  quantitative claim is backed by `report.md`.
