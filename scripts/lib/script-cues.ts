// Pure extraction of shooting/asset cues from a script.md body. Feeds SHOTLIST.md (screencast
// cues), MEME_LIST.md (meme cues) and shorts-pitches (SHORT cut candidates). No IO.

export interface Cue {
  beat: string // the '## ' beat heading the cue falls under (timing paren stripped)
  raw: string // cue content, whitespace-normalized to one line
}

// Remove HTML comment blocks so the legend's example tags (e.g. "[МЕМ: ...]") aren't parsed
// as real cues.
function stripComments(md: string): string {
  return md.replace(/<!--[\s\S]*?-->/g, '')
}

interface Heading {
  index: number
  beat: string
}

function headings(md: string): Heading[] {
  const out: Heading[] = []
  const re = /^##\s+(.+)$/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(md)) !== null) {
    // strip a trailing timing paren like " (0–15 сек)" for a clean beat label
    const beat = m[1].replace(/\s*\([^)]*\)\s*$/, '').trim()
    out.push({ index: m.index, beat })
  }
  return out
}

function beatAt(pos: number, hs: Heading[]): string {
  let beat = ''
  for (const h of hs) {
    if (h.index <= pos) beat = h.beat
    else break
  }
  return beat
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Extract all `[<tag>: ...]` cues (content may span multiple wrapped lines).
export function extractCues(md: string, tag: string): Cue[] {
  const clean = stripComments(md)
  const hs = headings(clean)
  const re = new RegExp(`\\[${escapeRegExp(tag)}:\\s*([^\\]]*)\\]`, 'g')
  const out: Cue[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(clean)) !== null) {
    out.push({ beat: beatAt(m.index, hs), raw: m[1].replace(/\s+/g, ' ').trim() })
  }
  return out
}

export const extractMemeCues = (md: string): Cue[] => extractCues(md, 'МЕМ')
export const extractScreencastCues = (md: string): Cue[] => extractCues(md, 'СКРИНКАСТ')
export const extractShortCuts = (md: string): Cue[] => extractCues(md, 'SHORT cut')
