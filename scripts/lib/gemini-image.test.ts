import { describe, it, expect } from 'vitest'
import {
  buildPrompt,
  type GenMode,
  type GenVariant,
  extractInlineImages,
  modeUsesSubject,
  variantUsesAccent,
  nextVersion,
  estimateCostUsd,
  appendGenLog,
  PRICES_AS_OF,
  type GenLog,
  type GenLogEntry,
  type GenResponse,
} from './gemini-image'

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

  // The first billed scene came back a grey matte slab: "soft" and "gentle" read to the model as
  // "unlit". The tile is the focal object of the whole thumbnail — it has to EMIT, not sit there.
  it.each(ALL)('%s/%s demands a bright, emissive tile — never a matte slab', (mode, variant) => {
    const p = buildPrompt(mode, variant, subjectFor(mode))
    expect(p).toMatch(/BRIGHT glowing white tile/)
    expect(p).toMatch(/strong emissive rim light/i)
    expect(p).toMatch(/vivid and luminous/i)
  })
})

describe('buildPrompt — the object variant', () => {
  it('isolates the tile on pure black', () => {
    expect(buildPrompt('known-logo', 'object', 'Meta infinity logo')).toMatch(/pure black/i)
  })
  it('does not impose the scene layout grid', () => {
    const p = buildPrompt('known-logo', 'object', 'Meta infinity logo')
    expect(p).not.toMatch(/RIGHT 30%/)
    expect(p).not.toMatch(/GUTTER/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// The scene grid is HALF of a contract; the other half is ThumbTemplate's brick,
// which clamps its right edge at 60% of the frame (see remotion/src/hook-block.ts,
// TEXT_ZONE_FRACTION). The two numbers only protect against a text/object collision
// if they agree, so the prompt has to state the zones — and the gutter between them —
// explicitly. A scene generated without these clauses puts the tile where the words go.
// ─────────────────────────────────────────────────────────────────────────────

describe('buildPrompt — the scene variant lays out the frame the brick expects', () => {
  const scene = buildPrompt('known-logo', 'scene', 'Meta infinity logo')

  it('centres the object in the RIGHT 30% of the frame', () => {
    expect(scene).toMatch(/RIGHT 30%/)
    expect(scene).toMatch(/vertically centred/i)
  })

  it('states the tile width EXACTLY once — two figures in one sentence invite a third', () => {
    // The superseded "roughly 28-30% of the frame width" must be gone, not merely accompanied by the
    // new 26-28%. An oversized tile is what a contradiction here actually looks like on the frame.
    expect(scene).not.toMatch(/28-30%/)
    expect(scene.match(/% of the frame WIDTH/gi) ?? []).toHaveLength(1)
  })

  it('reserves the LEFT 60% — dark, clean, empty — for the text overlay', () => {
    expect(scene).toMatch(/LEFT 60%/)
    expect(scene).toMatch(/text overlay/i)
    expect(scene).toMatch(/deep navy gradient/i)
  })

  it('bans objects, bright areas AND a light source from the left 60% — all three, by name', () => {
    // A dark-but-glowing left half is the failure this clause exists to stop: it reads as "empty"
    // to the model and eats the hook's contrast at 120px.
    expect(scene).toMatch(/no objects/i)
    expect(scene).toMatch(/no bright areas/i)
    expect(scene).toMatch(/no light source/i)
  })

  it('declares the 60-65% GUTTER and lets nothing but soft glow into it', () => {
    expect(scene).toMatch(/60-65%/)
    expect(scene).toMatch(/GUTTER/i)
    expect(scene).toMatch(/soft.{0,20}glow/i)
    expect(scene).toMatch(/65% line/i) // glow must stay subtle to the left of it
  })

  it('keeps the cinematic treatment — vignette and depth', () => {
    expect(scene).toMatch(/vignette/i)
    expect(scene).toMatch(/cinematic depth/i)
  })

  it('sizes the tile to 26-28% of the WIDTH and caps its HEIGHT so it cannot overflow', () => {
    // The first billed scene came back oversized and vertically cropped. A width-only constraint
    // lets a tall crop satisfy it; the height cap plus the margins clause is what actually bounds it.
    expect(scene).toMatch(/26-28% of the frame WIDTH/)
    expect(scene).toMatch(/no more than 55% of the frame HEIGHT/)
    expect(scene).toMatch(/never cropped/i)
    expect(scene).toMatch(/never touching the top or bottom edge/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// The scene is ASYMMETRIC by design, and that asymmetry is the whole fix.
//
// The first billed --scene render obeyed the grid and came back dead: a grey matte tile, no
// emission, no energy. The emptiness clauses were doing their job on the LEFT and then bleeding
// across the whole frame. So: the left stays exactly as strict as it was, and the right is told
// explicitly to be dramatic. The gutter is what keeps the two from meeting.
// ─────────────────────────────────────────────────────────────────────────────

describe('buildPrompt — the scene variant asks for drama on the RIGHT', () => {
  const scene = buildPrompt('known-logo', 'scene', 'Meta infinity logo')

  it('requests vivid glow, light streaks and cinematic bloom around the tile', () => {
    expect(scene).toMatch(/dramatic accent lighting/i)
    expect(scene).toMatch(/vivid glow/i)
    expect(scene).toMatch(/light streaks/i)
    expect(scene).toMatch(/energy wisps/i)
    expect(scene).toMatch(/cinematic bloom/i)
  })

  it('confines every bit of that drama to the right of the 65% line', () => {
    // Drama that leaks left would wreck the very contrast the empty zone exists to protect —
    // this clause is the only thing separating "dramatic" from "bright mess behind the hook".
    expect(scene).toMatch(/confined to the right of the 65% line/i)
  })

  it('still keeps the left zone strict — the drama must not have relaxed it', () => {
    expect(scene).toMatch(/no objects/i)
    expect(scene).toMatch(/no bright areas/i)
    expect(scene).toMatch(/no light source/i)
  })
})

describe('buildPrompt — sceneAccent colours the drama to match the episode', () => {
  it('defaults to green (the ГОДНОТА palette) when the host names no accent', () => {
    expect(buildPrompt('known-logo', 'scene', 'Meta infinity logo')).toMatch(/accent light colou?r is green/i)
  })

  it('injects the accent the host asked for', () => {
    const p = buildPrompt('known-logo', 'scene', 'Meta infinity logo', 'electric blue')
    expect(p).toMatch(/accent light colou?r is electric blue/i)
    expect(p).not.toMatch(/accent light colou?r is green/i)
  })

  it('does NOT colour the object variant — it is isolated on black, with no accent lighting at all', () => {
    // Same discipline as modeUsesSubject: a parameter that never reaches the prompt must not look
    // like it shaped the image. object/ has no drama clause to colour.
    const obj = buildPrompt('known-logo', 'object', 'Meta infinity logo', 'electric blue')
    expect(obj).not.toMatch(/accent light colou?r/i)
    expect(obj).toBe(buildPrompt('known-logo', 'object', 'Meta infinity logo'))
  })
})

describe('variantUsesAccent — the audit log must not record an input the prompt ignored', () => {
  it('scene uses it; object does not', () => {
    expect(variantUsesAccent('scene')).toBe(true)
    expect(variantUsesAccent('object')).toBe(false)
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

  it('category-object/scene also forbids any brand mark — the clause must not be scoped to object only', () => {
    const p = buildPrompt('category-object', 'scene', '3D terminal window')
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

describe('modeUsesSubject — the audit log must not record an input the prompt ignored', () => {
  it('real-avatar does not use it: its subject is the attached avatar', () => {
    expect(modeUsesSubject('real-avatar')).toBe(false)
    // The proof: the prompt is byte-identical with and without a subject.
    expect(buildPrompt('real-avatar', 'object', 'a subject that goes nowhere')).toBe(
      buildPrompt('real-avatar', 'object'),
    )
  })

  it('the text-only modes do use it — it is the whole subject of the prompt', () => {
    expect(modeUsesSubject('known-logo')).toBe(true)
    expect(modeUsesSubject('category-object')).toBe(true)
  })
})

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
