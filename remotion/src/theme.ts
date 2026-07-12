// Shared look for Intro / VerdictCard / ThumbTemplate. Branding is a PROP everywhere so it stays
// overridable per-episode; DEFAULT_BRANDING carries the channel identity — Senior Skeptic.

import { staticFile } from 'remotion'

export interface Branding {
  channelName: string
  tagline: string
  accent: string // hex
  logoSrc?: string // resolved url to the channel mark (staticFile output); nobg variant by default
}

export const DEFAULT_BRANDING: Branding = {
  channelName: 'SENIOR SKEPTIC',
  tagline: 'разбор репо: заслуженно или хайп?',
  accent: '#facc15',
  // transparent (no plate) mark — sits clean on our dark glow/texture surfaces.
  // ChannelLogo falls back to the `>_` glyph if this file is missing at render time.
  logoSrc: staticFile('branding/logo-nobg.svg'),
}

export const BG = '#0d1117' // GitHub-dark base, matches StarChart

export type Verdict = 'ГОДНОТА' | 'ХАЙП' | 'НАКРУТКА' | 'РАНО'

export const VERDICTS: Verdict[] = ['ГОДНОТА', 'ХАЙП', 'НАКРУТКА', 'РАНО']

// Per-verdict plate colors + a one-word gloss. bg = sticker fill, fg = text on the sticker.
export const VERDICT_STYLE: Record<Verdict, { bg: string; fg: string; gloss: string }> = {
  ГОДНОТА: { bg: '#22c55e', fg: '#052e16', gloss: 'заслуженно' },
  ХАЙП: { bg: '#f59e0b', fg: '#3b1e00', gloss: 'переоценено' },
  НАКРУТКА: { bg: '#ef4444', fg: '#3f0a0a', gloss: 'накручено' },
  РАНО: { bg: '#38bdf8', fg: '#062a3a', gloss: 'ещё рано' },
}

export function verdictStyle(verdict: string) {
  return VERDICT_STYLE[(verdict as Verdict)] ?? VERDICT_STYLE['ХАЙП']
}
