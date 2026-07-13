import { useEffect, useMemo, useState } from 'react'
import { AbsoluteFill, Img, staticFile, delayRender, continueRender, cancelRender } from 'remotion'
import { loadFonts, FONT_FAMILY, HOOK_FONT_FAMILY, HOOK_FONT_WEIGHT } from './loadFonts'
import { ChannelLogo } from './ChannelLogo'
import { BG, DEFAULT_BRANDING, verdictStyle } from './theme'
import { fitLinesToBlock, clampBlockWidth, REF_SIZE } from './hook-block'
import type { HookFont, HookLine, TermTone, ThumbLayout, ThumbLogo, ThumbTemplateProps, VerdictPosition } from './thumb-schema'

// Prop types + the Zod schema live in ./thumb-schema (the single source of truth used both here
// and by Root.tsx to render Studio's GUI controls). Re-exported for existing importers.
export type { HookFont, HookLine, TermTone, ThumbLayout, ThumbLogo, ThumbTemplateProps, VerdictPosition }

// ─────────────────────────────────────────────────────────────────────────────
// ThumbTemplate — still 1280×720 YouTube thumbnail. Round-3 redesign.
//
// FOCAL OBJECT = the repo/tech LOGO (GitHub org avatar), rendered as a
// depth-treated app-icon tile, ~30-35% of frame height, centered / right-of-
// centre. Recognition on mobile happens through the logo shape, not words.
//
// HARD TEXT BUDGET — exactly three content text elements:
//   (1) hook        — 2-4 words, HUGE, viewer-facing
//   (2) verdict      — the sticker
//   (3) repoName     — small, header (top-left)
// Everything else is decoration: the channel wordmark (bottom-left branding)
// and an OPTIONAL faint terminal texture line (at most one short line, low
// contrast — a texture, never a readable screenshot).
//
// Layers (approved architecture kept):
//   1 background  — optional Midjourney texture (`bgImage`) OR programmatic
//                   gradient + film grain + accent glow behind the logo.
//   2 focal object — the logo tile (image) with glow + shadow + slight rotation;
//                   glyph fallback if no avatar cached.
//   3 typography  — hook + repo header + verdict sticker (position/texture kept).
//
// Honesty: real logo, honest data only, no generative text, no fabricated
// numbers. README marketing is never asserted as our finding.
// ─────────────────────────────────────────────────────────────────────────────

const SIZE: Record<HookLine['size'], number> = { xl: 156, lg: 108, md: 66 }
const CANVAS = { w: 1280, h: 720 }
const PAD = 60

// ── The hook brick (hookBlock) ────────────────────────────────────────────────
// Every line is drawn at the size that makes its rendered width equal blockWidth, so the block
// comes out as a solid justified mass — short lines huge, long lines small. Sizing math (and the
// 60%-line clamp that keeps the block off the object) lives in ./hook-block, pure and unit-tested.

const DEFAULT_BLOCK_WIDTH = Math.round(CANVAS.w * 0.44) // 563px
const DEFAULT_LINE_SCALE_RATIO = 2
const BLOCK_TRACKING = -0.02 // em — uppercase wants tighter tracking to read as one mass
const BLOCK_LINE_HEIGHT = 0.95 // near-zero leading: the lines are meant to touch

/** What we DRAW is what we must MEASURE. Uppercasing via CSS `text-transform` would change the
 *  rendered width without changing the string measureText sees, and every line would justify to
 *  the wrong size — so the transform happens here, once, and the result is both measured and drawn. */
function blockText(text: string, uppercase: boolean): string {
  return uppercase ? text.toUpperCase() : text
}

/** Glyph widths at REF_SIZE, via canvas measureText. Tracking is applied to the context too:
 *  it is part of the rendered width, and both scale linearly with font size, so the ratio the
 *  sizing math relies on holds. */
function measureAtRefSize(texts: string[], family: string, weight: number): number[] {
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) throw new Error('ThumbTemplate: no 2d canvas context — cannot measure the hook block')
  ctx.font = `${weight} ${REF_SIZE}px ${family}`
  // `letterSpacing` is a Chrome canvas property (Remotion renders in Chrome) that this TS DOM lib
  // does not type yet. Without it the measured width omits tracking and the block overshoots.
  ;(ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${BLOCK_TRACKING * REF_SIZE}px`
  return texts.map((t) => ctx.measureText(t).width)
}

/** Measure once the fonts are actually ready, holding the render meanwhile.
 *
 *  The gate is the whole point: measuring before the face has loaded measures the FALLBACK face,
 *  which is a different width per glyph — the block would justify to sizes that are simply wrong,
 *  and on a still render nothing would ever correct them. Returns null until the sizes are known. */
function useBlockSizes(
  texts: string[],
  family: string,
  weight: number,
  blockWidth: number,
  maxLineScaleRatio: number,
  enabled: boolean,
): number[] | null {
  const [sizes, setSizes] = useState<number[] | null>(null)
  // Studio edits props live, so re-measure whenever anything that moves a glyph changes.
  const key = JSON.stringify([texts, family, weight, blockWidth, maxLineScaleRatio])

  useEffect(() => {
    if (!enabled || texts.length === 0) return
    let done = false
    const handle = delayRender('Measuring the hook block')
    const release = () => {
      if (done) return
      done = true
      continueRender(handle)
    }

    loadFonts()
      .then(() => document.fonts.ready)
      .then(() => {
        setSizes(fitLinesToBlock(measureAtRefSize(texts, family, weight), blockWidth, { maxLineScaleRatio }))
        release()
      })
      .catch((err) => cancelRender(err))

    return release
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])

  return sizes
}

// Per-layout config: logo size + centre (fraction of canvas) + hook vertical.
const LAYOUT: Record<ThumbLayout, { logoW: number; cx: number; cy: number; hookTop: number | string; hookTranslateY: boolean }> = {
  'logo-right': { logoW: 250, cx: 0.75, cy: 0.5, hookTop: '50%', hookTranslateY: true },
  'logo-hero': { logoW: 270, cx: 0.64, cy: 0.56, hookTop: 168, hookTranslateY: false },
  'logo-spot': { logoW: 256, cx: 0.73, cy: 0.53, hookTop: '56%', hookTranslateY: true },
}

const TERM_TONE: Record<TermTone, string> = {
  ok: '#3fb950',
  warn: '#d29922',
  err: '#f85149',
  dim: '#7d8590',
  accent: '#58a6ff',
}

// ── Layer 1: film grain (deterministic SVG turbulence) ────────────────────────
const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.09 }) => (
  <svg
    width={CANVAS.w}
    height={CANVAS.h}
    style={{ position: 'absolute', inset: 0, opacity, mixBlendMode: 'overlay', pointerEvents: 'none' }}
  >
    <filter id="thumb-grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter="url(#thumb-grain)" />
  </svg>
)

// ── Layer 2: the logo, as a depth-treated app-icon tile ───────────────────────
const LogoTile: React.FC<{ logo: ThumbLogo; size: number; glow: string; accent: string; rotate: number }> = ({
  logo,
  size,
  glow,
  accent,
  rotate,
}) => {
  const shell: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: size * 0.22,
    transform: `rotate(${rotate}deg)`,
    boxShadow: `0 40px 90px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06), 0 22px 80px ${glow}66`,
    overflow: 'hidden',
  }
  if (logo.src) {
    return (
      <div style={{ ...shell, background: '#ffffff' }}>
        <Img src={staticFile(logo.src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )
  }
  // Glyph fallback — a terminal-mark tile in the accent colour.
  return (
    <div
      style={{
        ...shell,
        background: `linear-gradient(150deg, ${accent} 0%, ${shade(accent, -0.22)} 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: BG,
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: size * 0.42,
        fontWeight: 700,
      }}
    >
      {logo.glyph ?? '>_'}
    </div>
  )
}

// ── Layer 3: verdict sticker — layered plate, angle, gloss, texture (kept) ─────
const VerdictSticker: React.FC<{ verdict: string; position: VerdictPosition }> = ({ verdict, position }) => {
  const v = verdictStyle(verdict)
  const place: React.CSSProperties =
    position === 'mid-left'
      ? { left: PAD - 6, top: '50%', transform: 'translateY(-50%) rotate(-4deg)' }
      : position === 'top-left'
        ? { left: PAD, top: PAD, transform: 'rotate(-4deg)' }
        : { right: PAD, top: PAD, transform: 'rotate(4deg)' } // top-right — clears the bottom-right timestamp zone

  return (
    <div style={{ position: 'absolute', ...place }}>
      <div style={{ position: 'absolute', inset: 0, transform: 'translate(10px, 12px)', background: 'rgba(0,0,0,0.45)', borderRadius: 20, filter: 'blur(2px)' }} />
      <div
        style={{
          position: 'relative',
          background: `linear-gradient(160deg, ${v.bg} 0%, ${shade(v.bg, -0.18)} 100%)`,
          color: v.fg,
          fontFamily: FONT_FAMILY,
          fontSize: 78,
          fontWeight: 700,
          letterSpacing: 1,
          padding: '14px 42px 18px',
          borderRadius: 20,
          border: `3px solid ${shade(v.bg, -0.3)}`,
          boxShadow: `inset 0 3px 0 ${shade(v.bg, 0.35)}, inset 0 -6px 14px ${shade(v.bg, -0.3)}, 0 16px 40px rgba(0,0,0,0.4)`,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, borderRadius: 20, background: 'linear-gradient(120deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 42%)', pointerEvents: 'none' }} />
        {verdict}
      </div>
    </div>
  )
}

// Lighten (t>0) / darken (t<0) a #rrggbb hex by fraction t.
function shade(hex: string, t: number): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const f = (c: number) => Math.round(t < 0 ? c * (1 + t) : c + (255 - c) * t)
  return `rgb(${f(r)}, ${f(g)}, ${f(b)})`
}

export const ThumbTemplate: React.FC<ThumbTemplateProps> = ({
  logo,
  hook,
  verdict,
  repoName,
  layout = 'logo-right',
  verdictPosition = 'top-right',
  logoScale = 1,
  accent,
  glowColor,
  bgImage,
  texture,
  branding = DEFAULT_BRANDING,
  hookBlock = true,
  blockWidth = DEFAULT_BLOCK_WIDTH,
  maxLineScaleRatio = DEFAULT_LINE_SCALE_RATIO,
  hookUppercase = true,
  hookFont = 'unbounded',
}) => {
  loadFonts()
  const acc = accent ?? branding.accent
  const glow = glowColor ?? acc
  const cfg = LAYOUT[layout]
  const logoW = cfg.logoW * logoScale // focal size = layout base × live scale

  // No collision BY GEOMETRY: the block's right edge is clamped to the 60% line, which is where the
  // scene contract stops the text zone (gen-thumb-object --scene reserves 60-65% as a gutter and
  // puts the object past 70%). The clamp is code, not convention, because blockWidth is a live
  // Studio slider — a comment saying "don't cross 60%" does not stop a drag.
  const hookFamily = HOOK_FONT_FAMILY[hookFont]
  const hookWeight = HOOK_FONT_WEIGHT[hookFont]
  const block = useMemo(() => clampBlockWidth(blockWidth, { padding: PAD, frameWidth: CANVAS.w }), [blockWidth])
  if (block.warning) console.warn(block.warning)

  const blockLines = useMemo(() => hook.map((l) => blockText(l.text, hookUppercase)), [hook, hookUppercase])
  const blockSizes = useBlockSizes(blockLines, hookFamily, hookWeight, block.blockWidth, maxLineScaleRatio, hookBlock)

  // Layer 1 — background: programmatic gradient anchored on the logo.
  const background: React.CSSProperties = {
    background: `radial-gradient(120% 120% at ${cfg.cx * 100}% ${cfg.cy * 100}%, ${shade(BG, 0.06)} 0%, ${BG} 55%, ${shade(BG, -0.4)} 100%)`,
  }

  return (
    <AbsoluteFill style={{ ...background, fontFamily: FONT_FAMILY, color: '#e6edf3', overflow: 'hidden' }}>
      {/* Layer 1 — optional texture */}
      {bgImage ? (
        <>
          <Img src={staticFile(bgImage)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <AbsoluteFill style={{ background: `linear-gradient(90deg, ${BG}f2 0%, ${BG}cc 45%, ${BG}66 100%)` }} />
        </>
      ) : null}

      {/* accent glow behind the logo */}
      <div
        style={{
          position: 'absolute',
          left: `${cfg.cx * 100}%`,
          top: `${cfg.cy * 100}%`,
          width: logoW * 3.4,
          height: logoW * 3.4,
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(closest-side, ${glow}3a 0%, ${glow}00 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* OPTIONAL faint terminal texture — one short line, low contrast, decoration */}
      {texture ? (
        <div
          style={{
            position: 'absolute',
            left: PAD,
            bottom: 150,
            opacity: 0.16,
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: 40,
            fontWeight: 600,
            letterSpacing: 1,
            color: TERM_TONE[texture.tone ?? 'dim'],
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {texture.text}
        </div>
      ) : null}

      <Grain />

      {/* Layer 2 — the logo (focal object) */}
      <div style={{ position: 'absolute', left: `${cfg.cx * 100}%`, top: `${cfg.cy * 100}%`, transform: 'translate(-50%, -50%)' }}>
        <LogoTile logo={logo} size={logoW} glow={glow} accent={acc} rotate={-4} />
      </div>

      {/* text (3) — repo header, top-left */}
      <div style={{ position: 'absolute', left: PAD, top: PAD, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ backgroundColor: acc, color: BG, fontWeight: 700, fontSize: 30, padding: '4px 14px', borderRadius: 10 }}>{'>_'}</div>
        <span style={{ fontSize: 36, fontWeight: 700, color: '#e6edf3', textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>{repoName}</span>
      </div>

      {/* text (1) — hook. In block mode this is the BRICK: a justified mass whose right edge is
          pinned to `block.blockWidth` and can never reach the object. Line breaks stay exactly as
          the host wrote them (HookLine[]); only the sizes are computed, so `line.size` is ignored
          here. `accent`, the shadow and the line colours carry over from the free-size mode. */}
      <div
        style={{
          position: 'absolute',
          left: PAD,
          ...(hookBlock ? { width: block.blockWidth } : { right: 640 }),
          top: cfg.hookTop,
          transform: cfg.hookTranslateY ? 'translateY(-50%)' : undefined,
          display: 'flex',
          flexDirection: 'column',
          gap: hookBlock ? 0 : 2,
        }}
      >
        {hook.map((line, i) => {
          // Until the fonts load, blockSizes is null — the render is held by delayRender, so this
          // fallback never reaches a captured frame; it only keeps the first paint sane.
          const size = hookBlock ? (blockSizes?.[i] ?? SIZE[line.size]) : SIZE[line.size]
          return (
            <span
              key={i}
              style={{
                fontFamily: hookBlock ? hookFamily : FONT_FAMILY,
                fontSize: size,
                fontWeight: hookBlock ? hookWeight : (line.weight ?? 700),
                lineHeight: hookBlock ? BLOCK_LINE_HEIGHT : 1.0,
                letterSpacing: hookBlock ? BLOCK_TRACKING * size : undefined,
                whiteSpace: 'nowrap',
                color: line.accent ? acc : '#f4f8fb',
                textShadow: '0 4px 26px rgba(0,0,0,0.6)',
              }}
            >
              {hookBlock ? blockLines[i] : line.text}
            </span>
          )
        })}
      </div>

      {/* text (2) — verdict sticker (out of the bottom-right timestamp zone) */}
      <VerdictSticker verdict={verdict} position={verdictPosition} />

      {/* channel lockup, bottom-left (branding decoration) — our mark + wordmark.
          NOTE: the top-left `>_` box is the REPO identity slot, left untouched. */}
      <div style={{ position: 'absolute', left: PAD, bottom: 36, display: 'flex', alignItems: 'center', gap: 14 }}>
        <ChannelLogo
          src={branding.logoSrc}
          size={52}
          style={{ filter: `drop-shadow(0 6px 16px ${glow}55)` }}
          fallback={
            <div style={{ backgroundColor: acc, color: BG, fontWeight: 700, fontSize: 26, fontFamily: 'ui-monospace, Menlo, monospace', padding: '2px 10px', borderRadius: 8 }}>{'>_'}</div>
          }
        />
        <span style={{ fontSize: 26, color: acc, fontWeight: 700, letterSpacing: 1 }}>{branding.channelName}</span>
      </div>
    </AbsoluteFill>
  )
}
