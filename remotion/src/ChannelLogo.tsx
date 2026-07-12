import { useCallback, useState } from 'react'
import { Img } from 'remotion'

// ─────────────────────────────────────────────────────────────────────────────
// ChannelLogo — the channel branding mark, shared by ThumbTemplate / Intro /
// VerdictCard so the "render the logo, but degrade gracefully" logic lives once.
//
// `src` is an ALREADY-RESOLVED url (the caller passes staticFile() output, e.g.
// DEFAULT_BRANDING.logoSrc → the transparent logo-nobg.svg). We do NOT wrap it in
// staticFile again here.
//
// Fallback contract: the legacy `>_` glyph shows ONLY when the mark is missing at
// render time — either no `src`, or the <Img> fails to load. Remotion's <Img>
// cancels the whole render on a load error UNLESS an `onError` handler is given;
// we give one and flip to the fallback instead, so a missing asset never kills a
// render, it just falls back to the glyph.
// ─────────────────────────────────────────────────────────────────────────────
export const ChannelLogo: React.FC<{
  src?: string
  size: number
  fallback: React.ReactNode
  style?: React.CSSProperties
}> = ({ src, size, fallback, style }) => {
  const [failed, setFailed] = useState(false)
  const onError = useCallback(() => setFailed(true), [])
  if (!src || failed) return <>{fallback}</>
  return <Img src={src} onError={onError} style={{ width: size, height: size, objectFit: 'contain', ...style }} />
}
