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
//                       [--episode <id>] [--scene] [--apply] [--subject "<text>"]
//                       [--accent "<colour>"] [--model <id>] [--dry-run]
//
//   --accent  colours the scene's accent lighting (default: green, the ГОДНОТА palette) so a
//             generated background matches the episode's verdict. --scene only; the object
//             variant is isolated on black and has no accent lighting to colour.
//   --apply   write the generated scene into every variant of the episode's thumb-variants.json
//             (bgImage + objectInScene). --scene only. See applyScene() below.
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
  DEFAULT_SCENE_ACCENT,
  estimateCostUsd,
  extractInlineImages,
  modeUsesSubject,
  nextVersion,
  PRICES_AS_OF,
  variantUsesAccent,
  type GenLog,
  type GenMode,
  type GenResponse,
  type GenVariant,
  type ImageGenerator,
  type InlineImage,
} from './lib/gemini-image'
import { applySceneToVariants, assertVariants } from './lib/thumb-variants'

const DEFAULT_MODEL = 'gemini-3-pro-image-preview' // Nano Banana Pro — best logo/text fidelity
const MODES: GenMode[] = ['real-avatar', 'known-logo', 'category-object']

interface Args {
  mode?: GenMode // required for a generation run; not needed by --mirror-only
  episode?: string
  variant: GenVariant
  subject?: string
  accent: string // colours the scene's accent lighting; ignored by the object variant
  model: string
  dryRun: boolean
  mirrorOnly: boolean
  apply: boolean // write the generated scene into the episode's thumb-variants.json
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
  const out: Partial<Args> = {
    variant: 'object',
    accent: DEFAULT_SCENE_ACCENT,
    model: DEFAULT_MODEL,
    dryRun: false,
    mirrorOnly: false,
    apply: false,
  }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--mode') out.mode = takeValue(argv, ++i, '--mode') as GenMode
    else if (argv[i] === '--episode') out.episode = takeValue(argv, ++i, '--episode')
    else if (argv[i] === '--subject') out.subject = takeValue(argv, ++i, '--subject')
    else if (argv[i] === '--accent') out.accent = takeValue(argv, ++i, '--accent')
    else if (argv[i] === '--model') out.model = takeValue(argv, ++i, '--model')
    else if (argv[i] === '--scene') out.variant = 'scene'
    else if (argv[i] === '--dry-run') out.dryRun = true
    else if (argv[i] === '--mirror-only') out.mirrorOnly = true
    else if (argv[i] === '--apply') out.apply = true
  }
  // --apply writes a GENERATED SCENE into thumb-variants.json. Every mode that produces no scene to
  // write is a mistake worth naming, not a silent no-op the host discovers by finding the file
  // unchanged: --dry-run and --mirror-only generate nothing, and the object variant has no bgImage
  // consumer (ThumbTemplate's object layer is still a follow-up).
  if (out.apply) {
    if (out.dryRun) throw new Error('--apply has nothing to apply in a --dry-run (nothing is generated)')
    if (out.mirrorOnly) throw new Error('--apply has nothing to apply with --mirror-only (nothing is generated)')
    if (out.variant !== 'scene') throw new Error('--apply writes a background scene — add --scene (the object variant has no bgImage consumer yet)')
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

/** --apply's write step: point every variant of the episode's thumb-variants.json at the scene we
 *  just generated, closing the copy-paste gap between a `--scene` run and /thumbs-preview.
 *
 *  It EDITS a tracked, hand-maintained file — so it refuses a missing or malformed one rather than
 *  scaffolding over it (assertVariants already said so, for free, before the billed call). And it
 *  writes bgImage and objectInScene TOGETHER: a bgImage without objectInScene renders the object
 *  twice (the scene bakes one in, ThumbTemplate draws another). */
function applyScene(variantsPath: string, bgImage: string): void {
  const { text, changes } = applySceneToVariants(readFileSync(variantsPath, 'utf8'), bgImage)
  if (changes.length === 0) {
    process.stdout.write(`\n${variantsPath}: every variant already points at this scene — unchanged.\n`)
    return
  }
  writeFileSync(variantsPath, text)
  process.stdout.write(`\nApplied → ${variantsPath}\n` + changes.map((c) => `  ✓ ${c}\n`).join(''))
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
  const prompt = buildPrompt(mode, args.variant, args.subject, args.accent)

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
        (variantUsesAccent(args.variant) ? `  accent:    ${args.accent}\n` : '') +
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

  // Same rule for --apply's target: a missing or malformed thumb-variants.json must fail HERE, not
  // after the images are paid for. This file is the host's — we edit it, we never author it.
  const variantsPath = join('episodes', episode, 'assets', 'thumb-variants.json')
  if (args.apply) {
    if (!existsSync(variantsPath)) {
      throw new Error(
        `--apply edits ${variantsPath}, and it is not there. It never scaffolds one — create the ` +
          `variant set first (/assets writes it), then re-run.`,
      )
    }
    assertVariants(readFileSync(variantsPath, 'utf8'))
  }

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
        // Only what actually shaped the prompt: real-avatar ignores --subject and the object variant
        // ignores --accent, so recording either would imply an input that never reached the model.
        subject: modeUsesSubject(mode) ? args.subject : undefined,
        sceneAccent: variantUsesAccent(args.variant) ? args.accent : undefined,
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
    // Both lines, together, are the paste-ready snippet (--apply writes them for you). A scene BAKES
    // the logo tile into the background, and ThumbTemplate draws its own LogoTile unless
    // objectInScene is set — so pasting the bgImage line alone renders the logo twice, in two
    // places. Printing the pair is what keeps that from being a switch the host has to remember
    // (/thumbs-preview also warns).
    if (args.variant === 'scene' && !args.apply) {
      process.stdout.write(`    bgImage: "gen/${episode}/${file}"\n`)
      process.stdout.write(`    objectInScene: true\n`)
    }
  }
  process.stdout.write(`\nArchive: ${genDir}\nLogged:  ${logPath}\n`)

  if (args.variant !== 'scene') return

  if (!args.apply) {
    process.stdout.write(
      `Paste BOTH lines into each variant's props in episodes/${episode}/assets/thumb-variants.json, then run\n` +
        `pnpm thumbs. objectInScene hands the object to the scene — without it the template draws its own\n` +
        `logo tile on top of the one baked into the scene. (Or let \`pnpm scene\` do it: it passes --apply.)\n`,
    )
    return
  }

  // One response can carry several images. They are alternatives, not a set — so apply the first and
  // SAY that the others exist, with their paste lines. Silently picking one of N and printing
  // nothing would hide generated work the host paid for.
  applyScene(variantsPath, `gen/${episode}/${outputs[0]}`)
  if (outputs.length > 1) {
    process.stdout.write(
      `\nThis run returned ${outputs.length} images; --apply used the first. To use another instead, put its\n` +
        `bgImage line into each variant of thumb-variants.json by hand:\n` +
        outputs.slice(1).map((f) => `    bgImage: "gen/${episode}/${f}"\n`).join(''),
    )
  }
  process.stdout.write(`\nNext: pnpm thumbs\n`)
}

main().catch((e) => {
  process.stderr.write(`[gen-thumb-object] failed: ${(e as Error).message}\n`)
  process.exit(1)
})
