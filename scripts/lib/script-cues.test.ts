import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractMemeCues, extractScreencastCues, extractShortCuts, extractCues } from './script-cues'

const here = dirname(fileURLToPath(import.meta.url))
// Frozen snapshot — decoupled from the live episode file, which the host WILL edit (his job is
// adding humor). Editing the real script must never break this suite.
const FIXTURE = readFileSync(join(here, '..', '__fixtures__', 'script-ep001.md'), 'utf8')

describe('script-cues against the frozen ep001 fixture', () => {
  it('extracts exactly the real cues, ignoring the legend comment block', () => {
    expect(extractMemeCues(FIXTURE)).toHaveLength(2)
    expect(extractScreencastCues(FIXTURE)).toHaveLength(11)
    expect(extractShortCuts(FIXTURE)).toHaveLength(2)
  })

  it('tags each cue with its beat heading (timing paren stripped)', () => {
    const memes = extractMemeCues(FIXTURE)
    expect(memes[0].beat).toBe('Хук')
    expect(memes[1].beat).toBe('Живой тест')

    const shorts = extractShortCuts(FIXTURE)
    expect(shorts[0].beat).toBe('Живой тест')
    expect(shorts[1].beat).toBe('Где README врёт')
  })

  it('normalizes multi-line cue content to a single line', () => {
    const shots = extractScreencastCues(FIXTURE)
    // every cue is one line, non-empty, no leftover newlines
    for (const c of shots) {
      expect(c.raw.length).toBeGreaterThan(0)
      expect(c.raw).not.toMatch(/\n/)
    }
    // the first screencast cue is the GitHub-page-to-terminal shot from the hook
    expect(shots[0].raw).toContain('GitHub')
  })

  it('does not treat legend example tags as cues', () => {
    // the legend defines "[МЕМ: ...]" etc inside an HTML comment; those must be excluded
    const memes = extractMemeCues(FIXTURE)
    expect(memes.every((c) => c.raw !== '...' && !c.raw.includes('что показать'))).toBe(true)
  })

  it('returns [] for a tag that never appears', () => {
    expect(extractCues(FIXTURE, 'НЕТ_ТАКОГО')).toEqual([])
  })
})

// Non-blocking sanity check against the LIVE script if it still exists: cues must parse without
// error and be non-empty. It never asserts exact counts, so host edits can't break it.
describe('live ep001 script sanity (non-blocking on counts)', () => {
  const livePath = join(here, '..', '..', 'episodes', '2026-07-ep001', 'script.md')
  it.skipIf(!existsSync(livePath))('parses and finds at least one screencast cue', () => {
    const live = readFileSync(livePath, 'utf8')
    expect(() => extractScreencastCues(live)).not.toThrow()
    expect(extractScreencastCues(live).length).toBeGreaterThan(0)
  })
})
