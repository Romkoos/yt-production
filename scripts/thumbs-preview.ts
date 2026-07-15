#!/usr/bin/env -S node --import tsx
// ─────────────────────────────────────────────────────────────────────────────
// /thumbs-preview — the contact sheet. Renders every variant in an episode's
// assets/thumb-variants.json as a still, makes a 120px copy of each, and writes a
// self-refreshing dark-bg gallery (assets/preview/index.html) that updates in
// place within 2s of a re-render. Opens the sheet once on the first run.
//
// Episode-agnostic (paths from the episode dir), macOS-only (open + sips, isolated
// in scripts/lib/platform.ts). See docs/superpowers/specs/2026-07-12-thumb-preview-loop-design.md.
//
// Usage: thumbs-preview.ts [--episode <id>] [--open]
//   --episode <id>  work on this episode (default: newest ep with a thumb-variants.json)
//   --open          force-open the sheet even if it already existed (default: open only 1st run)
// ─────────────────────────────────────────────────────────────────────────────

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { openInBrowser, downscalePng } from './lib/platform'
import { loadVariants, variantSummary, buildIndexHtml, pickEpisode, blockWidthWarnings, sceneObjectWarnings, type SheetItem } from './lib/thumb-preview'

const REMOTION_DIR = resolve('remotion')
const THUMB_COMPOSITION = 'ThumbTemplate'
const VARIANTS_FILE = 'thumb-variants.json'

interface Args {
  episode?: string
  open: boolean
}

function parseArgs(argv: string[]): Args {
  const out: Args = { open: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--episode') out.episode = argv[++i]
    else if (argv[i] === '--open') out.open = true
  }
  return out
}

/** Episode dirs that carry a thumb-variants.json — the candidates for the default pick. */
function episodesWithVariants(): string[] {
  if (!existsSync('episodes')) return []
  return readdirSync('episodes', { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join('episodes', d.name, 'assets', VARIANTS_FILE)))
    .map((d) => d.name)
}

function mtimeMs(file: string): number {
  return Math.floor(statSync(file).mtimeMs)
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  const episode = pickEpisode(episodesWithVariants(), args.episode)

  const assetsDir = join('episodes', episode, 'assets')
  const variantsPath = join(assetsDir, VARIANTS_FILE)
  if (!existsSync(variantsPath)) {
    throw new Error(`no ${variantsPath} — create it (an array of { label, props }) before previewing ${episode}`)
  }
  const variants = loadVariants(JSON.parse(readFileSync(variantsPath, 'utf8')))

  // Say it BEFORE the renders, not after: the sheet is what the host looks at, and a clamped block
  // renders perfectly happily — just not at the width they typed. Remotion eats the component's own
  // console.warn on the `still` path, so this is the only place the message can actually land.
  //
  // TODO(cli-warnings): ThumbTemplate ALSO warns when the in-brick verdict badge has to shrink to
  // clear the channel lockup (fitVerdictInBrick), and that warning cannot be reproduced here: it
  // depends on the brick's measured glyph widths, and Node has no canvas. Surfacing it means moving
  // this script off the `npx remotion still` CLI and onto @remotion/renderer's renderStill(), which
  // takes an onBrowserLog callback and would forward the component's console.warn to this terminal.
  // DEFERRED ON PURPOSE: the shrink has never fired — the tightest variant rendered so far still
  // cleared the lockup with room to spare — and building the plumbing for a warning nobody has
  // needed yet is speculative. Do it the first time a real render actually shrinks a badge.
  for (const w of [...blockWidthWarnings(variants), ...sceneObjectWarnings(variants)]) {
    process.stdout.write(`  ! ${w}\n`)
  }

  const previewDir = join(assetsDir, 'preview')
  const indexPath = join(previewDir, 'index.html')
  const firstRun = !existsSync(indexPath)
  mkdirSync(previewDir, { recursive: true })

  const items: SheetItem[] = variants.map((variant, i) => {
    const n = i + 1
    const fullFile = `thumb-v${n}.png`
    const thumbFile = `thumb-v${n}.120.png`
    const fullPath = join(previewDir, fullFile)
    const thumbPath = join(previewDir, thumbFile)
    const propsPath = join(previewDir, `.props-v${n}.json`)

    // Remotion resolves --props relative to the remotion/ cwd, so hand it an absolute path.
    writeFileSync(propsPath, JSON.stringify(variant.props))
    try {
      execFileSync('npx', ['remotion', 'still', THUMB_COMPOSITION, resolve(fullPath), `--props=${resolve(propsPath)}`, '--log=error'], {
        cwd: REMOTION_DIR,
        stdio: ['ignore', 'ignore', 'inherit'],
      })
    } finally {
      rmSync(propsPath, { force: true })
    }
    downscalePng(fullPath, thumbPath, 120)

    const summary = variantSummary(variant.props)
    const bg = summary.bgImage || '—'
    process.stdout.write(`  ✓ ${fullFile}  ${variant.label}  «${summary.hookText}» → ${summary.verdict}  bg: ${bg}\n`)
    return {
      label: variant.label,
      fullFile,
      thumbFile,
      fullMtime: mtimeMs(fullPath),
      thumbMtime: mtimeMs(thumbPath),
      hookText: summary.hookText,
      verdict: summary.verdict,
      bgImage: summary.bgImage,
    }
  })

  writeFileSync(indexPath, buildIndexHtml(items, { episode }))
  process.stdout.write(`\nContact sheet: ${indexPath}  (${items.length} variant${items.length === 1 ? '' : 's'})\n`)

  if (firstRun || args.open) {
    openInBrowser(resolve(indexPath))
    process.stdout.write('Opened in the browser — it self-refreshes every 2s; just re-run this to update.\n')
  } else {
    process.stdout.write('Already open — the page will pick up the new renders within 2s.\n')
  }
}

try {
  main()
} catch (e) {
  // Zero episodes (or no thumb-variants.json anywhere) is a normal state, not a crash: pickEpisode
  // throws an honest "no episode has a thumb-variants.json" here. Surface it cleanly, no stack trace.
  process.stderr.write(`[thumbs] ${(e as Error).message}\n`)
  process.exit(1)
}
