import type { ThumbTemplateProps } from './ThumbTemplate'

// ─────────────────────────────────────────────────────────────────────────────
// ep001 (facebook/astryx) — three logo-focal thumbnail compositions.
//
// Focal object: the cached GitHub org avatar (remotion/public/thumb/logo-facebook.png,
// sourced from github.com/facebook.png). Glyph fallback if absent.
//
// HOOKS are the host's picks from episodes/2026-07-ep001/assets/THUMB_HOOKS.md:
// A1 «Дизайн-система Meta», B1 «UI для тебя и AI», C3 «Стоит переходить?».
// Viewer-facing, ГОДНОТА-safe. Keep in sync with thumb-variants.json (the render source).
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
  verdictPosition: 'in-brick',
  logo: LOGO,
  hookBlock: true,
  hookFont: 'unbounded',
  hook: [
    { text: 'Дизайн-система', size: 'md', weight: 700 },
    { text: 'Meta', size: 'xl', accent: true },
  ],
}

// B — hero: larger logo centre-right, brand-yellow accent.
// The hook breaks «UI для тебя» / «и AI» so the two lines have similar natural widths (~1.6x apart)
// and the brick can actually equalize them. The earlier break — «UI для тебя и» / «AI» — could not:
// a 2-character line needs ~7x to reach a 13-character line's width, i.e. a ~400px word in a 720px
// frame, so the ratio cap held it short and the block never read as a brick.
// The terminal texture is gone: it earned its keep on the dead programmatic gradient, but the
// generated scene supplies the life now, and the in-brick badge grew down over it.
export const THUMB_ASTRYX_B: ThumbTemplateProps = {
  layout: 'logo-hero',
  accent: '#facc15',
  glowColor: META_BLUE,
  repoName: REPO,
  verdict: 'ГОДНОТА',
  verdictPosition: 'in-brick',
  logo: LOGO,
  hookBlock: true,
  hookFont: 'unbounded',
  hook: [
    { text: 'UI для тебя', size: 'md', weight: 700 },
    { text: 'и AI', size: 'xl', accent: true },
  ],
}

// C — spotlight: logo right with a strong glow, green accent (matches ГОДНОТА).
export const THUMB_ASTRYX_C: ThumbTemplateProps = {
  layout: 'logo-spot',
  accent: '#3fb950',
  glowColor: META_BLUE,
  repoName: REPO,
  verdict: 'ГОДНОТА',
  verdictPosition: 'in-brick',
  logo: LOGO,
  logoScale: 0.82, // trims the focal tile so the long «переходить?» hero word clears it
  hookBlock: true,
  hookFont: 'unbounded',
  hook: [
    { text: 'Стоит', size: 'md', weight: 700 },
    { text: 'переходить?', size: 'lg', accent: true },
  ],
}

export const THUMB_PRESETS: Record<string, ThumbTemplateProps> = {
  'Thumb-astryx-A': THUMB_ASTRYX_A,
  'Thumb-astryx-B': THUMB_ASTRYX_B,
  'Thumb-astryx-C': THUMB_ASTRYX_C,
}
