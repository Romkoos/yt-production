import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { writePrepDocs } from './gen-prep-docs'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = (name: string) => readFileSync(join(here, '__fixtures__', name), 'utf8')

const SCRIPT = fixture('script-mini.md')
const REPRO = fixture('repro-mini.md')
const LEGACY = fixture('script-ep001.md')

describe('writePrepDocs', () => {
  let dir: string
  let paths: { recordingPath: string; voicePath: string; memePath: string }
  const content = { episode: 'ep-mini', repo: 'o/r', script: SCRIPT, repro: REPRO }

  const recording = () => readFileSync(paths.recordingPath, 'utf8')
  const voice = () => readFileSync(paths.voicePath, 'utf8')

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'prep-docs-'))
    paths = {
      recordingPath: join(dir, 'RECORDING.md'),
      voicePath: join(dir, 'VOICE.md'),
      memePath: join(dir, 'MEME_LIST.md'),
    }
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  describe('RECORDING.md — one file drives the screencast sitting', () => {
    it('writes a checkbox per scene, keyed by the script ID', () => {
      const r = writePrepDocs(paths, content)
      expect(r.status).toBe('written')
      expect(recording()).toMatch(/^- \[ \] #1 — витрина репы/m)
      expect(recording()).toMatch(/^- \[ \] #3 — приложение нотаризовано, коробка нет/m)
    })

    it('inlines the commands, on-screen and reset notes — no cross-file link needed', () => {
      writePrepDocs(paths, content)
      expect(recording()).toContain('spctl -a -vvv /Volumes/r/app.app')
      expect(recording()).toContain('**На экране:**')
      expect(recording()).toContain('**Reset:**')
      expect(recording()).not.toContain('REPRO.md#scene-') // no mid-session jumps
    })

    it('back-references the voice beat the scene plays under (the run TAIL)', () => {
      writePrepDocs(paths, content)
      expect(recording()).toContain(
        '**Звучит под:** «И самое обидное — они почти всё сделали правильно.»',
      )
      expect(recording()).toContain('**Дальше:** «Приложение нотаризовано.»')
    })

    it('carries the pre-flight material and the failure recipes verbatim', () => {
      writePrepDocs(paths, content)
      expect(recording()).toContain('~30 мин на 3 сцены')
      expect(recording()).toContain('READY-DMG')
      expect(recording()).toContain('Сцену 2 снимай ПЕРВОЙ')
      expect(recording()).toContain('xattr -w com.apple.quarantine')
    })

    it('groups scenes under their beat', () => {
      writePrepDocs(paths, content)
      expect(recording()).toMatch(/## Хук[\s\S]*#1[\s\S]*## Живой тест[\s\S]*#2/)
    })

    // Finding #1 (Task 2 review): a Do-bullet whose bash fence starts on the NEXT line comes
    // back from parseRepro with a LEADING BLANK LINE in its body. The emitter must trim it so
    // the fence lands directly under `**Делать:**` — no trailing space, no blank line between.
    it('emits a next-line fence body cleanly under **Делать:** — no blank line', () => {
      writePrepDocs(paths, content)
      expect(recording()).toMatch(/\*\*Делать:\*\*\n {4}```bash/)
      expect(recording()).not.toMatch(/\*\*Делать:\*\*[ \t]*\n[ \t]*\n/)
    })
  })

  describe('VOICE.md — one file drives the voice sitting', () => {
    it('contains the voice lines, stripped of every cue tag', () => {
      writePrepDocs(paths, content)
      expect(voice()).toContain('Двадцать тысяч звёзд за неделю.')
      expect(voice()).not.toContain('[ГОЛОС]')
      expect(voice()).not.toContain('[СКРИНКАСТ')
      expect(voice()).not.toContain('spctl')
    })

    it('gives each block a margin note with the IDs it covers', () => {
      writePrepDocs(paths, content)
      expect(voice()).toContain('→ #2 · S1') // the run between #2 and S1
      expect(voice()).toContain('→ A1 · #3')
    })

    it('marks the two learn-verbatim beats', () => {
      writePrepDocs(paths, content)
      expect(voice()).toMatch(/## Хук.*НАИЗУСТЬ/)
      expect(voice()).toMatch(/## Вердикт.*НАИЗУСТЬ/)
      expect(voice()).not.toMatch(/## Живой тест.*НАИЗУСТЬ/)
    })
  })

  describe('MEME_LIST.md — hand-edited scaffold', () => {
    it('scaffolds with M-ids on first run', () => {
      const r = writePrepDocs(paths, content)
      expect(r).toMatchObject({ status: 'written', memeScaffolded: true })
      expect(readFileSync(paths.memePath, 'utf8')).toMatch(/### M1\./)
    })

    it('never clobbers a filled-in MEME_LIST on re-run', () => {
      writePrepDocs(paths, content)
      const edited = '# MEME_LIST — заполнено host\n\n### M1.\n- **Мем:** Futurama Fry\n'
      writeFileSync(paths.memePath, edited)

      const r2 = writePrepDocs(paths, content)

      expect(r2).toMatchObject({ status: 'written', memeScaffolded: false })
      expect(readFileSync(paths.memePath, 'utf8')).toBe(edited)
    })
  })

  describe('tick carry-over', () => {
    const tick = (id: string) => {
      const md = recording().replace(new RegExp(`^- \\[ \\] ${id} `, 'm'), `- [x] ${id} `)
      writeFileSync(paths.recordingPath, md)
    }

    it('carries a tick through a regeneration when the scene is unchanged', () => {
      writePrepDocs(paths, content)
      tick('#2')

      const r = writePrepDocs(paths, content)

      expect(recording()).toMatch(/^- \[x\] #2 /m)
      expect(r).toMatchObject({ status: 'written', merge: { carried: ['#2'], reset: [], dropped: [] } })
    })

    it('RESETS the box and marks it when the scene changed since it was ticked', () => {
      writePrepDocs(paths, content)
      tick('#2')

      const changed = REPRO.replace(
        '- **On screen:** диалог macOS о том, что образ не может быть проверен.',
        '- **On screen:** совершенно другой диалог.',
      )
      const r = writePrepDocs(paths, { ...content, repro: changed })

      expect(recording()).toMatch(/^- \[ \] #2 .*⟳ сцена изменилась после отметки — переснять\?/m)
      expect(r).toMatchObject({ merge: { carried: [], reset: ['#2'], dropped: [] } })
    })

    it('does NOT reset when the host scribbles in the file — only derived content counts', () => {
      writePrepDocs(paths, content)
      tick('#2')
      writeFileSync(paths.recordingPath, recording() + '\n\nмоя заметка: снял со второго дубля\n')

      const r = writePrepDocs(paths, content)

      expect(r).toMatchObject({ merge: { carried: ['#2'], reset: [], dropped: [] } })
    })

    it('drops a tick whose scene no longer exists, and reports which', () => {
      writePrepDocs(paths, content)
      tick('#3')

      // Renumber: drop scene #1 from both docs, so the old #3 is now #2.
      const script2 = SCRIPT.replace(/\[СКРИНКАСТ #1:[^\]]*\]\n\n/, '')
        .replace('[СКРИНКАСТ #2:', '[СКРИНКАСТ #1:')
        .replace('[СКРИНКАСТ #3:', '[СКРИНКАСТ #2:')
      const repro2 = REPRO.replace(/<a id="scene-1"><\/a>[\s\S]*?(?=<a id="scene-2")/, '')
        .replace('<a id="scene-2">', '<a id="scene-1">')
        .replace('### SCENE 2 —', '### SCENE 1 —')
        .replace('<a id="scene-3">', '<a id="scene-2">')
        .replace('### SCENE 3 —', '### SCENE 2 —')

      const r = writePrepDocs(paths, { ...content, script: script2, repro: repro2 })

      // The tick is NOT silently migrated onto the scene that now wears #3's old number.
      expect(recording()).not.toMatch(/^- \[x\]/m)
      expect(r).toMatchObject({ merge: { carried: [], reset: [], dropped: ['#3'] } })
    })

    it('--force discards all tick state', () => {
      writePrepDocs(paths, content)
      tick('#2')

      const r = writePrepDocs(paths, content, { force: true })

      expect(recording()).not.toMatch(/^- \[x\]/m)
      expect(r).toMatchObject({ merge: { carried: [], reset: [], dropped: [] } })
    })
  })

  describe('validation — writes nothing on failure', () => {
    it('rejects a #N whose REPRO scene block was deleted, and writes nothing', () => {
      const repro2 = REPRO.replace(/<a id="scene-3"><\/a>[\s\S]*?(?=\n## Failure recipes)/, '')
      const r = writePrepDocs(paths, { ...content, repro: repro2 })

      expect(r.status).toBe('invalid')
      expect(r.status === 'invalid' && r.errors.join('\n')).toMatch(/#3/)
      expect(existsSync(paths.recordingPath)).toBe(false)
      expect(existsSync(paths.voicePath)).toBe(false)
      expect(existsSync(paths.memePath)).toBe(false)
    })

    it('rejects an ORPHAN REPRO scene block with no matching #N, and writes nothing', () => {
      const repro2 = REPRO.replace(
        '\n## Failure recipes',
        '\n<a id="scene-4"></a>\n### SCENE 4 — сирота  ·  _beat: Живой тест_\n- **Do:** ничего\n\n## Failure recipes',
      )
      const r = writePrepDocs(paths, { ...content, repro: repro2 })

      expect(r.status).toBe('invalid')
      expect(r.status === 'invalid' && r.errors.join('\n')).toMatch(/scene-4/)
      expect(existsSync(paths.recordingPath)).toBe(false)
    })

    it('does not clobber existing docs when validation fails', () => {
      writePrepDocs(paths, content)
      const before = recording()

      const repro2 = REPRO.replace(/<a id="scene-3"><\/a>[\s\S]*?(?=\n## Failure recipes)/, '')
      expect(writePrepDocs(paths, { ...content, repro: repro2 }).status).toBe('invalid')

      expect(recording()).toBe(before)
    })
  })

  describe('legacy episodes', () => {
    it('skips a pre-#N script without writing anything (and without erroring)', () => {
      const r = writePrepDocs(paths, { ...content, script: LEGACY })

      expect(r.status).toBe('legacy')
      expect(existsSync(paths.recordingPath)).toBe(false)
      expect(existsSync(paths.memePath)).toBe(false)
    })
  })
})
