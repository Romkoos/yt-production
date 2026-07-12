// ─────────────────────────────────────────────────────────────────────────────
// Platform boundary — the ONLY OS-specific touchpoints in the codebase.
//
// The thumbnail preview loop is macOS-only, consistent with the rest of the
// pipeline (Screen Studio, DaVinci Resolve are macOS). That is a DOCUMENTED
// constraint, not a silent assumption: both native calls live here so making the
// future marketplace plugin cross-platform is a two-function swap, not a grep.
//
//   openInBrowser  → macOS `open`.  Swap: `xdg-open` (Linux) / `start` (Windows).
//   downscalePng   → macOS `sips`.  Swap: `npx sharp` or `ffmpeg -vf scale=W:-1`.
// ─────────────────────────────────────────────────────────────────────────────

import { execFileSync } from 'node:child_process'

/** Open a file/URL in the default browser (macOS `open`). */
export function openInBrowser(target: string): void {
  execFileSync('open', [target], { stdio: 'ignore' })
}

/** Downscale a PNG to `width` px (aspect preserved) via macOS `sips`. */
export function downscalePng(src: string, out: string, width: number): void {
  execFileSync('sips', ['--resampleWidth', String(width), src, '--out', out], { stdio: 'ignore' })
}
