#!/usr/bin/env -S node --import tsx
// Generate the host's pre-record prep docs from an episode's script.md:
//   - SHOTLIST.md  (episode root)     — every [СКРИНКАСТ] cue, numbered checkboxes, by beat.
//   - assets/MEME_LIST.md             — every [МЕМ] cue (beat + line) scaffolded for the host to
//                                       fill a concrete meme + source, plus a free stock-sound list.
// SHOTLIST is fully mechanical. MEME_LIST's per-cue suggestion/source lines are scaffolds the
// /assets step fills with editorial judgment (concrete meme + download link).
//
// Usage: gen-prep-docs.ts --episode <id>

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { extractScreencastCues, extractMemeCues } from './lib/script-cues'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function repoFromState(episode: string): string {
  try {
    const state = readFileSync(join('episodes', episode, 'STATE.md'), 'utf8')
    const m = state.match(/repo_url:\s*(\S+)/)
    if (m) return m[1].replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '')
  } catch {
    /* fall through */
  }
  return episode
}

const STOCK_SOUNDS = `## Стоковые звуки (свободные лицензии)

Скачивает host сам — ниже только категории и источники.

- **Whoosh / переход между кадрами** — https://pixabay.com/sound-effects/search/whoosh/
- **Verdict stinger / удар-акцент на вердикте** — https://pixabay.com/sound-effects/search/stinger/
- **Клавиатура / печать в терминале** — https://freesound.org/search/?q=keyboard+typing/
- (доп.) **UI-клик / pop** для мелких переходов — https://pixabay.com/sound-effects/search/click/
`

function buildShotlist(episode: string, repo: string, md: string): string {
  const cues = extractScreencastCues(md)
  let out = `# SHOTLIST — ${episode} (${repo})\n\n`
  out += `Чек-лист записи для Screen Studio. Каждый \`[СКРИНКАСТ]\`-кью из script.md, по порядку.\n`
  out += `Это clock (b): запись делается позже, тайминга здесь нет — только что снять.\n`
  out += `Каждый пункт N ведёт в свой блок \`#scene-N\` в [REPRO.md](REPRO.md) — там точные команды,\n`
  out += `что появится на экране, WAIT/CUT и как переснять.\n\n`
  let currentBeat = ''
  cues.forEach((c, i) => {
    if (c.beat !== currentBeat) {
      currentBeat = c.beat
      out += `\n## ${c.beat}\n\n`
    }
    // Item N ↔ REPRO SCENE N: both derive from the same ordered [СКРИНКАСТ] cue list.
    out += `- [ ] ${i + 1}. ${c.raw} · [↗ REPRO](REPRO.md#scene-${i + 1})\n`
  })
  return out
}

function buildMemeList(episode: string, repo: string, md: string): string {
  const cues = extractMemeCues(md)
  let out = `# MEME_LIST — ${episode} (${repo})\n\n`
  out += `Мем-подсказки и стоковые звуки. Скачивает host — авто-загрузки нет, только предложения\n`
  out += `и ссылки; финальный выбор за host'ом.\n\n## Мемы\n`
  cues.forEach((c, i) => {
    out += `\n### ${i + 1}. Бит: ${c.beat}\n`
    out += `> Из сценария: ${c.raw}\n\n`
    out += `- **Мем:** <заполнить конкретным предложением>\n`
    out += `- **Источник:** <ссылка для скачивания>\n`
  })
  out += `\n${STOCK_SOUNDS}`
  return out
}

// Write the prep docs with the right regeneration policy:
//   SHOTLIST.md is DERIVED from script.md — always (re)written, so it stays in sync
//     (and keeps its REPRO scene links current).
//   MEME_LIST.md is a host-EDITED scaffold — only written when it doesn't exist yet, so
//     re-running to refresh SHOTLIST never clobbers the host's filled-in meme suggestions.
export function writePrepDocs(
  paths: { shotlistPath: string; memePath: string },
  content: { episode: string; repo: string; md: string },
): { memeScaffolded: boolean } {
  const { episode, repo, md } = content
  writeFileSync(paths.shotlistPath, buildShotlist(episode, repo, md))
  const memeExists = existsSync(paths.memePath)
  if (!memeExists) writeFileSync(paths.memePath, buildMemeList(episode, repo, md))
  return { memeScaffolded: !memeExists }
}

function main() {
  const episode = arg('--episode')
  if (!episode) throw new Error('--episode <id> is required')
  const repo = repoFromState(episode)
  const scriptPath = join('episodes', episode, 'script.md')
  const md = readFileSync(scriptPath, 'utf8')

  const assetsDir = join('episodes', episode, 'assets')
  mkdirSync(assetsDir, { recursive: true })

  const shotlistPath = join('episodes', episode, 'SHOTLIST.md')
  const memePath = join(assetsDir, 'MEME_LIST.md')
  const { memeScaffolded } = writePrepDocs({ shotlistPath, memePath }, { episode, repo, md })

  const shots = extractScreencastCues(md).length
  const memes = extractMemeCues(md).length
  const memeNote = memeScaffolded
    ? `assets/MEME_LIST.md (${memes} meme cues + sounds, scaffolded)`
    : `assets/MEME_LIST.md (kept — already present, not overwritten)`
  console.log(`[gen-prep-docs] ${episode}: SHOTLIST.md (${shots} shots), ${memeNote}`)
}

// Run main only when invoked directly, not when imported by tests.
if (process.argv[1] && process.argv[1].endsWith('gen-prep-docs.ts')) main()
