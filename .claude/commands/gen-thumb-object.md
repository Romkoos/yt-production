# /gen-thumb-object

Generate a thumbnail **focal object** — or a full **background scene** — with the Gemini image API
(Nano Banana). Generated *scenes* feed `ThumbTemplate`'s `bgImage` prop today; the isolated-object
compositing layer is a follow-up (see below).

**Usage:** `/gen-thumb-object --mode <mode> [--episode <id>] [--scene] [--subject "<text>"] [--model <id>] [--dry-run]`

```bash
node --import tsx scripts/gen-thumb-object.ts --mode <mode> [--episode <id>] [--scene] \
  [--subject "<text>"] [--model <id>] [--dry-run]
```

- `--mode` — **required**, one of the three below.
- `--episode <id>` — default: the newest episode directory.
- `--scene` — render the full background scene variant instead of the isolated object.
- `--subject "<text>"` — the brand for `known-logo`, the metaphor for `category-object`.
  **Required** for both; ignored for `real-avatar`, whose subject is the avatar itself.
- `--model <id>` — default `gemini-3-pro-image-preview` (Nano Banana Pro — best logo/text fidelity).
  Use `gemini-2.5-flash-image` for cheap drafts.
- `--dry-run` — print the exact prompt and exit. No API key read, no network call.

**Auth:** `GEMINI_API_KEY` from the environment — never logged, never written to disk (same hygiene
as `GITHUB_TOKEN` in `/assets`' star-history fetch).

## The three modes

| Mode | What it does | Honesty guarantee |
|---|---|---|
| `real-avatar` | Sends the episode's cached repo avatar (`assets/logo-<owner>.png`, fetched from `github.com/<owner>.png` on first use) as a reference image. | The prompt is **trademark-faithful**: do not redraw, restyle, re-letter or reinterpret the logo — only its presentation is generated. |
| `known-logo` | Text-only prompt naming a real brand (`--subject "Meta infinity logo"`). | The host names a **real, well-known** mark; the model reproduces, it does not invent. |
| `category-object` | Text-only prompt describing a category metaphor (`--subject "3D terminal window"`). | The prompt **forbids any brand logo, wordmark or lettering** — inventing a brand-like mark is the failure mode this clause exists to block. |

All modes forbid **text of any kind** in the generated image. Thumbnail text is always a
programmatic `ThumbTemplate` render (channel rule — never generative).

`--dry-run` is the audit surface: it prints the exact prompt for free, so any of these claims can be
checked without spending a cent or trusting this table.

## Output contract

| Path | Role | Git |
|---|---|---|
| `episodes/<ep>/assets/gen/{object,scene}-<mode>-vN.png` | **Archive** — every variant ever generated | ignored |
| `remotion/public/gen/<ep>/scene-<mode>-vN.png` | **Render surface** — the only tree `staticFile()` resolves | ignored |
| `episodes/<ep>/assets/gen-log.json` | **Audit/repro record** — prompt, model, mode, subject, outputs, estimated cost per run | **tracked, append-only** |

Only `scene-*` outputs are mirrored to the render surface: `object-*` has no consumer until the
`ThumbTemplate` object layer ships. **`object-*` outputs begin mirroring to
`remotion/public/gen/<ep>/` when the `ThumbTemplate` object layer ships.**

`gen-log.json` sits *beside* `gen/`, not inside it — git cannot re-include a file whose parent
directory is excluded, and `episodes/*/assets/*` excludes `gen/`. See
`scripts/workspace-hygiene.test.ts`.

**Cleanup:** `remotion/public/gen/<ep>/` is disposable — it can be regenerated from the episode
archive at any time, so it is safe to delete.

## Using a scene

The script prints a paste-ready line:

```
✓ scene-real-avatar-v1.png   (gemini-3-pro-image-preview, ~$0.13 — estimate, prices as of 2026-07-13)
  bgImage: "gen/2026-07-ep001/scene-real-avatar-v1.png"
```

Paste `bgImage` into a variant's `props` in `episodes/<ep>/assets/thumb-variants.json`, then run
`/thumbs-preview` — the contact sheet prints each variant's background beneath it.

Cost figures are **estimates** from a hardcoded price table, printed with the date they were
recorded. The log stores the exact model per run, so a corrected table can recompute historical
cost. Never quote them as a billing figure.

## Side-effects

Writes only under `episodes/<ep>/assets/` and `remotion/public/gen/<ep>/`. The only network calls
are the Gemini API and (first use of `real-avatar`) the GitHub avatar fetch. No third-party repo
code is executed.
