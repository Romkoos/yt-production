# Generative Thumbnail Objects & Scenes (Gemini) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate thumbnail focal objects and background scenes with the Gemini image API (Nano Banana), archived per-episode and mirrored to a Remotion render surface so scenes can feed `ThumbTemplate`'s `bgImage`.

**Architecture:** Two files on the repo's established orchestrator/pure-lib seam (`scripts/thumbs-preview.ts` ↔ `scripts/lib/thumb-preview.ts`). `scripts/lib/gemini-image.ts` is pure — prompt builders, response parsing, versioning, cost, log append — and exposes an `ImageGenerator` interface that keeps the test suite off the network. `scripts/gen-thumb-object.ts` owns all IO and injects a `@google/genai`-backed implementation of that interface.

**Tech Stack:** Node 22, TypeScript (ESM, `tsx`), vitest, `@google/genai`, pnpm.

Spec: `docs/superpowers/specs/2026-07-13-gen-thumb-object-design.md`
Branch: `feat/gen-thumb-object` (already created; the spec is committed at `1c50a08`).

## Global Constraints

- **Package manager is pnpm.** Add root deps with `pnpm add <pkg>`. Never run a plain `pnpm install` inside `remotion/` — that package is standalone (`--ignore-workspace`); this plan does not touch it.
- **`GEMINI_API_KEY` comes from the environment only.** Never log it, never write it to a file, never interpolate it into a printed command. Same hygiene as `GITHUB_TOKEN` in `scripts/fetch-star-history.ts`.
- **Content language is Russian; code and commit messages are English.** Prompts sent to Gemini are English (the model performs better, and no prompt text reaches the viewer).
- **No generated text in any image.** Thumbnail text is always a programmatic `ThumbTemplate` render (`CLAUDE.md`, non-negotiable).
- **No fabricated brand marks.** A generated image may only carry a logo we supplied (`real-avatar`) or a real brand the host named (`known-logo`). `category-object` forbids brand marks entirely.
- **Cost figures are estimates.** Never print or write a cost number without the "estimate, prices as of `<date>`" qualifier.
- Model default: `gemini-3-pro-image-preview`. Cheap-draft alternative: `gemini-2.5-flash-image`.
- Run the full suite with `pnpm test` (vitest, `scripts/**/*.test.ts`).

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/lib/gemini-image.ts` (create) | Pure logic: prompt builders, `extractInlineImages`, `nextVersion`, `estimateCostUsd`, `appendGenLog`, the `ImageGenerator` seam. No `fs`, no network, no SDK import. |
| `scripts/lib/gemini-image.test.ts` (create) | Unit tests for all of the above. Never touches the network. |
| `scripts/gen-thumb-object.ts` (create) | Orchestrator: args, API key, `STATE.md` → owner, avatar fetch/cache, the `@google/genai` adapter, archive writes, the render-surface mirror, the log append. |
| `scripts/lib/thumb-preview.ts` (modify) | `variantSummary` + `SheetItem` + `buildIndexHtml` gain `bgImage`. |
| `scripts/lib/thumb-preview.test.ts` (modify) | Existing `variantSummary` assertion updated; new `bgImage` cases. |
| `scripts/thumbs-preview.ts` (modify) | stdout line prints the background. |
| `scripts/workspace-hygiene.test.ts` (modify) | Tripwire: `git check-ignore` proves the new rules ignore what they must and spare the tracked brand assets. |
| `.gitignore` (modify) | Un-ignore `gen-log.json`; ignore `remotion/public/gen/`. |
| `.claude/commands/gen-thumb-object.md` (create) | The command contract. |
| `.claude/commands/assets.md` (modify) | Pointer to `/gen-thumb-object`. |
| `package.json` (modify) | `@google/genai` dependency. |

---

### Task 1: gitignore rules + the check-ignore tripwire

The output contract depends on two `.gitignore` rules being exactly right, and the spec's central git subtlety (an excluded parent directory cannot be re-included through) is invisible in the diff. A test proves it and keeps proving it.

**Files:**
- Modify: `.gitignore`
- Test: `scripts/workspace-hygiene.test.ts` (append a second `describe` block)

**Interfaces:**
- Consumes: nothing.
- Produces: the on-disk output contract every later task writes into —
  `episodes/<ep>/assets/gen/**` ignored, `episodes/<ep>/assets/gen-log.json` **tracked**,
  `remotion/public/gen/**` ignored, `remotion/public/{branding,fonts,thumb}/**` still tracked.

- [ ] **Step 1: Write the failing test**

Append to `scripts/workspace-hygiene.test.ts` (keep the existing imports; add `execFileSync`):

```typescript
import { execFileSync } from 'node:child_process'

// ─────────────────────────────────────────────────────────────────────────────
// Tripwire: the generated-asset ignore rules.
//
// `git check-ignore` is the only authority here, because the rule that governs
// gen-log.json is a subtle one: "It is not possible to re-include a file if a
// parent directory of that file is excluded." `episodes/*/assets/*` matches the
// `gen` DIRECTORY itself, so git never descends into it — which is exactly why
// gen-log.json must sit BESIDE gen/, not inside it. Prose forgets. A test does not.
// ─────────────────────────────────────────────────────────────────────────────

/** True if git would ignore `path`. `check-ignore -q` exits 0 when ignored, 1 when not. */
function isIgnored(path: string): boolean {
  try {
    execFileSync('git', ['check-ignore', '-q', path], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

describe('generated-asset ignore rules', () => {
  it('ignores the per-episode gen/ archive (PNGs are heavy and regenerable)', () => {
    expect(isIgnored('episodes/2026-07-ep001/assets/gen/scene-real-avatar-v1.png')).toBe(true)
    expect(isIgnored('episodes/2026-07-ep001/assets/gen/object-known-logo-v2.png')).toBe(true)
  })

  it('TRACKS gen-log.json — an audit trail that dies with the working copy is not one', () => {
    expect(isIgnored('episodes/2026-07-ep001/assets/gen-log.json')).toBe(false)
  })

  it('ignores the remotion render surface', () => {
    expect(isIgnored('remotion/public/gen/2026-07-ep001/scene-real-avatar-v1.png')).toBe(true)
  })

  it('does NOT swallow the tracked brand assets beside it', () => {
    expect(isIgnored('remotion/public/branding/logo.svg')).toBe(false)
    expect(isIgnored('remotion/public/branding/logo-nobg.svg')).toBe(false)
    expect(isIgnored('remotion/public/fonts/montserrat-latin-700-normal.woff2')).toBe(false)
    expect(isIgnored('remotion/public/thumb/logo-facebook.png')).toBe(false)
  })
})
```

- [ ] **Step 2: Run it and watch the right two fail**

Run: `pnpm test -- scripts/workspace-hygiene.test.ts`
Expected: FAIL. `gen-log.json` is reported ignored (it is currently swallowed by `episodes/*/assets/*`) and `remotion/public/gen/...` is reported **not** ignored (no rule exists yet). The other two cases already pass — that is the point: they are the regression guard.

- [ ] **Step 3: Add the two rules**

In `.gitignore`, directly under the existing `!episodes/*/assets/thumb-variants.json` line:

```gitignore
# gen-log.json is the generative-asset audit/repro record (prompt, model, mode, cost per run) —
# tracked, append-only. It lives BESIDE assets/gen/ and not inside it because an excluded parent
# directory can never be re-included through (see scripts/workspace-hygiene.test.ts).
!episodes/*/assets/gen-log.json
```

Then, at the end of the file:

```gitignore
# per-episode generated render surface — mirrored from the episode archive, disposable.
# It must not pollute the tracked brand-asset space (branding/, fonts/, thumb/).
remotion/public/gen/
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm test -- scripts/workspace-hygiene.test.ts`
Expected: PASS, 5 tests (the pre-existing lockfile tripwire + the 4 new ones).

- [ ] **Step 5: Commit**

```bash
git add .gitignore scripts/workspace-hygiene.test.ts
git commit -m "chore(gitignore): track gen-log.json, ignore the remotion gen render surface"
```

---

### Task 2: Prompt builders (`buildPrompt`)

The honesty guardrails live here. Every clause in this task is load-bearing: it is what structurally prevents the model from fabricating a brand mark or baking text into a thumbnail.

**Files:**
- Create: `scripts/lib/gemini-image.ts`
- Test: `scripts/lib/gemini-image.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type GenMode = 'real-avatar' | 'known-logo' | 'category-object'`
  - `type GenVariant = 'object' | 'scene'`
  - `buildPrompt(mode: GenMode, variant: GenVariant, subject?: string): string`

- [ ] **Step 1: Write the failing test**

Create `scripts/lib/gemini-image.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildPrompt, type GenMode, type GenVariant } from './gemini-image'

const ALL: Array<[GenMode, GenVariant]> = [
  ['real-avatar', 'object'],
  ['real-avatar', 'scene'],
  ['known-logo', 'object'],
  ['known-logo', 'scene'],
  ['category-object', 'object'],
  ['category-object', 'scene'],
]

const subjectFor = (mode: GenMode): string | undefined =>
  mode === 'real-avatar' ? undefined : mode === 'known-logo' ? 'Meta infinity logo' : '3D terminal window'

describe('buildPrompt — rules that hold for every mode and variant', () => {
  it.each(ALL)('%s/%s forbids text in the image', (mode, variant) => {
    expect(buildPrompt(mode, variant, subjectFor(mode))).toMatch(/NO text/i)
  })

  it.each(ALL)('%s/%s asks for the glowing 3D app-icon tile presentation', (mode, variant) => {
    expect(buildPrompt(mode, variant, subjectFor(mode))).toMatch(/app-icon tile/i)
  })
})

describe('buildPrompt — the object variant', () => {
  it('isolates the tile on pure black', () => {
    expect(buildPrompt('known-logo', 'object', 'Meta infinity logo')).toMatch(/pure black/i)
  })
  it('does not impose the scene layout grid', () => {
    expect(buildPrompt('known-logo', 'object', 'Meta infinity logo')).not.toMatch(/RIGHT THIRD/)
  })
})

describe('buildPrompt — the scene variant', () => {
  const scene = buildPrompt('known-logo', 'scene', 'Meta infinity logo')

  it('confines the object to the right third at ~30% width', () => {
    expect(scene).toMatch(/RIGHT THIRD/)
    expect(scene).toMatch(/30% of the frame width/)
  })
  it('reserves the left two thirds, dark and empty, for the text overlay', () => {
    expect(scene).toMatch(/LEFT TWO THIRDS/)
    expect(scene).toMatch(/text overlay/i)
  })
})

describe('buildPrompt — honesty guardrails per mode', () => {
  it('real-avatar demands a trademark-faithful reproduction of the supplied logo', () => {
    const p = buildPrompt('real-avatar', 'object')
    expect(p).toMatch(/do NOT redraw, restyle, re-letter/i)
    expect(p).toMatch(/attached (reference )?image/i)
  })

  it('known-logo names the real brand the host asked for', () => {
    expect(buildPrompt('known-logo', 'object', 'Meta infinity logo')).toContain('Meta infinity logo')
  })

  it('category-object forbids any brand mark — inventing one is the failure mode', () => {
    const p = buildPrompt('category-object', 'object', '3D terminal window')
    expect(p).toContain('3D terminal window')
    expect(p).toMatch(/do NOT include any brand logo, wordmark, trademark or lettering/i)
  })

  it('does not leak the trademark clause into the text-only modes (nothing is attached)', () => {
    expect(buildPrompt('known-logo', 'object', 'Meta infinity logo')).not.toMatch(/attached/i)
    expect(buildPrompt('category-object', 'object', 'terminal')).not.toMatch(/attached/i)
  })

  it('refuses to build a text-only prompt with no subject', () => {
    expect(() => buildPrompt('known-logo', 'object')).toThrow(/--subject/)
    expect(() => buildPrompt('category-object', 'scene')).toThrow(/--subject/)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test -- scripts/lib/gemini-image.test.ts`
Expected: FAIL — `Failed to resolve import "./gemini-image"`.

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/gemini-image.ts`:

```typescript
// ─────────────────────────────────────────────────────────────────────────────
// Pure logic for /gen-thumb-object — prompt building, response parsing, output
// versioning, cost estimation and the append-only gen-log. No fs, no network, no
// SDK import; the orchestrator (scripts/gen-thumb-object.ts) supplies the IO and
// injects an ImageGenerator, so the test suite never touches the network.
//
// The prompt builders carry the channel's honesty rules (CLAUDE.md). A generated
// image may only show a logo we SUPPLIED (real-avatar) or a real brand the host
// NAMED (known-logo); category-object forbids brand marks outright. No mode may
// bake text into an image — thumbnail text is always a ThumbTemplate render.
// ─────────────────────────────────────────────────────────────────────────────

export type GenMode = 'real-avatar' | 'known-logo' | 'category-object'
export type GenVariant = 'object' | 'scene'

// ── Prompt clauses ────────────────────────────────────────────────────────────

const TILE_PRESENTATION =
  'Present the subject as a single glowing white 3D app-icon tile: a rounded-square tile with a soft ' +
  'white emissive rim light, gentle depth, and a soft contact shadow, floating and very slightly rotated.'

const ISOLATED_ON_BLACK =
  'The tile is isolated on a pure black (#000000) background. Nothing else is in the frame.'

const SCENE_LAYOUT =
  'Composition is a strict layout grid for a 16:9 thumbnail background. Place the tile inside the RIGHT ' +
  'THIRD of the frame, occupying roughly 30% of the frame width, vertically centred. The LEFT TWO THIRDS ' +
  'must stay dark, empty and uncluttered — that space is reserved for a text overlay added later. Dark ' +
  'studio background with a soft falloff glow around the tile. No props, no scenery, no clutter.'

const NO_TEXT =
  'There must be NO text, NO letters, NO numbers, NO captions and NO wordmarks anywhere in the image.'

const TRADEMARK_FAITHFUL =
  'The attached reference image is the EXACT logo. Reproduce it verbatim: do NOT redraw, restyle, ' +
  're-letter, re-interpret or "improve" it. Preserve its glyph shapes, proportions and colours precisely. ' +
  'Only the presentation — lighting, depth, the tile — is yours to render.'

const NO_FABRICATED_BRAND =
  'Depict a generic object only. Do NOT include any brand logo, wordmark, trademark or lettering of any ' +
  'kind. Inventing a brand-like mark is forbidden.'

/** Text-only modes carry no reference image, so the subject MUST come from the host. */
function requireSubject(mode: GenMode, subject?: string): string {
  if (!subject?.trim()) {
    throw new Error(`mode "${mode}" needs a subject — pass --subject "<what to draw>"`)
  }
  return subject.trim()
}

/** Build the generation prompt. `subject` is required for known-logo / category-object and
 *  ignored for real-avatar, whose subject is the attached avatar itself. */
export function buildPrompt(mode: GenMode, variant: GenVariant, subject?: string): string {
  const blocks: string[] = []

  switch (mode) {
    case 'real-avatar':
      blocks.push('Subject: the logo shown in the attached reference image.', TRADEMARK_FAITHFUL)
      break
    case 'known-logo':
      blocks.push(
        `Subject: the ${requireSubject(mode, subject)} — the real, well-known brand mark, rendered accurately.`,
      )
      break
    case 'category-object':
      blocks.push(
        `Subject: ${requireSubject(mode, subject)} — a category metaphor, not a brand.`,
        NO_FABRICATED_BRAND,
      )
      break
  }

  blocks.push(TILE_PRESENTATION)
  blocks.push(variant === 'scene' ? SCENE_LAYOUT : ISOLATED_ON_BLACK)
  blocks.push(NO_TEXT)

  return blocks.join('\n\n')
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm test -- scripts/lib/gemini-image.test.ts`
Expected: PASS, 21 tests (12 from the two `it.each` × 6 combinations, 2 object, 2 scene, 5 guardrail).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/gemini-image.ts scripts/lib/gemini-image.test.ts
git commit -m "feat(gemini): prompt builders for the three generation modes

The honesty guardrails are asserted by tests, not just written into strings:
real-avatar is trademark-faithful to the supplied logo, category-object forbids
brand marks outright, and no mode may bake text into an image."
```

---

### Task 3: Response parsing, versioning, cost, and the log (`gemini-image.ts` completed)

**Files:**
- Modify: `scripts/lib/gemini-image.ts`
- Test: `scripts/lib/gemini-image.test.ts`

**Interfaces:**
- Consumes: `GenMode`, `GenVariant` from Task 2.
- Produces:
  - `interface InlineImage { mimeType: string; data: string }`
  - `interface GenerateRequest { model: string; prompt: string; referenceImage?: InlineImage }`
  - `interface GenResponse` (the shape `@google/genai` returns)
  - `interface ImageGenerator { generate(req: GenerateRequest): Promise<GenResponse> }`
  - `extractInlineImages(response: GenResponse): InlineImage[]`
  - `nextVersion(existingNames: string[], variant: GenVariant, mode: GenMode): number`
  - `estimateCostUsd(model: string, imageCount: number): number | null`
  - `PRICES_AS_OF: string`
  - `interface GenLogEntry`, `interface GenLog`
  - `appendGenLog(existing: GenLog | null, episode: string, entry: GenLogEntry): GenLog`

- [ ] **Step 1: Write the failing tests**

Append to `scripts/lib/gemini-image.test.ts` (extend the import from `./gemini-image` with the new names):

```typescript
import {
  extractInlineImages,
  nextVersion,
  estimateCostUsd,
  appendGenLog,
  PRICES_AS_OF,
  type GenLog,
  type GenLogEntry,
  type GenResponse,
} from './gemini-image'

/** A response whose parts are exactly `parts`, in order. */
const resp = (parts: unknown[]): GenResponse =>
  ({ candidates: [{ content: { parts } }] }) as GenResponse

const img = (data: string, mimeType = 'image/png') => ({ inlineData: { mimeType, data } })

describe('extractInlineImages — selects by PRESENCE of inlineData, never by index', () => {
  it('finds the image when the model talks first', () => {
    expect(extractInlineImages(resp([{ text: "Here's your tile!" }, img('AAA')]))).toEqual([
      { mimeType: 'image/png', data: 'AAA' },
    ])
  })

  it('finds the image when it comes first', () => {
    expect(extractInlineImages(resp([img('AAA'), { text: 'Hope that works.' }]))).toEqual([
      { mimeType: 'image/png', data: 'AAA' },
    ])
  })

  it('finds every image when text is interleaved between them', () => {
    const out = extractInlineImages(
      resp([{ text: 'one:' }, img('AAA'), { text: 'and two:' }, img('BBB'), { text: 'done' }]),
    )
    expect(out.map((i) => i.data)).toEqual(['AAA', 'BBB'])
  })

  it('defaults a missing mimeType to image/png', () => {
    expect(extractInlineImages(resp([{ inlineData: { data: 'AAA' } }]))[0].mimeType).toBe('image/png')
  })

  it('throws a clear error when the model returned text only', () => {
    expect(() => extractInlineImages(resp([{ text: 'I cannot do that.' }]))).toThrow(/no image part/i)
  })

  it('throws on an empty/blocked response rather than returning undefined', () => {
    expect(() => extractInlineImages({} as GenResponse)).toThrow(/no image part/i)
  })
})

describe('nextVersion', () => {
  it('starts at 1 in an empty directory', () => {
    expect(nextVersion([], 'scene', 'real-avatar')).toBe(1)
  })

  it('continues past the highest existing version, gaps and all', () => {
    const names = ['scene-real-avatar-v1.png', 'scene-real-avatar-v3.png']
    expect(nextVersion(names, 'scene', 'real-avatar')).toBe(4)
  })

  it('numbers each variant/mode pair independently', () => {
    const names = ['scene-real-avatar-v7.png', 'object-known-logo-v2.png', 'gen-log.json']
    expect(nextVersion(names, 'object', 'real-avatar')).toBe(1)
    expect(nextVersion(names, 'object', 'known-logo')).toBe(3)
    expect(nextVersion(names, 'scene', 'real-avatar')).toBe(8)
  })
})

describe('estimateCostUsd', () => {
  it('multiplies the per-image price by the image count', () => {
    const one = estimateCostUsd('gemini-2.5-flash-image', 1)!
    expect(estimateCostUsd('gemini-2.5-flash-image', 3)).toBeCloseTo(one * 3, 4)
  })

  it('prices the pro model above the flash draft model', () => {
    expect(estimateCostUsd('gemini-3-pro-image-preview', 1)!).toBeGreaterThan(
      estimateCostUsd('gemini-2.5-flash-image', 1)!,
    )
  })

  it('returns null for an unknown model — no estimate beats a wrong number', () => {
    expect(estimateCostUsd('gemini-99-imaginary', 1)).toBeNull()
  })

  it('publishes the date its prices were recorded', () => {
    expect(PRICES_AS_OF).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('appendGenLog — append-only', () => {
  const entry = (n: number): GenLogEntry => ({
    at: `2026-07-13T0${n}:00:00.000Z`,
    mode: 'real-avatar',
    variant: 'scene',
    model: 'gemini-3-pro-image-preview',
    prompt: `prompt ${n}`,
    outputs: [`scene-real-avatar-v${n}.png`],
    estimatedCostUsd: 0.134,
    pricesAsOf: PRICES_AS_OF,
  })

  it('creates the log on the first run', () => {
    const log = appendGenLog(null, '2026-07-ep001', entry(1))
    expect(log.episode).toBe('2026-07-ep001')
    expect(log.runs).toHaveLength(1)
  })

  it('appends to the end and never rewrites history', () => {
    const first = appendGenLog(null, '2026-07-ep001', entry(1))
    const second = appendGenLog(first, '2026-07-ep001', entry(2))
    expect(second.runs).toHaveLength(2)
    expect(second.runs[0]).toEqual(entry(1))
    expect(second.runs[1].prompt).toBe('prompt 2')
  })

  it('does not mutate the log it was given', () => {
    const first: GenLog = appendGenLog(null, '2026-07-ep001', entry(1))
    appendGenLog(first, '2026-07-ep001', entry(2))
    expect(first.runs).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test -- scripts/lib/gemini-image.test.ts`
Expected: FAIL — `extractInlineImages is not a function` (and the other new names are undefined).

- [ ] **Step 3: Write the implementation**

Append to `scripts/lib/gemini-image.ts`:

```typescript
// ── The API seam ──────────────────────────────────────────────────────────────
// The orchestrator injects a @google/genai-backed implementation; tests inject a
// fake. Nothing in the test suite reaches the network.

export interface InlineImage {
  mimeType: string
  data: string // base64
}

export interface GenerateRequest {
  model: string
  prompt: string
  referenceImage?: InlineImage
}

/** The subset of the @google/genai response we rely on. Every field is optional:
 *  a blocked or text-only response legitimately omits them, and we must fail loudly
 *  rather than index into undefined. */
export interface GenResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string; inlineData?: { mimeType?: string; data?: string } }>
    }
  }>
}

export interface ImageGenerator {
  generate(req: GenerateRequest): Promise<GenResponse>
}

/** Pull every image part out of a response.
 *
 *  Selection is by PRESENCE of `inlineData`, never by index: the model interleaves text and
 *  image parts freely ("Here's your tile!" + the image, in either order), so `parts[0]` is not
 *  the image and `parts[1]` is not either. Indexing is the bug this function exists to prevent. */
export function extractInlineImages(response: GenResponse): InlineImage[] {
  const parts = response.candidates?.[0]?.content?.parts ?? []
  const images: InlineImage[] = []
  for (const part of parts) {
    const inline = part.inlineData
    if (!inline?.data) continue
    images.push({ mimeType: inline.mimeType ?? 'image/png', data: inline.data })
  }
  if (images.length === 0) {
    throw new Error(
      'Gemini returned no image part (text-only or blocked response) — check the model id and the prompt',
    )
  }
  return images
}

// ── Output naming ─────────────────────────────────────────────────────────────

/** The next `vN` for a `<variant>-<mode>-vN.png` output. Each variant/mode pair is numbered
 *  independently, and gaps are skipped over rather than filled (a deleted v2 stays deleted). */
export function nextVersion(existingNames: string[], variant: GenVariant, mode: GenMode): number {
  const re = new RegExp(`^${variant}-${mode}-v(\\d+)\\.png$`)
  let max = 0
  for (const name of existingNames) {
    const m = name.match(re)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return max + 1
}

// ── Cost ──────────────────────────────────────────────────────────────────────

/** The date the prices below were recorded. Printed with every cost figure — the console is
 *  where the number is actually read, so the caveat has to travel with it. */
export const PRICES_AS_OF = '2026-07-13'

/** Per-image output price in USD.
 *
 *  THESE ARE ESTIMATES. They were not verified against Google's live pricing page, and image
 *  pricing moves. gen-log.json records the exact model per run, so a corrected table can always
 *  recompute historical cost from the log. Never present these as a billing figure. */
const PRICE_PER_IMAGE_USD: Record<string, number> = {
  'gemini-3-pro-image-preview': 0.134,
  'gemini-2.5-flash-image': 0.039,
}

/** Estimated USD for a run. `null` for an unknown model — no estimate beats a wrong number. */
export function estimateCostUsd(model: string, imageCount: number): number | null {
  const unit = PRICE_PER_IMAGE_USD[model]
  if (unit == null) return null
  return Number((unit * imageCount).toFixed(4))
}

// ── The audit log ─────────────────────────────────────────────────────────────

export interface GenLogEntry {
  at: string // ISO timestamp
  mode: GenMode
  variant: GenVariant
  model: string
  subject?: string
  prompt: string // the FULL prompt — this is what makes a run reproducible
  referenceImage?: string // repo-relative path of the avatar sent, when one was
  outputs: string[] // basenames written into assets/gen/
  estimatedCostUsd: number | null
  pricesAsOf: string
}

export interface GenLog {
  episode: string
  runs: GenLogEntry[]
}

/** Append one run to the log. Append-only by construction: the existing runs are copied, never
 *  rewritten or reordered, and the input is not mutated. */
export function appendGenLog(existing: GenLog | null, episode: string, entry: GenLogEntry): GenLog {
  return {
    episode: existing?.episode ?? episode,
    runs: [...(existing?.runs ?? []), entry],
  }
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm test -- scripts/lib/gemini-image.test.ts`
Expected: PASS, 37 tests (the 21 from Task 2 plus 16 new: 6 parsing, 3 versioning, 4 cost, 3 log).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/gemini-image.ts scripts/lib/gemini-image.test.ts
git commit -m "feat(gemini): response parsing, output versioning, cost estimate, append-only log

extractInlineImages selects image parts by presence, never by index — the model
interleaves text and image parts in either order. estimateCostUsd returns null for
an unknown model: no estimate beats a wrong number."
```

---

### Task 4: The orchestrator (`gen-thumb-object.ts`)

**Files:**
- Create: `scripts/gen-thumb-object.ts`
- Modify: `package.json` (add `@google/genai`)

**Interfaces:**
- Consumes: everything exported from `scripts/lib/gemini-image.ts` (Tasks 2–3), and the output contract from Task 1.
- Produces: the CLI. Later tasks only document it.

- [ ] **Step 1: Add the SDK**

Run from the repo root (NOT from `remotion/`):

```bash
pnpm add @google/genai
```

Verify the root lockfile did not gain a `remotion:` importer:

```bash
pnpm test -- scripts/workspace-hygiene.test.ts
```
Expected: PASS.

- [ ] **Step 2: Write the orchestrator**

Create `scripts/gen-thumb-object.ts`:

```typescript
#!/usr/bin/env -S node --import tsx
// ─────────────────────────────────────────────────────────────────────────────
// /gen-thumb-object — generate a thumbnail focal object (or a full background
// scene) with the Gemini image API (Nano Banana).
//
// Two trees, two jobs:
//   ARCHIVE         episodes/<ep>/assets/gen/        every variant ever generated (gitignored)
//   RENDER SURFACE  remotion/public/gen/<ep>/        the only tree staticFile() resolves
//                                                    (gitignored, disposable, regenerable)
//   AUDIT           episodes/<ep>/assets/gen-log.json  TRACKED, append-only
//
// Honesty (CLAUDE.md): a generated image may only carry a logo we SUPPLIED
// (real-avatar) or a real brand the host NAMED (known-logo). category-object
// forbids brand marks outright. No mode bakes text into an image. --dry-run
// prints the exact prompt without a key or a network call, so the guardrails are
// auditable for free.
//
// Usage:
//   gen-thumb-object.ts --mode <real-avatar|known-logo|category-object>
//                       [--episode <id>] [--scene] [--subject "<text>"]
//                       [--model <id>] [--dry-run]
//
// Auth: GEMINI_API_KEY from the environment. Never logged, never written to disk.
// ─────────────────────────────────────────────────────────────────────────────

import { GoogleGenAI } from '@google/genai'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  appendGenLog,
  buildPrompt,
  estimateCostUsd,
  extractInlineImages,
  nextVersion,
  PRICES_AS_OF,
  type GenLog,
  type GenMode,
  type GenResponse,
  type GenVariant,
  type ImageGenerator,
  type InlineImage,
} from './lib/gemini-image'

const DEFAULT_MODEL = 'gemini-3-pro-image-preview' // Nano Banana Pro — best logo/text fidelity
const MODES: GenMode[] = ['real-avatar', 'known-logo', 'category-object']

interface Args {
  mode: GenMode
  episode?: string
  variant: GenVariant
  subject?: string
  model: string
  dryRun: boolean
}

function parseArgs(argv: string[]): Args {
  const out: Partial<Args> = { variant: 'object', model: DEFAULT_MODEL, dryRun: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--mode') out.mode = argv[++i] as GenMode
    else if (argv[i] === '--episode') out.episode = argv[++i]
    else if (argv[i] === '--subject') out.subject = argv[++i]
    else if (argv[i] === '--model') out.model = argv[++i]
    else if (argv[i] === '--scene') out.variant = 'scene'
    else if (argv[i] === '--dry-run') out.dryRun = true
  }
  if (!out.mode) throw new Error(`--mode <${MODES.join('|')}> is required`)
  if (!MODES.includes(out.mode)) throw new Error(`unknown --mode "${out.mode}" (expected ${MODES.join(' | ')})`)
  return out as Args
}

/** Newest episode dir — ids sort chronologically by their YYYY-MM prefix. */
function newestEpisode(): string {
  const dirs = readdirSync('episodes', { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
  const newest = dirs.at(-1)
  if (!newest) throw new Error('no episodes/ directory entries — pass --episode <id>')
  return newest
}

/** Owner from STATE.md's repo_url — same parse as fetch-star-history.ts. */
function ownerFromState(episode: string): string {
  const state = readFileSync(join('episodes', episode, 'STATE.md'), 'utf8')
  const m = state.match(/repo_url:\s*(\S+)/)
  if (!m) throw new Error(`no repo_url in episodes/${episode}/STATE.md`)
  return m[1]
    .replace(/\.git$/, '')
    .replace(/^https?:\/\/github\.com\//, '')
    .split('/')[0]
}

/** The cached org avatar — the SAME file ThumbTemplate uses for its focal LogoTile
 *  (assets/logo-<owner>.png). Fetched from github.com/<owner>.png on first use. */
async function ensureAvatar(episode: string, owner: string): Promise<string> {
  const path = join('episodes', episode, 'assets', `logo-${owner}.png`)
  if (existsSync(path)) return path
  const res = await fetch(`https://github.com/${owner}.png`, {
    headers: { 'User-Agent': 'yt-production-gen-thumb-object' },
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`avatar fetch for ${owner} failed: HTTP ${res.status}`)
  mkdirSync(join('episodes', episode, 'assets'), { recursive: true })
  writeFileSync(path, Buffer.from(await res.arrayBuffer()))
  process.stdout.write(`  · cached avatar → ${path}\n`)
  return path
}

function readInlineImage(path: string): InlineImage {
  return { mimeType: 'image/png', data: readFileSync(path).toString('base64') }
}

/** The real ImageGenerator. The ONLY place the SDK is touched. */
function createGeminiGenerator(apiKey: string): ImageGenerator {
  const ai = new GoogleGenAI({ apiKey })
  return {
    async generate({ model, prompt, referenceImage }) {
      const parts: unknown[] = [{ text: prompt }]
      if (referenceImage) parts.push({ inlineData: referenceImage })
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
      })
      return response as GenResponse
    },
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const episode = args.episode ?? newestEpisode()

  // real-avatar's subject IS the attached avatar; the text-only modes need --subject
  // (buildPrompt enforces this — it throws before any network call is made).
  const prompt = buildPrompt(args.mode, args.variant, args.subject)

  let referencePath: string | undefined
  if (args.mode === 'real-avatar') {
    const owner = ownerFromState(episode)
    referencePath = args.dryRun
      ? join('episodes', episode, 'assets', `logo-${owner}.png`)
      : await ensureAvatar(episode, owner)
  }

  if (args.dryRun) {
    process.stdout.write(
      `[gen-thumb-object] DRY RUN — no API key read, no network call\n` +
        `  episode:   ${episode}\n` +
        `  mode:      ${args.mode}   variant: ${args.variant}   model: ${args.model}\n` +
        (referencePath ? `  reference: ${referencePath}\n` : '') +
        `\n${prompt}\n`,
    )
    return
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set (export it; never commit it)')

  const genDir = join('episodes', episode, 'assets', 'gen')
  mkdirSync(genDir, { recursive: true })

  const response = await createGeminiGenerator(apiKey).generate({
    model: args.model,
    prompt,
    referenceImage: referencePath ? readInlineImage(referencePath) : undefined,
  })
  const images = extractInlineImages(response)

  const mirrorDir = join('remotion', 'public', 'gen', episode)
  const existing = readdirSync(genDir)
  const outputs: string[] = []

  for (const image of images) {
    // Re-derive the version per image, counting what this run has already written — a single
    // response can carry more than one image part.
    const n = nextVersion([...existing, ...outputs], args.variant, args.mode)
    const file = `${args.variant}-${args.mode}-v${n}.png`
    const buf = Buffer.from(image.data, 'base64')

    // ARCHIVE — the episode's permanent record.
    writeFileSync(join(genDir, file), buf)
    outputs.push(file)

    // RENDER SURFACE — the only tree staticFile() can resolve. Scenes only: `object-*` has no
    // consumer yet, so mirroring it would drop dead PNGs into the render tree.
    // TODO(object-layer): when the ThumbTemplate luminance-alpha object layer ships, `object-*`
    // outputs must start mirroring here too — drop this `variant === 'scene'` guard.
    if (args.variant === 'scene') {
      mkdirSync(mirrorDir, { recursive: true })
      writeFileSync(join(mirrorDir, file), buf)
    }
  }

  const cost = estimateCostUsd(args.model, images.length)
  const costText =
    cost == null
      ? `${args.model}, cost unknown for this model`
      : `${args.model}, ~$${cost.toFixed(2)} — estimate, prices as of ${PRICES_AS_OF}`

  const logPath = join('episodes', episode, 'assets', 'gen-log.json')
  const existingLog: GenLog | null = existsSync(logPath)
    ? (JSON.parse(readFileSync(logPath, 'utf8')) as GenLog)
    : null
  writeFileSync(
    logPath,
    JSON.stringify(
      appendGenLog(existingLog, episode, {
        at: new Date().toISOString(),
        mode: args.mode,
        variant: args.variant,
        model: args.model,
        subject: args.subject,
        prompt,
        referenceImage: referencePath,
        outputs,
        estimatedCostUsd: cost,
        pricesAsOf: PRICES_AS_OF,
      }),
      null,
      2,
    ) + '\n',
  )

  for (const file of outputs) {
    process.stdout.write(`  ✓ ${file}   (${costText})\n`)
    if (args.variant === 'scene') {
      process.stdout.write(`    bgImage: "gen/${episode}/${file}"\n`)
    }
  }
  process.stdout.write(`\nArchive: ${genDir}\nLogged:  ${logPath}\n`)
  if (args.variant === 'scene') {
    process.stdout.write(`Paste the bgImage line into episodes/${episode}/assets/thumb-variants.json, then run /thumbs-preview.\n`)
  }
}

main().catch((e) => {
  process.stderr.write(`[gen-thumb-object] failed: ${(e as Error).message}\n`)
  process.exit(1)
})
```

- [ ] **Step 3: Verify the honesty audit surface works with no key and no network**

Run (note the deliberately empty key — this must still work):

```bash
GEMINI_API_KEY= node --import tsx scripts/gen-thumb-object.ts \
  --episode 2026-07-ep001 --mode category-object --subject "3D terminal window" --scene --dry-run
```

Expected: prints the DRY RUN header and the full prompt, containing `RIGHT THIRD`, `LEFT TWO THIRDS`, `Do NOT include any brand logo`, and `NO text`. Exit code 0. No network call, no key read.

- [ ] **Step 4: Verify the argument guards fail loudly**

```bash
node --import tsx scripts/gen-thumb-object.ts --mode known-logo --dry-run
```
Expected: exit code 1, `failed: mode "known-logo" needs a subject — pass --subject "<what to draw>"`.

```bash
node --import tsx scripts/gen-thumb-object.ts --mode nonsense --dry-run
```
Expected: exit code 1, `failed: unknown --mode "nonsense" (expected real-avatar | known-logo | category-object)`.

- [ ] **Step 5: Run the full suite**

Run: `pnpm test`
Expected: PASS — every pre-existing test plus the new ones.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml scripts/gen-thumb-object.ts
git commit -m "feat(assets): /gen-thumb-object — generate thumbnail objects and scenes via Gemini

Archive per episode, mirror scenes to the Remotion render surface (the only tree
staticFile resolves), append to the tracked gen-log. --dry-run prints the exact
prompt with no key and no network call, so the honesty guardrails are auditable."
```

---

### Task 5: Surface `bgImage` in the thumbnail preview

A host iterating on generated scenes must be able to tell which variant sits on which background. `variantSummary` currently returns only `{ hookText, verdict }` — this adds the third field, which deliberately breaks the existing `toEqual` assertion.

**Files:**
- Modify: `scripts/lib/thumb-preview.ts:13-21` (`SheetItem`), `:36-38` (`variantSummary`), `:79-99` (`buildIndexHtml`)
- Modify: `scripts/thumbs-preview.ts:88-98`
- Test: `scripts/lib/thumb-preview.test.ts:17-24` and `:61-94`

**Interfaces:**
- Consumes: the `gen/<ep>/<file>.png` `bgImage` paths produced by Task 4.
- Produces: `variantSummary(props) → { hookText: string; verdict: string; bgImage: string }`; `SheetItem` gains `bgImage: string`.

- [ ] **Step 1: Write the failing tests**

In `scripts/lib/thumb-preview.test.ts`, **replace** the existing `variantSummary` describe block (lines 17–24) with:

```typescript
describe('variantSummary', () => {
  it('extracts hook text, verdict and background from props', () => {
    expect(
      variantSummary({
        hook: [{ text: 'UI без' }, { text: 'сборки' }],
        verdict: 'ГОДНОТА',
        bgImage: 'gen/2026-07-ep001/scene-real-avatar-v1.png',
      }),
    ).toEqual({
      hookText: 'UI без сборки',
      verdict: 'ГОДНОТА',
      bgImage: 'gen/2026-07-ep001/scene-real-avatar-v1.png',
    })
  })

  it('reports an empty background when the variant has none', () => {
    expect(variantSummary({ hook: [], verdict: 'ХАЙП' }).bgImage).toBe('')
  })
})
```

Then in the `buildIndexHtml` describe block, **replace** the `items` fixture (lines 62–65) with:

```typescript
  const items: SheetItem[] = [
    { label: 'A — clean right', fullFile: 'thumb-v1.png', thumbFile: 'thumb-v1.120.png', fullMtime: 111, thumbMtime: 112, hookText: 'Дизайн-система Meta', verdict: 'ГОДНОТА', bgImage: 'gen/2026-07-ep001/scene-real-avatar-v1.png' },
    { label: 'B — hero', fullFile: 'thumb-v2.png', thumbFile: 'thumb-v2.120.png', fullMtime: 221, thumbMtime: 222, hookText: 'UI для тебя и AI', verdict: 'ГОДНОТА', bgImage: '' },
  ]
```

and append these two cases inside that same describe block:

```typescript
  it('prints the background each variant uses', () => {
    expect(html).toContain('gen/2026-07-ep001/scene-real-avatar-v1.png')
  })

  it('marks a variant with no background rather than leaving it blank', () => {
    // Anchored to the bg field: a bare toContain('—') would pass vacuously, since the em-dash
    // also appears in every variant label ("A — clean right").
    expect(html).toContain('<span class="k">bg</span> —')
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test -- scripts/lib/thumb-preview.test.ts`
Expected: FAIL — `variantSummary` returns an object without `bgImage`, and the `SheetItem` fixture does not typecheck.

- [ ] **Step 3: Implement**

In `scripts/lib/thumb-preview.ts`, add the field to `SheetItem` (after `verdict`):

```typescript
  verdict: string
  bgImage: string // the variant's background (a public/ path), '' when it has none
```

Replace `variantSummary`:

```typescript
/** The caption printed under each variant: its hook text, verdict, and background. The background
 *  matters once generated scenes (/gen-thumb-object) start feeding bgImage — without it the host
 *  cannot tell which variant is sitting on which scene. */
export function variantSummary(props: Record<string, unknown>): { hookText: string; verdict: string; bgImage: string } {
  return {
    hookText: hookText(props.hook),
    verdict: String(props.verdict ?? ''),
    bgImage: typeof props.bgImage === 'string' ? props.bgImage : '',
  }
}
```

In `buildIndexHtml`, replace the `.props` paragraph inside the card template with:

```html
      <p class="props"><span class="k">hook</span> «${esc(it.hookText)}» &nbsp;·&nbsp; <span class="k">verdict</span> ${esc(it.verdict)} &nbsp;·&nbsp; <span class="k">bg</span> ${it.bgImage ? esc(it.bgImage) : '—'}</p>
```

- [ ] **Step 4: Print it on stdout too**

In `scripts/thumbs-preview.ts`, replace the progress line and the returned item (lines 88–98):

```typescript
    const summary = variantSummary(variant.props)
    const bg = summary.bgImage || '—'
    process.stdout.write(`  ✓ ${fullFile}  ${variant.label}  «${summary.hookText}» → ${summary.verdict}  bg: ${bg}\n`)
    return {
      label: variant.label,
      fullFile,
      thumbFile,
      fullMtime: mtimeMs(fullPath),
      thumbMtime: mtimeMs(thumbPath),
      hookText: summary.hookText,
      verdict: summary.verdict,
      bgImage: summary.bgImage,
    }
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `pnpm test`
Expected: PASS, all suites.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/thumb-preview.ts scripts/lib/thumb-preview.test.ts scripts/thumbs-preview.ts
git commit -m "feat(thumbs-preview): show each variant's background in the contact sheet

Generated scenes are about to start feeding bgImage; without this the host cannot
tell which variant is sitting on which scene."
```

---

### Task 6: Command docs

**Files:**
- Create: `.claude/commands/gen-thumb-object.md`
- Modify: `.claude/commands/assets.md` (insert after the Step 3 thumbnails section, before `## Step 4`)

**Interfaces:**
- Consumes: the CLI from Task 4, the output contract from Task 1.
- Produces: nothing code depends on.

- [ ] **Step 1: Write the command doc**

Create `.claude/commands/gen-thumb-object.md`:

````markdown
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
- `--model <id>` — default `gemini-3-pro-image-preview` (Nano Banana Pro — best logo fidelity).
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
````

- [ ] **Step 2: Point `/assets` at it**

In `.claude/commands/assets.md`, insert immediately before the `---` that precedes `## Step 4 — Generate prep docs`:

```markdown
**Generative backgrounds (optional).** `/gen-thumb-object` generates a focal object or a full
background scene with the Gemini image API. Generated **scenes** are mirrored to
`remotion/public/gen/<ep>/` and feed `ThumbTemplate`'s `bgImage` prop — paste the path the script
prints into a variant's `props` in `thumb-variants.json` and re-run the contact sheet. Generated
**objects** are archived but not yet consumed: the `ThumbTemplate` object layer is a follow-up.

Generated images never contain text (thumbnail text is always a programmatic render) and never
carry a fabricated brand mark — see `/gen-thumb-object` for the per-mode guarantees and the
`--dry-run` audit surface.
```

- [ ] **Step 3: Verify the docs match the code**

Run the dry-run from the command doc verbatim and confirm the prompt it prints matches what the doc
claims each mode guarantees:

```bash
node --import tsx scripts/gen-thumb-object.ts --episode 2026-07-ep001 --mode real-avatar --scene --dry-run
```
Expected: the trademark-faithful clause, the scene layout grid, and the no-text clause all appear.

- [ ] **Step 4: Run the full suite**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .claude/commands/gen-thumb-object.md .claude/commands/assets.md
git commit -m "docs(commands): /gen-thumb-object contract, and point /assets at it"
```

---

## Verification (after all tasks)

- [ ] `pnpm test` — full suite green.
- [ ] `git check-ignore -v remotion/public/branding/logo.svg` → **no output, exit 1** (still tracked).
- [ ] `git status --short` after a real generation run shows **only** `episodes/<ep>/assets/gen-log.json` as a new tracked file — no PNGs.
- [ ] `git log --oneline` shows one commit per task.
- [ ] A real end-to-end run (needs `GEMINI_API_KEY`) — the host's call, since it costs money:
      `node --import tsx scripts/gen-thumb-object.ts --episode 2026-07-ep001 --mode real-avatar --scene --model gemini-2.5-flash-image`
      then paste the printed `bgImage` into `thumb-variants.json` and run `/thumbs-preview`.
