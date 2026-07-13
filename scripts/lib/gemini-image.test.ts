import { describe, it, expect } from 'vitest'
import { buildPrompt, type GenMode, type GenVariant } from './gemini-image'

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

  it('does not leak the trademark clause into the text-only modes (nothing is attached)', () => {
    expect(buildPrompt('known-logo', 'object', 'Meta infinity logo')).not.toMatch(/attached/i)
    expect(buildPrompt('category-object', 'object', 'terminal')).not.toMatch(/attached/i)
  })

  it('refuses to build a text-only prompt with no subject', () => {
    expect(() => buildPrompt('known-logo', 'object')).toThrow(/--subject/)
    expect(() => buildPrompt('category-object', 'scene')).toThrow(/--subject/)
  })
})
