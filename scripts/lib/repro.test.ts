import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseRepro } from './repro'

const here = dirname(fileURLToPath(import.meta.url))
const MINI = readFileSync(join(here, '..', '__fixtures__', 'repro-mini.md'), 'utf8')

describe('parseRepro', () => {
  it('reads the scene number off the anchor, not off the position in the file', () => {
    const { scenes } = parseRepro(MINI)
    expect(scenes.map((s) => s.num)).toEqual([1, 2, 3])
  })

  it('reads each scene title and beat', () => {
    const [s1, , s3] = parseRepro(MINI).scenes
    expect(s1.title).toBe('витрина репы')
    expect(s1.beat).toBe('Хук')
    expect(s3.title).toBe('приложение нотаризовано, коробка нет')
    expect(s3.beat).toBe('Живой тест')
  })

  it('splits a scene into labelled bullets', () => {
    const s1 = parseRepro(MINI).scenes[0]
    expect(s1.bullets.map((b) => b.label)).toEqual(['Do', 'On screen', 'Wait/Cut', 'Reset'])
    expect(s1.bullets[0].body).toContain('открыть `https://github.com/o/r`')
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

  it('carries an extra bullet (e.g. Failure recipe) through', () => {
    const s2 = parseRepro(MINI).scenes[1]
    expect(s2.bullets.map((b) => b.label)).toContain('Failure recipe')
  })

  it('captures the time budget, prepared states, scenes preamble and failure recipes', () => {
    const d = parseRepro(MINI)
    expect(d.timeBudget).toBe('~30 мин на 3 сцены, если модели скачаны заранее.')
    expect(d.preparedStates).toContain('READY-DMG')
    expect(d.preparedStates).toContain('флага карантина НЕТ')
    expect(d.scenesPreamble).toContain('Сцену 2 снимай ПЕРВОЙ')
    expect(d.failureRecipes).toContain('DMG не нотаризован')
    expect(d.failureRecipes).toContain('xattr -w com.apple.quarantine')
  })

  it('does not leak HTML comments into any parsed section', () => {
    const d = parseRepro(MINI)
    expect(d.preparedStates + d.scenesPreamble + d.failureRecipes).not.toContain('<!--')
  })

  it('returns empty scenes for a REPRO with no anchors yet', () => {
    expect(parseRepro('# REPRO\n\n## Scenes\n\nничего ещё нет\n').scenes).toEqual([])
  })
})
