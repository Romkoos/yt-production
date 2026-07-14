#!/usr/bin/env -S node --import tsx
// Generate the host's session-oriented prep docs from an episode's script.md + REPRO.md.
// ONE FILE DRIVES ONE SITTING:
//   - RECORDING.md (episode root) — the screencast session: a checkbox per [СКРИНКАСТ #N] with
//     the commands, what appears on screen, WAIT/CUT and reset inline, plus the voice beat the
//     scene plays under. No cross-file links needed mid-session; REPRO.md stays the source of truth.
//   - VOICE.md (episode root)     — the voice session: [ГОЛОС] only, in reading order, with a
//     margin note per block naming the scene/asset IDs it covers.
//   - assets/MEME_LIST.md         — every [МЕМ M<n>] cue, scaffolded for the host to fill.
//
// Regeneration policy: RECORDING/VOICE are DERIVED and always rewritten (ticks are merged, see
// recording-merge.ts). MEME_LIST is a host-EDITED scaffold — written only when missing.
//
// Usage: gen-prep-docs.ts --episode <id> [--force]

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseScript, isLegacyScript, validateScript, type Cue, type ScriptDoc } from './lib/script-cues'
import { parseRepro, type ReproDoc, type ReproScene } from './lib/repro'
import {
  fingerprint,
  parseRecordingTicks,
  mergeTicks,
  type MergeReport,
  type OldTick,
  type TickState,
} from './lib/recording-merge'

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

// REPRO's bullet labels are English (the protocol is written by the review phase); the host's
// session doc is Russian. Unknown labels pass through untouched.
const LABELS: Record<string, string> = {
  Do: 'Делать',
  'On screen': 'На экране',
  'Wait/Cut': 'Wait/Cut',
  Reset: 'Reset',
}

const RESET_MARK = '(⟳ сцена изменилась после отметки — переснять?)'
const VERBATIM_BEATS = ['Хук', 'Вердикт'] // the two learn-verbatim moments

/** Indent a bullet body's continuation lines so nested fences stay inside the checkbox item. */
const indent = (body: string, pad: string): string => body.split('\n').join(`\n${pad}`)

function sceneBody(cue: Cue, scene: ReproScene): string {
  const lines: string[] = []
  if (cue.voiceBefore) lines.push(`  - **Звучит под:** «${cue.voiceBefore}»`)
  if (cue.voiceAfter) lines.push(`  - **Дальше:** «${cue.voiceAfter}»`)
  for (const b of scene.bullets) {
    // Finding #1 (Task 2 review of repro.ts): a bullet whose content starts on the NEXT line
    // (e.g. `- **Do:**` followed by an indented ```bash fence) comes back from parseRepro with a
    // LEADING BLANK LINE in its body. Trim only that leading newline — internal blank lines
    // inside a fenced block are preserved.
    const body = b.body.replace(/^\n+/, '')
    if (!b.label) {
      lines.push(`  ${indent(body, '  ')}`)
      continue
    }
    const label = `**${LABELS[b.label] ?? b.label}:**`
    // A multi-line body (a fenced block) drops to its own lines under the label — no trailing
    // space on the label line, no blank line before the fence. An inline body stays on the label.
    if (body.includes('\n')) {
      lines.push(`  - ${label}`)
      lines.push(`    ${indent(body, '    ')}`)
    } else {
      lines.push(`  - ${label} ${body}`)
    }
  }
  return lines.join('\n')
}

function buildRecording(
  episode: string,
  repo: string,
  doc: ScriptDoc,
  repro: ReproDoc,
  previous: string,
  force: boolean,
): { md: string; report: MergeReport; scenes: number } {
  const byNum = new Map(repro.scenes.map((s) => [s.num, s]))
  const shots = doc.cues.filter((c) => c.kind === 'screencast')

  // Fingerprint the DERIVED payload — not the file text — so host scribbles never reset a tick.
  const blocks = shots.map((cue) => {
    const scene = byNum.get(cue.num as number) as ReproScene
    const title = scene.title || cue.raw
    const body = sceneBody(cue, scene)
    return { cue, scene, title, body, id: cue.id, fp: fingerprint(`${cue.id}\n${title}\n${body}`) }
  })

  const old = force ? new Map<string, OldTick>() : parseRecordingTicks(previous)
  const { state, report } = mergeTicks(
    blocks.map((b) => ({ id: b.id, fp: b.fp })),
    old,
  )

  const box = (s: TickState): string => (s === 'ticked' ? 'x' : ' ')

  let out = `# RECORDING — ${episode} (${repo})\n\n`
  out += `Сессия скринкаста: один файл на одну посадку. Всё, что нужно снять, — здесь; REPRO.md\n`
  out += `остаётся источником правды, но открывать его по ходу записи не нужно.\n`
  out += `Это clock (b): тайминга здесь нет — только что снять.\n\n`
  if (repro.timeBudget) out += `**Recording time budget:** ${repro.timeBudget}\n\n`

  out += `---\n\n## Pre-flight\n\n`
  if (repro.scenesPreamble) out += `${repro.scenesPreamble}\n\n`
  if (repro.preparedStates) out += `${repro.preparedStates}\n\n`
  out += `> SETUP (zero-to-running) — в REPRO.md: это подготовка ДО посадки, не по ходу записи.\n`

  let beat = ''
  for (const b of blocks) {
    if (b.cue.beat !== beat) {
      beat = b.cue.beat
      out += `\n---\n\n## ${beat}\n`
    }
    const mark = state.get(b.id) === 'reset' ? `  ${RESET_MARK}` : ''
    out += `\n- [${box(state.get(b.id) as TickState)}] ${b.id} — ${b.title}${mark}  <!-- fp:${b.fp} -->\n`
    out += `${b.body}\n`
  }

  if (repro.failureRecipes) {
    out += `\n---\n\n## Failure recipes\n\n${repro.failureRecipes}\n`
  }
  return { md: out, report, scenes: blocks.length }
}

function buildVoice(episode: string, repo: string, doc: ScriptDoc): { md: string; blocks: number } {
  let out = `# VOICE — ${episode} (${repo})\n\n`
  out += `Сессия озвучки: только текст, в порядке чтения. Кью убраны.\n`
  out += `В поле у блока — ID сцен и ассетов, которые он покрывает (для монтажа).\n`
  out += `🎯 **НАИЗУСТЬ** — эти два блока выучить дословно.\n`

  let beat = ''
  doc.runs.forEach((run, i) => {
    if (run.beat !== beat) {
      beat = run.beat
      const mark = VERBATIM_BEATS.includes(beat) ? '  🎯 НАИЗУСТЬ' : ''
      out += `\n---\n\n## ${beat}${mark}\n`
    } else {
      out += `\n·  ·  ·\n` // scene separator inside a beat
    }
    out += `\n> → ${run.cueIds.length ? run.cueIds.join(' · ') : '—'}\n\n`
    out += run.lines.join('\n\n') + '\n'
  })
  return { md: out, blocks: doc.runs.length }
}

function buildMemeList(episode: string, repo: string, doc: ScriptDoc): { md: string; memes: number } {
  const cues = doc.cues.filter((c) => c.kind === 'meme')
  let out = `# MEME_LIST — ${episode} (${repo})\n\n`
  out += `Мем-подсказки и стоковые звуки. Скачивает host — авто-загрузки нет, только предложения\n`
  out += `и ссылки; финальный выбор за host'ом. ID (M<n>) — из script.md.\n\n## Мемы\n`
  for (const c of cues) {
    out += `\n### ${c.id}. Бит: ${c.beat}\n`
    out += `> Из сценария: ${c.raw}\n\n`
    out += `- **Мем:** <заполнить конкретным предложением>\n`
    out += `- **Источник:** <ссылка для скачивания>\n`
  }
  out += `\n${STOCK_SOUNDS}`
  return { md: out, memes: cues.length }
}

export type PrepResult =
  | { status: 'invalid'; errors: string[] }
  | { status: 'legacy' }
  | {
      status: 'written'
      scenes: number
      blocks: number
      memes: number
      memeScaffolded: boolean
      merge: MergeReport
    }

export function writePrepDocs(
  paths: { recordingPath: string; voicePath: string; memePath: string },
  content: { episode: string; repo: string; script: string; repro: string },
  opts: { force?: boolean } = {},
): PrepResult {
  const { episode, repo } = content
  const doc = parseScript(content.script)

  // A pre-#N episode is a statement, not an error: skip it, write nothing, and let the caller
  // exit 0 so an all-episodes wrapper never breaks on history.
  if (isLegacyScript(doc)) return { status: 'legacy' }

  const repro = parseRepro(content.repro)
  const errors = validateScript(
    doc,
    repro.scenes.map((s) => s.num),
  )
  // Nothing is written on a validation failure — no partial output, no clobbered docs.
  if (errors.length) return { status: 'invalid', errors }

  const previous = existsSync(paths.recordingPath) ? readFileSync(paths.recordingPath, 'utf8') : ''
  const rec = buildRecording(episode, repo, doc, repro, previous, opts.force === true)
  const voice = buildVoice(episode, repo, doc)
  const meme = buildMemeList(episode, repo, doc)

  writeFileSync(paths.recordingPath, rec.md)
  writeFileSync(paths.voicePath, voice.md)
  const memeExists = existsSync(paths.memePath)
  if (!memeExists) writeFileSync(paths.memePath, meme.md)

  return {
    status: 'written',
    scenes: rec.scenes,
    blocks: voice.blocks,
    memes: meme.memes,
    memeScaffolded: !memeExists,
    merge: rec.report,
  }
}

function main() {
  const episode = arg('--episode')
  if (!episode) throw new Error('--episode <id> is required')
  const force = process.argv.includes('--force')
  const repo = repoFromState(episode)

  const script = readFileSync(join('episodes', episode, 'script.md'), 'utf8')
  const reproPath = join('episodes', episode, 'REPRO.md')
  const reproExists = existsSync(reproPath)
  const repro = reproExists ? readFileSync(reproPath, 'utf8') : ''

  const assetsDir = join('episodes', episode, 'assets')
  mkdirSync(assetsDir, { recursive: true })

  const result = writePrepDocs(
    {
      recordingPath: join('episodes', episode, 'RECORDING.md'),
      voicePath: join('episodes', episode, 'VOICE.md'),
      memePath: join(assetsDir, 'MEME_LIST.md'),
    },
    { episode, repo, script, repro },
    { force },
  )

  if (result.status === 'legacy') {
    console.log(
      `[gen-prep-docs] ${episode}: script.md без ID-тегов (эпизод до введения #N) — ` +
        `миграция не проводилась, пропускаю. Ничего не записано.`,
    )
    return // exit 0 — a legacy episode is a statement, not a failure, even without REPRO.md
  }

  // Only a NON-legacy episode is actually blocked by a missing REPRO.md.
  if (!reproExists) {
    console.error(`[gen-prep-docs] ${episode}: нет REPRO.md — сначала /script (Step 3)`)
    process.exit(1)
  }

  if (result.status === 'invalid') {
    console.error(`[gen-prep-docs] ${episode}: script.md ↔ REPRO.md рассинхронизированы — ничего не записано:`)
    for (const e of result.errors) console.error(`  ✗ ${e}`)
    process.exit(1)
  }

  const { merge } = result
  console.log(`[gen-prep-docs] ${episode}:`)
  console.log(
    `  RECORDING.md  ${result.scenes} сцен` +
      (merge.carried.length ? ` · ${merge.carried.length} отметок перенесено` : ''),
  )
  // Surfaced HERE, at regeneration time: the host regenerates in the evening and opens
  // RECORDING.md at the next session. Mid-recording is the worst place to find a reset tick.
  for (const id of merge.reset) {
    console.log(`  ⟳ ${id}: сцена изменилась после отметки — отметка снята, переснять?`)
  }
  if (merge.dropped.length) {
    console.log(`  ⚠ отметки потеряны: ${merge.dropped.join(', ')} — этих сцен больше нет в script.md`)
  }
  console.log(`  VOICE.md      ${result.blocks} блоков`)
  console.log(
    `  assets/MEME_LIST.md  ` +
      (result.memeScaffolded ? `${result.memes} мем-кью, скаффолд создан` : `не тронут — уже существует`),
  )
}

// Run main only when invoked directly, not when imported by tests.
if (process.argv[1] && process.argv[1].endsWith('gen-prep-docs.ts')) main()
