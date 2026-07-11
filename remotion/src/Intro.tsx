import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion'
import { loadFonts, FONT_FAMILY } from './loadFonts'
import { BG, DEFAULT_BRANDING, type Branding } from './theme'

// `type` (not `interface`) so it satisfies Remotion's `Props extends Record<string, unknown>`.
export type IntroProps = {
  episodeNumber: number
  branding?: Branding
}

// Channel intro: programmatic logo mark (">_" terminal prompt) + episode number + channel
// name/tagline. Simple but finished; all branding is swappable via the `branding` prop.
export const Intro: React.FC<IntroProps> = ({ episodeNumber, branding = DEFAULT_BRANDING }) => {
  loadFonts()
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const markScale = spring({ frame, fps, config: { damping: 12, mass: 0.7 }, durationInFrames: 30 })
  const textIn = interpolate(frame, [12, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const textY = interpolate(frame, [12, 30], [24, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const underline = interpolate(frame, [24, 44], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        fontFamily: FONT_FAMILY,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 40,
      }}
    >
      {/* logo mark */}
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 36,
          backgroundColor: branding.accent,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          transform: `scale(${markScale})`,
          boxShadow: `0 0 80px ${branding.accent}55`,
        }}
      >
        <span style={{ fontSize: 96, fontWeight: 700, color: BG, lineHeight: 1 }}>{'>_'}</span>
      </div>

      <div style={{ textAlign: 'center', opacity: textIn, transform: `translateY(${textY}px)` }}>
        <div style={{ fontSize: 96, fontWeight: 700, color: '#e6edf3', letterSpacing: 2 }}>
          {branding.channelName}
        </div>
        <div
          style={{
            height: 6,
            width: `${underline * 60}%`,
            margin: '20px auto',
            backgroundColor: branding.accent,
            borderRadius: 3,
          }}
        />
        <div style={{ fontSize: 34, color: '#8b949e' }}>{branding.tagline}</div>
        <div style={{ fontSize: 40, fontWeight: 700, color: branding.accent, marginTop: 28 }}>
          Выпуск #{episodeNumber}
        </div>
      </div>
    </AbsoluteFill>
  )
}
