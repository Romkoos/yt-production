import { z } from 'zod'
import { zColor } from '@remotion/zod-types'
import { VERDICTS } from './theme'

// ─────────────────────────────────────────────────────────────────────────────
// Zod schema for ThumbTemplate — the single source of truth for the prop shape.
//
// Its purpose is the Remotion Studio GUI: passing `schema={thumbSchema}` to a
// <Composition> turns the right-hand panel into typed controls (dropdowns for
// enums, a colour picker via zColor, an array editor for the hook lines, number
// inputs) with instant hot reload. The host fine-tunes text/sizes/colours live;
// the agent gets the layout right. `ThumbTemplateProps` is inferred from here so
// the schema and the component's props can never drift.
//
// Mirrors the round-3 logo-focal props exactly, ADDITIVE only — the one new prop
// is `logoScale` (was previously impossible to tune without editing LAYOUT).
// ─────────────────────────────────────────────────────────────────────────────

// zod can't build a literal-tuple enum from a readonly string[], so restate the
// four verdicts as a const tuple and assert it stays in sync with theme.VERDICTS.
const VERDICT_VALUES = ['ГОДНОТА', 'ХАЙП', 'НАКРУТКА', 'РАНО'] as const
// Compile-time guard: fails to typecheck if theme.VERDICTS and VERDICT_VALUES diverge.
const _verdictsInSync: readonly (typeof VERDICT_VALUES)[number][] = VERDICTS
void _verdictsInSync

export const hookLineSchema = z.object({
  text: z.string(),
  size: z.enum(['xl', 'lg', 'md']),
  weight: z.union([z.literal(400), z.literal(700)]).optional(),
  accent: z.boolean().optional(),
})

export const thumbLogoSchema = z.object({
  src: z.string().optional(),
  glyph: z.string().optional(),
})

export const termToneSchema = z.enum(['ok', 'warn', 'err', 'dim', 'accent'])

export const brandingSchema = z.object({
  channelName: z.string(),
  tagline: z.string(),
  accent: zColor(),
})

export const thumbSchema = z.object({
  // text element (3) — small header
  repoName: z.string(),
  // text element (2) — the sticker; enum so Studio shows the 4-way dropdown
  verdict: z.enum(VERDICT_VALUES),
  // text element (1) — the huge hook, one or more styled lines
  hook: z.array(hookLineSchema),
  // Layer 2 — the focal object
  logo: thumbLogoSchema,
  // layout controls logo size + centre + hook vertical
  layout: z.enum(['logo-right', 'logo-hero', 'logo-spot']).optional(),
  verdictPosition: z.enum(['top-right', 'mid-left', 'top-left']).optional(),
  // NEW — multiply the layout's logo width (0.4–2×); tune the focal size live
  logoScale: z.number().min(0.4).max(2).optional(),
  accent: zColor().optional(),
  glowColor: zColor().optional(),
  // Layer 1 — optional background texture (a public/ path)
  bgImage: z.string().optional(),
  // OPTIONAL faint one-line terminal decoration
  texture: z.object({ text: z.string(), tone: termToneSchema.optional() }).optional(),
  branding: brandingSchema.optional(),
})

export type ThumbTemplateProps = z.infer<typeof thumbSchema>
export type HookLine = z.infer<typeof hookLineSchema>
export type ThumbLogo = z.infer<typeof thumbLogoSchema>
export type ThumbLayout = NonNullable<ThumbTemplateProps['layout']>
export type VerdictPosition = NonNullable<ThumbTemplateProps['verdictPosition']>
export type TermTone = z.infer<typeof termToneSchema>
