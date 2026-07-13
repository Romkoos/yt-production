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

// ─────────────────────────────────────────────────────────────────────────────
// The verdict as the brick's LAST LINE (verdictPosition: 'in-brick').
//
// A FLAT badge spanning the full block width, so the block closes on a hard horizontal edge. Flat
// is the point: the old 3D bevelled-and-tilted sticker reads as a foreign object glued onto a flat
// typographic lockup. Here it is another row of the same block.
//
// The badge's WIDTH is fixed (it spans the block), so the only free variable is its font size, and
// three separate things bound it. It takes the smallest, because each bound is a real failure:
//   · 0.7× the largest hook line — else the verdict out-shouts the hook it is supposed to answer
//   · the block's inner width     — else the word spills out of the badge that contains it
//   · the channel lockup          — else a tall brick pushes the badge onto the wordmark
// ─────────────────────────────────────────────────────────────────────────────

/** Horizontal padding inside the badge. The verdict word must fit between these. */
export const VERDICT_BADGE_PAD_X = 28
/** Vertical padding inside the badge. */
export const VERDICT_BADGE_PAD_Y = 10
/** The badge's text line box, as a multiple of its font size. */
export const VERDICT_LINE_BOX = 1.18
/** The verdict may never be more than this fraction of the largest hook line. */
export const VERDICT_HOOK_RATIO = 0.7
/** Below this the verdict stops being readable at 120px, and a verdict nobody can read is not one. */
export const MIN_VERDICT_FONT = 30

/** Below the lockup's top edge the badge must not go. The channel mark sits at bottom:36 and is
 *  52px tall, so it starts at 720-36-52 = 632; back off a little for its glow. */
export const LOCKUP_TOP = 620

/** The badge's rendered height at a given font size. */
export function verdictBadgeHeight(fontSize: number): number {
  return fontSize * VERDICT_LINE_BOX + 2 * VERDICT_BADGE_PAD_Y
}

/** The verdict word's rendered width at a given font size, from its width at REF_SIZE. */
export function verdictTextWidth(fontSize: number, verdictWidthAtRef: number): number {
  return (verdictWidthAtRef * fontSize) / REF_SIZE
}

export interface VerdictFit {
  fontSize: number
  warning?: string
}

export interface VerdictInBrickParams {
  /** Total height of the rendered hook lines. */
  brickHeight: number
  /** The largest hook line's font size — the badge is capped relative to it. */
  maxHookSize: number
  /** The hook column's `top`, resolved to px. */
  hookTop: number
  /** Whether the column is vertically centred on hookTop (translateY(-50%)). */
  translateY: boolean
  /** The block the badge spans — already clamped inside the 60% line, so spanning it is what makes
   *  the badge respect that same boundary. */
  blockWidth: number
  /** Fixed gap between the brick's last line and the badge (the verdictGap prop). */
  gap: number
  /** Width of the verdict word at REF_SIZE, in the badge's face. */
  verdictWidthAtRef: number
  lockupTop?: number
}

/** The badge's font size: the smallest of its three bounds, floored at legibility. */
export function fitVerdictInBrick(p: VerdictInBrickParams): VerdictFit {
  const lockupTop = p.lockupTop ?? LOCKUP_TOP

  const byHook = VERDICT_HOOK_RATIO * p.maxHookSize
  const byWidth = ((p.blockWidth - 2 * VERDICT_BADGE_PAD_X) / p.verdictWidthAtRef) * REF_SIZE

  // Vertical room. With translateY the whole column (brick + gap + badge) is centred on hookTop, so
  // growing the badge pushes the bottom down only half as fast.
  const roomBelow = p.translateY
    ? 2 * (lockupTop - p.hookTop) - p.brickHeight - p.gap
    : lockupTop - p.hookTop - p.brickHeight - p.gap
  const byLockup = (roomBelow - 2 * VERDICT_BADGE_PAD_Y) / VERDICT_LINE_BOX

  const natural = Math.min(byHook, byWidth, byLockup)
  if (natural >= byHook) return { fontSize: byHook } // the hook cap is the intended, quiet bound

  const fontSize = Math.max(natural, MIN_VERDICT_FONT)
  const reason =
    byLockup < byWidth
      ? 'the brick is tall enough that the verdict badge would land on the channel lockup'
      : 'the verdict word is wider than the block it must sit inside'
  const floored =
    natural < MIN_VERDICT_FONT
      ? ` It could not shrink far enough (floor ${MIN_VERDICT_FONT}px) — shorten the hook, lower blockWidth, or reduce verdictGap.`
      : ''
  return {
    fontSize,
    warning: `[ThumbTemplate] ${reason}; shrunk it to ${Math.round(fontSize)}px.${floored}`,
  }
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
