import { staticFile, delayRender, continueRender, cancelRender } from 'remotion'

// Bundled woff2 faces under public/fonts/ (Cyrillic + Latin subsets, from fontsource).
// Loaded locally so headless renders are deterministic and offline — no fetch-at-render
// dependency on Google Fonts. Scripts mix Cyrillic (ГОДНОТА) and Latin (repo names, code identifiers),
// hence both subsets for every family. The channel has Cyrillic-heavy on-screen text; a font
// that can't draw it renders tofu boxes in the final video.
//
//   Montserrat  400/700 — body text, the verdict sticker, everything that is not the hook
//   Unbounded   700/900 — the hook brick's default: wide, geometric, poster-weight
//   Oswald      700     — the hook brick's condensed alternative
//
// loadFonts() RETURNS the load promise (cached). ThumbTemplate's brick measures glyph widths
// with canvas measureText, and measuring before the face is ready measures the FALLBACK face —
// the sizes come out wrong and the block doesn't justify. Awaiting this is the gate.

// HookFont is owned by thumb-schema (the prop is a Studio control). Importing it here as a TYPE —
// erased at build, so no runtime edge, no cycle — makes the two Records below a compile-time
// completeness check: add a font to the schema without bundling a face for it and this file fails
// to typecheck, instead of silently rendering the fallback.
import type { HookFont } from './thumb-schema'

export const FONT_FAMILY = 'Montserrat, sans-serif'

/** CSS font-family per hookFont choice. The value doubles as the canvas `font` shorthand family,
 *  so the measurer and the renderer can never pick different faces. */
export const HOOK_FONT_FAMILY: Record<HookFont, string> = {
  unbounded: 'Unbounded, sans-serif',
  oswald: 'Oswald, sans-serif',
  montserrat: 'Montserrat, sans-serif',
}

/** The heaviest weight each family actually ships here. Unbounded has a true Black (900); the
 *  other two top out at Bold. Asking for a 900 we don't bundle gets a synthesised (smeared) bold. */
export const HOOK_FONT_WEIGHT: Record<HookFont, number> = {
  unbounded: 900,
  oswald: 700,
  montserrat: 700,
}

// Google Fonts' standard Cyrillic unicode-range — identical for all three families. The Latin face
// declares NO range, so it carries everything else; without the range on the Cyrillic face the
// last-registered face would win outright and one of the two scripts would go missing.
const CYRILLIC_RANGE = 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116'

interface FaceSpec {
  family: string
  file: string // fontsource basename: <family>-<subset>-<weight>-normal.woff2
  weight: number
  subset: 'cyrillic' | 'latin'
}

const SPECS: FaceSpec[] = [
  ...([400, 700] as const).flatMap((weight) =>
    (['latin', 'cyrillic'] as const).map((subset) => ({ family: 'Montserrat', file: 'montserrat', weight, subset })),
  ),
  ...([700, 900] as const).flatMap((weight) =>
    (['latin', 'cyrillic'] as const).map((subset) => ({ family: 'Unbounded', file: 'unbounded', weight, subset })),
  ),
  ...(['latin', 'cyrillic'] as const).map((subset) => ({ family: 'Oswald', file: 'oswald', weight: 700, subset })),
]

let loading: Promise<void> | null = null

/** Register every bundled face and hold the render until they're ready. Idempotent — the promise is
 *  cached, so the second caller awaits the first caller's load rather than starting another.
 *  Resolves immediately outside a DOM (e.g. SSR of props). */
export function loadFonts(): Promise<void> {
  if (loading) return loading
  if (typeof document === 'undefined') {
    loading = Promise.resolve()
    return loading
  }

  const handle = delayRender('Loading hook + body fonts')

  loading = Promise.all(
    SPECS.map((spec) => {
      const url = staticFile(`fonts/${spec.file}-${spec.subset}-${spec.weight}-normal.woff2`)
      const face = new FontFace(spec.family, `url(${url}) format('woff2')`, {
        weight: String(spec.weight),
        style: 'normal',
        unicodeRange: spec.subset === 'cyrillic' ? CYRILLIC_RANGE : undefined,
      })
      return face.load().then((loaded) => {
        // FontFaceSet.add isn't in this TS DOM lib's type; the runtime method exists.
        ;(document.fonts as unknown as { add: (f: FontFace) => void }).add(loaded)
      })
    }),
  )
    .then(() => {
      continueRender(handle)
    })
    .catch((err) => {
      cancelRender(err)
      throw err
    })

  return loading
}
