import { readdirSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { nextEpisodeId, nextEpisodeNumber } from './episode-id'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const EPISODES = join(ROOT, 'episodes')

export interface StateVars {
  episodeId: string
  number: number
  repoUrl: string
  date: string
}

export function renderState(template: string, v: StateVars): string {
  return template
    .replaceAll('{{EPISODE_ID}}', v.episodeId)
    .replaceAll('{{NUMBER}}', String(v.number))
    .replaceAll('{{REPO_URL}}', v.repoUrl)
    .replaceAll('{{DATE}}', v.date)
}

function listEpisodeDirs(): string[] {
  if (!existsSync(EPISODES)) return []
  return readdirSync(EPISODES, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

// CLI: pnpm episode:init <repo_url>
function main() {
  const repoUrl = process.argv[2]
  if (!repoUrl) {
    console.error('Usage: pnpm episode:init <repo_url>')
    process.exit(1)
  }
  const dirs = listEpisodeDirs()
  const date = today()
  const yearMonth = date.slice(0, 7)
  const episodeId = nextEpisodeId(dirs, yearMonth)
  const number = nextEpisodeNumber(dirs)
  const epDir = join(EPISODES, episodeId)
  mkdirSync(join(epDir, 'assets'), { recursive: true })
  mkdirSync(join(epDir, 'shorts'), { recursive: true })
  writeFileSync(join(epDir, 'assets', '.gitkeep'), '')
  writeFileSync(join(epDir, 'shorts', '.gitkeep'), '')
  const tpl = readFileSync(join(ROOT, 'templates', 'STATE.md'), 'utf8')
  writeFileSync(join(epDir, 'STATE.md'), renderState(tpl, { episodeId, number, repoUrl, date }))
  console.log(episodeId)
}

// Run main only when invoked directly, not when imported by tests.
if (process.argv[1] && process.argv[1].endsWith('init-episode.ts')) main()
