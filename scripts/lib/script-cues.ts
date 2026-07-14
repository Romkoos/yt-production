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

const HEADING_LINE_RE = /^\s*#{1,6}\s/
const HR_LINE_RE = /^\s*---\s*$/

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
  // A voice line runs until the next tag — so a wrapped line is captured whole. It must also
  // stop at a heading or a horizontal rule: those are barriers too (see the cue-association
  // pass below), and neither is prose the host should read.
  for (const m of clean.matchAll(/\[ГОЛОС\]\s*([^[]*)/g)) {
    const lines = m[1].split(/\r?\n/)
    const barrier = lines.findIndex((l) => HEADING_LINE_RE.test(l) || HR_LINE_RE.test(l))
    const text = barrier === -1 ? lines.join('\n') : lines.slice(0, barrier).join('\n')
    toks.push({ index: m.index, type: 'voice', text: norm(text) })
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
function tailQuote(run: VoiceRun): string {
  const last = run.lines[run.lines.length - 1]
  if (!last) return ''
  const ss = sentences(last)
  const sentence = ss[ss.length - 1] ?? last
  const words = sentence.split(' ')
  return words.length <= WORD_CAP ? sentence : `…${words.slice(-WORD_CAP).join(' ')}`
}

/** The HEAD of a run: its opening sentence. What the scene plays into. */
function headQuote(run: VoiceRun): string {
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
