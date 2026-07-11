import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion'
import type { StarChartProps } from './starchart-data'

export const StarChart: React.FC<StarChartProps> = ({ repoName, data }) => {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()

  const pad = 80
  const chartW = width - pad * 2
  const chartH = height - pad * 2
  const maxStars = Math.max(...data.map((d) => d.stars), 1)

  // Guard the divisor: with a single data point, (data.length - 1) === 0 would make x NaN
  // and the whole chart render silently blank. Center the lone point instead.
  const denom = Math.max(data.length - 1, 1)
  const points = data.map((d, i) => ({
    x: data.length === 1 ? pad + chartW / 2 : pad + (chartW * i) / denom,
    y: pad + chartH - (chartH * d.stars) / maxStars,
    stars: d.stars,
    date: d.date,
  }))

  const grow = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 60 })
  const shown = Math.max(1, Math.round(grow * points.length))
  const visible = points.slice(0, shown)
  const path = visible.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{ backgroundColor: '#0d1117', fontFamily: 'sans-serif' }}>
      <svg width={width} height={height}>
        <text x={pad} y={pad - 30} fill="#e6edf3" fontSize={44} opacity={titleOpacity}>
          ⭐ {repoName}
        </text>
        <line x1={pad} y1={pad + chartH} x2={pad + chartW} y2={pad + chartH} stroke="#30363d" strokeWidth={2} />
        <path d={path} fill="none" stroke="#facc15" strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />
        {visible.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={8} fill="#facc15" />
            <text x={p.x} y={p.y - 18} fill="#e6edf3" fontSize={24} textAnchor="middle">
              {p.stars.toLocaleString()}
            </text>
            <text x={p.x} y={pad + chartH + 34} fill="#8b949e" fontSize={22} textAnchor="middle">
              {p.date}
            </text>
          </g>
        ))}
      </svg>
    </AbsoluteFill>
  )
}
