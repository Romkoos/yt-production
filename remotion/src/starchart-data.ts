export interface StarPoint {
  date: string
  stars: number
}

export interface StarChartProps {
  repoName: string
  data: StarPoint[]
}

export const TEST_STARCHART: StarChartProps = {
  repoName: 'owner/hyped-repo',
  data: [
    { date: '2026-01', stars: 120 },
    { date: '2026-02', stars: 340 },
    { date: '2026-03', stars: 900 },
    { date: '2026-04', stars: 2600 },
    { date: '2026-05', stars: 7100 },
    { date: '2026-06', stars: 15200 },
  ],
}
