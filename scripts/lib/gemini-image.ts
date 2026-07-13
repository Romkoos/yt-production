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
