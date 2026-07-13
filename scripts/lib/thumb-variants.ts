// ─────────────────────────────────────────────────────────────────────────────
// Pure logic for `--apply`: point every variant of a thumb-variants.json at a
// generated scene. Kept free of fs so it is unit-testable; the orchestrator
// (scripts/gen-thumb-object.ts) supplies the read and the write.
//
// The file is HAND-EDITED and TRACKED — it is the host's, not ours. So: we edit
// it, we never author it. A missing or malformed file is a refusal, never a
// scaffold; a file we cannot parse is a file whose contents we would destroy.
// ─────────────────────────────────────────────────────────────────────────────

import { loadVariants, type Variant } from './thumb-preview'

export interface ApplyResult {
  /** The full file contents to write back. */
  text: string
  /** One human-readable line per variant that actually changed; empty ⇒ nothing to write. */
  changes: string[]
}

/** The file's own indentation, so a re-serialize does not reformat a file the host maintains by
 *  hand. Read off the first indented line; 2 spaces (what the pipeline writes) when there is none. */
function detectIndent(source: string): number {
  const m = source.match(/\n( +)\S/)
  return m ? m[1].length : 2
}

/** Parse + shape-validate, sharing one set of error messages with the apply path. */
function parseVariants(source: string): { parsed: unknown; variants: Variant[] } {
  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  } catch (e) {
    throw new Error(`thumb-variants.json is not valid JSON — fix it by hand: ${(e as Error).message}`)
  }
  // Shape-validate with the SAME loader /thumbs-preview renders from, so `--apply` cannot write a
  // file the very next command would reject. It also accepts the `{ variants: [...] }` wrapper.
  return { parsed, variants: loadVariants(parsed) }
}

/** Throw unless `source` is a file --apply can safely edit. The FREE pre-flight: gen-thumb-object
 *  calls this before the billed Gemini call, so a missing or malformed variants file costs nothing
 *  — the same rule the gen-log parse already follows. Edits nothing. */
export function assertVariants(source: string): void {
  parseVariants(source)
}

/** Point EVERY variant at `bgImage`, and set `objectInScene: true` alongside it.
 *
 *  The pair is not optional. A generated scene BAKES the focal object into the background;
 *  ThumbTemplate draws its own LogoTile unless `objectInScene` is set — so a bgImage written
 *  without it renders the object twice, in two places. Writing one without the other is the exact
 *  bug this function exists to make impossible (see sceneObjectWarnings in ./thumb-preview).
 *
 *  Every variant, not a chosen one: variants are an A/B over ONE variable (layout, hook, accent).
 *  A scene applied to a subset would silently make the background a second variable and invalidate
 *  the comparison. */
export function applySceneToVariants(source: string, bgImage: string): ApplyResult {
  const { parsed, variants } = parseVariants(source)

  const changes: string[] = []
  for (const variant of variants) {
    const props = variant.props as Record<string, unknown>
    const before = props.bgImage
    const parts: string[] = []

    if (before !== bgImage) {
      // Assigning to an existing key keeps its slot in the insertion order; a new key appends.
      // Either way the host's key order survives the round-trip.
      parts.push(typeof before === 'string' && before ? `bgImage ${before} → ${bgImage}` : `bgImage → ${bgImage}`)
      props.bgImage = bgImage
    }
    if (props.objectInScene !== true) {
      parts.push('objectInScene → true')
      props.objectInScene = true
    }
    if (parts.length > 0) changes.push(`${variant.label}: ${parts.join(', ')}`)
  }

  const trailingNewline = source.endsWith('\n') ? '\n' : ''
  return { text: JSON.stringify(parsed, null, detectIndent(source)) + trailingNewline, changes }
}
