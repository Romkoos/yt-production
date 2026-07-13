import { describe, it, expect } from 'vitest'
import { applySceneToVariants, assertVariants } from './thumb-variants'

const THREE_VARIANTS = `[
  {
    "label": "A — clean right",
    "props": {
      "layout": "logo-right",
      "repoName": "facebook/astryx",
      "bgImage": "gen/2026-07-ep001/scene-real-avatar-v1.png",
      "objectInScene": true
    }
  },
  {
    "label": "B — hero",
    "props": {
      "layout": "logo-hero",
      "repoName": "facebook/astryx"
    }
  }
]
`

describe('applySceneToVariants', () => {
  it('writes bgImage + objectInScene into EVERY variant', () => {
    const { text } = applySceneToVariants(THREE_VARIANTS, 'gen/2026-07-ep001/scene-real-avatar-v9.png')
    const parsed = JSON.parse(text)
    for (const v of parsed) {
      expect(v.props.bgImage).toBe('gen/2026-07-ep001/scene-real-avatar-v9.png')
      expect(v.props.objectInScene).toBe(true)
    }
  })

  it('reports what changed, per variant, and stays silent about what did not', () => {
    const { changes } = applySceneToVariants(THREE_VARIANTS, 'gen/2026-07-ep001/scene-real-avatar-v9.png')
    expect(changes).toEqual([
      'A — clean right: bgImage gen/2026-07-ep001/scene-real-avatar-v1.png → gen/2026-07-ep001/scene-real-avatar-v9.png',
      'B — hero: bgImage → gen/2026-07-ep001/scene-real-avatar-v9.png, objectInScene → true',
    ])
  })

  it('is a no-op report when every variant already points at this scene', () => {
    const scene = 'gen/2026-07-ep001/scene-real-avatar-v1.png'
    const once = applySceneToVariants(THREE_VARIANTS, scene)
    const twice = applySceneToVariants(once.text, scene)
    expect(twice.changes).toEqual([])
    expect(twice.text).toBe(once.text)
  })

  it('preserves key order — bgImage keeps its slot, new keys append to props', () => {
    const { text } = applySceneToVariants(THREE_VARIANTS, 'gen/x/scene-v9.png')
    const [a, b] = JSON.parse(text)
    expect(Object.keys(a.props)).toEqual(['layout', 'repoName', 'bgImage', 'objectInScene'])
    expect(Object.keys(b.props)).toEqual(['layout', 'repoName', 'bgImage', 'objectInScene'])
  })

  it('preserves the file’s indentation and trailing newline', () => {
    const fourSpace = THREE_VARIANTS.replace(/^( +)/gm, (m) => m.repeat(2))
    const { text } = applySceneToVariants(fourSpace, 'gen/x/scene-v9.png')
    expect(text.split('\n')[1]).toBe('    {')
    expect(text.endsWith('\n')).toBe(true)
  })

  it('refuses a malformed file rather than rewriting it', () => {
    expect(() => applySceneToVariants('{ not json', 'gen/x/s.png')).toThrow(/not valid JSON/)
    expect(() => applySceneToVariants('{"variants": "nope"}', 'gen/x/s.png')).toThrow(/thumb-variants/)
    expect(() => applySceneToVariants('[]', 'gen/x/s.png')).toThrow(/no variants/)
  })

  // The pre-flight: --apply must fail while failing is still FREE, i.e. before the billed Gemini
  // call, not after it — the same rule gen-log.json's parse already follows.
  it('assertVariants accepts a well-formed file and refuses a malformed one, without editing it', () => {
    expect(() => assertVariants(THREE_VARIANTS)).not.toThrow()
    expect(() => assertVariants('{ not json')).toThrow(/not valid JSON/)
    expect(() => assertVariants('[]')).toThrow(/no variants/)
  })

  it('handles the { "variants": [...] } wrapper loadVariants also accepts', () => {
    const wrapped = '{\n  "variants": [\n    { "label": "A", "props": {} }\n  ]\n}\n'
    const { text, changes } = applySceneToVariants(wrapped, 'gen/x/scene-v9.png')
    expect(JSON.parse(text).variants[0].props).toEqual({ bgImage: 'gen/x/scene-v9.png', objectInScene: true })
    expect(changes).toHaveLength(1)
  })
})
