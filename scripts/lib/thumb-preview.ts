// ─────────────────────────────────────────────────────────────────────────────
// Pure logic for /thumbs-preview — variant loading, episode resolution, and the
// contact-sheet HTML generator. Kept free of fs/child_process so it is unit-
// testable; the orchestrator (scripts/thumbs-preview.ts) supplies the IO.
// ─────────────────────────────────────────────────────────────────────────────

export interface Variant {
  label: string
  props: Record<string, unknown>
}

/** One rendered variant, as the HTML generator needs it. */
export interface SheetItem {
  label: string
  fullFile: string // basename of the full 1280×720 render, e.g. thumb-v1.png
  thumbFile: string // basename of the 120px copy, e.g. thumb-v1.120.png
  fullMtime: number // mtime (ms) baked into the cache-bust query
  thumbMtime: number
  hookText: string
  verdict: string
}

/** Flatten a `hook` prop (array of styled lines, or a plain string) to its text. */
export function hookText(hook: unknown): string {
  if (typeof hook === 'string') return hook
  if (Array.isArray(hook)) {
    return hook
      .map((line) => (line && typeof line === 'object' && typeof (line as { text?: unknown }).text === 'string' ? (line as { text: string }).text : ''))
      .filter(Boolean)
      .join(' ')
  }
  return ''
}

/** The caption printed under each variant: its hook text and verdict. */
export function variantSummary(props: Record<string, unknown>): { hookText: string; verdict: string } {
  return { hookText: hookText(props.hook), verdict: String(props.verdict ?? '') }
}

/** Parse + shape-validate a thumb-variants.json payload. Authoritative prop validation happens
 *  later at render time (Remotion checks props against thumbSchema); this just fails early and
 *  clearly on a malformed file. Accepts a bare array or a `{ variants: [...] }` wrapper. */
export function loadVariants(parsed: unknown): Variant[] {
  const arr = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { variants?: unknown }).variants)
      ? ((parsed as { variants: unknown[] }).variants)
      : null
  if (!arr) throw new Error('thumb-variants.json must be a JSON array of { label, props } (or { "variants": [...] })')
  if (arr.length === 0) throw new Error('thumb-variants.json has no variants to render')
  arr.forEach((v, i) => {
    if (!v || typeof v !== 'object') throw new Error(`thumb-variants.json variant #${i + 1} is not an object`)
    const label = (v as { label?: unknown }).label
    if (typeof label !== 'string' || !label) throw new Error(`thumb-variants.json variant #${i + 1} is missing a "label"`)
    const props = (v as { props?: unknown }).props
    if (!props || typeof props !== 'object') throw new Error(`thumb-variants.json variant "${label}" is missing a "props" object`)
  })
  return arr as Variant[]
}

/** Choose the episode to render: the explicit one, else the newest candidate (episode ids sort
 *  chronologically by their YYYY-MM prefix, so lexicographically-last = newest). */
export function pickEpisode(candidates: string[], explicit?: string): string {
  if (explicit) return explicit
  if (candidates.length === 0) {
    throw new Error('no episode has a thumb-variants.json — pass --episode <id> or create one')
  }
  return [...candidates].sort().at(-1)!
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Build the self-refreshing dark-bg contact sheet. Each variant shows the full render plus its
 *  120px copy on BOTH a dark and a light strip (mobile glance + white YouTube/Google SERP test).
 *  Images carry an `?m=<mtime>` cache-bust so a re-render refetches while the 2s meta-refresh
 *  between renders serves the cached image (no flicker). */
export function buildIndexHtml(items: SheetItem[], opts: { episode?: string } = {}): string {
  const cards = items
    .map(
      (it) => `
    <section class="card">
      <h2>${esc(it.label)}</h2>
      <img class="full" src="${it.fullFile}?m=${it.fullMtime}" alt="${esc(it.label)}" />
      <div class="strips">
        <figure class="strip strip-dark">
          <img src="${it.thumbFile}?m=${it.thumbMtime}" width="120" alt="${esc(it.label)} @120px on dark" />
          <figcaption>120px · dark (mobile feed)</figcaption>
        </figure>
        <figure class="strip strip-light">
          <img src="${it.thumbFile}?m=${it.thumbMtime}" width="120" alt="${esc(it.label)} @120px on light" />
          <figcaption>120px · light (search / SERP)</figcaption>
        </figure>
      </div>
      <p class="props"><span class="k">hook</span> «${esc(it.hookText)}» &nbsp;·&nbsp; <span class="k">verdict</span> ${esc(it.verdict)}</p>
    </section>`,
    )
    .join('\n')

  const title = opts.episode ? `thumbs · ${esc(opts.episode)}` : 'thumbs preview'
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="refresh" content="2">
  <title>${title}</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 32px; background: #0d1117; color: #e6edf3;
           font: 14px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    header { margin: 0 0 24px; }
    header h1 { margin: 0; font-size: 18px; font-weight: 700; }
    header .hint { color: #7d8590; margin-top: 4px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(520px, 1fr)); gap: 28px; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 16px; }
    .card h2 { margin: 0 0 12px; font-size: 15px; font-weight: 700; }
    .full { width: 100%; height: auto; border-radius: 8px; display: block;
            border: 1px solid #30363d; background: #000; }
    .strips { display: flex; gap: 12px; margin: 14px 0 10px; }
    .strip { margin: 0; flex: 1; border-radius: 8px; padding: 12px; display: flex;
             flex-direction: column; align-items: center; gap: 8px; }
    .strip img { border-radius: 4px; display: block; }
    .strip figcaption { font-size: 11px; }
    .strip-dark { background: #000; color: #8b949e; }
    .strip-light { background: #ffffff; color: #57606a; }
    .props { margin: 0; color: #adbac7; font-size: 13px; }
    .props .k { color: #7d8590; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
  </style>
</head>
<body>
  <header>
    <h1>${title}</h1>
    <div class="hint">auto-refreshes every 2s · re-run the render step to update in place</div>
  </header>
  <main class="grid">${cards}
  </main>
</body>
</html>
`
}
