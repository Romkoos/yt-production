// Pure parsing of an episode's REPRO.md — the reproduction protocol under the LINEAR-TAKE
// doctrine. The host records the user's real path in one continuous take from a clean machine
// state; evidence proofs are woven into that flow at the point the narrative needs them. So REPRO
// is not a set of isolated scene setups — it is one ordered flow (## User flow) plus the proofs
// that hang off it (## Evidence inserts), bracketed by a wipe (## Clean slate) and the one-shot
// warnings (## Environment caveats).
//
// /review-repo writes the flow, evidence, clean slate and caveats (it walked the real path);
// /script confirms the [СКРИНКАСТ #N] cues that reference them. RECORDING.md is assembled from
// these pieces verbatim, so the host never opens REPRO mid-session. REPRO stays the source of
// truth; RECORDING is disposable. No IO.

export interface ReproBullet {
  mark: string // a leading warning marker on the LABEL ('⚠️' in `- ⚠️ **Label:** …`); '' if none
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
  cleanSlate: string // ## Clean slate — wipe commands, rendered as the RECORDING pre-flight checklist
  scenes: ReproScene[] // every <a id="scene-N"> block, gathered doc-wide (## User flow + ## Evidence inserts)
  envCaveats: string // ## Environment caveats — one-shot moments ("этот кадр только в первом прогоне")
  preparedStates: string // ## Prepared states — optional, off-camera time savings ONLY (never in frame)
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
// The header word is cosmetic (FLOW / EVIDENCE / SCENE …) — the scene number always comes off the
// anchor above it, never off this line. So accept any leading word before the number.
const SCENE_HEADER = /^###\s+\S+\s+\d+\s*[—–-]\s*(.*?)(?:\s*·\s*_beat:\s*(.*?)_)?\s*$/m
// A `## ` heading ends a scene block: an ## Evidence inserts block must not bleed into the
// following ## Environment caveats section.
const SECTION_HEADING = /^##\s/m

function bullets(block: string): ReproBullet[] {
  const out: ReproBullet[] = []
  let cur: ReproBullet | null = null
  let inFence = false

  for (const raw of block.split('\n')) {
    const isFence = /^\s*```/.test(raw)
    const startsBullet = !inFence && !isFence && /^-\s/.test(raw)

    if (startsBullet) {
      if (cur) out.push(cur)
      // `- **Do:** …` / `- ⚠️ **Чего этот вывод НЕ доказывает:** …`; anything else keeps label ''.
      // The warning marker is CAPTURED, not swallowed: it is the flag on the bullets that guard
      // the channel's honesty rules, and the host reads the derived doc, not this one.
      const m = raw.match(/^-\s+(?:(⚠️?)\s*)?\*\*(.+?):\*\*\s?(.*)$/)
      cur = m ? { mark: m[1] ?? '', label: m[2].trim(), body: m[3] } : { mark: '', label: '', body: raw }
    } else if (cur) {
      // continuation line: dedent the two spaces markdown needs under a bullet
      cur.body += '\n' + raw.replace(/^ {1,2}/, '')
    }
    if (isFence) inFence = !inFence
  }
  if (cur) out.push(cur)
  return out.map((b) => ({ mark: b.mark, label: b.label, body: b.body.trimEnd() }))
}

export function parseRepro(md: string): ReproDoc {
  const clean = stripComments(md)

  const budget = clean.match(/\*\*Recording time budget:\*\*\s*([\s\S]*?)(?:\n\s*\n|$)/)

  // Anchors are gathered DOC-WIDE, not from a single section: a screencast scene is either a
  // ## User flow step or an ## Evidence insert, and both carry <a id="scene-N">. Each block runs
  // from its anchor to whichever comes first — the next anchor, or the next `## ` section heading.
  const anchors = [...clean.matchAll(SCENE_ANCHOR)]
  const scenes: ReproScene[] = anchors.map((a, i) => {
    const from = a.index + a[0].length
    const nextAnchor = i + 1 < anchors.length ? anchors[i + 1].index : clean.length
    const rest = clean.slice(from)
    const nextHeading = rest.search(SECTION_HEADING)
    const headingBound = nextHeading < 0 ? clean.length : from + nextHeading
    // Drop standalone `---` rule lines (the visual separators between blocks) so a trailing rule
    // never bleeds into the previous bullet's body — matches how the old section-scoped parse did it.
    const block = clean
      .slice(from, Math.min(nextAnchor, headingBound))
      .replace(/^\s*---\s*$/gm, '')
      .trim()
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
    cleanSlate: section(clean, 'Clean slate'),
    scenes,
    envCaveats: section(clean, 'Environment caveats'),
    preparedStates: section(clean, 'Prepared states'),
  }
}
