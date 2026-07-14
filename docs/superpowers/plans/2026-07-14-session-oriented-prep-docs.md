# Session-Oriented Prep Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every script cue a stable cross-document ID and replace `SHOTLIST.md` with two session-oriented derived docs — `RECORDING.md` (screencast sitting) and `VOICE.md` (voice sitting).

**Architecture:** `script.md` is the single source of cue identity (`#N`, `A<n>`, `M<n>`, `S<n>`). Three pure libs parse the inputs — `script-cues.ts` (cues + voice runs + validation), `repro.ts` (REPRO scene blocks), `recording-merge.ts` (fingerprints + tick carry-over) — and `gen-prep-docs.ts` assembles the derived docs from them. All parsing is pure and IO-free; only `gen-prep-docs.ts` touches the filesystem.

**Tech Stack:** TypeScript, Node 22, tsx, vitest. Package manager: pnpm.

**Spec:** `docs/superpowers/specs/2026-07-14-session-oriented-prep-docs-design.md`

## Global Constraints

- **Content language is Russian** for anything the host reads (doc bodies, generated headings, error messages the host sees). **Code and commit messages are English.**
- **Never write an `MM:SS`-style timecode** into any generated doc. Screencast cues are semantic (clock b).
- Cue ID forms, exactly: `[СКРИНКАСТ #N: …]`, `[АНИМАЦИЯ A<n>: …]`, `[МЕМ M<n>: …]`, `[SHORT cut S<n>: …]`. `[ГОЛОС]` takes no ID.
- IDs are sequential from **1** in document order, per kind. No gaps, no duplicates, no out-of-order.
- **Legacy scripts exit 0.** A script whose cues carry *zero* IDs is legacy (ep001): print the Russian skip message, write nothing, exit 0. A script with *some* IDs missing is a **validation error** (non-zero), not legacy.
- Validation failures write **nothing at all** — no partial output.
- Tests: `pnpm test` (vitest). Run it before every commit.
- Do NOT run `pnpm install` inside `remotion/` (it corrupts the root lockfile). This work does not touch `remotion/`.

---

## File Structure

**Create:**
- `scripts/lib/repro.ts` — parse `REPRO.md` into `{ timeBudget, preparedStates, scenesPreamble, scenes[], failureRecipes }`.
- `scripts/lib/repro.test.ts`
- `scripts/lib/recording-merge.ts` — payload fingerprints + tick carry-over rules.
- `scripts/lib/recording-merge.test.ts`
- `scripts/__fixtures__/script-mini.md` — synthetic ID-carrying script (3 scenes, 2 anims, 1 meme, 1 short).
- `scripts/__fixtures__/repro-mini.md` — its matching REPRO.
- `episodes/2026-07-ep002/RECORDING.md`, `episodes/2026-07-ep002/VOICE.md` — generated in Task 5.

**Modify:**
- `scripts/lib/script-cues.ts` — full rewrite: ID-carrying cues, voice runs, tail/head quotes, legacy detection, validation.
- `scripts/lib/script-cues.test.ts` — rewrite against the new API.
- `scripts/gen-prep-docs.ts` — build RECORDING + VOICE; `buildShotlist` deleted; `--force`.
- `scripts/gen-prep-docs.test.ts` — rewrite.
- `scripts/lib/flow.ts:48` and `:129` — manual-phase hint + `pnpm prep` row.
- `templates/script.md`, `templates/REPRO.md`, `.claude/commands/script.md`, `.claude/commands/assets.md`, `CLAUDE.md`, `README.md`.
- `episodes/2026-07-ep002/script.md` (add IDs), `assets/MEME_LIST.md` (M-headers), `STATE.md`.

**Delete:**
- `episodes/2026-07-ep002/SHOTLIST.md`.
- `episodes/2026-07-ep001/SHOTLIST.md` **stays** — frozen artifact of an unmigrated, already-recorded episode.

**Keep:** `scripts/__fixtures__/script-ep001.md` — the frozen legacy (no-ID) fixture; it now drives the legacy-detection test.

---

### Task 1: script-cues — IDs, voice runs, validation

**Files:**
- Modify: `scripts/lib/script-cues.ts` (full rewrite)
- Create: `scripts/__fixtures__/script-mini.md`
- Modify: `scripts/lib/script-cues.test.ts` (full rewrite)

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces:
  - `type CueKind = 'screencast' | 'anim' | 'meme' | 'short'`
  - `interface Cue { kind: CueKind; num: number | null; id: string; beat: string; raw: string; voiceBefore: string; voiceAfter: string }`
  - `interface VoiceRun { beat: string; lines: string[]; cueIds: string[] }`
  - `interface ScriptDoc { cues: Cue[]; runs: VoiceRun[] }`
  - `parseScript(md: string): ScriptDoc`
  - `isLegacyScript(doc: ScriptDoc): boolean`
  - `validateScript(doc: ScriptDoc, reproSceneNums: number[]): string[]` — returns Russian error messages; `[]` means valid.

The old `extractCues` / `extractScreencastCues` / `extractMemeCues` / `extractShortCuts` API is **removed**. Its only consumer is `gen-prep-docs.ts` (rewritten in Task 4) and this test file.

- [ ] **Step 1: Create the synthetic fixture**

Create `scripts/__fixtures__/script-mini.md`:

````markdown
# Сценарий: o/r — ХАЙП?

<!-- Tags:
     [ГОЛОС] voiceover line
     [СКРИНКАСТ #N: что показать] — shooting instruction (clock b), NOT a timecode
     [АНИМАЦИЯ A<n>: ...] Remotion scene cue
     [МЕМ M<n>: ...] meme cue
     [SHORT cut S<n>: <narrative beat>] — CANDIDATE Short (clock c). -->

## Хук (0–15 сек)

[ГОЛОС] Двадцать тысяч звёзд за неделю. В описании — три обещания.

[ГОЛОС] Я проверил все три. Начну с последнего.

[СКРИНКАСТ #1: страница репозитория, крупно строка описания]

[МЕМ M1: «this is fine» — пёс в горящей комнате]

---

## Живой тест (основа)

[ГОЛОС] README обещает четыре шага. Давайте по шагам.

[СКРИНКАСТ #2: двойной клик по dmg — Gatekeeper блокирует установку]

[ГОЛОС] Образ не нотаризован. Первый же шаг инструкции не работает.

[SHORT cut S1: первый шаг установки упирается в блок Gatekeeper]

[АНИМАЦИЯ A1: StarChart — рост звёзд]

[ГОЛОС] И самое обидное — они почти всё сделали правильно.

[СКРИНКАСТ #3: два вызова spctl подряд, оба вывода в одном кадре]

[ГОЛОС] Приложение нотаризовано. Забыли коробку, в которой оно лежит.

---

## Вердикт

[ГОЛОС] Хороший инструмент с вывеской громче, чем он есть.

[АНИМАЦИЯ A2: VerdictCard — ХАЙП]
````

The linear sequence this encodes (memorize it — the tests assert against it):

```
Хук:        run["Двадцать…", "Я проверил все три. Начну с последнего."] → #1 → M1
Живой тест: run["README обещает четыре шага. Давайте по шагам."] → #2
            → run["Образ не нотаризован. Первый же шаг инструкции не работает."] → S1 → A1
            → run["И самое обидное — они почти всё сделали правильно."] → #3
            → run["Приложение нотаризовано. Забыли коробку, в которой оно лежит."]
Вердикт:    run["Хороший инструмент с вывеской громче, чем он есть."] → A2
```

So `#3.voiceBefore` = `«И самое обидное — они почти всё сделали правильно.»` (the run's **tail**), and the run between `#2` and `S1` has `cueIds: ['#2', 'S1']`.

- [ ] **Step 2: Write the failing tests**

Replace `scripts/lib/script-cues.test.ts` entirely:

```ts
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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm vitest run scripts/lib/script-cues.test.ts`
Expected: FAIL — `parseScript` / `isLegacyScript` / `validateScript` are not exported.

- [ ] **Step 4: Rewrite `scripts/lib/script-cues.ts`**

```ts
// Pure parsing of a script.md body. script.md is the SINGLE source of cue identity:
// [СКРИНКАСТ #3], [АНИМАЦИЯ A1], [МЕМ M2], [SHORT cut S1]. Every derived doc (REPRO scene
// anchors, RECORDING.md, VOICE.md) reads its numbering from here — nothing counts positions.
// Also derives the voice↔cue association both session docs are built on. No IO.

export type CueKind = 'screencast' | 'anim' | 'meme' | 'short'

export interface Cue {
  kind: CueKind
  num: number | null // null = un-IDed (a legacy script, or a missed migration)
  id: string // '#3' | 'A1' | 'M2' | 'S1'; '' when num is null
  beat: string // the '## ' beat heading, timing paren stripped
  raw: string // cue description, whitespace-normalized to one line
  voiceBefore: string // TAIL of the preceding voice run — what sounds as the scene cuts in
  voiceAfter: string // HEAD of the following voice run — what the scene plays into
}

export interface VoiceRun {
  beat: string
  lines: string[]
  cueIds: string[] // ids of the cues adjacent to this run (the one before it, the one after it)
}

export interface ScriptDoc {
  cues: Cue[]
  runs: VoiceRun[]
}

interface KindDef {
  kind: CueKind
  tag: string
  prefix: string
}

const KINDS: KindDef[] = [
  { kind: 'screencast', tag: 'СКРИНКАСТ', prefix: '#' },
  { kind: 'anim', tag: 'АНИМАЦИЯ', prefix: 'A' },
  { kind: 'meme', tag: 'МЕМ', prefix: 'M' },
  { kind: 'short', tag: 'SHORT cut', prefix: 'S' },
]

const kindDef = (kind: CueKind): KindDef => KINDS.find((k) => k.kind === kind)!

// Remove HTML comment blocks so the legend's example tags aren't parsed as real cues.
const stripComments = (md: string): string => md.replace(/<!--[\s\S]*?-->/g, '')

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim()

type Tok =
  | { index: number; type: 'heading'; beat: string }
  | { index: number; type: 'voice'; text: string }
  | { index: number; type: 'cue'; kind: CueKind; num: number | null; raw: string }

function tokenize(md: string): Tok[] {
  const clean = stripComments(md)
  const toks: Tok[] = []

  for (const m of clean.matchAll(/^##\s+(.+)$/gm)) {
    // strip a trailing timing paren like " (0–15 сек)" for a clean beat label
    toks.push({ index: m.index, type: 'heading', beat: m[1].replace(/\s*\([^)]*\)\s*$/, '').trim() })
  }
  // A voice line runs until the next tag — so a wrapped line is captured whole.
  for (const m of clean.matchAll(/\[ГОЛОС\]\s*([^[]*)/g)) {
    toks.push({ index: m.index, type: 'voice', text: norm(m[1]) })
  }
  for (const { kind, tag, prefix } of KINDS) {
    const re = new RegExp(
      `\\[${escapeRegExp(tag)}(?:\\s*${escapeRegExp(prefix)}(\\d+))?:\\s*([^\\]]*)\\]`,
      'g',
    )
    for (const m of clean.matchAll(re)) {
      toks.push({ index: m.index, type: 'cue', kind, num: m[1] ? Number(m[1]) : null, raw: norm(m[2]) })
    }
  }
  return toks.sort((a, b) => a.index - b.index)
}

const WORD_CAP = 12

const sentences = (line: string): string[] =>
  line
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)

/** The TAIL of a run: its final sentence. What the host hears right before the scene cuts in. */
export function tailQuote(run: VoiceRun): string {
  const last = run.lines[run.lines.length - 1]
  if (!last) return ''
  const ss = sentences(last)
  const sentence = ss[ss.length - 1] ?? last
  const words = sentence.split(' ')
  return words.length <= WORD_CAP ? sentence : `…${words.slice(-WORD_CAP).join(' ')}`
}

/** The HEAD of a run: its opening sentence. What the scene plays into. */
export function headQuote(run: VoiceRun): string {
  const first = run.lines[0]
  if (!first) return ''
  const sentence = sentences(first)[0] ?? first
  const words = sentence.split(' ')
  return words.length <= WORD_CAP ? sentence : `${words.slice(0, WORD_CAP).join(' ')}…`
}

// The script as a linear sequence: voice runs, cues, and beat barriers. A cue associates with the
// run immediately before it and the run immediately after it — a heading is a hard barrier, so a
// cue never borrows voice from a different beat.
type Item = { t: 'run'; r: VoiceRun } | { t: 'cue'; c: Cue } | { t: 'break' }

export function parseScript(md: string): ScriptDoc {
  const cues: Cue[] = []
  const runs: VoiceRun[] = []
  const seq: Item[] = []
  let beat = ''
  let run: VoiceRun | null = null

  const closeRun = () => {
    if (run) runs.push(run)
    run = null
  }

  for (const tk of tokenize(md)) {
    if (tk.type === 'heading') {
      closeRun()
      seq.push({ t: 'break' })
      beat = tk.beat
      continue
    }
    if (tk.type === 'voice') {
      if (!run) {
        run = { beat, lines: [], cueIds: [] }
        seq.push({ t: 'run', r: run })
      }
      if (tk.text) run.lines.push(tk.text)
      continue
    }
    closeRun()
    const cue: Cue = {
      kind: tk.kind,
      num: tk.num,
      id: tk.num === null ? '' : `${kindDef(tk.kind).prefix}${tk.num}`,
      beat,
      raw: tk.raw,
      voiceBefore: '',
      voiceAfter: '',
    }
    cues.push(cue)
    seq.push({ t: 'cue', c: cue })
  }
  closeRun()

  seq.forEach((item, i) => {
    if (item.t !== 'cue') return
    const prev = seq[i - 1]
    const next = seq[i + 1]
    if (prev?.t === 'run') {
      item.c.voiceBefore = tailQuote(prev.r)
      if (item.c.id) prev.r.cueIds.push(item.c.id)
    }
    if (next?.t === 'run') {
      item.c.voiceAfter = headQuote(next.r)
      if (item.c.id) next.r.cueIds.push(item.c.id)
    }
  })

  return { cues, runs }
}

/** A legacy (pre-#N) script carries NO id on ANY cue. Half-migrated is not legacy — it's an
 *  error: skipping it silently would hide a botched migration behind an exit-0. */
export function isLegacyScript(doc: ScriptDoc): boolean {
  return doc.cues.length > 0 && doc.cues.every((c) => c.num === null)
}

/** Russian error messages for the host; [] means valid. `reproSceneNums` are the N's of the
 *  `<a id="scene-N">` blocks found in REPRO.md. */
export function validateScript(doc: ScriptDoc, reproSceneNums: number[]): string[] {
  const errors: string[] = []

  for (const c of doc.cues) {
    if (c.num === null) {
      errors.push(
        `cue без ID: [${kindDef(c.kind).tag}: ${c.raw.slice(0, 60)}…] — присвой ID ` +
          `(нумерация в порядке повествования, см. /script)`,
      )
    }
  }
  // Numbering and cross-doc checks are meaningless until every cue has an ID.
  if (errors.length) return errors

  for (const { kind, tag, prefix } of KINDS) {
    const nums = doc.cues.filter((c) => c.kind === kind).map((c) => c.num as number)
    const expected = nums.map((_, i) => i + 1)
    if (nums.join(',') !== expected.join(',')) {
      errors.push(
        `${tag}: ID должны идти 1..${nums.length} в порядке повествования, ` +
          `а в script.md: ${nums.map((n) => prefix + n).join(', ')}`,
      )
    }
  }

  const shots = doc.cues.filter((c) => c.kind === 'screencast').map((c) => c.num as number)
  const inRepro = new Set(reproSceneNums)
  for (const n of shots) {
    if (!inRepro.has(n)) {
      errors.push(`script.md: [СКРИНКАСТ #${n}] — нет блока <a id="scene-${n}"> в REPRO.md`)
    }
  }
  for (const n of reproSceneNums) {
    if (!shots.includes(n)) {
      errors.push(`REPRO.md: блок #scene-${n} — нет [СКРИНКАСТ #${n}] в script.md`)
    }
  }
  return errors
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run scripts/lib/script-cues.test.ts`
Expected: PASS (all tests). `pnpm test` will still fail — `gen-prep-docs.ts` imports the removed API. That's expected; Task 4 fixes it.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/script-cues.ts scripts/lib/script-cues.test.ts scripts/__fixtures__/script-mini.md
git commit -m "feat(script-cues): ID-carrying cues, voice runs, cross-doc validation"
```

---

### Task 2: REPRO parser

**Files:**
- Create: `scripts/lib/repro.ts`
- Create: `scripts/__fixtures__/repro-mini.md`
- Create: `scripts/lib/repro.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces:
  - `interface ReproBullet { label: string; body: string }` — `label: ''` means "a line carried verbatim".
  - `interface ReproScene { num: number; title: string; beat: string; bullets: ReproBullet[] }`
  - `interface ReproDoc { timeBudget: string; preparedStates: string; scenesPreamble: string; scenes: ReproScene[]; failureRecipes: string }`
  - `parseRepro(md: string): ReproDoc`

- [ ] **Step 1: Create the fixture**

Create `scripts/__fixtures__/repro-mini.md` (matches `script-mini.md`: scenes 1–3):

````markdown
# REPRO — ep-mini (o/r)

<!-- ownership comment that must not leak into the parsed output -->

**Repo:** https://github.com/o/r  ·  **Verdict:** ХАЙП  ·  **Sandbox:** `episodes/ep-mini/sandbox/r`
**Recording time budget:** ~30 мин на 3 сцены, если модели скачаны заранее.

---

## Prepared states

- **READY-APP** — `sandbox/run/app` — распаковано, запускается напрямую.
- **READY-DMG** — `sandbox/dist/app.dmg` — скачан через `gh`, флага карантина НЕТ.

---

## SETUP — zero to running (copy-paste)

```bash
# 1. Скачать релиз — ~10s, success: файл на диске
gh release download v1 --repo o/r --dir dist
```

---

## Scenes  <!-- one block per [СКРИНКАСТ] cue; script #N → #scene-N -->

⚠️ **Сцену 2 снимай ПЕРВОЙ по времени** — только браузер ставит флаг карантина.

<a id="scene-1"></a>
### SCENE 1 — витрина репы  ·  _beat: Хук_
- **Do:** открыть `https://github.com/o/r`, навести на строку описания.
- **On screen:** строка описания с тремя обещаниями + «20k stars».
- **Wait/Cut:** — (статичная страница)
- **Reset:** — (идемпотентно)

<a id="scene-2"></a>
### SCENE 2 — Gatekeeper блокирует установку  ·  _beat: Живой тест_
- **Do:** скачать dmg **браузером** → двойной клик в Finder.
- **On screen:** диалог macOS о том, что образ не может быть проверен.
- **Wait/Cut:** — (срабатывает мгновенно)
- **Reset:** файл должен сохранить флаг карантина.
- **Failure recipe:** см. «DMG не нотаризован» ниже.

<a id="scene-3"></a>
### SCENE 3 — приложение нотаризовано, коробка нет  ·  _beat: Живой тест_
- **Do:**
  ```bash
  spctl -a -vvv /Volumes/r/app.app
  spctl -a -vvv -t open dist/quarantined.dmg
  ```
- **On screen:** `accepted / Notarized` и `rejected / Unnotarized` в одном кадре.
- **Wait/Cut:** — (мгновенно). Оба вывода должны попасть в один кадр.
- **Reset:** — (идемпотентно)

---

## Failure recipes

- **DMG не нотаризован → Gatekeeper блокирует установку** — детерминированно:

  ```bash
  xattr -w com.apple.quarantine "0083;0;Safari;" quarantined.dmg
  spctl -a -vvv -t open quarantined.dmg
  ```
````

- [ ] **Step 2: Write the failing tests**

Create `scripts/lib/repro.test.ts`:

```ts
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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm vitest run scripts/lib/repro.test.ts`
Expected: FAIL — cannot resolve `./repro`.

- [ ] **Step 4: Write `scripts/lib/repro.ts`**

```ts
// Pure parsing of an episode's REPRO.md — the reproduction protocol (/review-repo writes the
// prepared states, SETUP and failure recipes; /script fills the scene blocks). RECORDING.md is
// assembled from these pieces verbatim, so the host never opens REPRO mid-session. REPRO stays
// the source of truth; RECORDING is disposable. No IO.

export interface ReproBullet {
  label: string // '' means: a line with no `- **Label:**` shape, carried verbatim
  body: string
}

export interface ReproScene {
  num: number // read off the <a id="scene-N"> anchor — never off the position in the file
  title: string
  beat: string
  bullets: ReproBullet[]
}

export interface ReproDoc {
  timeBudget: string
  preparedStates: string
  scenesPreamble: string // warnings that precede the first scene (e.g. "снимай сцену 2 первой")
  scenes: ReproScene[]
  failureRecipes: string
}

const stripComments = (md: string): string => md.replace(/<!--[\s\S]*?-->/g, '')

/** The body of a `## <heading>` section, up to the next `## `, with rule lines dropped. */
function section(md: string, heading: string): string {
  const lines = md.split('\n')
  const start = lines.findIndex((l) => l.startsWith(`## ${heading}`))
  if (start < 0) return ''
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      end = i
      break
    }
  }
  return lines
    .slice(start + 1, end)
    .join('\n')
    .replace(/^\s*---\s*$/gm, '')
    .trim()
}

const SCENE_ANCHOR = /<a id="scene-(\d+)"><\/a>/g
const SCENE_HEADER = /^###\s+SCENE\s+\d+\s*[—–-]\s*(.*?)(?:\s*·\s*_beat:\s*(.*?)_)?\s*$/m

function bullets(block: string): ReproBullet[] {
  const out: ReproBullet[] = []
  let cur: ReproBullet | null = null
  let inFence = false

  for (const raw of block.split('\n')) {
    const isFence = /^\s*```/.test(raw)
    const startsBullet = !inFence && !isFence && /^-\s/.test(raw)

    if (startsBullet) {
      if (cur) out.push(cur)
      // `- **Do:** …` / `- ⚠ **Что этот замер НЕ доказывает:** …`; anything else keeps label ''.
      const m = raw.match(/^-\s+(?:⚠️?\s*)?\*\*(.+?):\*\*\s?(.*)$/)
      cur = m ? { label: m[1].trim(), body: m[2] } : { label: '', body: raw }
    } else if (cur) {
      // continuation line: dedent the two spaces markdown needs under a bullet
      cur.body += '\n' + raw.replace(/^ {1,2}/, '')
    }
    if (isFence) inFence = !inFence
  }
  if (cur) out.push(cur)
  return out.map((b) => ({ label: b.label, body: b.body.trimEnd() }))
}

export function parseRepro(md: string): ReproDoc {
  const clean = stripComments(md)

  const budget = clean.match(/\*\*Recording time budget:\*\*\s*([\s\S]*?)(?:\n\s*\n|$)/)
  const scenesBody = section(clean, 'Scenes')

  const anchors = [...scenesBody.matchAll(SCENE_ANCHOR)]
  const scenesPreamble = (anchors.length ? scenesBody.slice(0, anchors[0].index) : scenesBody).trim()

  const scenes: ReproScene[] = anchors.map((a, i) => {
    const from = a.index + a[0].length
    const to = i + 1 < anchors.length ? anchors[i + 1].index : scenesBody.length
    const block = scenesBody.slice(from, to).trim()
    const header = block.match(SCENE_HEADER)
    const body = header ? block.slice(block.indexOf(header[0]) + header[0].length) : block
    return {
      num: Number(a[1]),
      title: (header?.[1] ?? '').trim(),
      beat: (header?.[2] ?? '').trim(),
      bullets: bullets(body),
    }
  })

  return {
    timeBudget: budget ? budget[1].replace(/\s+/g, ' ').trim() : '',
    preparedStates: section(clean, 'Prepared states'),
    scenesPreamble,
    scenes,
    failureRecipes: section(clean, 'Failure recipes'),
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run scripts/lib/repro.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/repro.ts scripts/lib/repro.test.ts scripts/__fixtures__/repro-mini.md
git commit -m "feat(repro): parse REPRO.md scene blocks, prepared states and failure recipes"
```

---

### Task 3: Tick carry-over

**Files:**
- Create: `scripts/lib/recording-merge.ts`
- Create: `scripts/lib/recording-merge.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces:
  - `fingerprint(payload: string): string` — 8 hex chars of sha256.
  - `interface OldTick { ticked: boolean; fp: string }`
  - `parseRecordingTicks(md: string): Map<string, OldTick>` — reads a previously generated `RECORDING.md`.
  - `type TickState = 'ticked' | 'reset' | 'open'`
  - `interface MergeReport { carried: string[]; reset: string[]; dropped: string[] }`
  - `mergeTicks(scenes: { id: string; fp: string }[], old: Map<string, OldTick>): { state: Map<string, TickState>; report: MergeReport }`

The checkbox line format this module reads and `gen-prep-docs` writes:

```
- [x] #3 — приложение нотаризовано, коробка нет  <!-- fp:a91c40de -->
```

- [ ] **Step 1: Write the failing tests**

Create `scripts/lib/recording-merge.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { fingerprint, parseRecordingTicks, mergeTicks } from './recording-merge'

const line = (mark: string, id: string, fp: string, title = 'сцена') =>
  `- [${mark}] ${id} — ${title}  <!-- fp:${fp} -->`

describe('fingerprint', () => {
  it('is stable and 8 hex chars', () => {
    expect(fingerprint('payload')).toMatch(/^[0-9a-f]{8}$/)
    expect(fingerprint('payload')).toBe(fingerprint('payload'))
  })

  it('changes when the payload changes', () => {
    expect(fingerprint('a')).not.toBe(fingerprint('b'))
  })
})

describe('parseRecordingTicks', () => {
  it('reads the tick state and fingerprint of every scene box', () => {
    const md = [line('x', '#1', 'aaaaaaaa'), line(' ', '#2', 'bbbbbbbb')].join('\n')
    const ticks = parseRecordingTicks(md)
    expect(ticks.get('#1')).toEqual({ ticked: true, fp: 'aaaaaaaa' })
    expect(ticks.get('#2')).toEqual({ ticked: false, fp: 'bbbbbbbb' })
  })

  it('ignores checkboxes that are not scene boxes', () => {
    expect(parseRecordingTicks('- [x] купить кофе\n').size).toBe(0)
  })

  it('returns an empty map for a file that does not exist yet (empty string)', () => {
    expect(parseRecordingTicks('').size).toBe(0)
  })
})

describe('mergeTicks', () => {
  const old = new Map([
    ['#1', { ticked: true, fp: 'aaaaaaaa' }],
    ['#2', { ticked: true, fp: 'bbbbbbbb' }],
    ['#3', { ticked: false, fp: 'cccccccc' }],
  ])

  it('carries a tick when the ID matches AND the scene is unchanged', () => {
    const { state, report } = mergeTicks([{ id: '#1', fp: 'aaaaaaaa' }], old)
    expect(state.get('#1')).toBe('ticked')
    expect(report.carried).toEqual(['#1'])
    expect(report.reset).toEqual([])
  })

  it('RESETS a tick when the scene content changed since it was ticked', () => {
    // A ticked box on changed content would claim footage exists for a scene that no longer
    // matches it.
    const { state, report } = mergeTicks([{ id: '#2', fp: 'ZZZZZZZZ' }], old)
    expect(state.get('#2')).toBe('reset')
    expect(report.reset).toEqual(['#2'])
    expect(report.carried).toEqual([])
  })

  it('leaves an unticked box open regardless of fingerprint', () => {
    const { state, report } = mergeTicks([{ id: '#3', fp: 'dddddddd' }], old)
    expect(state.get('#3')).toBe('open')
    expect(report.reset).toEqual([])
  })

  it('drops a tick whose scene ID is gone — never guesses a new home for it', () => {
    // Renumbering safety: #1 and #2 were ticked; the new script only has #9.
    const { state, report } = mergeTicks([{ id: '#9', fp: 'aaaaaaaa' }], old)
    expect(state.get('#9')).toBe('open') // same fp as old #1, but a DIFFERENT scene — no carry
    expect(report.dropped).toEqual(['#1', '#2'])
    expect(report.carried).toEqual([])
  })

  it('reports nothing when there is no previous file', () => {
    const { state, report } = mergeTicks([{ id: '#1', fp: 'aaaaaaaa' }], new Map())
    expect(state.get('#1')).toBe('open')
    expect(report).toEqual({ carried: [], reset: [], dropped: [] })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run scripts/lib/recording-merge.test.ts`
Expected: FAIL — cannot resolve `./recording-merge`.

- [ ] **Step 3: Write `scripts/lib/recording-merge.ts`**

```ts
// Tick carry-over for the regenerated RECORDING.md. The host ticks scene boxes DURING a session;
// a regeneration must never silently destroy that progress — nor keep a tick on a scene whose
// content changed (that would claim footage exists for a scene that no longer matches it).
//
// Matching is BY SCENE ID, never by position: if scenes were inserted or removed, an orphaned
// tick is dropped and reported, never migrated onto a different scene.
//
// The fingerprint covers the DERIVED payload (title + commands + on-screen + wait/cut + reset +
// voice refs), not the raw file text — so the host's own scribbles inside a block never read as
// "the scene changed". No IO.

import { createHash } from 'node:crypto'

export function fingerprint(payload: string): string {
  return createHash('sha256').update(payload).digest('hex').slice(0, 8)
}

export interface OldTick {
  ticked: boolean
  fp: string
}

// `- [x] #3 — приложение нотаризовано, коробка нет  <!-- fp:a91c40de -->`
const BOX = /^- \[([ xX])\]\s+(#\d+)\b.*?<!--\s*fp:([0-9a-f]{8})\s*-->/gm

export function parseRecordingTicks(md: string): Map<string, OldTick> {
  const out = new Map<string, OldTick>()
  for (const m of md.matchAll(BOX)) {
    out.set(m[2], { ticked: m[1].toLowerCase() === 'x', fp: m[3] })
  }
  return out
}

export type TickState = 'ticked' | 'reset' | 'open'

export interface MergeReport {
  carried: string[]
  reset: string[]
  dropped: string[]
}

export function mergeTicks(
  scenes: { id: string; fp: string }[],
  old: Map<string, OldTick>,
): { state: Map<string, TickState>; report: MergeReport } {
  const state = new Map<string, TickState>()
  const report: MergeReport = { carried: [], reset: [], dropped: [] }

  for (const s of scenes) {
    const prev = old.get(s.id)
    if (prev?.ticked && prev.fp === s.fp) {
      state.set(s.id, 'ticked')
      report.carried.push(s.id)
    } else if (prev?.ticked) {
      state.set(s.id, 'reset')
      report.reset.push(s.id)
    } else {
      state.set(s.id, 'open')
    }
  }

  const live = new Set(scenes.map((s) => s.id))
  for (const [id, prev] of old) {
    if (prev.ticked && !live.has(id)) report.dropped.push(id)
  }
  return { state, report }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run scripts/lib/recording-merge.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/recording-merge.ts scripts/lib/recording-merge.test.ts
git commit -m "feat(recording): fingerprint-guarded tick carry-over"
```

---

### Task 4: gen-prep-docs — RECORDING.md + VOICE.md, SHOTLIST removed

**Files:**
- Modify: `scripts/gen-prep-docs.ts` (rewrite)
- Modify: `scripts/gen-prep-docs.test.ts` (rewrite)

**Interfaces:**
- Consumes: `parseScript`, `isLegacyScript`, `validateScript` (Task 1); `parseRepro` (Task 2); `fingerprint`, `parseRecordingTicks`, `mergeTicks` (Task 3).
- Produces:
  - `type PrepResult = { status: 'invalid'; errors: string[] } | { status: 'legacy' } | { status: 'written'; scenes: number; blocks: number; memes: number; memeScaffolded: boolean; merge: MergeReport }`
  - `writePrepDocs(paths: { recordingPath: string; voicePath: string; memePath: string }, content: { episode: string; repo: string; script: string; repro: string }, opts?: { force?: boolean }): PrepResult`

Regeneration policy, encoded here:
- `RECORDING.md` — always rewritten; ticks merged from the previous file (unless `force`).
- `VOICE.md` — always rewritten (no ticks, no hand-edits).
- `assets/MEME_LIST.md` — write-if-missing (host fills it by hand). Unchanged from today, except scaffold headers now carry `M<n>` IDs.
- `status: 'invalid'` and `status: 'legacy'` write **nothing**.

- [ ] **Step 1: Write the failing tests**

Replace `scripts/gen-prep-docs.test.ts` entirely:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run scripts/gen-prep-docs.test.ts`
Expected: FAIL — `writePrepDocs` has the old signature / `buildShotlist` still imported.

- [ ] **Step 3: Rewrite `scripts/gen-prep-docs.ts`**

```ts
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
    if (!b.label) {
      lines.push(`  ${indent(b.body, '  ')}`)
      continue
    }
    lines.push(`  - **${LABELS[b.label] ?? b.label}:** ${indent(b.body, '    ')}`)
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
  if (!existsSync(reproPath)) {
    console.error(`[gen-prep-docs] ${episode}: нет REPRO.md — сначала /script (Step 3)`)
    process.exit(1)
  }
  const repro = readFileSync(reproPath, 'utf8')

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
    return // exit 0 — a legacy episode is a statement, not a failure
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run scripts/gen-prep-docs.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `pnpm test`
Expected: PASS — every suite. (`script-cues.test.ts`, `repro.test.ts`, `recording-merge.test.ts`, `gen-prep-docs.test.ts`, plus the pre-existing `flow`, `episode-id`, `init-episode`, `thumb-*`, `star-history`, `workspace-hygiene` suites.)

- [ ] **Step 6: Commit**

```bash
git add scripts/gen-prep-docs.ts scripts/gen-prep-docs.test.ts
git commit -m "feat(prep): RECORDING.md + VOICE.md session docs; drop SHOTLIST"
```

---

### Task 5: Migrate ep002 and regenerate its docs

**Files:**
- Modify: `episodes/2026-07-ep002/script.md` (add IDs)
- Modify: `episodes/2026-07-ep002/assets/MEME_LIST.md` (M-headers — hand-filled file, generator won't touch it)
- Modify: `episodes/2026-07-ep002/STATE.md`
- Delete: `episodes/2026-07-ep002/SHOTLIST.md`
- Generated: `episodes/2026-07-ep002/RECORDING.md`, `episodes/2026-07-ep002/VOICE.md`

**Interfaces:**
- Consumes: `pnpm prep` (Task 4).
- Produces: nothing code-facing. This is the spec's acceptance criteria #2 and #3.

ep002's `REPRO.md` already has `<a id="scene-1..9">` anchors in the same order as the script's screencast cues, so the IDs are a pure relabel — **no reordering**.

- [ ] **Step 1: Add IDs to ep002's script**

Edit `episodes/2026-07-ep002/script.md`. The mapping (document order — verify each against the file before editing):

| Line | Old tag | New tag |
|---|---|---|
| Хук | `[СКРИНКАСТ: страница репозитория на GitHub…` | `[СКРИНКАСТ #1: страница репозитория на GitHub…` |
| Хук | `[МЕМ: «this is fine»…` | `[МЕМ M1: «this is fine»…` |
| Что за репо | `[АНИМАЦИЯ: StarChart — рост звёзд]` | `[АНИМАЦИЯ A1: StarChart — рост звёзд]` |
| Живой тест | `[СКРИНКАСТ: скачать dmg с GitHub Releases…` | `[СКРИНКАСТ #2: скачать dmg с GitHub Releases…` |
| Живой тест | `[SHORT cut: README обещает четыре шага…` | `[SHORT cut S1: README обещает четыре шага…` |
| Живой тест | `[СКРИНКАСТ: в терминале два вызова spctl…` | `[СКРИНКАСТ #3: в терминале два вызова spctl…` |
| Живой тест | `[МЕМ: «you had one job»]` | `[МЕМ M2: «you had one job»]` |
| Живой тест | `[СКРИНКАСТ: запуск meetily из терминала…` | `[СКРИНКАСТ #4: запуск meetily из терминала…` |
| Живой тест | `[СКРИНКАСТ: приложение запущено, рядом в терминале lsof…` | `[СКРИНКАСТ #5: приложение запущено, рядом в терминале lsof…` |
| Живой тест | `[SHORT cut: приложение обещает приватность…` | `[SHORT cut S2: приложение обещает приватность…` |
| Живой тест | `[СКРИНКАСТ: импорт одного и того же аудиофайла…` | `[СКРИНКАСТ #6: импорт одного и того же аудиофайла…` |
| Где README врёт | `[СКРИНКАСТ: strings по бинарю с грепом…` | `[СКРИНКАСТ #7: strings по бинарю с грепом…` |
| Где README врёт | `[СКРИНКАСТ: git log с поиском по строке миграции…` | `[СКРИНКАСТ #8: git log с поиском по строке миграции…` |
| Где README врёт | `[СКРИНКАСТ: рядом в одном кадре — строка описания репы…` | `[СКРИНКАСТ #9: рядом в одном кадре — строка описания репы…` |
| Где README врёт | `[SHORT cut: главная фича из описания репы не существует…` | `[SHORT cut S3: главная фича из описания репы не существует…` |
| Где README врёт | `[МЕМ: «hidden paywall»…` | `[МЕМ M3: «hidden paywall»…` |
| Вердикт | `[АНИМАЦИЯ: VerdictCard — ХАЙП]` | `[АНИМАЦИЯ A2: VerdictCard — ХАЙП]` |

Also update the tag legend comment at the top of the file to the ID forms (copy the legend from `templates/script.md` as updated in Task 6 — or just apply the same four lines):

```
<!-- Tags:
     [ГОЛОС] voiceover line
     [СКРИНКАСТ #N: что показать] — shooting instruction (clock b), NOT a timecode.
        N is assigned in narrative order and is the SINGLE source of scene identity:
        REPRO.md's #scene-N and RECORDING.md both derive from it.
     [АНИМАЦИЯ A<n>: ...] Remotion scene cue
     [МЕМ M<n>: ...] meme cue
     [SHORT cut S<n>: <narrative beat>] — CANDIDATE Short (clock c). Real final-video
        timecodes are reconciled after the Resolve edit; /cut-shorts uses THOSE. -->
```

Sanity check after editing — the counts must be 9 / 2 / 3 / 3:

```bash
grep -c 'СКРИНКАСТ #' episodes/2026-07-ep002/script.md   # 9
grep -c 'АНИМАЦИЯ A'  episodes/2026-07-ep002/script.md   # 2
grep -c 'МЕМ M'       episodes/2026-07-ep002/script.md   # 3
grep -c 'SHORT cut S' episodes/2026-07-ep002/script.md   # 3
```

- [ ] **Step 2: Add M-ids to the hand-filled MEME_LIST**

`episodes/2026-07-ep002/assets/MEME_LIST.md` is hand-filled (real suggestions + sources) and the generator never overwrites it — so its headers are edited by hand:

- `### 1. Бит: Хук` → `### M1. Бит: Хук`
- `### 2. Бит: Живой тест` → `### M2. Бит: Живой тест`
- `### 3. Бит: Где README врёт` → `### M3. Бит: Где README врёт`

Leave every `**Мем:**` / `**Источник:**` body untouched.

- [ ] **Step 3: Delete SHOTLIST and regenerate**

```bash
git rm episodes/2026-07-ep002/SHOTLIST.md
pnpm prep -- --episode 2026-07-ep002
```

Expected output (9 scenes, no ticks yet, MEME_LIST untouched):

```
[gen-prep-docs] 2026-07-ep002:
  RECORDING.md  9 сцен
  VOICE.md      <N> блоков
  assets/MEME_LIST.md  не тронут — уже существует
```

If instead you get `✗` validation errors, the script IDs and REPRO anchors disagree — fix the script (Step 1), do **not** touch `REPRO.md`'s anchors.

- [ ] **Step 4: Verify the legacy episode still exits 0**

```bash
pnpm prep -- --episode 2026-07-ep001; echo "exit=$?"
```

Expected: the Russian "миграция не проводилась" line, `exit=0`, and **no** `RECORDING.md`/`VOICE.md` created under `episodes/2026-07-ep001/`:

```bash
ls episodes/2026-07-ep001/RECORDING.md 2>/dev/null && echo "BUG: legacy episode was written to"
```

- [ ] **Step 5: Eyeball the generated docs**

Read `episodes/2026-07-ep002/RECORDING.md` and `episodes/2026-07-ep002/VOICE.md` and confirm by hand:
- Every `#N` box (1–9) is present, in beat order, with its commands inline.
- `#3`'s box carries `**Звучит под:** «И самое обидное — они почти всё сделали правильно.»`
- The Gatekeeper warning ("Сцену 2 снимай ПЕРВОЙ") and the prepared states are in Pre-flight.
- The failure recipes are at the bottom of RECORDING.md, verbatim.
- VOICE.md has no `[ГОЛОС]` markers, no commands, and the Хук/Вердикт blocks are marked 🎯 НАИЗУСТЬ.
- No `MM:SS`-style timecode anywhere in either file.

- [ ] **Step 6: Update ep002's STATE.md**

In `episodes/2026-07-ep002/STATE.md`:
- `## Artifacts`: replace the `SHOTLIST.md (9 кадров) в корне эпизода` mention with `RECORDING.md (9 сцен) + VOICE.md в корне эпизода`.
- `## Next action` checklist: replace
  `- [ ] Скринкаст: снять по SHOTLIST.md → REPRO.md (точные команды/что на экране/WAIT-CUT)`
  with two lines:
  ```
  - [ ] Голос: записать озвучку по VOICE.md (хук и вердикт — наизусть)
  - [ ] Скринкаст: снять по RECORDING.md (команды/что на экране/WAIT-CUT — всё внутри)
  ```
  and delete the now-duplicated `- [ ] Голос: записать озвучку по script.md` line.
- `updated:` → `2026-07-14`.

- [ ] **Step 7: Commit**

```bash
git add -A episodes/2026-07-ep002
git commit -m "feat(ep002): migrate to cue IDs; RECORDING.md + VOICE.md replace SHOTLIST"
```

---

### Task 6: Docs, templates and commands

**Files:**
- Modify: `templates/script.md`, `templates/REPRO.md`
- Modify: `.claude/commands/script.md`, `.claude/commands/assets.md`
- Modify: `CLAUDE.md`, `README.md:68`, `scripts/lib/flow.ts:48` and `:129`

**Interfaces:**
- Consumes: the behavior built in Tasks 1–4.
- Produces: nothing code-facing.

- [ ] **Step 1: `templates/script.md` — ID forms in the legend**

Replace the tag-legend comment block with the ID-carrying version (identical to the one used in Task 5, Step 1), and update the body's example tags so a copied template already shows the shape:

```markdown
## Хук (0–15 сек)
[ГОЛОС] ...
[СКРИНКАСТ #1: ...]

## Что это за репо (15–60 сек)
[ГОЛОС] ...
[АНИМАЦИЯ A1: StarChart — рост звёзд]

## Живой тест (основа)
[ГОЛОС] ...
[СКРИНКАСТ #2: ...]
[SHORT cut S1: <the funniest failure beat>]

## Где README врёт
[ГОЛОС] ...

## Вердикт
[ГОЛОС] ...
[АНИМАЦИЯ A2: VerdictCard — {{VERDICT}}]
```

- [ ] **Step 2: `templates/REPRO.md` — anchors derive from the script's `#N`**

Change the `## Scenes` heading comment and the guidance block under it:

```markdown
## Scenes  <!-- one block per [СКРИНКАСТ #N] cue; the anchor N IS the script's N -->

<!-- /script fills these. The anchor <a id="scene-N"></a> takes its N from the script's
     [СКРИНКАСТ #N] tag — it is NOT a positional counter. `pnpm prep` hard-fails if a #N has no
     block here, or a block here has no #N in script.md. RECORDING.md is assembled from these
     blocks verbatim, so write them for someone who will not open this file mid-session. -->
```

Also update the ownership comment at the top: `/script fills ## Scenes (one block per [СКРИНКАСТ #N] cue)`.

- [ ] **Step 3: `.claude/commands/script.md` — assign IDs at generation**

In the **Tags** list of Step 2, replace the four cue bullets with the ID-carrying forms, and add the numbering rule:

```markdown
**Cue IDs — assign them as you write.** `script.md` is the SINGLE source of cue identity; every
other doc (REPRO's `#scene-N` anchors, RECORDING.md, VOICE.md, MEME_LIST.md) derives its numbering
from here. Number each kind sequentially from 1, in narrative (document) order:

- `[ГОЛОС]` — a voiceover line. No ID.
- `[СКРИНКАСТ #N: <what to show>]` — SEMANTIC shooting instruction (clock b). `#1, #2, #3…`
- `[АНИМАЦИЯ A<n>: ...]` — Remotion scene cue. `A1, A2…`
- `[МЕМ M<n>: ...]` — meme cue. `M1, M2…`
- `[SHORT cut S<n>: <narrative beat>]` — CANDIDATE Short (clock c). `S1, S2…`

No gaps, no duplicates, no out-of-order numbers — `pnpm prep` hard-fails on all three.
```

In **Step 3** (REPRO scenes), replace the positional-counting paragraph:

```markdown
- **`## Scenes`** — write **one block per `[СКРИНКАСТ #N]` cue**, in shooting order. The block for
  cue `#N` carries the anchor `<a id="scene-N"></a>` — **the N comes from the script's tag, not
  from the block's position in the file**. `pnpm prep` validates both directions and refuses to
  generate anything if a `#N` has no block, or a block has no `#N`.
```

In the **Output contract**, keep the file list as is (script.md, REPRO.md, STATE.md, tracker.sqlite).

- [ ] **Step 4: `.claude/commands/assets.md` — emit RECORDING + VOICE**

Header (line 3–4): replace `prep docs (SHOTLIST.md, MEME_LIST.md)` with `prep docs (RECORDING.md, VOICE.md, MEME_LIST.md)`.

Replace **Step 4** wholesale:

```markdown
## Step 4 — Generate prep docs

```bash
pnpm prep -- --episode <ep>
```

This writes the two **session-oriented** docs — one file drives one sitting:

- `episodes/<ep>/RECORDING.md` — the screencast session. A checkbox per `[СКРИНКАСТ #N]` cue,
  grouped by beat, with REPRO's exact commands / on-screen / WAIT-CUT / reset **inlined**, plus a
  back-reference to the voice beat the scene plays under (`Звучит под: «…»`). Pre-flight (prepared
  states) at the top, failure recipes at the bottom. No cross-file jump is needed mid-session —
  `REPRO.md` stays the source of truth, `RECORDING.md` is disposable.
- `episodes/<ep>/VOICE.md` — the voice session. `[ГОЛОС]` lines only, in reading order, cues
  stripped, with a margin note per block naming the IDs it covers (`→ #3 · M2`). The Хук and
  Вердикт blocks are marked 🎯 НАИЗУСТЬ.
- `episodes/<ep>/assets/MEME_LIST.md` — every `[МЕМ M<n>]` cue + a free stock-sound list.
  **Scaffolded only if missing** — a re-run never clobbers the host's filled-in suggestions. Then
  **fill each scaffold** (`**Мем:**` / `**Источник:**`) with a concrete meme and a real download
  link — suggestions + links only, never auto-download copyrighted memes.

`pnpm prep` **hard-fails and writes nothing** if `script.md` and `REPRO.md` disagree (a `#N` with no
`#scene-N` block, or an orphan block with no cue) — the IDs are the contract between them.

Re-running is safe: RECORDING/VOICE are regenerated, and ticked scene boxes are carried over by ID.
A box whose scene content changed since it was ticked is **reset** and marked `⟳`; a tick whose
scene no longer exists is dropped and printed as a warning. `--force` discards all tick state.
```

Step 5's manual-phase checklist — replace the two lines:

```
  - [ ] Голос: записать озвучку по VOICE.md (хук и вердикт — наизусть)
  - [ ] Скринкаст: снять по RECORDING.md (команды/что на экране/WAIT-CUT — всё внутри)
```

Output contract: `episodes/<ep>/RECORDING.md` and `episodes/<ep>/VOICE.md` — new files (replaces the `SHOTLIST.md` line). Update the tracked-files sentence to name `MEME_LIST.md`, `RECORDING.md`, `VOICE.md`.

- [ ] **Step 5: `CLAUDE.md` — the script-structure section**

Under `## Script structure (with timing)`, append the cue-ID contract:

```markdown
### Cue IDs (cross-document contract)

`script.md` is the **single source of cue identity**. `/script` numbers each cue kind sequentially
from 1, in narrative order, and every derived doc reads its numbering from there:

| Tag | Form | Derived into |
|-----|------|--------------|
| `[СКРИНКАСТ #N: …]` | `#1, #2…` | `REPRO.md`'s `<a id="scene-N">`, `RECORDING.md`'s checkboxes |
| `[АНИМАЦИЯ A<n>: …]` | `A1, A2…` | the edit; `VOICE.md` margin notes |
| `[МЕМ M<n>: …]` | `M1, M2…` | `assets/MEME_LIST.md` headers |
| `[SHORT cut S<n>: …]` | `S1, S2…` | `/cut-shorts` (post-edit) |

`pnpm prep` hard-fails (writing nothing) on a missing ID, a gap/duplicate, or a `#N` ↔ `#scene-N`
mismatch in either direction. Episodes written before this scheme (ep001) are detected as legacy:
`pnpm prep` skips them with a message and exits 0.
```

In `## The pipeline`, under the manual phase / STATE.md contract area, note the two session docs:
`RECORDING.md` (screencast sitting) and `VOICE.md` (voice sitting) are **derived and regenerable**;
`REPRO.md` and `script.md` are the sources of truth. `SHOTLIST.md` is gone (superseded by
`RECORDING.md`).

- [ ] **Step 6: `README.md` and `flow.ts`**

`README.md:68` — replace the `pnpm prep` row:

```markdown
| `pnpm prep` | `RECORDING.md` + `VOICE.md` + `MEME_LIST.md` (MEME_LIST only if missing; ticks carried over by scene ID) | no |
```

`scripts/lib/flow.ts:48` — the manual-phase hint:

```ts
  manual:
    'Ручная фаза — команды нет: голос по VOICE.md, скринкаст по RECORDING.md, мемы по MEME_LIST.md,\n' +
    'монтаж в DaVinci Resolve, затем сверка таймкодов в STATE.md/script.md.\n' +
    'Когда монтаж готов:  /publish-pack',
```

`scripts/lib/flow.ts:129` — the scripts cheat-sheet row:

```ts
  ['pnpm prep', 'RECORDING.md + VOICE.md + MEME_LIST.md  (ticks carried over by scene ID)'],
```

- [ ] **Step 7: Run the full suite and the flow sheet**

```bash
pnpm test
pnpm flow
```

Expected: `pnpm test` PASS (if `flow.test.ts` asserts on the old hint text, update the assertion to the new string — the hint is the thing under test, and it changed deliberately). `pnpm flow` prints the cheat sheet with the new `pnpm prep` row and no mention of SHOTLIST.

Final grep — no stale references anywhere outside ep001's frozen artifacts and the old spec:

```bash
grep -rn "SHOTLIST" . --exclude-dir=node_modules --exclude-dir=sandbox --exclude-dir=.git \
  | grep -v "episodes/2026-07-ep001/" \
  | grep -v "docs/superpowers/specs/2026-07-11"
```

Expected: **no output**.

- [ ] **Step 8: Commit**

```bash
git add templates .claude/commands CLAUDE.md README.md scripts/lib/flow.ts scripts/lib/flow.test.ts
git commit -m "docs: cue-ID contract; /script assigns IDs, /assets emits RECORDING + VOICE"
```

---

## Acceptance (run at the end)

1. `pnpm test` — green.
2. `pnpm prep -- --episode 2026-07-ep002` — regenerates; IDs match 1:1 across `script.md` ↔ `REPRO.md` ↔ `RECORDING.md` ↔ `VOICE.md`.
3. `pnpm prep -- --episode 2026-07-ep001` — prints the legacy message, writes nothing, `exit=0`.
4. Desync fails loudly in **both** directions, writing nothing (covered by `gen-prep-docs.test.ts`: "rejects a #N whose REPRO scene block was deleted" and "rejects an ORPHAN REPRO scene block").
5. The three tick tests pass: carried on unchanged, reset+marked on changed, dropped+warned on renumber.
6. `grep -rn SHOTLIST` returns nothing outside ep001's frozen files and the superseded 2026-07-11 spec.
