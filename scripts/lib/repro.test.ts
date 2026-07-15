import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseRepro } from './repro'

const here = dirname(fileURLToPath(import.meta.url))
const MINI = readFileSync(join(here, '..', '__fixtures__', 'repro-mini.md'), 'utf8')

describe('parseRepro', () => {
  it('gathers <a id="scene-N"> anchors doc-wide — across ## User flow AND ## Evidence inserts', () => {
    // scene-1/2 live under ## User flow, scene-3 under ## Evidence inserts; all three parse.
    const { scenes } = parseRepro(MINI)
    expect(scenes.map((s) => s.num)).toEqual([1, 2, 3])
  })

  it('reads the scene number off the anchor, not off the physical order of the blocks', () => {
    // A REPRO whose anchors are physically out of order is doctrine-INVALID (the monotonic guard in
    // validateScript rejects it), but parseRepro itself is order-agnostic: the number always comes
    // off the anchor, so an out-of-order file still maps each block to its true N.
    const ooo = [
      '## User flow',
      '',
      '<a id="scene-2"></a>',
      '### FLOW 2 — второй  ·  _beat: Live_',
      '- **Do:** TWO',
      '',
      '<a id="scene-1"></a>',
      '### FLOW 1 — первый  ·  _beat: Live_',
      '- **Do:** ONE',
      '',
    ].join('\n')
    const { scenes } = parseRepro(ooo)
    expect(scenes.map((s) => s.num)).toEqual([2, 1]) // physical order preserved, nums off the anchors
    expect(scenes[0].title).toBe('второй')
    expect(scenes[1].title).toBe('первый')
  })

  it('reads each scene title and beat, whatever the header word (FLOW / EVIDENCE)', () => {
    const [s1, , s3] = parseRepro(MINI).scenes
    expect(s1.title).toBe('витрина репы')
    expect(s1.beat).toBe('Хук')
    expect(s3.title).toBe('приложение нотаризовано, коробка нет')
    expect(s3.beat).toBe('Живой тест')
  })

  it('splits a flow step into labelled bullets', () => {
    const s1 = parseRepro(MINI).scenes[0]
    expect(s1.bullets.map((b) => b.label)).toEqual(['Do', 'On screen', 'Wait/Cut', 'Reset'])
    expect(s1.bullets[0].body).toContain('открыть `https://github.com/o/r`')
  })

  it('does not let an evidence block bleed into the following ## Environment caveats section', () => {
    const s3 = parseRepro(MINI).scenes[2]
    expect(s3.bullets.map((b) => b.body).join('\n')).not.toContain('только в первом прогоне')
  })

  it('keeps a fenced code block inside its bullet, verbatim', () => {
    const s3 = parseRepro(MINI).scenes[2]
    const doBullet = s3.bullets.find((b) => b.label === 'Do')!
    expect(doBullet.body).toContain('```bash')
    expect(doBullet.body).toContain('spctl -a -vvv /Volumes/r/app.app')
    expect(doBullet.body).toContain('spctl -a -vvv -t open dist/quarantined.dmg')
    // the fence must not be mistaken for a new bullet or bleed into the next one
    expect(s3.bullets.find((b) => b.label === 'On screen')!.body).not.toContain('spctl')
  })

  // The ⚠️ on a label is the flag on the honesty-guard bullets ("что этот замер НЕ доказывает").
  // Matching it and then dropping it would strip the warning off the doc the host reads mid-shoot.
  it('captures the ⚠️ marker that leads a bullet LABEL, instead of swallowing it', () => {
    const s3 = parseRepro(MINI).scenes[2]
    const warn = s3.bullets.find((b) => b.label.startsWith('Чего этот вывод'))!
    expect(warn.mark).toBe('⚠️')
    expect(warn.label).toBe('Чего этот вывод НЕ доказывает') // the marker is not part of the label
    expect(warn.body).toContain('проверяем ровно две вещи')
    // an unmarked bullet carries no marker
    expect(s3.bullets.find((b) => b.label === 'Do')!.mark).toBe('')
  })

  it('carries an evidence insert’s Anchor bullet through', () => {
    // The Anchor bullet ("сразу после шага 2 …") tells the host WHERE in the flow the proof goes.
    const s3 = parseRepro(MINI).scenes[2]
    const anchor = s3.bullets.find((b) => b.label === 'Anchor')!
    expect(anchor.body).toContain('после того как Gatekeeper показал диалог')
  })

  it('captures the time budget, clean slate, env caveats and (off-camera) prepared states', () => {
    const d = parseRepro(MINI)
    expect(d.timeBudget).toBe('~30 мин на весь линейный дубль, если модели скачаны заранее.')
    expect(d.cleanSlate).toContain('rm -rf ~/Library/Application')
    expect(d.cleanSlate).toContain('com.apple.quarantine')
    expect(d.envCaveats).toContain('только в первом прогоне')
    expect(d.envCaveats).toContain('Gatekeeper')
    expect(d.preparedStates).toContain('МОДЕЛИ')
    expect(d.preparedStates).toContain('скачаны заранее')
  })

  it('does not leak HTML comments into any parsed section', () => {
    const d = parseRepro(MINI)
    expect(d.cleanSlate + d.envCaveats + d.preparedStates).not.toContain('<!--')
  })

  it('returns empty scenes for a REPRO with no anchors yet', () => {
    expect(parseRepro('# REPRO\n\n## User flow\n\nничего ещё нет\n').scenes).toEqual([])
  })
})
