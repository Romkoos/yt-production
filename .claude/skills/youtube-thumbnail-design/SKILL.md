---
name: youtube-thumbnail-design
description: YouTube thumbnail design principles — 120px mobile glance test, YouTube UI safe zones, single focal point, high-contrast color schemes, text legibility, common mistakes. Use when designing, rendering, or critiquing a thumbnail. Triggers: thumbnail design, ThumbTemplate, thumbnail variant, thumbnail review, ctr, safe zone, focal point.
---

# YouTube Thumbnail Design

> **Source:** adapted from `inferen-sh/skills → guides/design/youtube-thumbnail-design`.
> **PROJECT ADAPTATION (yt-production):** we keep every *design principle* below. We
> DISCARD the original skill's `belt` AI-image-generation workflow: our channel rule is
> **thumbnail text is always a programmatic Remotion render, never generative**. AI imagery is
> allowed ONLY as a background texture layer (host-supplied Midjourney), never for text or for
> a fabricated focal object. Every number on a thumbnail must be backed by `report.md`.

## Specifications

| Spec | Value |
|------|-------|
| Dimensions | 1280×720 px (minimum) |
| Recommended | 1920×1080 px |
| Aspect ratio | 16:9 |
| Max file size | 2 MB |
| Formats | JPG, GIF, PNG |

## The 120px Test

Your thumbnail appears at roughly **120px wide** on mobile — how most viewers first see it.

**At 120px, viewers must be able to identify:**
1. The mood/emotion (from colors and the focal object)
2. The general subject (from composition)
3. The text (only if large enough)

**Test:** view the thumbnail at 120px width. If it's a muddy blur, redesign.

## Safe Zones

```
┌─────────────────────────────────────────────┐
│                                             │
│   ✅ SAFE FOR TEXT AND KEY ELEMENTS         │
│                                             │
│                                             │
│                                             │
│                                       ┌───┐ │
│                                       │ ⏱ │ │ ← Timestamp overlay
│                              ┌────────┴───┘ │    (bottom-right)
│   ┌────┐                     │  DURATION    │
│   │ CH │ Chapter marker      └──────────────│
└───┴────┴────────────────────────────────────┘
     ↑ Bottom-left: chapter/progress markers
```

**Avoid placing critical elements in:**
- **Bottom-right corner** — video duration timestamp overlay (our old verdict sticker sat here — never again).
- **Bottom-left corner** — chapter markers / progress bar.
- **Extreme edges** — cropping varies by device.

## Color Strategy

### High-Contrast Pairs That Work

| Combination | Mood | Best For |
|-------------|------|----------|
| Yellow + Black | Urgency, attention | Tech, business, lists |
| Red + White | Energy, excitement | Entertainment, reactions |
| Blue + Orange | Professional contrast | Education, tutorials |
| Green + White | Growth, money | Finance, success stories |
| Purple + Yellow | Premium, creative | Design, art, creativity |
| White + Dark | Clean, minimal | Luxury, minimalist channels |

### Color Rules

- Background and text/subject should be complementary or high-contrast.
- Avoid same-temperature colors touching (red on orange = mud).
- Use **3 colors maximum** per thumbnail.
- Saturate more than real life — thumbnails compete with bright UI.

## Text on Thumbnails

### When to Use Text
Lists/numbers ("7 Tips"), strong opinions ("STOP Doing This"), results ("$10K in 30 Days"), comparisons ("vs").

### When NOT to Use Text
The title already says it (redundant); the visual tells the story; you can't make it readable at 120px.

### Text Rules

| Rule | Reason |
|------|--------|
| Max 6 words (ideally ≤3) | Readability at thumbnail size |
| Min ~60pt equivalent | Legible at 120px width |
| Bold sans-serif | Thin fonts vanish at small sizes |
| Contrast stroke/shadow | Readable on any background |
| No small text | If not readable small, cut it |

## Focal Point

Faceless channel (ours): the focal point is a **visual OBJECT**, not a face — a real terminal
screenshot, a code frame, a tech logo, or a chart. Rules that still apply:

- **One** clear focal point. If the eye doesn't know where to land, redesign.
- Object occupies **30–50%** of the frame; give it depth (shadow/glow/slight rotation) so it
  isn't a flat sticker floating on a fill.
- **30–40% negative space** — cluttered thumbnails lose the focal point at small sizes.
- Direct visual flow: object → hook word → verdict.

## A/B Testing

Test **one variable at a time**: color scheme (warm vs cool), text vs no text, background
(bright vs dark), focal object (screenshot vs logo vs chart), composition (object left vs right).
YouTube Studio allows up to 3 variants; it optimizes for **watch-time share, not just CTR**.

## Thumbnail Checklist

- [ ] 1280×720 minimum (1920×1080 preferred)
- [ ] Under 2 MB
- [ ] Passes the 120px squint test
- [ ] No critical element in bottom-right (timestamp) or bottom-left (chapter)
- [ ] Max 3 colors, high contrast
- [ ] Text (if any) ≤6 words, bold, with contrast stroke/shadow
- [ ] One clear focal object with depth (not a flat sticker)
- [ ] Doesn't duplicate the video title (complements it)
- [ ] Stands out from surrounding thumbnails in the niche
- [ ] Works on both light and dark YouTube backgrounds
- [ ] Every number is backed by report.md (honesty rule)

## Common Mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| Too much text | Unreadable small | ≤6 words or none |
| Low contrast | Disappears in feed | Complementary colors |
| Cluttered | Eye doesn't know where to look | One focal point |
| Flat sticker feel | No depth, reads as 2010s | Shadow/glow/grain/rotation |
| Tiny details | Lost at 120px | Bold simple shapes |
| Same style every video | Viewer fatigue | Vary within brand |
| Misleading thumbnail | Kills trust + AI clickbait suppression | Match actual content |
