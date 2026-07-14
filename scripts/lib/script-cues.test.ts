import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseScript, isLegacyScript, validateScript } from './script-cues'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = (name: string) => readFileSync(join(here, '..', '__fixtures__', name), 'utf8')

// Frozen snapshots — decoupled from the live episode files, which the host WILL edit.
const MINI = fixture('script-mini.md')
const LEGACY = fixture('script-ep001.md') // pre-#N script, no IDs anywhere

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

  it('leaves the association empty when a cue is adjacent to another cue, not to voice', () => {
    const byId = Object.fromEntries(parseScript(MINI).cues.map((c) => [c.id, c]))
    expect(byId['M1'].voiceBefore).toBe('') // preceded by cue #1
    expect(byId['A1'].voiceBefore).toBe('') // preceded by cue S1
    expect(byId['A1'].voiceAfter).toBe('И самое обидное — они почти всё сделали правильно.')
  })

  it('never associates across a beat heading', () => {
    const byId = Object.fromEntries(parseScript(MINI).cues.map((c) => [c.id, c]))
    // #1's run is the last thing in Хук; M1 closes the beat, so nothing follows it.
    expect(byId['M1'].voiceAfter).toBe('')
  })

  it('gives each voice run the IDs of the cues adjacent to it', () => {
    const { runs } = parseScript(MINI)
    expect(runs.map((r) => r.cueIds)).toEqual([
      ['#1'],          // Хук run, followed by #1
      ['#2'],          // "README обещает…", followed by #2
      ['#2', 'S1'],    // sits BETWEEN #2 and S1
      ['A1', '#3'],    // sits between A1 and #3
      ['#3'],          // "Приложение нотаризовано…", preceded by #3
      ['A2'],          // Вердикт run, followed by A2
    ])
  })

  it('keeps voice lines in reading order, one entry per [ГОЛОС]', () => {
    const { runs } = parseScript(MINI)
    expect(runs[0].beat).toBe('Хук')
    expect(runs[0].lines).toEqual([
      'Двадцать тысяч звёзд за неделю. В описании — три обещания.',
      'Я проверил все три. Начну с последнего.',
    ])
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
    expect(validateScript(parseScript(dup), scenes).length).toBeGreaterThan(0)
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
