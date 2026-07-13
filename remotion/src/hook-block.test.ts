import { describe, it, expect } from 'vitest'
import { fitLinesToBlock, clampBlockWidth, fitVerdictInBrick, verdictBadgeHeight, verdictTextWidth, VERDICT_BADGE_PAD_X, MIN_VERDICT_FONT, TEXT_ZONE_FRACTION, REF_SIZE } from './hook-block'

// ─────────────────────────────────────────────────────────────────────────────
// The brick: every hook line is scaled so its RENDERED width equals the block
// width. Short lines therefore get big, long lines get small — the poster
// lockup. These tests inject a fake measurer instead of a canvas: the real one
// is a canvas measureText, but the math must not know or care where the widths
// came from, and a unit test must not need a DOM.
// ─────────────────────────────────────────────────────────────────────────────

/** Fake measurer: a monospace-ish face whose glyphs are 0.5em wide, measured at REF_SIZE. */
const monoMeasurer = (text: string): number => text.length * 0.5 * REF_SIZE

/** Measure a list of lines the way ThumbTemplate does — at the reference size. */
const widthsOf = (lines: string[], measure = monoMeasurer): number[] => lines.map(measure)

describe('fitLinesToBlock — each line fills the block width', () => {
  it('scales a single line so its rendered width lands exactly on the block width', () => {
    // "META" measures 200px at REF_SIZE=100 → to fill 600px it must be drawn at 300px.
    const [size] = fitLinesToBlock(widthsOf(['META']), 600, { maxLineScaleRatio: 10 })
    expect(size).toBeCloseTo(300)
  })

  it('gives the SHORT line the BIGGER size — that is the whole point of the brick', () => {
    const [long, short] = fitLinesToBlock(widthsOf(['ДИЗАЙН-СИСТЕМА', 'META']), 600, { maxLineScaleRatio: 10 })
    expect(short).toBeGreaterThan(long)
  })

  it('gives equal-width lines equal sizes', () => {
    const [a, b] = fitLinesToBlock(widthsOf(['ХАЙП', 'РАНО']), 600, { maxLineScaleRatio: 2 })
    expect(a).toBeCloseTo(b)
  })

  it('re-measures at the returned size back to the block width (round-trip)', () => {
    const lines = ['СТОИТ', 'ПЕРЕХОДИТЬ?']
    const sizes = fitLinesToBlock(widthsOf(lines), 563, { maxLineScaleRatio: 10 })
    lines.forEach((line, i) => {
      // width scales linearly with font size, so: measured@REF * (size / REF) === blockWidth
      expect((monoMeasurer(line) * sizes[i]) / REF_SIZE).toBeCloseTo(563)
    })
  })

  it('returns nothing for no lines', () => {
    expect(fitLinesToBlock([], 600, { maxLineScaleRatio: 2 })).toEqual([])
  })
})

describe('fitLinesToBlock — maxLineScaleRatio caps the largest line', () => {
  it('holds largest/smallest to the ratio, capping the short line rather than the long one', () => {
    // widths 700 / 200 → an uncapped ratio of 3.5×, well past the 2× cap.
    const sizes = fitLinesToBlock([700, 200], 600, { maxLineScaleRatio: 2 })
    expect(Math.max(...sizes) / Math.min(...sizes)).toBeCloseTo(2)
    // the LONG line still fills the block; only the short one is held back
    expect(sizes[0]).toBeCloseTo((600 / 700) * REF_SIZE)
    expect(sizes[1]).toBeCloseTo((600 / 700) * REF_SIZE * 2)
  })

  it('leaves sizes untouched when the natural ratio is already inside the cap', () => {
    const sizes = fitLinesToBlock([600, 400], 600, { maxLineScaleRatio: 2 })
    expect(sizes[0]).toBeCloseTo(100)
    expect(sizes[1]).toBeCloseTo(150) // 1.5× — under the cap, so not clipped
  })

  it('collapses every line to one size at a ratio of 1', () => {
    const sizes = fitLinesToBlock([700, 200, 350], 600, { maxLineScaleRatio: 1 })
    expect(new Set(sizes.map((s) => s.toFixed(4))).size).toBe(1)
  })
})

describe('fitLinesToBlock — degenerate input must not produce NaN/Infinity sizes', () => {
  it('gives an unmeasurable (empty) line the smallest size instead of Infinity', () => {
    const sizes = fitLinesToBlock([600, 0], 600, { maxLineScaleRatio: 2 })
    expect(sizes.every(Number.isFinite)).toBe(true)
    expect(sizes[1]).toBeCloseTo(Math.min(...sizes))
  })

  it('falls back to the reference size when NO line is measurable', () => {
    expect(fitLinesToBlock([0, 0], 600, { maxLineScaleRatio: 2 })).toEqual([REF_SIZE, REF_SIZE])
  })

  it('refuses a non-positive block width rather than returning garbage sizes', () => {
    expect(() => fitLinesToBlock([600], 0, { maxLineScaleRatio: 2 })).toThrow(/block width/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// The collision guarantee. The scene contract (gen-thumb-object --scene) reserves
// the right of the frame for the object and treats 60–65% as a gutter. The text
// block must therefore NEVER cross 60% of the frame — and that has to be enforced
// in code, because a prop combination the host types in Studio will otherwise
// silently slide the brick under the tile.
// ─────────────────────────────────────────────────────────────────────────────

describe('clampBlockWidth — the brick can never cross the 60% line', () => {
  const opts = { padding: 60, frameWidth: 1280 }

  it('leaves a block that fits alone', () => {
    const r = clampBlockWidth(563, opts)
    expect(r.blockWidth).toBe(563)
    expect(r.warning).toBeUndefined()
  })

  it('shrinks a block whose right edge would cross 60%, and says so', () => {
    const r = clampBlockWidth(900, opts) // 60 + 900 = 960 > 768
    expect(r.blockWidth).toBe(708) // 1280 * 0.60 - 60
    expect(r.warning).toMatch(/60%/)
    expect(r.warning).toMatch(/900/) // names the value it refused
  })

  it('accepts the exact boundary without warning (the clamp is not off by one)', () => {
    const r = clampBlockWidth(708, opts)
    expect(r.blockWidth).toBe(708)
    expect(r.warning).toBeUndefined()
    expect(r.blockWidth + opts.padding).toBe(opts.frameWidth * TEXT_ZONE_FRACTION)
  })

  it('holds for any padding — the boundary is on the block RIGHT edge, not its width', () => {
    const r = clampBlockWidth(760, { padding: 120, frameWidth: 1280 })
    expect(r.blockWidth).toBe(648) // 768 - 120
    expect(r.blockWidth + 120).toBeLessThanOrEqual(1280 * TEXT_ZONE_FRACTION)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// The verdict as the brick's LAST LINE (verdictPosition: 'in-brick').
//
// A flat badge spanning the full block width, so the block ends on a hard horizontal edge. Its
// font is bounded three ways and takes the smallest: it may not out-shout the hook (a cap relative
// to the largest hook line), its text must fit inside the block, and the badge must not drop onto
// the channel lockup. Same construction-over-arithmetic anchoring as before — the badge is a child
// of the hook column — so only the SIZE is computed here.
// ─────────────────────────────────────────────────────────────────────────────

const BRICK = {
  hookTop: 360,
  translateY: true,
  blockWidth: 563,
  gap: 24,
  lockupTop: 620,
  verdictWidthAtRef: 430, // "ГОДНОТА" at REF_SIZE
  maxHookSize: 160,
  brickHeight: 240,
}

describe('fitVerdictInBrick — the badge is the block’s last row, and never out-shouts the hook', () => {
  it('caps the badge at 0.7x the largest hook line', () => {
    // Width and height are both generous here, so the hook-relative cap is what binds.
    const r = fitVerdictInBrick({ ...BRICK })
    expect(r.fontSize).toBeCloseTo(0.7 * BRICK.maxHookSize)
  })

  it('never lets the badge grow past the hook, however small the hook gets', () => {
    const r = fitVerdictInBrick({ ...BRICK, maxHookSize: 40 })
    expect(r.fontSize).toBeLessThanOrEqual(0.7 * 40 + 0.01)
  })

  it('shrinks the badge text to fit INSIDE the block — the badge spans it, the word must not', () => {
    // A wide verdict word in a narrow block: the width bound is the binding one, and there is still
    // room above the legibility floor to satisfy it.
    const r = fitVerdictInBrick({ ...BRICK, blockWidth: 400, verdictWidthAtRef: 800 })
    expect(verdictTextWidth(r.fontSize, 800)).toBeLessThanOrEqual(400 - 2 * VERDICT_BADGE_PAD_X + 0.01)
    expect(r.warning).toMatch(/wider than the block/i)
  })

  it('warns rather than lie when the word cannot fit even at the legibility floor', () => {
    // The honest failure: below MIN_VERDICT_FONT the verdict stops being readable at 120px, so the
    // code stops shrinking. It will overflow — and the only useful thing it can do is say so.
    const r = fitVerdictInBrick({ ...BRICK, blockWidth: 260, verdictWidthAtRef: 800 })
    expect(r.fontSize).toBe(MIN_VERDICT_FONT)
    expect(verdictTextWidth(r.fontSize, 800)).toBeGreaterThan(260 - 2 * VERDICT_BADGE_PAD_X)
    expect(r.warning).toMatch(/could not shrink far enough/i)
  })

  it('shrinks — and warns — when a tall brick would drop the badge onto the channel lockup', () => {
    const r = fitVerdictInBrick({ ...BRICK, brickHeight: 420 })
    expect(r.fontSize).toBeLessThan(0.7 * BRICK.maxHookSize)
    expect(r.warning).toMatch(/lockup|channel/i)
  })

  it('keeps the shrunk badge clear of the lockup — it must FIT, not merely warn', () => {
    const brickHeight = 420
    const r = fitVerdictInBrick({ ...BRICK, brickHeight })
    const content = brickHeight + BRICK.gap + verdictBadgeHeight(r.fontSize)
    const bottom = BRICK.hookTop - content / 2 + content // translateY centres the whole column
    expect(bottom).toBeLessThanOrEqual(BRICK.lockupTop + 0.01)
  })

  it('honours an un-centred layout (translateY false anchors the top)', () => {
    const brickHeight = 300
    const r = fitVerdictInBrick({ ...BRICK, translateY: false, hookTop: 168, brickHeight })
    const bottom = 168 + brickHeight + BRICK.gap + verdictBadgeHeight(r.fontSize)
    expect(bottom).toBeLessThanOrEqual(BRICK.lockupTop + 0.01)
  })

  it('will not shrink into illegibility — it stops at the floor and says what to change', () => {
    const r = fitVerdictInBrick({ ...BRICK, brickHeight: 900 })
    expect(r.fontSize).toBe(MIN_VERDICT_FONT)
    expect(r.warning).toMatch(/could not shrink far enough/i)
  })

  it('does not warn when nothing had to give', () => {
    expect(fitVerdictInBrick({ ...BRICK }).warning).toBeUndefined()
  })
})
