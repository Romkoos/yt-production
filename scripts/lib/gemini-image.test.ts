import { describe, it, expect } from 'vitest'
import {
  buildPrompt,
  type GenMode,
  type GenVariant,
  extractInlineImages,
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
