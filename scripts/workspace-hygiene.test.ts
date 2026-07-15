import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

// ─────────────────────────────────────────────────────────────────────────────
// Tripwire: the root pnpm-lock.yaml must NEVER contain a `remotion:` importer.
//
// remotion/ is a standalone package (own lockfile). pnpm 9 has no `ignore-workspace`
// .npmrc key — only the --ignore-workspace CLI flag — so a plain `cd remotion &&
// pnpm install` silently attaches remotion as an importer in the ROOT lockfile
// (~1700 lines of pollution). A failing check beats a doc line nobody re-reads.
//
// If this fails: the remotion install was run without --ignore-workspace. Fix with
//   git checkout HEAD -- pnpm-lock.yaml
//   cd remotion && pnpm install --ignore-workspace
// ─────────────────────────────────────────────────────────────────────────────

describe('workspace hygiene', () => {
  it('root pnpm-lock.yaml has no remotion: importer (install remotion with --ignore-workspace)', () => {
    const lock = readFileSync(join(process.cwd(), 'pnpm-lock.yaml'), 'utf8')
    // Importer keys are 2-space-indented under `importers:`. A transitive package
    // resolution is `remotion@<version>:` at column 0, which this does not match.
    const hasRemotionImporter = /^ {2}remotion:\s*$/m.test(lock)
    expect(
      hasRemotionImporter,
      'root pnpm-lock.yaml contains a `remotion:` importer — the remotion install was run without ' +
        '--ignore-workspace. Revert (git checkout HEAD -- pnpm-lock.yaml) and reinstall with ' +
        '`cd remotion && pnpm install --ignore-workspace`.',
    ).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tripwire: the generated-asset ignore rules.
//
// `git check-ignore` is the only authority here, because the rule that governs
// gen-log.json is a subtle one: "It is not possible to re-include a file if a
// parent directory of that file is excluded." `episodes/*/assets/*` matches the
// `gen` DIRECTORY itself, so git never descends into it — which is exactly why
// gen-log.json must sit BESIDE gen/, not inside it. Prose forgets. A test does not.
// ─────────────────────────────────────────────────────────────────────────────

/** True if git would ignore `path`. `check-ignore -q` exits 0 when ignored, 1 when not. */
function isIgnored(path: string): boolean {
  try {
    execFileSync('git', ['check-ignore', '-q', path], { stdio: 'ignore' })
    return true
  } catch (err) {
    // `check-ignore` exits 1 for "not ignored" — that's the only failure this
    // helper is allowed to swallow. Any other status (128: git missing, cwd
    // outside a work tree, bad argument, ...) is a real error, and silently
    // returning false would make the ignore-rule assertions below pass for
    // the wrong reason instead of failing loudly.
    if ((err as { status?: number }).status === 1) return false
    throw err
  }
}

describe('generated-asset ignore rules', () => {
  it('ignores the per-episode gen/ archive (PNGs are heavy and regenerable)', () => {
    expect(isIgnored('episodes/2026-07-ep001/assets/gen/scene-real-avatar-v1.png')).toBe(true)
    expect(isIgnored('episodes/2026-07-ep001/assets/gen/object-known-logo-v2.png')).toBe(true)
  })

  it('TRACKS gen-log.json — an audit trail that dies with the working copy is not one', () => {
    expect(isIgnored('episodes/2026-07-ep001/assets/gen-log.json')).toBe(false)
  })

  it('ignores the remotion render surface', () => {
    expect(isIgnored('remotion/public/gen/2026-07-ep001/scene-real-avatar-v1.png')).toBe(true)
  })

  it('does NOT swallow the tracked brand assets beside it', () => {
    expect(isIgnored('remotion/public/branding/logo.svg')).toBe(false)
    expect(isIgnored('remotion/public/branding/logo-nobg.svg')).toBe(false)
    expect(isIgnored('remotion/public/fonts/montserrat-latin-700-normal.woff2')).toBe(false)
  })
})
