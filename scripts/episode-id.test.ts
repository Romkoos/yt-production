import { describe, it, expect } from 'vitest'
import { nextEpisodeNumber, formatEpisodeId, nextEpisodeId } from './episode-id'

describe('nextEpisodeNumber', () => {
  it('returns 1 when there are no episodes', () => {
    expect(nextEpisodeNumber([])).toBe(1)
  })
  it('is channel-wide max+1, ignoring date prefix and month', () => {
    expect(nextEpisodeNumber(['2026-07-ep001', '2026-08-ep005', '2026-06-ep003'])).toBe(6)
  })
  it('ignores non-episode dir names', () => {
    expect(nextEpisodeNumber(['.gitkeep', 'scratch', '2026-07-ep002'])).toBe(3)
  })
  it('does not reset per month', () => {
    expect(nextEpisodeNumber(['2026-12-ep009', '2027-01-ep010'])).toBe(11)
  })
})

describe('formatEpisodeId', () => {
  it('zero-pads NNN to 3 digits and prefixes year-month', () => {
    expect(formatEpisodeId(7, '2026-07')).toBe('2026-07-ep007')
    expect(formatEpisodeId(42, '2026-07')).toBe('2026-07-ep042')
  })
  it('does not truncate numbers above 999', () => {
    expect(formatEpisodeId(1000, '2030-01')).toBe('2030-01-ep1000')
  })
})

describe('nextEpisodeId', () => {
  it('combines next number with the given year-month', () => {
    expect(nextEpisodeId(['2026-07-ep001'], '2026-08')).toBe('2026-08-ep002')
  })
})
