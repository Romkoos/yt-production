# /gen-thumb-object

Generate a thumbnail **focal object** — or a full **background scene** — with the Gemini image API
(Nano Banana). Generated *scenes* feed `ThumbTemplate`'s `bgImage` prop today; the isolated-object
compositing layer is a follow-up (see below).

**Usage:** `/gen-thumb-object --mode <mode> [--episode <id>] [--scene] [--apply] [--subject "<text>"] [--model <id>] [--dry-run]`
· recovery: `/gen-thumb-object [--episode <id>] --mirror-only`

The common paths have short pnpm scripts — **use these** (they are the stable surface a future UI
sits on). Each defaults to the newest episode; pass `-- --episode <id>` for another:

```bash
pnpm scene           # --mode real-avatar --scene --apply   (BILLED)
pnpm scene:dry       # --mode real-avatar --scene --dry-run (free: prints the prompt, no key)
pnpm scene:noapply   # --mode real-avatar --scene           (BILLED; leaves thumb-variants.json alone)
pnpm scene:mirror    # --mirror-only                        (free: rebuild the render surface)
```

The full CLI, for the modes/flags the scripts do not cover:

```bash
npx tsx scripts/gen-thumb-object.ts --mode <mode> [--episode <id>] [--scene] [--apply] \
  [--subject "<text>"] [--model <id>] [--dry-run]
```

- `--mode` — **required** (except with `--mirror-only`), one of the three below.
- `--episode <id>` — default: the newest episode directory.
- `--scene` — render the full background scene variant instead of the isolated object.
- `--apply` — write the generated scene into **every** variant of the episode's
  `thumb-variants.json` (`bgImage` + `objectInScene: true`). `--scene` only; rejected with
  `--dry-run` / `--mirror-only`, which generate nothing to apply. See **Applying a scene** below.
- `--subject "<text>"` — the brand for `known-logo`, the metaphor for `category-object`.
  **Required** for both; ignored for `real-avatar`, whose subject is the avatar itself (so it is
  not recorded in the log for that mode either — it had no effect on the prompt).
- `--model <id>` — default `gemini-3-pro-image-preview` (Nano Banana Pro — best logo/text fidelity).
  Use `gemini-2.5-flash-image` for cheap drafts.
- `--dry-run` — print the exact prompt and exit. No API key read, no network call.
- `--mirror-only` — copy every archived `scene-*.png` into `remotion/public/gen/<ep>/` and exit.
  No API key read, no network call, nothing generated: the **free recovery path** for a deleted or
  never-cloned render surface. Idempotent (a normal run does it first, too).

A value-taking flag rejects a missing value or one that starts with `--` (`--subject --scene` is an
error, not a request to draw "--scene" at full price).

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

## Applying a scene

`--apply` (which `pnpm scene` passes) closes the copy-paste gap: after a successful `--scene` run it
writes **`bgImage` + `objectInScene: true` into every variant** of
`episodes/<ep>/assets/thumb-variants.json` and prints what changed.

```
✓ scene-real-avatar-v3.png   (gemini-3-pro-image-preview, ~$0.13 — estimate, prices as of 2026-07-13)

Applied → episodes/2026-07-epNNN/assets/thumb-variants.json
  ✓ A — clean right: bgImage …scene-real-avatar-v2.png → …scene-real-avatar-v3.png
  ✓ B — hero: bgImage → …scene-real-avatar-v3.png, objectInScene → true

Next: pnpm thumbs
```

So the whole thumbnail leg is `pnpm scene && pnpm thumbs`.

Three rules it holds to:

- **It edits that file; it never authors it.** A missing or malformed `thumb-variants.json` is a
  refusal, never a scaffold — and the check runs **before** the billed call (like the gen-log parse),
  so it fails while failing is still free. Formatting and key order survive the round-trip.
- **The pair is written together.** A scene BAKES the focal object into the background, and
  `ThumbTemplate` draws its own `LogoTile` unless `objectInScene` is set — a `bgImage` written alone
  renders the object twice, in two places.
- **Every variant, not a chosen one.** Variants are an A/B over ONE variable; a background applied
  to a subset would silently make it a second variable and invalidate the comparison.

`pnpm scene:noapply` (or plain `--scene`) keeps the manual path: it prints both paste-ready lines
and leaves the file alone. If a single response returns several images, `--apply` uses the first and
prints the others' `bgImage` lines rather than silently discarding work that was paid for.

Cost figures are **estimates** from a hardcoded price table, printed with the date they were
recorded. The log stores the exact model per run, so a corrected table can recompute historical
cost. Never quote them as a billing figure.

## Output contract / side-effects

Writes **only** under `episodes/<ep>/assets/` and `remotion/public/gen/<ep>/`:

| Path | Role | Git |
|---|---|---|
| `episodes/<ep>/assets/gen/{object,scene}-<mode>-vN.png` | **Archive** — every variant ever generated; the **source of truth** | ignored |
| `remotion/public/gen/<ep>/scene-<mode>-vN.png` | **Render surface** — the only tree `staticFile()` resolves | ignored |
| `episodes/<ep>/assets/gen-log.json` | **Audit/repro record** — prompt, model, mode, subject, outputs, estimated cost per run | **tracked, append-only** |
| `episodes/<ep>/assets/thumb-variants.json` | **`--apply` only** — `bgImage` + `objectInScene` updated in place, in every variant. Never created. | **tracked** |

Only `scene-*` outputs reach the render surface: `object-*` has no consumer until the
`ThumbTemplate` object layer ships, at which point it starts mirroring too.

`gen-log.json` sits *beside* `gen/`, not inside it — git cannot re-include a file whose parent
directory is excluded, and `episodes/*/assets/*` excludes `gen/`. It is read and parsed **before**
the billed API call, so a corrupt log fails while failing is still free. See
`scripts/workspace-hygiene.test.ts`.

**Cleanup / recovery:** `remotion/public/gen/<ep>/` is disposable — it is a mirror of the archive
and is safe to delete. Rebuild it for free (no API key, no network, no generation) with:

```bash
pnpm scene:mirror                        # newest episode
pnpm scene:mirror -- --episode <ep>      # a specific one
```

A normal run reconciles the mirror first, so the repair also happens implicitly. The archive
itself is gitignored: if *it* is gone (fresh clone, `git clean -dx`), the images are gone and only
a paid re-generation brings them back — `gen-log.json` holds the exact prompt/model to reproduce them.

The only network calls are the Gemini API and (first use of `real-avatar`) the GitHub avatar fetch.
`GEMINI_API_KEY` is never logged or written. No third-party repo code is executed.
