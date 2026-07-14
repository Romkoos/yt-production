// ─────────────────────────────────────────────────────────────────────────────
// Pure logic for `pnpm flow` — the read-only cheat sheet. Parses an episode's
// STATE.md (the pipeline's single source of truth, see CLAUDE.md) and answers
// the one question the host actually has: what do I run next?
//
// Kept free of fs so it is unit-testable; the orchestrator (scripts/flow.ts)
// reads the file and prints the string. It writes NOTHING — a cheat sheet that
// mutates state is a phase command, and this is deliberately not one.
// ─────────────────────────────────────────────────────────────────────────────

export type Marker = ' ' | '~' | 'x' | '-'

export interface ChecklistItem {
  phase: string
  marker: Marker
  /** The parenthesised reason on a skipped phase, e.g. "skipped — direct review". */
  note: string
}

export interface EpisodeState {
  episode: string
  number: string
  repoUrl: string
  title: string
  currentPhase: string
  phaseStatus: string
  verdict: string
  updated: string
  checklist: ChecklistItem[]
  nextAction: string
}

/** What to run for each phase. `null` = no command exists: the manual phase IS the human, and the
 *  pipeline waits there (CLAUDE.md). Printing a fake command for it would be a lie with a prompt. */
const PHASE_COMMAND: Record<string, string | null> = {
  scout: '/scout',
  review: '/review-repo', // + repo_url, appended below
  script: '/script',
  assets: '/assets',
  manual: null,
  publish: '/publish-pack',
  retro: '/retro',
}

const PHASE_HINT: Record<string, string> = {
  assets: 'thumbnails: pnpm scene && pnpm thumbs   ·   star data: pnpm chart   ·   prep docs: pnpm prep',
  manual:
    'Ручная фаза — команды нет: голос по VOICE.md, скринкаст по RECORDING.md, мемы по MEME_LIST.md,\n' +
    'монтаж в DaVinci Resolve, затем сверка таймкодов в STATE.md/script.md.\n' +
    'Когда монтаж готов:  /publish-pack',
}

export function parseState(md: string): EpisodeState {
  const fm = md.match(/^---\n([\s\S]*?)\n---/)
  if (!fm) throw new Error('STATE.md has no --- frontmatter block — is this an episode STATE.md?')

  const field = (name: string): string => {
    const m = fm[1].match(new RegExp(`^${name}:[ \\t]*(.*)$`, 'm'))
    return m ? m[1].trim() : ''
  }

  return {
    episode: field('episode'),
    number: field('number'),
    repoUrl: field('repo_url'),
    title: field('title'),
    currentPhase: field('current_phase'),
    phaseStatus: field('phase_status'),
    verdict: field('verdict'),
    updated: field('updated'),
    checklist: parseChecklist(section(md, 'Phase checklist')),
    nextAction: section(md, 'Next action').trim(),
  }
}

/** The body of a `## <name>` section, up to the next heading. */
function section(md: string, name: string): string {
  const lines = md.split('\n')
  const start = lines.findIndex((l) => l.trim() === `## ${name}`)
  if (start === -1) return ''
  const body = lines.slice(start + 1)
  const end = body.findIndex((l) => l.startsWith('## '))
  return (end === -1 ? body : body.slice(0, end)).join('\n')
}

function parseChecklist(body: string): ChecklistItem[] {
  const items: ChecklistItem[] = []
  for (const line of body.split('\n')) {
    const m = line.match(/^- \[([ ~x-])\] (\S+)(?:\s+\((.*)\))?\s*$/)
    if (m) items.push({ phase: m[2], marker: m[1] as Marker, note: m[3] ?? '' })
  }
  return items
}

/** The phase the host is actually on: one already in progress, else the first pending one.
 *  `[x]` done and `[-]` skipped are both closed — a skipped phase never comes back. */
export function nextPhase(items: ChecklistItem[]): ChecklistItem | null {
  return items.find((i) => i.marker === '~') ?? items.find((i) => i.marker === ' ') ?? null
}

export interface NextStep {
  phase: string | null
  command: string | null
  hint: string
}

export function nextCommand(state: EpisodeState): NextStep {
  const next = nextPhase(state.checklist)
  if (!next) return { phase: null, command: null, hint: 'Every phase is closed — this episode is done.' }

  const base = PHASE_COMMAND[next.phase]
  // An unknown phase name is a typo'd checklist, not a phase we can route. Say so instead of
  // guessing a command that does not exist.
  if (base === undefined) {
    return { phase: next.phase, command: null, hint: `Unknown phase "${next.phase}" in the checklist — no command maps to it.` }
  }
  const command = base === '/review-repo' ? `/review-repo ${state.repoUrl}`.trim() : base
  return { phase: next.phase, command, hint: PHASE_HINT[next.phase] ?? '' }
}

const SCRIPTS = [
  ['pnpm flow', 'this sheet'],
  ['pnpm scene', 'generate a scene + point every thumb variant at it   (BILLED — Gemini)'],
  ['pnpm scene:dry', 'print the scene prompt and stop — free, no key, no network'],
  ['pnpm scene:mirror', 'rebuild remotion/public/gen/<ep>/ from the archive — free'],
  ['pnpm thumbs', 'render the thumbnail contact sheet'],
  ['pnpm studio', 'Remotion studio — live prop controls'],
  ['pnpm chart', 'fetch REAL star history → StarChart.props.json'],
  ['pnpm prep', 'RECORDING.md + VOICE.md + MEME_LIST.md  (ticks carried over by scene ID)'],
]

/** The one-screen cheat sheet. */
export function renderFlow(state: EpisodeState): string {
  const next = nextPhase(state.checklist)
  const step = nextCommand(state)
  const out: string[] = []

  const repo = state.repoUrl.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '')
  const head = [state.episode, state.number && `#${state.number}`, repo, state.verdict].filter(Boolean).join('  ·  ')
  out.push(`[flow] ${head}`)
  out.push(`       phase: ${state.currentPhase || '—'} (${state.phaseStatus || '—'})  ·  updated ${state.updated || '—'}`)
  out.push('')

  out.push('Phase checklist')
  const width = Math.max(...state.checklist.map((i) => i.phase.length), 0)
  for (const item of state.checklist) {
    const arrow = next && item.phase === next.phase ? '  ← next' : ''
    const note = item.note ? `  (${item.note})` : ''
    const tail = `${note}${arrow}`
    // Pad only when something follows — otherwise the column alignment is just trailing whitespace.
    out.push(`  [${item.marker}] ${tail ? item.phase.padEnd(width) : item.phase}${tail}`)
  }
  out.push('')

  if (state.nextAction) {
    out.push('Next action (STATE.md)')
    for (const line of state.nextAction.split('\n')) out.push(`  ${line}`)
    out.push('')
  }

  out.push('Next command')
  if (step.command) out.push(`  ${step.command}`)
  if (step.hint) for (const line of step.hint.split('\n')) out.push(`  ${line}`)
  out.push('')

  out.push('Scripts')
  const w = Math.max(...SCRIPTS.map(([s]) => s.length))
  for (const [script, what] of SCRIPTS) out.push(`  ${script.padEnd(w)}  ${what}`)
  out.push('')
  out.push('  Each defaults to the newest episode; target another with  pnpm <script> -- --episode <id>')

  return out.join('\n') + '\n'
}
