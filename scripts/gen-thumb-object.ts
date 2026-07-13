#!/usr/bin/env -S node --import tsx
// ─────────────────────────────────────────────────────────────────────────────
// /gen-thumb-object — generate a thumbnail focal object (or a full background
// scene) with the Gemini image API (Nano Banana).
//
// Two trees, two jobs:
//   ARCHIVE         episodes/<ep>/assets/gen/        every variant ever generated (gitignored)
//   RENDER SURFACE  remotion/public/gen/<ep>/        the only tree staticFile() resolves
//                                                    (gitignored, disposable, regenerable)
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
//
// Auth: GEMINI_API_KEY from the environment. Never logged, never written to disk.
// ─────────────────────────────────────────────────────────────────────────────

import { GoogleGenAI, type Part } from '@google/genai'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  appendGenLog,
  buildPrompt,
  estimateCostUsd,
  extractInlineImages,
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
  mode: GenMode
  episode?: string
  variant: GenVariant
  subject?: string
  model: string
  dryRun: boolean
}

function parseArgs(argv: string[]): Args {
  const out: Partial<Args> = { variant: 'object', model: DEFAULT_MODEL, dryRun: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--mode') out.mode = argv[++i] as GenMode
    else if (argv[i] === '--episode') out.episode = argv[++i]
    else if (argv[i] === '--subject') out.subject = argv[++i]
    else if (argv[i] === '--model') out.model = argv[++i]
    else if (argv[i] === '--scene') out.variant = 'scene'
    else if (argv[i] === '--dry-run') out.dryRun = true
  }
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

  // real-avatar's subject IS the attached avatar; the text-only modes need --subject
  // (buildPrompt enforces this — it throws before any network call is made).
  const prompt = buildPrompt(args.mode, args.variant, args.subject)

  let referencePath: string | undefined
  if (args.mode === 'real-avatar') {
    const owner = ownerFromState(episode)
    referencePath = args.dryRun
      ? join('episodes', episode, 'assets', `logo-${owner}.png`)
      : await ensureAvatar(episode, owner)
  }

  if (args.dryRun) {
    process.stdout.write(
      `[gen-thumb-object] DRY RUN — no API key read, no network call\n` +
        `  episode:   ${episode}\n` +
        `  mode:      ${args.mode}   variant: ${args.variant}   model: ${args.model}\n` +
        (referencePath ? `  reference: ${referencePath}\n` : '') +
        `\n${prompt}\n`,
    )
    return
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set (export it; never commit it)')

  const genDir = join('episodes', episode, 'assets', 'gen')
  mkdirSync(genDir, { recursive: true })

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
    const n = nextVersion([...existing, ...outputs], args.variant, args.mode)
    const file = `${args.variant}-${args.mode}-v${n}.png`
    const buf = Buffer.from(image.data, 'base64')

    // ARCHIVE — the episode's permanent record.
    writeFileSync(join(genDir, file), buf)
    outputs.push(file)

    // RENDER SURFACE — the only tree staticFile() can resolve. Scenes only: `object-*` has no
    // consumer yet, so mirroring it would drop dead PNGs into the render tree.
    // TODO(object-layer): when the ThumbTemplate luminance-alpha object layer ships, `object-*`
    // outputs must start mirroring here too — drop this `variant === 'scene'` guard.
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

  const logPath = join('episodes', episode, 'assets', 'gen-log.json')
  const existingLog: GenLog | null = existsSync(logPath)
    ? (JSON.parse(readFileSync(logPath, 'utf8')) as GenLog)
    : null
  writeFileSync(
    logPath,
    JSON.stringify(
      appendGenLog(existingLog, episode, {
        at: new Date().toISOString(),
        mode: args.mode,
        variant: args.variant,
        model: args.model,
        subject: args.subject,
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
