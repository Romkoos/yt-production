import { AbsoluteFill } from 'remotion'
// STUB: channel intro. TODO: animate logo + episode number.
export const Intro: React.FC<{ episodeNumber: number }> = ({ episodeNumber }) => (
  <AbsoluteFill style={{ backgroundColor: '#0d1117', color: '#e6edf3', justifyContent: 'center', alignItems: 'center', fontSize: 80, fontFamily: 'sans-serif' }}>
    #{episodeNumber}
  </AbsoluteFill>
)
