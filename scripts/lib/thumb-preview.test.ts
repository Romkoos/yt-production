import { describe, it, expect } from 'vitest'
import { hookText, variantSummary, loadVariants, pickEpisode, buildIndexHtml, type SheetItem } from './thumb-preview'

describe('hookText', () => {
  it('joins array hook lines with a space', () => {
    expect(hookText([{ text: 'UI без', size: 'lg' }, { text: 'сборки', size: 'xl' }])).toBe('UI без сборки')
  })
  it('passes through a plain string', () => {
    expect(hookText('Дизайн-система Meta')).toBe('Дизайн-система Meta')
  })
  it('is empty for missing/garbage input', () => {
    expect(hookText(undefined)).toBe('')
    expect(hookText(42)).toBe('')
  })
})

describe('variantSummary', () => {
  it('extracts hook text, verdict and background from props', () => {
    expect(
      variantSummary({
        hook: [{ text: 'UI без' }, { text: 'сборки' }],
        verdict: 'ГОДНОТА',
        bgImage: 'gen/2026-07-ep001/scene-real-avatar-v1.png',
      }),
    ).toEqual({
      hookText: 'UI без сборки',
      verdict: 'ГОДНОТА',
      bgImage: 'gen/2026-07-ep001/scene-real-avatar-v1.png',
    })
  })

  it('reports an empty background when the variant has none', () => {
    expect(variantSummary({ hook: [], verdict: 'ХАЙП' }).bgImage).toBe('')
  })
})

describe('loadVariants', () => {
  const ok = [{ label: 'A', props: { repoName: 'x/y', verdict: 'ГОДНОТА', hook: [], logo: {} } }]

  it('accepts a bare array', () => {
    expect(loadVariants(ok)).toEqual(ok)
  })
  it('accepts a { variants: [...] } wrapper', () => {
    expect(loadVariants({ variants: ok })).toEqual(ok)
  })
  it('rejects a non-array/non-wrapper', () => {
    expect(() => loadVariants({ foo: 1 })).toThrow(/array of/)
  })
  it('rejects an empty list', () => {
    expect(() => loadVariants([])).toThrow(/no variants/)
  })
  it('rejects a variant missing a label', () => {
    expect(() => loadVariants([{ props: {} }])).toThrow(/label/)
  })
  it('rejects a variant missing props', () => {
    expect(() => loadVariants([{ label: 'A' }])).toThrow(/props/)
  })
})

describe('pickEpisode', () => {
  it('returns the explicit episode when given', () => {
    expect(pickEpisode(['2026-07-ep001', '2026-08-ep002'], '2026-07-ep001')).toBe('2026-07-ep001')
  })
  it('returns the newest (lexicographically last) candidate otherwise', () => {
    expect(pickEpisode(['2026-08-ep002', '2026-07-ep001'])).toBe('2026-08-ep002')
  })
  it('throws when there are no candidates and no explicit episode', () => {
    expect(() => pickEpisode([])).toThrow(/thumb-variants\.json/)
  })
})

describe('buildIndexHtml', () => {
  const items: SheetItem[] = [
    { label: 'A — clean right', fullFile: 'thumb-v1.png', thumbFile: 'thumb-v1.120.png', fullMtime: 111, thumbMtime: 112, hookText: 'Дизайн-система Meta', verdict: 'ГОДНОТА', bgImage: 'gen/2026-07-ep001/scene-real-avatar-v1.png' },
    { label: 'B — hero', fullFile: 'thumb-v2.png', thumbFile: 'thumb-v2.120.png', fullMtime: 221, thumbMtime: 222, hookText: 'UI для тебя и AI', verdict: 'ГОДНОТА', bgImage: '' },
  ]
  const html = buildIndexHtml(items, { episode: '2026-07-ep001' })

  it('self-refreshes every 2s', () => {
    expect(html).toContain('<meta http-equiv="refresh" content="2">')
  })
  it('prints every label, hook text and verdict', () => {
    for (const it of items) {
      expect(html).toContain(it.label)
      expect(html).toContain(it.hookText)
    }
    expect(html).toContain('ГОДНОТА')
  })
  it('shows the 120px thumb on BOTH a dark and a light strip', () => {
    expect(html).toContain('strip-dark')
    expect(html).toContain('strip-light')
    // the 120px image of variant A appears at least twice (once per strip)
    const occurrences = html.split('thumb-v1.120.png').length - 1
    expect(occurrences).toBeGreaterThanOrEqual(2)
  })
  it('cache-busts each image with its mtime', () => {
    expect(html).toContain('thumb-v1.png?m=111')
    expect(html).toContain('thumb-v1.120.png?m=112')
  })
  it('escapes HTML-special characters in text', () => {
    const evil = buildIndexHtml([{ ...items[0], hookText: 'a < b & "c"' }])
    expect(evil).toContain('a &lt; b &amp; &quot;c&quot;')
    expect(evil).not.toContain('a < b & "c"')
  })

  it('prints the background each variant uses', () => {
    expect(html).toContain('gen/2026-07-ep001/scene-real-avatar-v1.png')
  })

  it('marks a variant with no background rather than leaving it blank', () => {
    // Anchored to the bg field: a bare toContain('—') would pass vacuously, since the em-dash
    // also appears in every variant label ("A — clean right").
    expect(html).toContain('<span class="k">bg</span> —')
  })
})
