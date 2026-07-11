import { describe, it, expect } from 'vitest'
import { chooseBucket, aggregateStarHistory, anchorPoints } from './star-history'

const iso = (s: string) => new Date(s).toISOString()

describe('chooseBucket', () => {
  it('is weekly for a repo younger than 12 months', () => {
    expect(chooseBucket(new Date('2026-01-01'), new Date('2026-07-01'))).toBe('weekly')
  })
  it('is monthly for a repo 12 months or older', () => {
    expect(chooseBucket(new Date('2024-01-01'), new Date('2026-07-01'))).toBe('monthly')
  })
})

describe('aggregateStarHistory', () => {
  it('returns an empty series for no timestamps', () => {
    expect(aggregateStarHistory([])).toEqual([])
  })

  it('returns a single cumulative point for one star', () => {
    const out = aggregateStarHistory([iso('2026-03-10T00:00:00Z')])
    expect(out).toHaveLength(1)
    expect(out[0].stars).toBe(1)
  })

  it('accumulates monthly for an old repo', () => {
    const stamps = [
      '2026-01-05', '2026-01-20', // Jan: 2
      '2026-02-02', // Feb: +1 = 3
      '2026-03-01', '2026-03-15', '2026-03-31', // Mar: +3 = 6
    ].map(iso)
    // createdAt 2 years back forces monthly bucketing; no `now` -> series ends at the last star
    const out = aggregateStarHistory(stamps, { createdAt: new Date('2024-01-01') })
    expect(out.map((p) => p.date)).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(out.map((p) => p.stars)).toEqual([2, 3, 6]) // cumulative, monotonic non-decreasing
  })

  it('buckets weekly (YYYY-Www) for a young repo', () => {
    const stamps = ['2026-01-05', '2026-01-13', '2026-01-20'].map(iso)
    const out = aggregateStarHistory(stamps, { createdAt: new Date('2026-01-01'), now: new Date('2026-02-01') })
    expect(out.length).toBeGreaterThan(1)
    expect(out.every((p) => /^\d{4}-W\d{2}$/.test(p.date))).toBe(true)
    expect(out[out.length - 1].stars).toBe(3)
  })

  it('caps the number of points and keeps the final cumulative total', () => {
    // 120 stars, one per day, over a young repo -> weekly would exceed the cap
    const stamps = Array.from({ length: 120 }, (_, i) => {
      const d = new Date('2026-01-01T00:00:00Z')
      d.setUTCDate(d.getUTCDate() + i)
      return d.toISOString()
    })
    const out = aggregateStarHistory(stamps, {
      createdAt: new Date('2026-01-01'),
      now: new Date('2026-05-01'),
      maxPoints: 10,
    })
    expect(out.length).toBeLessThanOrEqual(10)
    expect(out[out.length - 1].stars).toBe(120) // last point is the true total
    // monotonic non-decreasing
    for (let i = 1; i < out.length; i++) expect(out[i].stars).toBeGreaterThanOrEqual(out[i - 1].stars)
  })

  it('gap-fills empty buckets with the carried-forward real total (monotonic, no holes)', () => {
    // two stars far apart: one in Jan, one in Apr — the months between are real flat totals
    const out = aggregateStarHistory([iso('2026-01-05'), iso('2026-04-20')], {
      createdAt: new Date('2024-01-01'), // force monthly
    })
    expect(out.map((p) => p.date)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04'])
    expect(out.map((p) => p.stars)).toEqual([1, 1, 1, 2]) // Feb/Mar carry the real count, not a gap
  })

  it('never emits duplicate consecutive points when the cap is near the series length', () => {
    // 30 distinct weekly buckets, cap at 29 -> Math.round collisions would otherwise dupe indices
    const stamps = Array.from({ length: 30 }, (_, i) => {
      const d = new Date('2026-01-01T00:00:00Z')
      d.setUTCDate(d.getUTCDate() + i * 7)
      return d.toISOString()
    })
    const out = aggregateStarHistory(stamps, { createdAt: new Date('2026-01-01'), maxPoints: 29 })
    const dates = out.map((p) => p.date)
    expect(new Set(dates).size).toBe(dates.length) // all unique
    expect(out[out.length - 1].stars).toBe(30) // final total preserved
  })

  it('ignores unparseable timestamps', () => {
    const out = aggregateStarHistory(['nonsense', iso('2026-03-10'), ''])
    expect(out).toHaveLength(1)
    expect(out[0].stars).toBe(1)
  })
})

describe('anchorPoints (Tier D fallback)', () => {
  it('returns two real points: 0 at creation, total today', () => {
    const out = anchorPoints('2026-01-09T00:00:00Z', 7858, new Date('2026-07-11'))
    expect(out).toHaveLength(2)
    expect(out[0].stars).toBe(0)
    expect(out[1].stars).toBe(7858)
    expect(out[0].date).toBe('2026-01')
    expect(out[1].date).toBe('2026-07')
  })
})
