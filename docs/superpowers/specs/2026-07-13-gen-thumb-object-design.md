# Generative thumbnail objects & scenes (Gemini / Nano Banana) — design

**Date:** 2026-07-13
**Status:** approved, ready for planning
**Scope:** `scripts/gen-thumb-object.ts`, `scripts/lib/gemini-image.ts`,
`.claude/commands/gen-thumb-object.md`, a folded-in `bgImage` surfacing change in
`scripts/lib/thumb-preview.ts`, and two `.gitignore` rules.

**Explicitly out of scope:** the `ThumbTemplate` luminance-alpha **object layer**. Generated
*scenes* feed the existing `bgImage` prop in this pass; compositing an isolated object over a
programmatic background is a separate follow-up.

---

## 1. Why

Thumbnail focal objects are currently limited to what we can cache (a GitHub org avatar) or draw
programmatically. The approach validated manually — generating a glowing 3D app-icon-tile
presentation of an object, isolated on pure black, via the Gemini image API (Nano Banana) — gives
the thumbnail a real focal object without generative *text* and without fabricating brand marks.
This spec wires that into the pipeline as a script + command.

The channel's honesty rules (`CLAUDE.md`) constrain the whole design:

- **Thumbnail text is always a programmatic render** — so every generated image is text-free, and
  every prompt says so.
- **We never fabricate a brand.** The three modes exist precisely to make fabrication structurally
  impossible: either we hand the model the real logo, or we name a brand the model already knows,
  or we forbid brand marks entirely.

---

## 2. Components

Two files, split on the same seam the repo already uses for `/thumbs-preview`
(`scripts/thumbs-preview.ts` orchestrates IO; `scripts/lib/thumb-preview.ts` is pure and tested).

### `scripts/lib/gemini-image.ts` — pure, unit-testable

No `fs`, no network, no SDK import. Exports:

| Export | Contract |
|---|---|
| `buildPrompt(mode, variant, subject?)` | The prompt string. `mode` ∈ `real-avatar \| known-logo \| category-object`; `variant` ∈ `object \| scene`. |
| `extractInlineImages(response)` | `{ mimeType, data }[]` from `candidates[0].content.parts`, selected **by presence of `inlineData`**, never by index. |
| `nextVersion(existingNames, variant, mode)` | The `N` for the `vN` filename suffix. |
| `estimateCostUsd(model, imageCount)` | USD, from the `PRICE_PER_IMAGE_USD` table. |
| `appendGenLog(existingLog, entry)` | New log value. Append-only; never rewrites prior entries. |
| `interface ImageGenerator` | `{ generate(req): Promise<GenResponse> }` — the injection seam. |

`ImageGenerator` is what keeps the test suite off the network. Tests inject a fake; the orchestrator
injects a `@google/genai`-backed implementation.

### `scripts/gen-thumb-object.ts` — orchestrator

Owns all IO: arg parsing, `GEMINI_API_KEY`, `STATE.md` → owner, avatar fetch/cache, the real
`ImageGenerator`, file writes, the mirror, the log append.

`@google/genai` is a **root** `dependencies` entry — scripts run from the repo root via `tsx`. It is
not a `remotion/` dependency (that package has its own lockfile; see `CLAUDE.md`).

---

## 3. Data flow

```
STATE.md repo_url ──► owner
                       │
                       ▼  (real-avatar only)
     episodes/<ep>/assets/logo-<owner>.png  ◄── fetch github.com/<owner>.png if missing
                       │  sent as an inlineData reference
                       ▼
buildPrompt(mode, variant, subject) ──► ImageGenerator.generate ──► extractInlineImages
                       │
       ┌───────────────┴────────────────┐
       ▼ ARCHIVE                         ▼ RENDER SURFACE (scene-* only, for now)
episodes/<ep>/assets/gen/                remotion/public/gen/<ep>/
  object-<mode>-vN.png                     scene-<mode>-vN.png
  scene-<mode>-vN.png
episodes/<ep>/assets/gen-log.json  (TRACKED, append-only)
```

**Archive** (`episodes/<ep>/assets/gen/`) — every generated variant, gitignored as usual. The
episode's permanent record of what was produced.

**Render surface** (`remotion/public/gen/<ep>/`) — the only tree `staticFile()` can resolve.
Gitignored, disposable, **regenerable from the archive at any time**.

### The avatar

`real-avatar` reads `episodes/<ep>/assets/logo-<owner>.png`, fetching `github.com/<owner>.png` into
that same path if absent. `owner` is parsed from `STATE.md`'s `repo_url`, the same way
`fetch-star-history.ts` does it. One cached file serves both `ThumbTemplate`'s focal `LogoTile`
(`logo.src`) and the Gemini reference image — no second copy of the same PNG under a different name.

### The mirror, and the follow-up contract

Only `scene-*` files mirror today. `object-*` files have **no consumer** until the object layer
ships, so mirroring them would drop dead PNGs into the render tree.

That decision is correct now but becomes wrong the moment the follow-up lands, so it is encoded as a
contract in two places rather than left in prose:

1. A `TODO` marker **at the exact branch point in the mirror logic**, naming the object-layer
   follow-up.
2. One line in `.claude/commands/gen-thumb-object.md`'s contract:
   > `object-*` outputs begin mirroring to `remotion/public/gen/<ep>/` when the `ThumbTemplate`
   > object layer ships.

### `gen-log.json` placement — forced by a git rule

The log lives at **`episodes/<ep>/assets/gen-log.json`** — a *sibling* of `gen/`, not inside it.

This is not a style choice. Git: *"It is not possible to re-include a file if a parent directory of
that file is excluded."* The existing pattern `episodes/*/assets/*` (`.gitignore:3`) matches the
`gen` **directory** itself, so git never descends into it and a `!episodes/*/assets/gen/gen-log.json`
rule would be inert. `thumb-variants.json` is re-includable precisely because it is a direct child of
`assets/`. Verified: `git check-ignore -v episodes/2026-07-ep001/assets/gen/scene-x.png` →
`.gitignore:3:episodes/*/assets/*`.

The log is the reproduction/audit record — prompt, model, mode, subject, output filenames, estimated
cost, timestamp per run. An audit trail that dies with the working copy is not an audit trail, so it
is committed. PNGs stay ignored. Semantics are **append-only**: a new run appends an entry and never
rewrites history.

---

## 4. CLI

```
gen-thumb-object.ts --mode <real-avatar|known-logo|category-object>
                    [--episode <id>] [--scene] [--subject "<text>"]
                    [--model <id>] [--dry-run]
```

- `--episode` — default: the newest episode dir (same convention as `pickEpisode`).
- `--scene` — render the full background scene variant instead of the isolated object.
- `--subject` — the brand for `known-logo` (`"Meta infinity logo"`), the metaphor for
  `category-object` (`"3D terminal window"`). **Required** for those two modes; ignored for
  `real-avatar`, whose subject is the avatar image itself.
- `--model` — default `gemini-3-pro-image-preview` (Nano Banana Pro; best text/logo fidelity).
  `gemini-2.5-flash-image` is the cheap-draft escape hatch.
- `--dry-run` — build and print the prompt, then exit. No API key, no network call. This is the
  honesty-audit surface: anyone can read exactly what we ask the model for, for free.

**Auth:** `GEMINI_API_KEY` from the environment, same hygiene as `GITHUB_TOKEN` in
`fetch-star-history.ts` — never logged, never written to disk, never passed to a sandboxed process.

### Success output

```
✓ scene-real-avatar-v1.png   (gemini-3-pro-image-preview, ~$0.13 — estimate, prices as of 2026-07-13)
  bgImage: "gen/2026-07-ep001/scene-real-avatar-v1.png"
```

The `bgImage` line is paste-ready into `thumb-variants.json`. The cost caveat is printed on the
**console**, not just left in a code comment — the console is where the number is actually read.

---

## 5. Honesty guardrails

Asserted by tests, not merely written into strings.

| Mode | Guardrail clause in the prompt |
|---|---|
| `real-avatar` | **Trademark-faithful clause:** use the supplied image as the exact logo; do **not** redraw, restyle, re-letter, or reinterpret it; preserve its glyph shapes, proportions, and colours precisely. |
| `known-logo` | The brand is **named by the host**, so the model reproduces a mark it already knows rather than inventing one. |
| `category-object` | **Anti-brand clause:** no brand logos, no wordmarks, no lettering of any kind. This is what stops the model producing a plausible-looking *fake* logo — a `CLAUDE.md` honesty violation. |
| all modes | **No text anywhere in the image.** Thumbnail text is always a programmatic `ThumbTemplate` render. |
| `--scene` | **Strict layout grid:** object confined to the right third at ~30% width; left two thirds dark and empty for the text overlay; no text anywhere. |

---

## 6. Cost estimate

`PRICE_PER_IMAGE_USD` is a hardcoded table carrying an "as of" date.

**These figures are estimates and were not verified against Google's live pricing page while writing
this spec.** The code comment says so and the console line says so. The log records the exact `model`
per run, so a corrected price table can recompute historical cost from the log. The estimate is a
budgeting aid — it is never presented as a billing figure.

---

## 7. Folded-in change — `bgImage` in the preview

`variantSummary()` in `scripts/lib/thumb-preview.ts` currently returns only `{ hookText, verdict }`;
neither the stdout line nor the contact-sheet card caption mentions the background. **This is a new
addition, not existing behaviour.** It gains `bgImage`, rendered in both places (`bg —` when absent),
plus one test case.

Without it, a host iterating on generated scenes cannot tell which variant is sitting on which
background — which is the entire point of generating them.

---

## 8. `.gitignore`

```gitignore
!episodes/*/assets/gen-log.json     # audit/repro record — tracked, like thumb-variants.json
remotion/public/gen/                # per-episode generated render surface — regenerable from the archive
```

`remotion/public/` is otherwise fully tracked (`branding/`, `fonts/`, `thumb/`) and is the brand-asset
space; per-episode generated content must not pollute it. A slash-containing pattern matches
path-wise, not by basename, so `remotion/public/gen/` cannot swallow those siblings — but this is
**verified with `git check-ignore -v` on `branding/logo.svg`, a font, and `thumb/logo-facebook.png`**,
not assumed.

---

## 9. Tests

`scripts/lib/gemini-image.test.ts` (new) — nothing touches the network:

- **Prompt builders** — all six `mode × variant` combinations. Each asserts its required guardrail
  clause from §5 and the no-text rule; each `scene` asserts the layout grid.
- **`extractInlineImages`** — fixtures proving selection is *by presence, never by index*:
  parts ordered `[text, image]`; ordered `[image, text]`; two images with interleaved text; and a
  response with **no** image part at all (must throw a clear error, not return `undefined`).
- **`nextVersion`** — empty directory, gaps in the sequence, `object-*` and `scene-*` numbered
  independently.
- **`estimateCostUsd`** — known model, unknown model.
- **`appendGenLog`** — appends; never rewrites prior entries.

`scripts/lib/thumb-preview.test.ts` — one case for `bgImage` in `variantSummary()` (present /
absent).

---

## 10. Docs

- **`.claude/commands/gen-thumb-object.md`** (new) — the contract: usage, the three modes, the
  archive-vs-render-surface split, the object-layer mirroring line from §3, the honesty guardrails,
  the output contract, and the cleanup note: *`remotion/public/gen/<ep>/` is regenerable from the
  archive at any time and is safe to delete.*
- **`.claude/commands/assets.md`** — a short section pointing at `/gen-thumb-object`, noting that
  generated **scenes** feed `ThumbTemplate`'s `bgImage` today and that the object layer is a
  follow-up.
