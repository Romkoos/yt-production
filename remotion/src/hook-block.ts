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
// The verdict sticker, anchored below the brick (verdictPosition: 'below-hook').
//
// The sticker hangs off the bottom of the hook column, so its position is a FUNCTION of the brick's
// height — which is itself a function of the measured line sizes. Two things it must not do: cross
// the 60% line into the object's zone, and land on the channel lockup in the bottom-left. A tall
// brick makes the second one certain, so the sticker gets one scale factor satisfying both.
// ─────────────────────────────────────────────────────────────────────────────

/** The sticker's metrics at scale 1 — must match VerdictSticker's CSS. */
const STICKER_FONT = 78
const STICKER_LINE_BOX = STICKER_FONT * 1.2 // the text's line box
const STICKER_PAD_Y = 14 + 18 // padding: '14px 42px 18px'
const STICKER_PAD_X = 42 * 2
const STICKER_BORDER = 3 * 2

/** Below the lockup's top edge the sticker must not go. The channel mark sits at bottom:36 and is
 *  52px tall, so it starts at 720-36-52 = 632; back off a little for its glow. */
export const LOCKUP_TOP = 620

/** Shrinking is a fix only up to a point. A verdict nobody can read at 120px is not a verdict. */
export const MIN_STICKER_SCALE = 0.62

/** The sticker's rendered height at a given scale. */
export function stickerHeight(scale: number): number {
  return scale * (STICKER_LINE_BOX + STICKER_PAD_Y + STICKER_BORDER)
}

/** The sticker's rendered width at a given scale, for a verdict measured at REF_SIZE. */
export function stickerWidth(scale: number, verdictWidthAtRef: number): number {
  return scale * ((verdictWidthAtRef * STICKER_FONT) / REF_SIZE + STICKER_PAD_X + STICKER_BORDER)
}

export interface VerdictFit {
  scale: number
  warning?: string
}

export interface VerdictBelowHookParams {
  /** Total height of the rendered hook lines. */
  brickHeight: number
  /** The hook column's `top`, resolved to px. */
  hookTop: number
  /** Whether the column is vertically centred on hookTop (translateY(-50%)). */
  translateY: boolean
  /** The block the sticker is left-aligned to — already clamped inside the 60% line, so fitting the
   *  sticker within it is what makes the sticker respect that same boundary. */
  blockWidth: number
  /** Fixed gap between the brick's last line and the sticker. */
  gap: number
  /** Width of the verdict word measured at REF_SIZE in the sticker's face. */
  verdictWidthAtRef: number
  lockupTop?: number
}

/** The scale at which the below-hook sticker clears both the lockup and the block's right edge.
 *
 *  Returns 1 (no warning) when it already fits. Otherwise shrinks to the binding constraint and
 *  names it — a sticker that silently shrank is a sticker whose size no longer means anything, and
 *  the host tunes these props expecting the verdict to be a fixed, recognisable stamp. */
export function fitVerdictBelowHook(p: VerdictBelowHookParams): VerdictFit {
  const lockupTop = p.lockupTop ?? LOCKUP_TOP

  // How much vertical room the sticker has. With translateY the whole column (brick + gap + sticker)
  // is centred on hookTop, so growing the sticker pushes the bottom down only half as fast.
  const roomBelow = p.translateY
    ? 2 * (lockupTop - p.hookTop) - p.brickHeight - p.gap
    : lockupTop - p.hookTop - p.brickHeight - p.gap
  const scaleH = roomBelow / stickerHeight(1)

  // How much horizontal room: the sticker is left-aligned to the block (with a small indent), and
  // the block's right edge is already the 60% line.
  const scaleW = (p.blockWidth - VERDICT_INDENT) / stickerWidth(1, p.verdictWidthAtRef)

  const natural = Math.min(scaleH, scaleW, 1)
  if (natural >= 1) return { scale: 1 }

  const scale = Math.max(natural, MIN_STICKER_SCALE)
  const pct = Math.round(scale * 100)
  const reason =
    scaleH < scaleW
      ? `the brick is tall enough that the verdict sticker would land on the channel lockup`
      : `the verdict sticker is wider than the hook block (it must stay inside the 60% line)`
  const floored =
    natural < MIN_STICKER_SCALE
      ? ` It could not shrink far enough (floor ${Math.round(MIN_STICKER_SCALE * 100)}%) — shorten the hook or reduce blockWidth.`
      : ''
  return { scale, warning: `[ThumbTemplate] ${reason}; shrunk it to ${pct}%.${floored}` }
}

/** The sticker's left indent inside the block — a slight step in, so it reads as hanging off the
 *  brick rather than as another line of it. */
export const VERDICT_INDENT = 8

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
