#!/usr/bin/env -S node --import tsx
// ─────────────────────────────────────────────────────────────────────────────
// `pnpm flow` — where am I, and what do I run next?
//
// Prints the current episode's STATE.md as a one-screen cheat sheet: the phase
// checklist, the next action, and the exact next command. READ-ONLY — it opens
// STATE.md and nothing else, writes nothing, and touches no network. Safe to run
// at any point in any phase, including mid-phase.
//
// Usage: flow.ts [--episode <id>]     (default: the newest episode)
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseState, renderFlow } from './lib/flow'
import { pickEpisode } from './lib/thumb-preview'

/** Episode dirs that carry a STATE.md — every real episode does; a half-made dir does not. */
function episodesWithState(): string[] {
  if (!existsSync('episodes')) return []
  return readdirSync('episodes', { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join('episodes', d.name, 'STATE.md')))
    .map((d) => d.name)
}

function main(): void {
  const argv = process.argv.slice(2)
  const i = argv.indexOf('--episode')
  const explicit = i === -1 ? undefined : argv[i + 1]
  if (i !== -1 && (!explicit || explicit.startsWith('--'))) throw new Error('--episode needs a value')

  const candidates = episodesWithState()
  if (candidates.length === 0) throw new Error('no episode has a STATE.md — run `pnpm episode:init <repo_url>` first')
  const episode = pickEpisode(candidates, explicit)

  const statePath = join('episodes', episode, 'STATE.md')
  if (!existsSync(statePath)) throw new Error(`no ${statePath} — known episodes: ${candidates.join(', ')}`)

  process.stdout.write(renderFlow(parseState(readFileSync(statePath, 'utf8'))))
}

try {
  main()
} catch (e) {
  process.stderr.write(`[flow] failed: ${(e as Error).message}\n`)
  process.exit(1)
}
