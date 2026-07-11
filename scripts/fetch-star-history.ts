#!/usr/bin/env -S node --import tsx
// Fetch a repo's REAL star history and derive StarChart props. Tiered by data source, most
// truthful first; the tier that succeeded is recorded so the chart caption derives from it.
// Channel rule: real data only — never synthesize/interpolate points (see CLAUDE.md).
//
//   Tier A  GraphQL  stargazers.starredAt (full real curve)   — primary
//   Tier B  REST     star+json paginate    (full real curve)
//   Tier C  Wayback  CDX snapshots         (sparse real)      — labeled
//   Tier D  anchors  creation=0, total today (2 real points)  — labeled, emergency floor
//
// Usage: fetch-star-history.ts --episode <id> [--repo owner/name] [--refresh]
// Auth token: GITHUB_TOKEN env, else `gh auth token`. Never written to disk or logged.

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { aggregateStarHistory, anchorPoints, type StarPoint } from './lib/star-history'

const UA = 'yt-production-star-history'

interface Args {
  episode: string
  repo?: string
  refresh: boolean
}

function parseArgs(argv: string[]): Args {
  const out: Partial<Args> = { refresh: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--episode') out.episode = argv[++i]
    else if (argv[i] === '--repo') out.repo = argv[++i]
    else if (argv[i] === '--refresh') out.refresh = true
  }
  if (!out.episode) throw new Error('--episode <id> is required')
  return out as Args
}

function getToken(): string | undefined {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim()
  } catch {
    return undefined
  }
}

function repoFromState(episode: string): string {
  const state = readFileSync(join('episodes', episode, 'STATE.md'), 'utf8')
  const m = state.match(/repo_url:\s*(\S+)/)
  if (!m) throw new Error(`no repo_url in episodes/${episode}/STATE.md`)
  const url = m[1].replace(/\.git$/, '')
  const parts = url.replace(/^https?:\/\/github\.com\//, '').split('/')
  return `${parts[0]}/${parts[1]}`
}

interface RepoMeta {
  stargazersCount: number
  createdAt: string
}

async function fetchRepoMeta(owner: string, name: string, token?: string): Promise<RepoMeta> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error(`repo meta HTTP ${res.status}`)
  const j = (await res.json()) as { stargazers_count: number; created_at: string }
  return { stargazersCount: j.stargazers_count, createdAt: j.created_at }
}

function authHeaders(token?: string, accept = 'application/vnd.github+json'): Record<string, string> {
  const h: Record<string, string> = { Accept: accept, 'User-Agent': UA }
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

// Tier A — GraphQL starredAt, ascending, cursor-paginated.
async function fetchGraphQL(owner: string, name: string, token: string): Promise<string[]> {
  const query = `query($owner:String!,$name:String!,$cursor:String){repository(owner:$owner,name:$name){stargazers(first:100,after:$cursor,orderBy:{field:STARRED_AT,direction:ASC}){pageInfo{hasNextPage endCursor} edges{starredAt}}}}`
  const timestamps: string[] = []
  let cursor: string | null = null
  for (let guard = 0; guard < 1000; guard++) {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { owner, name, cursor } }),
    })
    if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}`)
    const json = (await res.json()) as any
    if (json.errors) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`)
    const sg = json.data?.repository?.stargazers
    if (!sg) throw new Error('GraphQL: no stargazers connection')
    for (const e of sg.edges) timestamps.push(e.starredAt)
    if (!sg.pageInfo.hasNextPage) break
    cursor = sg.pageInfo.endCursor
  }
  return timestamps
}

// Tier B — REST stargazers with star+json media type.
async function fetchRest(owner: string, name: string, token?: string): Promise<string[]> {
  const timestamps: string[] = []
  for (let page = 1; page <= 400; page++) {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${name}/stargazers?per_page=100&page=${page}`,
      { headers: authHeaders(token, 'application/vnd.github.star+json') },
    )
    if (!res.ok) throw new Error(`REST HTTP ${res.status}`)
    const arr = (await res.json()) as Array<{ starred_at: string }>
    if (!Array.isArray(arr) || arr.length === 0) break
    for (const s of arr) timestamps.push(s.starred_at)
    if (arr.length < 100) break
  }
  if (timestamps.length === 0) throw new Error('REST returned no stargazers')
  return timestamps
}

// Tier C — Wayback CDX snapshots of the repo page; parse the exact star count per snapshot.
// Sparse but genuine historical measurements. Best-effort: a snapshot is only used if we can
// confidently extract a number.
async function fetchWayback(owner: string, name: string): Promise<StarPoint[]> {
  const cdx = `http://web.archive.org/cdx/search/cdx?url=github.com/${owner}/${name}&output=json&filter=statuscode:200&collapse=timestamp:6&limit=15`
  const res = await fetch(cdx, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`Wayback CDX HTTP ${res.status}`)
  const rows = (await res.json()) as string[][]
  const snapshots = rows.slice(1) // first row is the header
  const points: StarPoint[] = []
  for (const row of snapshots) {
    const ts = row[1] // yyyymmddhhmmss
    const snapUrl = `https://web.archive.org/web/${ts}/https://github.com/${owner}/${name}`
    try {
      const page = await (await fetch(snapUrl, { headers: { 'User-Agent': UA } })).text()
      const stars = parseStarCount(page)
      if (stars != null) {
        const d = new Date(
          `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T00:00:00Z`,
        )
        points.push({ date: `${ts.slice(0, 4)}-${ts.slice(4, 6)}`, stars })
        void d
      }
    } catch {
      /* skip unusable snapshot */
    }
  }
  // de-dupe by month keeping the max (monotonic), and require at least 2 real points
  const byMonth = new Map<string, number>()
  for (const p of points) byMonth.set(p.date, Math.max(byMonth.get(p.date) ?? 0, p.stars))
  const merged = [...byMonth.entries()].sort().map(([date, stars]) => ({ date, stars }))
  if (merged.length < 2) throw new Error('Wayback yielded < 2 usable snapshots')
  return merged
}

function parseStarCount(html: string): number | null {
  // Modern header: <span id="repo-stars-counter-star" ... title="7,858">
  const m1 = html.match(/repo-stars-counter-star[^>]*title="([\d,]+)"/)
  if (m1) return Number(m1[1].replace(/,/g, ''))
  // Older: aria-label="12345 users starred this repository"
  const m2 = html.match(/aria-label="([\d,]+)\s+users?\s+(?:have\s+)?starred/i)
  if (m2) return Number(m2[1].replace(/,/g, ''))
  return null
}

function deriveSourceLabel(tier: string): string {
  if (tier === 'wayback') return 'по снимкам Wayback Machine'
  if (tier === 'anchor') return 'по двум опорным точкам (детальная история недоступна)'
  return '' // full real series — no caption needed
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const repo = args.repo ?? repoFromState(args.episode)
  const [owner, name] = repo.split('/')
  const assetsDir = join('episodes', args.episode, 'assets')
  mkdirSync(assetsDir, { recursive: true })
  const rawPath = join(assetsDir, 'star-history.raw.json')
  const propsPath = join(assetsDir, 'StarChart.props.json')

  if (existsSync(rawPath) && !args.refresh) {
    const cached = JSON.parse(readFileSync(rawPath, 'utf8'))
    console.log(`[star-history] using cache (${cached.tier}, ${cached.points.length} pts). --refresh to re-fetch.`)
    return
  }

  const token = getToken()
  const meta = await fetchRepoMeta(owner, name, token)
  const now = new Date()

  let tier = ''
  let points: StarPoint[] = []

  try {
    if (!token) throw new Error('no token for GraphQL')
    const ts = await fetchGraphQL(owner, name, token)
    points = aggregateStarHistory(ts, { createdAt: new Date(meta.createdAt), now })
    tier = 'graphql'
  } catch (a) {
    console.log(`[star-history] tier A (GraphQL) unavailable: ${(a as Error).message}`)
    try {
      const ts = await fetchRest(owner, name, token)
      points = aggregateStarHistory(ts, { createdAt: new Date(meta.createdAt), now })
      tier = 'rest'
    } catch (b) {
      console.log(`[star-history] tier B (REST) unavailable: ${(b as Error).message}`)
      try {
        points = await fetchWayback(owner, name)
        tier = 'wayback'
      } catch (c) {
        console.log(`[star-history] tier C (Wayback) unavailable: ${(c as Error).message}`)
        points = anchorPoints(meta.createdAt, meta.stargazersCount, now)
        tier = 'anchor'
      }
    }
  }

  const sourceLabel = deriveSourceLabel(tier)
  const fetchedAt = now.toISOString()
  writeFileSync(
    rawPath,
    JSON.stringify({ repo, tier, fetchedAt, totalCount: meta.stargazersCount, sourceLabel, points }, null, 2),
  )
  writeFileSync(
    propsPath,
    JSON.stringify({ repoName: repo, data: points, sourceLabel: sourceLabel || undefined }, null, 2),
  )
  console.log(
    `[star-history] ${repo}: tier=${tier}, ${points.length} pts, total=${meta.stargazersCount}` +
      (sourceLabel ? `, label="${sourceLabel}"` : ''),
  )
}

main().catch((e) => {
  console.error(`[star-history] failed: ${e.message}`)
  process.exit(1)
})
