#!/usr/bin/env -S node --import tsx
// ─────────────────────────────────────────────────────────────────────────────
// /gen-thumb-object — generate a thumbnail focal object (or a full background
// scene) with the Gemini image API (Nano Banana).
//
// Two trees, two jobs:
//   ARCHIVE         episodes/<ep>/assets/gen/        every variant ever generated (gitignored)
//                                                    — the SOURCE OF TRUTH
//   RENDER SURFACE  remotion/public/gen/<ep>/        the only tree staticFile() resolves
//                                                    (gitignored, disposable — rebuilt from the
//                                                    archive by reconcileMirror / --mirror-only)
//   AUDIT           episodes/<ep>/assets/gen-log.json  TRACKED, append-only
//
// Honesty (CLAUDE.md): a generated image may only carry a logo we SUPPLIED
// (real-avatar) or a real brand the host NAMED (known-logo). category-object
// forbids brand marks outright. No mode bakes text into an image. --dry-run
// prints the exact prompt without a key or a network call, so the guardrails are
// auditable for free.
//
// Usage:
//   gen-thumb-object.ts --mode <real-avatar|known-logo|category-object>
//                       [--episode <id>] [--scene] [--subject "<text>"]
//                       [--model <id>] [--dry-run]
//   gen-thumb-object.ts --episode <id> --mirror-only     (free; no key, no network)
//
// Auth: GEMINI_API_KEY from the environment. Never logged, never written to disk.
// ─────────────────────────────────────────────────────────────────────────────

import { GoogleGenAI, type Part } from '@google/genai'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  appendGenLog,
  buildPrompt,
  estimateCostUsd,
  extractInlineImages,
  modeUsesSubject,
  nextVersion,
  PRICES_AS_OF,
  type GenLog,
  type GenMode,
  type GenResponse,
  type GenVariant,
  type ImageGenerator,
  type InlineImage,
} from './lib/gemini-image'

const DEFAULT_MODEL = 'gemini-3-pro-image-preview' // Nano Banana Pro — best logo/text fidelity
const MODES: GenMode[] = ['real-avatar', 'known-logo', 'category-object']

interface Args {
  mode?: GenMode // required for a generation run; not needed by --mirror-only
  episode?: string
  variant: GenVariant
  subject?: string
  model: string
  dryRun: boolean
  mirrorOnly: boolean
}

/** The value after a value-taking flag. A missing value — or the next flag swallowed as one
 *  (`--subject --scene` ⇒ subject "--scene") — would generate the WRONG image AT COST. */
function takeValue(argv: string[], i: number, flag: string): string {
  const v = argv[i]
  if (v === undefined) throw new Error(`${flag} needs a value`)
  if (v.startsWith('--')) throw new Error(`${flag} needs a value — got the flag "${v}"`)
  return v
}

function parseArgs(argv: string[]): Args {
  const out: Partial<Args> = { variant: 'object', model: DEFAULT_MODEL, dryRun: false, mirrorOnly: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--mode') out.mode = takeValue(argv, ++i, '--mode') as GenMode
    else if (argv[i] === '--episode') out.episode = takeValue(argv, ++i, '--episode')
    else if (argv[i] === '--subject') out.subject = takeValue(argv, ++i, '--subject')
    else if (argv[i] === '--model') out.model = takeValue(argv, ++i, '--model')
    else if (argv[i] === '--scene') out.variant = 'scene'
    else if (argv[i] === '--dry-run') out.dryRun = true
    else if (argv[i] === '--mirror-only') out.mirrorOnly = true
  }
  if (out.mirrorOnly) return out as Args
  if (!out.mode) throw new Error(`--mode <${MODES.join('|')}> is required`)
  if (!MODES.includes(out.mode)) throw new Error(`unknown --mode "${out.mode}" (expected ${MODES.join(' | ')})`)
  return out as Args
}

/** Newest episode dir — ids sort chronologically by their YYYY-MM prefix. */
function newestEpisode(): string {
  const dirs = readdirSync('episodes', { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
  const newest = dirs.at(-1)
  if (!newest) throw new Error('no episodes/ directory entries — pass --episode <id>')
  return newest
}

/** Owner from STATE.md's repo_url — same parse as fetch-star-history.ts. */
function ownerFromState(episode: string): string {
  const state = readFileSync(join('episodes', episode, 'STATE.md'), 'utf8')
  const m = state.match(/repo_url:\s*(\S+)/)
  if (!m) throw new Error(`no repo_url in episodes/${episode}/STATE.md`)
  return m[1]
    .replace(/\.git$/, '')
    .replace(/^https?:\/\/github\.com\//, '')
    .split('/')[0]
}

/** The cached org avatar — the SAME file ThumbTemplate uses for its focal LogoTile
 *  (assets/logo-<owner>.png). Fetched from github.com/<owner>.png on first use. */
async function ensureAvatar(episode: string, owner: string): Promise<string> {
  const path = join('episodes', episode, 'assets', `logo-${owner}.png`)
  if (existsSync(path)) return path
  const res = await fetch(`https://github.com/${owner}.png`, {
    headers: { 'User-Agent': 'yt-production-gen-thumb-object' },
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`avatar fetch for ${owner} failed: HTTP ${res.status}`)
  mkdirSync(join('episodes', episode, 'assets'), { recursive: true })
  writeFileSync(path, Buffer.from(await res.arrayBuffer()))
  process.stdout.write(`  · cached avatar → ${path}\n`)
  return path
}

function readInlineImage(path: string): InlineImage {
  return { mimeType: 'image/png', data: readFileSync(path).toString('base64') }
}

/** Rebuild the RENDER SURFACE from the ARCHIVE, which is the source of truth. Overwrites freely,
 *  idempotent, free — no key, no network. This is what actually makes `remotion/public/gen/<ep>/`
 *  disposable: both trees are gitignored, but `thumb-variants.json` (tracked) points into the
 *  mirror, so after a `git clean -dx` or a fresh clone the ONLY free recovery is this copy.
 *
 *  Scenes only: `object-*` has no consumer yet, so mirroring it would drop dead PNGs into the
 *  render tree.
 *  TODO(object-layer): when the ThumbTemplate luminance-alpha object layer ships, `object-*` must
 *  be mirrored here too — drop the `scene-` filter below AND the `variant === 'scene'` guard in
 *  main(). Both are the same deferral. */
function reconcileMirror(episode: string): string[] {
  const genDir = join('episodes', episode, 'assets', 'gen')
  if (!existsSync(genDir)) return []
  const scenes = readdirSync(genDir)
    .filter((f) => /^scene-.+\.png$/.test(f))
    .sort()
  if (scenes.length === 0) return []
  const mirrorDir = join('remotion', 'public', 'gen', episode)
  mkdirSync(mirrorDir, { recursive: true })
  for (const file of scenes) copyFileSync(join(genDir, file), join(mirrorDir, file))
  return scenes
}

/** The audit log, or null on the first run. Read BEFORE the billed call (see main) — and a corrupt
 *  log has to name itself, because `Unexpected token }` alone tells the host nothing. */
function readGenLog(logPath: string): GenLog | null {
  if (!existsSync(logPath)) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(logPath, 'utf8'))
  } catch (e) {
    throw new Error(`${logPath} is not valid JSON — fix or delete it: ${(e as Error).message}`)
  }
  // Valid JSON of the WRONG shape is the dangerous case: `runs` would read as undefined, and the
  // append would write a fresh log over the history it failed to understand. Refuse instead.
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as GenLog).runs)) {
    throw new Error(`${logPath} is not a gen-log (expected { episode, runs: [...] }) — refusing to overwrite it`)
  }
  return parsed as GenLog
}

/** The real ImageGenerator. The ONLY place the SDK is touched. */
function createGeminiGenerator(apiKey: string): ImageGenerator {
  const ai = new GoogleGenAI({ apiKey })
  return {
    async generate({ model, prompt, referenceImage }) {
      const parts: Part[] = [{ text: prompt }]
      if (referenceImage) parts.push({ inlineData: referenceImage })
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
      })
      return response as GenResponse
    },
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const episode = args.episode ?? newestEpisode()

  // The free recovery path: rebuild the render surface from the archive and stop. No key is read,
  // nothing is generated — this must work on a machine that has no GEMINI_API_KEY at all.
  if (args.mirrorOnly) {
    const mirrored = reconcileMirror(episode)
    const header = '[gen-thumb-object] MIRROR ONLY — no API key read, no network call\n'
    if (mirrored.length === 0) {
      process.stdout.write(
        header + `  episodes/${episode}/assets/gen/ holds no scene-*.png — nothing to mirror.\n`,
      )
      return
    }
    process.stdout.write(
      header +
        mirrored.map((f) => `  ✓ ${f}\n`).join('') +
        `\n${mirrored.length} scene(s) → ${join('remotion', 'public', 'gen', episode)}\n`,
    )
    return
  }

  const mode = args.mode
  if (!mode) throw new Error(`--mode <${MODES.join('|')}> is required`) // parseArgs guarantees it

  // real-avatar's subject IS the attached avatar; the text-only modes need --subject
  // (buildPrompt enforces this — it throws before any network call is made).
  const prompt = buildPrompt(mode, args.variant, args.subject)

  let referencePath: string | undefined
  if (mode === 'real-avatar') {
    const owner = ownerFromState(episode)
    referencePath = args.dryRun
      ? join('episodes', episode, 'assets', `logo-${owner}.png`)
      : await ensureAvatar(episode, owner)
  }

  if (args.dryRun) {
    process.stdout.write(
      `[gen-thumb-object] DRY RUN — no API key read, no network call\n` +
        `  episode:   ${episode}\n` +
        `  mode:      ${mode}   variant: ${args.variant}   model: ${args.model}\n` +
        (referencePath ? `  reference: ${referencePath}\n` : '') +
        `\n${prompt}\n`,
    )
    return
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set (export it; never commit it)')

  // Everything that can fail for free happens BEFORE the billed call. A corrupt gen-log parsed
  // after the PNGs were written would throw with paid images already on disk and no audit record.
  const logPath = join('episodes', episode, 'assets', 'gen-log.json')
  const existingLog: GenLog | null = readGenLog(logPath)

  const genDir = join('episodes', episode, 'assets', 'gen')
  mkdirSync(genDir, { recursive: true })

  // Cheap and idempotent: bring the render surface back in line with the archive before adding to
  // it, so a deleted/never-cloned mirror is repaired on any run, not just via --mirror-only.
  const reconciled = reconcileMirror(episode)
  if (reconciled.length > 0) {
    process.stdout.write(`  · mirrored ${reconciled.length} archived scene(s) → remotion/public/gen/${episode}/\n`)
  }

  const response = await createGeminiGenerator(apiKey).generate({
    model: args.model,
    prompt,
    referenceImage: referencePath ? readInlineImage(referencePath) : undefined,
  })
  const images = extractInlineImages(response)

  const mirrorDir = join('remotion', 'public', 'gen', episode)
  const existing = readdirSync(genDir)
  const outputs: string[] = []

  for (const image of images) {
    // Re-derive the version per image, counting what this run has already written — a single
    // response can carry more than one image part.
    const n = nextVersion([...existing, ...outputs], args.variant, mode)
    const file = `${args.variant}-${mode}-v${n}.png`
    const buf = Buffer.from(image.data, 'base64')

    // ARCHIVE — the episode's permanent record.
    // `existing` was read once, before the API call, so a concurrent run (or a manual file drop)
    // can land on this same vN while we were waiting on Gemini. Refuse rather than clobber: these
    // are billed artifacts, and a silent overwrite destroys one we already paid for.
    const archivePath = join(genDir, file)
    if (existsSync(archivePath)) {
      throw new Error(`output collision: ${file} appeared during the run — re-run to get a fresh version`)
    }
    writeFileSync(archivePath, buf)
    outputs.push(file)

    // RENDER SURFACE — the only tree staticFile() can resolve. Scenes only: `object-*` has no
    // consumer yet, so mirroring it would drop dead PNGs into the render tree.
    // TODO(object-layer): when the ThumbTemplate luminance-alpha object layer ships, `object-*`
    // outputs must start mirroring here too — drop this `variant === 'scene'` guard (and the
    // matching `scene-` filter in reconcileMirror).
    if (args.variant === 'scene') {
      mkdirSync(mirrorDir, { recursive: true })
      writeFileSync(join(mirrorDir, file), buf)
    }
  }

  const cost = estimateCostUsd(args.model, images.length)
  const costText =
    cost == null
      ? `${args.model}, cost unknown for this model`
      : `${args.model}, ~$${cost.toFixed(2)} — estimate, prices as of ${PRICES_AS_OF}`

  writeFileSync(
    logPath,
    JSON.stringify(
      appendGenLog(existingLog, episode, {
        at: new Date().toISOString(),
        mode,
        variant: args.variant,
        model: args.model,
        // Only what actually shaped the prompt: real-avatar ignores --subject, so recording it
        // would imply an input that never reached the model.
        subject: modeUsesSubject(mode) ? args.subject : undefined,
        prompt,
        referenceImage: referencePath,
        outputs,
        estimatedCostUsd: cost,
        pricesAsOf: PRICES_AS_OF,
      }),
      null,
      2,
    ) + '\n',
  )

  for (const file of outputs) {
    process.stdout.write(`  ✓ ${file}   (${costText})\n`)
    if (args.variant === 'scene') {
      process.stdout.write(`    bgImage: "gen/${episode}/${file}"\n`)
    }
  }
  process.stdout.write(`\nArchive: ${genDir}\nLogged:  ${logPath}\n`)
  if (args.variant === 'scene') {
    process.stdout.write(`Paste the bgImage line into episodes/${episode}/assets/thumb-variants.json, then run /thumbs-preview.\n`)
  }
}

main().catch((e) => {
  process.stderr.write(`[gen-thumb-object] failed: ${(e as Error).message}\n`)
  process.exit(1)
})
