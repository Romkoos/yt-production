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

// The scene grid is one half of a two-part contract. The other half is ThumbTemplate's hook block,
// whose right edge is hard-clamped at 60% of the frame (remotion/src/hook-block.ts, TEXT_ZONE_FRACTION).
// The zones below MUST agree with that number: the text owns 0-60%, the object owns 70-100%, and
// 60-65% is a gutter nobody builds in. Change one side without the other and the tile lands on the words.
const SCENE_LAYOUT =
  'Composition is a strict layout grid for a 16:9 thumbnail background. All zones below are measured ' +
  'as a percentage of the frame width, from the left edge.\n' +
  '· RIGHT 30% of the frame (from the 70% line to the right edge): the tile lives here, centred in that ' +
  'band, occupying roughly 28-30% of the frame width, vertically centred in the frame.\n' +
  '· LEFT 60% of the frame (from the left edge to the 60% line): dark, clean and completely empty — a ' +
  'deep navy gradient with fine film grain. NO objects, NO bright areas, NO light source and no detail ' +
  'of any kind in the left 60%: that space is reserved for a text overlay added later.\n' +
  '· The 60-65% band is a GUTTER: keep it clear. Nothing important sits on either side of it. Only a ' +
  'soft falloff glow from the tile may reach into it, and any glow, bloom or light streak must be dim ' +
  'and subtle to the left of the 65% line.\n' +
  'Dark cinematic studio background, cinematic depth, soft vignette. No props, no scenery, no clutter.'

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

/** Does this mode's prompt actually consume `subject`?
 *
 *  real-avatar's subject IS the attached avatar, so buildPrompt ignores any `--subject` passed
 *  alongside it. The audit log asks this before recording `subject`: a record that lists an input
 *  which never reached the prompt is a lie about how the image was produced. */
export function modeUsesSubject(mode: GenMode): boolean {
  return mode !== 'real-avatar'
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
