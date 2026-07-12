import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

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
