import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // remotion/ is a standalone package with its own lockfile, but its PURE modules (no remotion
    // runtime import, no DOM) are unit-testable from the root suite — hook-block.ts is the brick's
    // sizing math. Keep it that way: a test in here must never import a remotion package, or the
    // root suite starts resolving into remotion/node_modules.
    include: ['scripts/**/*.test.ts', 'db/**/*.test.ts', 'remotion/src/**/*.test.ts'],
    environment: 'node',
  },
})
