// Pure parsing of an episode's REPRO.md — the reproduction protocol (/review-repo writes the
// prepared states, SETUP and failure recipes; /script fills the scene blocks). RECORDING.md is
// assembled from these pieces verbatim, so the host never opens REPRO mid-session. REPRO stays
// the source of truth; RECORDING is disposable. No IO.

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
      // `- **Do:** …` / `- ⚠️ **Что этот замер НЕ доказывает:** …`; anything else keeps label ''.
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
