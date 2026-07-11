const EPISODE_DIR_RE = /-ep(\d+)$/

/** Highest channel-wide episode number across all folder names, +1. Never resets. */
export function nextEpisodeNumber(dirNames: string[]): number {
  let max = 0
  for (const name of dirNames) {
    const m = name.match(EPISODE_DIR_RE)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return max + 1
}

/** `YYYY-MM` prefix is for folder sorting only; NNN is the channel-wide identity. */
export function formatEpisodeId(n: number, yearMonth: string): string {
  return `${yearMonth}-ep${String(n).padStart(3, '0')}`
}

export function nextEpisodeId(dirNames: string[], yearMonth: string): string {
  return formatEpisodeId(nextEpisodeNumber(dirNames), yearMonth)
}
