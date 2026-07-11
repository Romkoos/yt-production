import { AbsoluteFill } from 'remotion'
// STUB: verdict plate. TODO: per-verdict color + animation.
export const VerdictCard: React.FC<{ verdict: string }> = ({ verdict }) => (
  <AbsoluteFill style={{ backgroundColor: '#0d1117', color: '#facc15', justifyContent: 'center', alignItems: 'center', fontSize: 96, fontFamily: 'sans-serif', fontWeight: 700 }}>
    {verdict}
  </AbsoluteFill>
)
