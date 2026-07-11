import { AbsoluteFill } from 'remotion'
// STUB: thumbnail (text ALWAYS programmatic, never generative). TODO: 3 variants.
export const ThumbTemplate: React.FC<{ repoName: string; verdict: string }> = ({ repoName, verdict }) => (
  <AbsoluteFill style={{ backgroundColor: '#0d1117', color: '#e6edf3', justifyContent: 'center', alignItems: 'center', fontSize: 64, fontFamily: 'sans-serif' }}>
    {repoName} — {verdict}?
  </AbsoluteFill>
)
