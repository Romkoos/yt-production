import { staticFile, delayRender, continueRender, cancelRender } from 'remotion'

// Bundled Montserrat (regular + bold, Cyrillic + Latin subsets) under public/fonts/.
// Loaded locally so headless renders are deterministic and offline — no fetch-at-render
// dependency on Google Fonts. Scripts mix Cyrillic (ГОДНОТА) and Latin (astryx, StyleX),
// hence both subsets. The channel has Cyrillic-heavy on-screen text; a font that can't draw
// it renders tofu boxes in the final video.

export const FONT_FAMILY = 'Montserrat, sans-serif'

// Google Fonts' Cyrillic unicode-range for Montserrat. The Latin face carries everything else.
const CYRILLIC_RANGE = 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116'

interface FaceSpec {
  weight: number
  subset: 'cyrillic' | 'latin'
}

const SPECS: FaceSpec[] = [
  { weight: 400, subset: 'latin' },
  { weight: 400, subset: 'cyrillic' },
  { weight: 700, subset: 'latin' },
  { weight: 700, subset: 'cyrillic' },
]

let started = false

// Idempotent: register all Montserrat faces and hold the render until they're ready.
// Call once from each composition's body. No-op outside a DOM (e.g. SSR of props).
export function loadFonts(): void {
  if (started || typeof document === 'undefined') return
  started = true

  const handle = delayRender('Loading Montserrat fonts')

  Promise.all(
    SPECS.map((spec) => {
      const url = staticFile(`fonts/montserrat-${spec.subset}-${spec.weight}-normal.woff2`)
      const face = new FontFace('Montserrat', `url(${url}) format('woff2')`, {
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
    .then(() => continueRender(handle))
    .catch((err) => cancelRender(err))
}
