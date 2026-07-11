import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion'
import { loadFonts, FONT_FAMILY } from './loadFonts'
import { BG, DEFAULT_BRANDING, verdictStyle, type Branding } from './theme'

// `type` (not `interface`) so it satisfies Remotion's `Props extends Record<string, unknown>`.
export type VerdictCardProps = {
  verdict: string // ГОДНОТА | ХАЙП | НАКРУТКА | РАНО
  repoName?: string
  branding?: Branding
}

// Verdict plate: the verdict word slams in as a rotated sticker in its per-verdict color,
// with the repo name above and a one-word gloss below.
export const VerdictCard: React.FC<VerdictCardProps> = ({
  verdict,
  repoName,
  branding = DEFAULT_BRANDING,
}) => {
  loadFonts()
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const style = verdictStyle(verdict)

  const repoIn = interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const slam = spring({ frame: frame - 12, fps, config: { damping: 9, mass: 0.8 }, durationInFrames: 30 })
  const stampScale = interpolate(slam, [0, 1], [0.3, 1])
  const rotate = interpolate(slam, [0, 1], [-14, -6])
  const glossIn = interpolate(frame, [38, 54], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        fontFamily: FONT_FAMILY,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 44,
      }}
    >
      {repoName && (
        <div style={{ fontSize: 48, color: '#8b949e', opacity: repoIn }}>⭐ {repoName}</div>
      )}

      <div
        style={{
          transform: `scale(${stampScale}) rotate(${rotate}deg)`,
          backgroundColor: style.bg,
          color: style.fg,
          fontSize: 150,
          fontWeight: 700,
          padding: '28px 80px',
          borderRadius: 24,
          letterSpacing: 4,
          boxShadow: `0 0 120px ${style.bg}66`,
        }}
      >
        {verdict}
      </div>

      <div style={{ fontSize: 46, color: style.bg, fontWeight: 700, opacity: glossIn }}>
        {style.gloss}
      </div>
    </AbsoluteFill>
  )
}
