import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { writePrepDocs, prepEpisode } from './gen-prep-docs'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = (name: string) => readFileSync(join(here, '__fixtures__', name), 'utf8')

const SCRIPT = fixture('script-mini.md')
const REPRO = fixture('repro-mini.md')
const LEGACY = fixture('script-legacy.md')

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

    it('builds the pre-flight from clean slate, one-shot caveats and off-camera prepared states', () => {
      writePrepDocs(paths, content)
      const r = recording()
      expect(r).toContain('~30 мин на весь линейный дубль') // recording time budget
      expect(r).toContain('## Чистый лист') // the wipe checklist on top
      expect(r).toContain('rm -rf ~/Library/Application') // clean-slate command, verbatim
      expect(r).toContain('ОДИН ДУБЛЬ') // the one-shot warning block
      expect(r).toContain('только в первом прогоне') // env caveat, verbatim
      expect(r).toContain('Заготовки') // demoted, off-camera-only prepared states
      expect(r).toContain('МОДЕЛИ')
      // No isolated failure-recipe footer, and no out-of-order shooting instruction — the break
      // now lives inside FLOW 2, in linear order.
      expect(r).not.toContain('## Failure recipes')
      expect(r).not.toContain('снимай ПЕРВОЙ')
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

    // Finding #3 (review): the bullet regex MATCHED a leading ⚠️ on a label but never re-emitted
    // it. Those are precisely the honesty-guard bullets ("чего этот вывод НЕ доказывает") — the
    // host must see the flag in the doc he reads mid-shoot, not only in REPRO.md.
    it('keeps the ⚠️ that leads a REPRO bullet label', () => {
      writePrepDocs(paths, content)
      expect(recording()).toContain('- ⚠️ **Чего этот вывод НЕ доказывает:** что подписана сама коробка')
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
      expect(voice()).toContain('→ #2 · S1 · A1') // the run between #2 and the S1+A1 cue pair
      expect(voice()).toContain('→ S1 · A1 · #3')
    })

    // A cue that follows another cue (M1 follows #1) still names a block — otherwise its ID would
    // appear NOWHERE in VOICE.md and the editor's footage mapping would be silently incomplete.
    it('names every cue ID at least once — a cue behind another cue is not dropped', () => {
      writePrepDocs(paths, content)
      const notes = voice()
        .split('\n')
        .filter((l) => l.startsWith('> → '))
        .join('\n')
      for (const id of ['#1', '#2', '#3', 'M1', 'S1', 'A1', 'A2']) expect(notes).toContain(id)
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
        .replace('### FLOW 2 —', '### FLOW 1 —')
        .replace('<a id="scene-3">', '<a id="scene-2">')
        .replace('### EVIDENCE 3 —', '### EVIDENCE 2 —')

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
      const repro2 = REPRO.replace(/<a id="scene-3"><\/a>[\s\S]*?(?=\n## Environment caveats)/, '')
      const r = writePrepDocs(paths, { ...content, repro: repro2 })

      expect(r.status).toBe('invalid')
      expect(r.status === 'invalid' && r.errors.join('\n')).toMatch(/#3/)
      expect(existsSync(paths.recordingPath)).toBe(false)
      expect(existsSync(paths.voicePath)).toBe(false)
      expect(existsSync(paths.memePath)).toBe(false)
    })

    it('rejects an ORPHAN REPRO scene block with no matching #N, and writes nothing', () => {
      const repro2 = REPRO.replace(
        '\n## Environment caveats',
        '\n<a id="scene-4"></a>\n### EVIDENCE 4 — сирота  ·  _beat: Живой тест_\n- **Do:** ничего\n\n## Environment caveats',
      )
      const r = writePrepDocs(paths, { ...content, repro: repro2 })

      expect(r.status).toBe('invalid')
      expect(r.status === 'invalid' && r.errors.join('\n')).toMatch(/scene-4/)
      expect(existsSync(paths.recordingPath)).toBe(false)
    })

    it('does not clobber existing docs when validation fails', () => {
      writePrepDocs(paths, content)
      const before = recording()

      const repro2 = REPRO.replace(/<a id="scene-3"><\/a>[\s\S]*?(?=\n## Environment caveats)/, '')
      expect(writePrepDocs(paths, { ...content, repro: repro2 }).status).toBe('invalid')

      expect(recording()).toBe(before)
    })
  })

  // Linear-take doctrine: the narrative order IS the shooting order, so the REPRO anchors must
  // ASCEND along the flow. A REPRO whose blocks are physically out of order (scene-2 before scene-1)
  // no longer reads top-to-bottom as the host records — the monotonic guard rejects it and writes
  // nothing, rather than silently generating a doc the host would shoot out of sequence.
  describe('monotonic guard — anchors must ascend along the flow', () => {
    const SCRIPT_OOO = [
      '# Сценарий: out-of-order test',
      '',
      '## Live test',
      '',
      '[СКРИНКАСТ #1: сцена раз]',
      '',
      '[СКРИНКАСТ #2: сцена два]',
      '',
    ].join('\n')

    const REPRO_OOO = [
      '# REPRO — out-of-order test',
      '',
      '## User flow',
      '',
      '<a id="scene-2"></a>',
      '### FLOW 2 — второй по счёту  ·  _beat: Live test_',
      '- **Do:** SCENE-TWO-MARKER',
      '',
      '<a id="scene-1"></a>',
      '### FLOW 1 — первый по счёту  ·  _beat: Live test_',
      '- **Do:** SCENE-ONE-MARKER',
      '',
    ].join('\n')

    it('rejects a REPRO whose anchors descend (2 before 1), and writes nothing', () => {
      const r = writePrepDocs(paths, { episode: 'ep-ooo', repo: 'o/r', script: SCRIPT_OOO, repro: REPRO_OOO })
      expect(r.status).toBe('invalid')
      expect(r.status === 'invalid' && r.errors.join('\n')).toMatch(/по возрастанию вдоль потока/)
      expect(existsSync(paths.recordingPath)).toBe(false)
      expect(existsSync(paths.voicePath)).toBe(false)
    })
  })

  // Finding #2 (review): the missing-REPRO guard used to run AFTER writePrepDocs. A script with no
  // [СКРИНКАСТ #N] cues gives validateScript nothing to cross-check, so it sailed through, got its
  // docs WRITTEN, and only then exited 1 — breaking the "writes nothing on failure" rule. The
  // guard's ORDER is the behaviour under test, so it is exercised through the CLI body.
  describe('prepEpisode — guard order (legacy first, then REPRO, then any write)', () => {
    let root: string
    const EP = 'ep-guard'
    const at = (...p: string[]) => join(root, EP, ...p)

    // Non-legacy (A1 carries an ID) and screencast-free: NOTHING for validateScript to reject.
    const NO_SHOTS = ['## Хук (0–15 сек)', '', '[ГОЛОС] Двадцать тысяч звёзд.', '', '[АНИМАЦИЯ A1: StarChart]', ''].join('\n')

    beforeEach(() => {
      root = mkdtempSync(join(tmpdir(), 'prep-cli-'))
      mkdirSync(join(root, EP), { recursive: true })
      vi.spyOn(console, 'log').mockImplementation(() => {})
      vi.spyOn(console, 'error').mockImplementation(() => {})
    })
    afterEach(() => {
      vi.restoreAllMocks()
      rmSync(root, { recursive: true, force: true })
    })

    const wroteNothing = () => {
      expect(existsSync(at('RECORDING.md'))).toBe(false)
      expect(existsSync(at('VOICE.md'))).toBe(false)
      expect(existsSync(at('assets', 'MEME_LIST.md'))).toBe(false)
    }

    it('fails a script with no screencast cues and no REPRO.md — BEFORE writing anything', () => {
      writeFileSync(at('script.md'), NO_SHOTS)

      expect(prepEpisode(EP, { root })).toBe(1)

      expect(console.error).toHaveBeenCalledWith(`[gen-prep-docs] ${EP}: нет REPRO.md — сначала /script (Step 3)`)
      wroteNothing()
    })

    it('still exits 0 on a LEGACY script with no REPRO.md — legacy wins over the REPRO guard', () => {
      writeFileSync(at('script.md'), LEGACY)

      expect(prepEpisode(EP, { root })).toBe(0)

      expect(console.error).not.toHaveBeenCalled()
      expect(vi.mocked(console.log).mock.calls.join('\n')).toMatch(/без ID-тегов/)
      wroteNothing()
    })

    it('writes the docs when the script and REPRO.md are both there and consistent', () => {
      writeFileSync(at('script.md'), SCRIPT)
      writeFileSync(at('REPRO.md'), REPRO)

      expect(prepEpisode(EP, { root })).toBe(0)

      expect(existsSync(at('RECORDING.md'))).toBe(true)
      expect(existsSync(at('VOICE.md'))).toBe(true)
      expect(existsSync(at('assets', 'MEME_LIST.md'))).toBe(true)
    })
  })

  describe('legacy episodes', () => {
    it('skips a pre-#N script without writing anything (and without erroring)', () => {
      const r = writePrepDocs(paths, { ...content, script: LEGACY })

      expect(r.status).toBe('legacy')
      expect(existsSync(paths.recordingPath)).toBe(false)
      expect(existsSync(paths.memePath)).toBe(false)
    })

    // Finding #1 (review): the CLI's legacy check must win over its missing-REPRO check, so a
    // legacy episode that also lacks a REPRO.md still exits clean. writePrepDocs's legacy check
    // runs before parseRepro (see gen-prep-docs.ts), so an empty repro string must be just as
    // safe as a real one — this is the unit-level half of that contract.
    it('returns legacy — and writes nothing — even when repro is the empty string', () => {
      const r = writePrepDocs(paths, { ...content, script: LEGACY, repro: '' })

      expect(r.status).toBe('legacy')
      expect(existsSync(paths.recordingPath)).toBe(false)
      expect(existsSync(paths.voicePath)).toBe(false)
      expect(existsSync(paths.memePath)).toBe(false)
    })
  })
})
