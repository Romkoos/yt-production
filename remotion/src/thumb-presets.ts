import type { ThumbTemplateProps } from './ThumbTemplate'

// ─────────────────────────────────────────────────────────────────────────────
// ep001 (facebook/astryx) — three logo-focal thumbnail compositions.
//
// Focal object: the cached GitHub org avatar (remotion/public/thumb/logo-facebook.png,
// sourced from github.com/facebook.png). Glyph fallback if absent.
//
// HOOKS BELOW ARE PLACEHOLDERS. The real hook per variant is chosen by the host
// from episodes/2026-07-ep001/assets/THUMB_HOOKS.md, then filled in here before
// the final render. Hooks must be viewer-facing and must not contradict ГОДНОТА.
//
// Honesty: real logo, honest data only. README marketing («8 лет в Meta»,
// «13 000+ приложений») is NOT asserted as our finding anywhere on the thumb.
// ─────────────────────────────────────────────────────────────────────────────

const REPO = 'facebook/astryx'
const LOGO = { src: 'thumb/logo-facebook.png', glyph: '>_' }
const META_BLUE = '#1877f2' // glow tint that matches the Meta mark

// Hooks picked by the host from THUMB_HOOKS.md (2026-07): modest label line +
// one huge accented keyword, ≤4 words, viewer-facing, ГОДНОТА-safe.

// A — clean right: logo right-of-centre, blue accent.
export const THUMB_ASTRYX_A: ThumbTemplateProps = {
  layout: 'logo-right',
  accent: '#58a6ff',
  glowColor: META_BLUE,
  repoName: REPO,
  verdict: 'ГОДНОТА',
  verdictPosition: 'top-right',
  logo: LOGO,
  hook: [
    { text: 'Дизайн-система', size: 'md', weight: 700 },
    { text: 'Meta', size: 'xl', accent: true },
  ],
}

// B — hero: larger logo centre-right, brand-yellow accent, faint terminal texture.
export const THUMB_ASTRYX_B: ThumbTemplateProps = {
  layout: 'logo-hero',
  accent: '#facc15',
  glowColor: META_BLUE,
  repoName: REPO,
  verdict: 'ГОДНОТА',
  verdictPosition: 'top-right',
  logo: LOGO,
  texture: { text: '$ pnpm install --ignore-scripts', tone: 'dim' },
  hook: [
    { text: 'UI для тебя и', size: 'md', weight: 700 },
    { text: 'AI', size: 'xl', accent: true },
  ],
}

// C — spotlight: logo right with a strong glow, green accent (matches ГОДНОТА).
export const THUMB_ASTRYX_C: ThumbTemplateProps = {
  layout: 'logo-spot',
  accent: '#3fb950',
  glowColor: META_BLUE,
  repoName: REPO,
  verdict: 'ГОДНОТА',
  verdictPosition: 'top-right',
  logo: LOGO,
  hook: [
    { text: 'UI без', size: 'lg', weight: 700 },
    { text: 'сборки', size: 'xl', accent: true },
  ],
}

export const THUMB_PRESETS: Record<string, ThumbTemplateProps> = {
  'Thumb-astryx-A': THUMB_ASTRYX_A,
  'Thumb-astryx-B': THUMB_ASTRYX_B,
  'Thumb-astryx-C': THUMB_ASTRYX_C,
}
