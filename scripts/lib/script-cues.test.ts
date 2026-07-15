import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseScript, isLegacyScript, validateScript } from './script-cues'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = (name: string) => readFileSync(join(here, '..', '__fixtures__', name), 'utf8')

// Frozen snapshots — decoupled from the live episode files, which the host WILL edit.
const MINI = fixture('script-mini.md')
const LEGACY = fixture('script-legacy.md') // pre-#N script, no IDs anywhere

describe('parseScript — cue identity', () => {
  it('reads the ID off every cue kind and ignores the legend comment block', () => {
    const { cues } = parseScript(MINI)
    expect(cues.map((c) => c.id)).toEqual(['#1', 'M1', '#2', 'S1', 'A1', '#3', 'A2'])
    expect(cues.map((c) => c.kind)).toEqual([
      'screencast', 'meme', 'screencast', 'short', 'anim', 'screencast', 'anim',
    ])
    expect(cues.map((c) => c.num)).toEqual([1, 1, 2, 1, 1, 3, 2])
  })

  it('tags each cue with its beat heading, timing paren stripped', () => {
    const byId = Object.fromEntries(parseScript(MINI).cues.map((c) => [c.id, c]))
    expect(byId['#1'].beat).toBe('Хук')
    expect(byId['#3'].beat).toBe('Живой тест')
    expect(byId['A2'].beat).toBe('Вердикт')
  })
})

describe('parseScript — voice association', () => {
  it('quotes the TAIL of the preceding run — what sounds right before the scene cuts in', () => {
    const byId = Object.fromEntries(parseScript(MINI).cues.map((c) => [c.id, c]))
    // The preceding run's LAST sentence, not its first words.
    expect(byId['#3'].voiceBefore).toBe('И самое обидное — они почти всё сделали правильно.')
    expect(byId['#2'].voiceBefore).toBe('Давайте по шагам.')
  })

  it('quotes the HEAD of the following run — what the scene plays into', () => {
    const byId = Object.fromEntries(parseScript(MINI).cues.map((c) => [c.id, c]))
    expect(byId['#2'].voiceAfter).toBe('Образ не нотаризован.')
    expect(byId['#3'].voiceAfter).toBe('Приложение нотаризовано.')
  })

  it('walks past an intervening cue to the nearest voice run', () => {
    const byId = Object.fromEntries(parseScript(MINI).cues.map((c) => [c.id, c]))
    // M1 is preceded by cue #1, not by voice — it must still reach the Хук run behind it.
    expect(byId['M1'].voiceBefore).toBe('Начну с последнего.')
    // A1 is preceded by cue S1; S1 is followed by cue A1. Both look past it, to the same runs.
    expect(byId['A1'].voiceBefore).toBe('Первый же шаг инструкции не работает.')
    expect(byId['S1'].voiceBefore).toBe('Первый же шаг инструкции не работает.')
    expect(byId['A1'].voiceAfter).toBe('И самое обидное — они почти всё сделали правильно.')
    expect(byId['S1'].voiceAfter).toBe('И самое обидное — они почти всё сделали правильно.')
  })

  it('never associates across a beat heading', () => {
    const byId = Object.fromEntries(parseScript(MINI).cues.map((c) => [c.id, c]))
    // M1 closes the Хук beat: nothing but a heading follows it. The walk stops at the barrier.
    expect(byId['M1'].voiceAfter).toBe('')
    // #1's forward walk steps past M1 — and then hits the very same barrier.
    expect(byId['#1'].voiceAfter).toBe('')
    // A2 closes the document.
    expect(byId['A2'].voiceAfter).toBe('')
  })

  it('opens a beat on a cue: no voice behind it, but it still maps forward', () => {
    // The mirror of the barrier case above. A beat that starts with a cue (no [ГОЛОС] before it
    // in that beat) leaves «Звучит под» empty — RECORDING.md simply omits the line — but the cue
    // must still reach the run that FOLLOWS it, or its ID would vanish from the footage mapping.
    const md = [
      '## Хук',
      '[ГОЛОС] Реплика предыдущего бита.',
      '',
      '## Живой тест',
      '[СКРИНКАСТ #1: кадр, открывающий бит]',
      '[ГОЛОС] А вот теперь я говорю.',
    ].join('\n')

    const { cues, runs } = parseScript(md)
    const shot = cues.find((c) => c.id === '#1')!

    expect(shot.voiceBefore).toBe('') // the walk back stops at the beat heading — no borrowing
    expect(shot.voiceAfter).toBe('А вот теперь я говорю.')
    // and it is NOT orphaned: it lands in the following run's margin note
    expect(runs.find((r) => r.beat === 'Живой тест')!.cueIds).toEqual(['#1'])
    // the previous beat's run must not have picked it up across the barrier
    expect(runs.find((r) => r.beat === 'Хук')!.cueIds).toEqual([])
  })

  it('gives each voice run the IDs of every cue whose nearest run it is', () => {
    const { runs } = parseScript(MINI)
    expect(runs.map((r) => r.cueIds)).toEqual([
      ['#1', 'M1'],         // Хук run: #1 follows it, M1 follows #1 and looks back past it
      ['#2'],               // "README обещает…", followed by #2
      ['#2', 'S1', 'A1'],   // sits before the S1+A1 cue pair — three IDs on one run
      ['S1', 'A1', '#3'],   // the pair plays into it, and #3 looks back past nothing
      ['#3'],               // "Приложение нотаризовано…", preceded by #3
      ['A2'],               // Вердикт run, followed by A2
    ])
  })

  it('leaves NO cue out of the footage mapping — every ID lands in some run', () => {
    const { cues, runs } = parseScript(MINI)
    const mapped = new Set(runs.flatMap((r) => r.cueIds))
    const orphans = cues.filter((c) => c.id && !mapped.has(c.id)).map((c) => c.id)
    expect(orphans).toEqual([]) // an orphan cue is footage the editor can never place
  })

  it('keeps voice lines in reading order, one entry per [ГОЛОС]', () => {
    const { runs } = parseScript(MINI)
    expect(runs[0].beat).toBe('Хук')
    expect(runs[0].lines).toEqual([
      'Двадцать тысяч звёзд за неделю. В описании — три обещания.',
      'Я проверил все три. Начну с последнего.',
    ])
  })

  it('terminates a voice line at the "---" rule / next heading, not just the next cue (regression)', () => {
    // The final [ГОЛОС] of "Живой тест" is followed by a bare `---` and then `## Вердикт`,
    // with no cue in between. Neither may leak into the captured voice text.
    const { runs } = parseScript(MINI)
    const beatFinal = runs.find(
      (r) => r.beat === 'Живой тест' && r.lines[0]?.startsWith('Приложение нотаризовано'),
    )
    expect(beatFinal?.lines).toEqual(['Приложение нотаризовано. Забыли коробку, в которой оно лежит.'])
    expect(beatFinal?.lines.join(' ')).not.toMatch(/---/)
    expect(beatFinal?.lines.join(' ')).not.toMatch(/##/)
  })
})

describe('parseScript — quote truncation (WORD_CAP)', () => {
  // tailQuote/headQuote are module-private; exercise their truncation branches through the
  // public cue voiceBefore/voiceAfter fields instead of importing them directly.
  const RU_NUMS = [
    'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь',
    'девять', 'десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать',
  ]
  const withPeriod = (words: string[]) => [...words.slice(0, -1), `${words[words.length - 1]}.`]

  const TAIL_WORDS = withPeriod(RU_NUMS.slice(0, 14)) // 14 words > WORD_CAP (12)
  const HEAD_WORDS = withPeriod(RU_NUMS.slice(0, 15)) // 15 words > WORD_CAP (12)

  const CAP_SCRIPT = `## Тест (0–1 сек)

[ГОЛОС] ${TAIL_WORDS.join(' ')}

[СКРИНКАСТ #1: заглушка]

[ГОЛОС] ${HEAD_WORDS.join(' ')}
`

  it('truncates a long TAIL quote to the last WORD_CAP words with a leading ellipsis', () => {
    const { cues } = parseScript(CAP_SCRIPT)
    expect(cues[0].voiceBefore).toBe(`…${TAIL_WORDS.slice(-12).join(' ')}`)
  })

  it('truncates a long HEAD quote to the first WORD_CAP words with a trailing ellipsis', () => {
    const { cues } = parseScript(CAP_SCRIPT)
    expect(cues[0].voiceAfter).toBe(`${HEAD_WORDS.slice(0, 12).join(' ')}…`)
  })
})

describe('isLegacyScript', () => {
  it('is true for a pre-#N script — zero IDs on any cue', () => {
    expect(isLegacyScript(parseScript(LEGACY))).toBe(true)
  })

  it('is false for a migrated script', () => {
    expect(isLegacyScript(parseScript(MINI))).toBe(false)
  })

  it('is false for a HALF-migrated script — that is an error, not a legacy episode', () => {
    const half = MINI.replace('[СКРИНКАСТ #2:', '[СКРИНКАСТ:')
    expect(isLegacyScript(parseScript(half))).toBe(false)
  })
})

describe('validateScript', () => {
  const scenes = [1, 2, 3] // REPRO blocks matching MINI

  it('passes a consistent script', () => {
    expect(validateScript(parseScript(MINI), scenes)).toEqual([])
  })

  it('rejects a cue with no ID', () => {
    const half = MINI.replace('[СКРИНКАСТ #2:', '[СКРИНКАСТ:')
    const errors = validateScript(parseScript(half), scenes)
    expect(errors.join('\n')).toMatch(/без ID/)
  })

  it('rejects a gap in the numbering', () => {
    const gap = MINI.replace('[СКРИНКАСТ #3:', '[СКРИНКАСТ #4:')
    const errors = validateScript(parseScript(gap), [1, 2, 4])
    expect(errors.join('\n')).toMatch(/СКРИНКАСТ.*1\.\.3/s)
  })

  it('rejects a duplicate ID', () => {
    const dup = MINI.replace('[СКРИНКАСТ #3:', '[СКРИНКАСТ #2:')
    const errors = validateScript(parseScript(dup), scenes)
    expect(errors.length).toBeGreaterThan(0)
    // Must name the offending kind, not just fail for any reason.
    expect(errors.join('\n')).toMatch(/СКРИНКАСТ/)
  })

  it('rejects a #N with no REPRO scene block (script → REPRO direction)', () => {
    const errors = validateScript(parseScript(MINI), [1, 2]) // #3's block was deleted
    expect(errors.join('\n')).toMatch(/#3.*scene-3.*REPRO/s)
  })

  it('rejects an orphan REPRO scene block (REPRO → script direction)', () => {
    const errors = validateScript(parseScript(MINI), [1, 2, 3, 4]) // scene-4 has no cue
    expect(errors.join('\n')).toMatch(/scene-4.*script\.md/s)
  })

  it('validates the non-screencast kinds too', () => {
    const badMeme = MINI.replace('[МЕМ M1:', '[МЕМ M2:')
    expect(validateScript(parseScript(badMeme), scenes).join('\n')).toMatch(/МЕМ/)
  })
})
