import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { writePrepDocs } from './gen-prep-docs'

// Minimal script body with two [СКРИНКАСТ] cues and one [МЕМ] cue.
const SCRIPT = `# Сценарий: o/r — ГОДНОТА?

## Живой тест (основа)
[ГОЛОС] ...
[СКРИНКАСТ: показать чистую установку]
[МЕМ: сапёр осторожно тыкает в postinstall]
[СКРИНКАСТ: финальная строка — все тесты зелёные]
`

describe('writePrepDocs', () => {
  let dir: string
  let shotlistPath: string
  let memePath: string
  const content = { episode: 'ep', repo: 'o/r', md: SCRIPT }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'prep-docs-'))
    shotlistPath = join(dir, 'SHOTLIST.md')
    memePath = join(dir, 'MEME_LIST.md')
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('scaffolds MEME_LIST on first run and links each SHOTLIST item to its REPRO scene', () => {
    const r = writePrepDocs({ shotlistPath, memePath }, content)
    expect(r.memeScaffolded).toBe(true)
    expect(existsSync(memePath)).toBe(true)
    const shot = readFileSync(shotlistPath, 'utf8')
    expect(shot).toMatch(/1\..*REPRO\.md#scene-1/)
    expect(shot).toMatch(/2\..*REPRO\.md#scene-2/)
  })

  it('does NOT modify an edited MEME_LIST on re-run; SHOTLIST is always regenerated', () => {
    // First run scaffolds MEME_LIST.
    writePrepDocs({ shotlistPath, memePath }, content)

    // Host fills MEME_LIST by hand, then SHOTLIST is deleted to prove it gets rewritten.
    const edited = '# MEME_LIST — заполнено host\n\n- **Мем:** Futurama Fry (Not sure if…)\n'
    writeFileSync(memePath, edited)
    rmSync(shotlistPath)

    const r2 = writePrepDocs({ shotlistPath, memePath }, content)

    expect(r2.memeScaffolded).toBe(false)
    expect(readFileSync(memePath, 'utf8')).toBe(edited) // host edits untouched
    expect(existsSync(shotlistPath)).toBe(true) // derived doc regenerated
    expect(readFileSync(shotlistPath, 'utf8')).toMatch(/REPRO\.md#scene-1/)
  })
})
