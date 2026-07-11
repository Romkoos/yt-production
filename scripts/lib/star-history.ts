// Pure aggregation of raw star timestamps into a cumulative series for StarChart.
// No network / IO — the fetcher (fetch-star-history.ts) feeds real `starredAt` values in.

export interface StarPoint {
  date: string // 'YYYY-MM' (monthly) or 'YYYY-Www' (weekly)
  stars: number // cumulative total as of this bucket
}

export type Bucket = 'weekly' | 'monthly'

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.44

// Young repos (< 12 months) get weekly buckets so a 6-month-old repo isn't a 7-point line;
// older repos get monthly buckets to stay readable.
export function chooseBucket(createdAt: Date, now: Date): Bucket {
  const ageMonths = (now.getTime() - createdAt.getTime()) / MS_PER_MONTH
  return ageMonths < 12 ? 'weekly' : 'monthly'
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

// ISO-8601 week number, keyed as 'YYYY-Www'.
function weekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = t.getUTCDay() || 7 // Mon=1..Sun=7
  t.setUTCDate(t.getUTCDate() + 4 - day) // shift to the Thursday of this week
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function keyFor(d: Date, bucket: Bucket): string {
  return bucket === 'monthly' ? monthKey(d) : weekKey(d)
}

// Start-of-bucket instant (UTC): first of the month, or Monday of the ISO week.
function bucketStart(d: Date, bucket: Bucket): Date {
  if (bucket === 'monthly') return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = t.getUTCDay() || 7 // Mon=1..Sun=7
  t.setUTCDate(t.getUTCDate() - (day - 1))
  return t
}

function nextBucketStart(d: Date, bucket: Bucket): Date {
  const n = new Date(d)
  if (bucket === 'monthly') n.setUTCMonth(n.getUTCMonth() + 1)
  else n.setUTCDate(n.getUTCDate() + 7)
  return n
}

// Evenly downsample to at most `max` points, always keeping the first and last (the last point
// carries the true cumulative total, so it must survive). Dedupes indices — when `max` is close
// to points.length, Math.round can map neighbouring i's to the same index, which would emit
// duplicate points; we keep each index once and still guarantee the final point.
function downsample(points: StarPoint[], max: number): StarPoint[] {
  if (points.length <= max) return points
  const step = (points.length - 1) / (max - 1)
  const indices: number[] = []
  for (let i = 0; i < max; i++) {
    const j = Math.round(i * step)
    if (indices.length === 0 || indices[indices.length - 1] !== j) indices.push(j)
  }
  const lastIdx = points.length - 1
  if (indices[indices.length - 1] !== lastIdx) indices.push(lastIdx)
  return indices.map((j) => points[j])
}

export interface AggregateOptions {
  createdAt?: Date // repo creation, for bucket selection; defaults to earliest star
  now?: Date // "today", for bucket selection; defaults to latest star
  maxPoints?: number // hard cap on series length (default 52)
}

// Raw ISO `starredAt` timestamps -> cumulative {date, stars}[] series.
export function aggregateStarHistory(timestamps: string[], opts: AggregateOptions = {}): StarPoint[] {
  const dates = timestamps
    .map((t) => new Date(t))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())

  if (dates.length === 0) return []

  const createdAt = opts.createdAt ?? dates[0]
  const now = opts.now ?? dates[dates.length - 1]
  const bucket = chooseBucket(createdAt, now)
  const maxPoints = opts.maxPoints ?? 52

  // Walk every bucket from the first star to `now`, emitting the TRUE cumulative count as of the
  // end of each bucket — including flat stretches (weeks with no new stars carry the real count
  // forward). This is measured data at every point, not interpolation: it makes flat-then-spike
  // growth visible instead of collapsing sparse activity into a few evenly-spaced points.
  const seriesStart = bucketStart(dates[0], bucket)
  const seriesEnd = now.getTime() < dates[0].getTime() ? dates[0] : now

  const points: StarPoint[] = []
  let ptr = 0
  let cumulative = 0
  for (let b = seriesStart; b.getTime() <= seriesEnd.getTime(); b = nextBucketStart(b, bucket)) {
    const bEnd = nextBucketStart(b, bucket)
    while (ptr < dates.length && dates[ptr].getTime() < bEnd.getTime()) {
      cumulative++
      ptr++
    }
    points.push({ date: keyFor(b, bucket), stars: cumulative })
  }

  return downsample(points, maxPoints)
}

// Tier D emergency floor: two REAL points — 0 stars at repo creation, the real total today.
// Never plots interpolated points between them (channel honesty rule).
export function anchorPoints(createdAt: string, total: number, now: Date): StarPoint[] {
  return [
    { date: monthKey(new Date(createdAt)), stars: 0 },
    { date: monthKey(now), stars: total },
  ]
}
