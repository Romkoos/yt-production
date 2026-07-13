// ─────────────────────────────────────────────────────────────────────────────
// The "brick": the hook rendered as a solid, justified block of equal-width lines.
//
// Each line is drawn at whatever font size makes its RENDERED width equal the block
// width, so a short line comes out huge and a long line small — the poster lockup.
// The lines themselves are never re-wrapped: the host controls the breaks by writing
// HookLine[], and this file only decides sizes.
//
// Pure by construction. The widths come from a canvas measureText in ThumbTemplate
// (after the fonts are ready — measuring before that measures the fallback face and
// the whole block comes out the wrong size), but nothing here knows that. Injecting
// the widths is what makes the math unit-testable without a DOM.
// ─────────────────────────────────────────────────────────────────────────────

/** The font size the caller must measure at. Widths scale linearly with size, so the
 *  size that fills the block is just `blockWidth / measuredWidth × REF_SIZE`. */
export const REF_SIZE = 100

/** The text zone ends here — the scene contract (`/gen-thumb-object --scene`) reserves
 *  everything right of it for the object, with 60–65% left as a gutter. The brick's right
 *  edge may touch this line and never cross it. Changing this number without changing the
 *  scene prompt re-opens the text/object collision this whole pass exists to close. */
export const TEXT_ZONE_FRACTION = 0.6

export interface BlockCaps {
  /** Cap on largest-line-size ÷ smallest-line-size. Uncapped, a one-word line next to a long
   *  one blows up to a size that eats the frame; 2 is the sane poster default. */
  maxLineScaleRatio: number
}

/** Font sizes (px) for each line, in input order.
 *
 *  @param measuredWidths each line's width at REF_SIZE, in px, INCLUDING tracking — measure with
 *                        the same letter-spacing you render with or the block won't line up.
 *  @param blockWidth     the target width every line is scaled to fill.
 */
export function fitLinesToBlock(measuredWidths: number[], blockWidth: number, caps: BlockCaps): number[] {
  if (!(blockWidth > 0)) throw new Error(`fitLinesToBlock: block width must be positive, got ${blockWidth}`)
  if (measuredWidths.length === 0) return []

  // An unmeasurable line (empty string, whitespace, a face that drew nothing) would divide to
  // Infinity and take the whole layout with it. It has no glyphs to size, so it gets the smallest
  // size in the block and stays out of the ratio math.
  const measurable = measuredWidths.filter((w) => w > 0)
  if (measurable.length === 0) return measuredWidths.map(() => REF_SIZE)

  // The size that makes each line exactly fill the block. The WIDEST line yields the smallest size.
  const natural = measurable.map((w) => (blockWidth / w) * REF_SIZE)
  const smallest = Math.min(...natural)

  // Cap only from above: the long lines keep filling the block, the short ones stop growing. Doing
  // it the other way (scaling the long lines up to meet the short ones) would overflow the block.
  const ceiling = smallest * Math.max(1, caps.maxLineScaleRatio)

  // An unmeasurable line draws no glyphs, so its size buys nothing but vertical space — give it the
  // smallest one in the block and let it disappear, rather than the ceiling, which would open a gap.
  return measuredWidths.map((w) => (w > 0 ? Math.min((blockWidth / w) * REF_SIZE, ceiling) : smallest))
}

export interface ClampedBlock {
  blockWidth: number
  /** Set when the requested width was refused. The caller logs it — a pure function that
   *  console.warns is a pure function you can't test twice. */
  warning?: string
}

/** Hard-clamp the block so its right edge cannot cross the text zone boundary.
 *
 *  This is the no-collision guarantee, and it lives in code rather than in a convention because
 *  the props are live Studio controls: the host WILL drag blockWidth past the line, and a comment
 *  saying "don't" does not stop a slider. */
export function clampBlockWidth(
  requested: number,
  opts: { padding: number; frameWidth: number; boundaryFraction?: number },
): ClampedBlock {
  const boundary = opts.frameWidth * (opts.boundaryFraction ?? TEXT_ZONE_FRACTION)
  const max = boundary - opts.padding
  if (requested <= max) return { blockWidth: requested }
  const pct = Math.round((opts.boundaryFraction ?? TEXT_ZONE_FRACTION) * 100)
  return {
    blockWidth: max,
    warning:
      `[ThumbTemplate] blockWidth ${Math.round(requested)}px + padding ${opts.padding}px would push the hook ` +
      `block past the ${pct}% line, into the zone the scene reserves for the object. Shrunk to ${Math.round(max)}px.`,
  }
}
