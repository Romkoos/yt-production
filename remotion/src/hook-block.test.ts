import { describe, it, expect } from 'vitest'
import { fitLinesToBlock, clampBlockWidth, fitVerdictBelowHook, stickerHeight, stickerWidth, MIN_STICKER_SCALE, TEXT_ZONE_FRACTION, REF_SIZE } from './hook-block'

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
// The verdict sticker, anchored below the brick.
//
// Two things can go wrong when the sticker hangs off the bottom of the hook, and both are
// geometry, not taste: it can run past the 60% line into the object's zone, and it can drop onto
// the channel lockup in the bottom-left. A tall brick (many lines, or a big blockWidth) makes the
// second one certain. So the sticker gets ONE scale factor that satisfies both constraints, and
// the host is told whenever it had to shrink — a sticker that silently shrank is a sticker whose
// size no longer means anything.
// ─────────────────────────────────────────────────────────────────────────────

const STICKER = {
  hookTop: 360,
  translateY: true,
  blockWidth: 563,
  gap: 24,
  lockupTop: 620,
  // "ГОДНОТА" measured at REF_SIZE in the sticker's face
  verdictWidthAtRef: 430,
}

describe('fitVerdictBelowHook — the sticker clears both the 60% line and the channel lockup', () => {
  it('leaves the sticker at full size when the brick is short enough', () => {
    const r = fitVerdictBelowHook({ ...STICKER, brickHeight: 200 })
    expect(r.scale).toBe(1)
    expect(r.warning).toBeUndefined()
  })

  it('shrinks the sticker — and says so — when a tall brick would push it onto the lockup', () => {
    const r = fitVerdictBelowHook({ ...STICKER, brickHeight: 400 })
    expect(r.scale).toBeLessThan(1)
    expect(r.warning).toMatch(/lockup|channel/i)
  })

  it('keeps the shrunk sticker clear of the lockup — the point is that it FITS, not that it warned', () => {
    // 400px of brick still leaves room to shrink INTO. (A brick so tall that even the floor scale
    // cannot clear the lockup is a different outcome — see the floor test below, which asserts the
    // sticker stays legible and the host gets told, rather than the sticker vanishing.)
    const brickHeight = 400
    const r = fitVerdictBelowHook({ ...STICKER, brickHeight })
    expect(r.scale).toBeGreaterThan(MIN_STICKER_SCALE) // shrunk, but not against the floor
    const content = brickHeight + STICKER.gap + stickerHeight(r.scale)
    const bottom = STICKER.hookTop - content / 2 + content // translateY: centre the whole column
    expect(bottom).toBeLessThanOrEqual(STICKER.lockupTop + 0.01)
  })

  it('honours the un-centred layouts too (translateY false anchors the top)', () => {
    const brickHeight = 300
    const r = fitVerdictBelowHook({ ...STICKER, translateY: false, hookTop: 168, brickHeight })
    const bottom = 168 + brickHeight + STICKER.gap + stickerHeight(r.scale)
    expect(bottom).toBeLessThanOrEqual(STICKER.lockupTop + 0.01)
  })

  it('shrinks a sticker whose WIDTH would cross the block edge — the 60% clamp binds it too', () => {
    // A very wide verdict word in a narrow block: width, not height, is what limits it here.
    const r = fitVerdictBelowHook({ ...STICKER, brickHeight: 150, blockWidth: 300, verdictWidthAtRef: 430 })
    expect(r.scale).toBeLessThan(1)
    expect(stickerWidth(r.scale, 430)).toBeLessThanOrEqual(300)
    expect(r.warning).toMatch(/width|block/i)
  })

  it('never shrinks past the floor — an illegible sticker is not a fix', () => {
    const r = fitVerdictBelowHook({ ...STICKER, brickHeight: 900 })
    expect(r.scale).toBeGreaterThanOrEqual(MIN_STICKER_SCALE)
    expect(r.warning).toBeDefined()
  })

  it('admits it when even the floor cannot clear the lockup, instead of pretending it fits', () => {
    // The honest failure. Shrinking has a floor, so past a certain brick height the sticker WILL
    // overlap — and the only useful thing the code can do is stop shrinking and say what to change.
    const r = fitVerdictBelowHook({ ...STICKER, brickHeight: 460 })
    expect(r.scale).toBe(MIN_STICKER_SCALE)
    expect(r.warning).toMatch(/could not shrink far enough/i)
    expect(r.warning).toMatch(/shorten the hook|blockWidth/i)
  })
})
