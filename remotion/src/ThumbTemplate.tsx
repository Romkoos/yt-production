import { AbsoluteFill } from 'remotion'
import { loadFonts, FONT_FAMILY } from './loadFonts'
import { BG, DEFAULT_BRANDING, verdictStyle, type Branding } from './theme'

// `type` (not `interface`) so it satisfies Remotion's `Props extends Record<string, unknown>`.
export type ThumbTemplateProps = {
  hookText: string // bold short text slot (the attention line)
  repoName: string // repo name/mark slot
  verdict: string // verdict sticker: ГОДНОТА | ХАЙП | НАКРУТКА | РАНО
  bgVariant?: number // 0..2 — high-contrast background treatment
  branding?: Branding
}

// A still 1280x720 thumbnail. All text is programmatically rendered (channel rule — never
// generative). Three swappable high-contrast bg treatments; the host renders 3 variants with
// different hookText and/or bgVariant and picks / A-B tests.
export const ThumbTemplate: React.FC<ThumbTemplateProps> = ({
  hookText,
  repoName,
  verdict,
  bgVariant = 0,
  branding = DEFAULT_BRANDING,
}) => {
  loadFonts()
  const v = verdictStyle(verdict)
  const accent = branding.accent

  // High-contrast backgrounds, all legible behind bold white/near-white text.
  const backgrounds: React.CSSProperties[] = [
    { background: `linear-gradient(135deg, ${BG} 0%, ${BG} 55%, ${accent}22 55%, ${accent}22 100%)` },
    { background: `radial-gradient(circle at 78% 30%, ${v.bg}44 0%, ${BG} 60%)` },
    { background: `linear-gradient(180deg, ${v.bg} 0%, ${v.bg} 34%, ${BG} 34%, ${BG} 100%)` },
  ]
  const bg = backgrounds[bgVariant % backgrounds.length]

  return (
    <AbsoluteFill style={{ ...bg, fontFamily: FONT_FAMILY, color: '#e6edf3', padding: 64 }}>
      {/* repo mark, top-left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div
          style={{
            backgroundColor: accent,
            color: BG,
            fontWeight: 700,
            fontSize: 34,
            padding: '6px 16px',
            borderRadius: 12,
          }}
        >
          {'>_'}
        </div>
        <span style={{ fontSize: 40, fontWeight: 700, color: '#e6edf3' }}>{repoName}</span>
      </div>

      {/* hook text — the dominant element */}
      <div
        style={{
          position: 'absolute',
          left: 64,
          top: 190,
          right: 360,
          fontSize: 116,
          fontWeight: 700,
          lineHeight: 1.02,
          textShadow: '0 6px 30px rgba(0,0,0,0.6)',
        }}
      >
        {hookText}
      </div>

      {/* verdict sticker, bottom-right */}
      <div
        style={{
          position: 'absolute',
          right: 56,
          bottom: 64,
          transform: 'rotate(-7deg)',
          backgroundColor: v.bg,
          color: v.fg,
          fontSize: 76,
          fontWeight: 700,
          padding: '16px 40px',
          borderRadius: 18,
          letterSpacing: 2,
          boxShadow: '0 10px 40px rgba(0,0,0,0.45)',
        }}
      >
        {verdict}
      </div>

      {/* channel tag, bottom-left */}
      <div style={{ position: 'absolute', left: 64, bottom: 60, fontSize: 30, color: accent, fontWeight: 700 }}>
        {branding.channelName}
      </div>
    </AbsoluteFill>
  )
}
