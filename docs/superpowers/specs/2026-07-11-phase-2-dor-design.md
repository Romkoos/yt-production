# Phase 2 — Definition of Ready for ep001 (design)

**Date:** 2026-07-11 · **Branch:** `bootstrap/phase-2` · **Episode:** `2026-07-ep001` (facebook/astryx, verdict ГОДНОТА)

Goal: bring ep001 to a "ready to record" state — everything preparable **before** the host
records voice/screencast. Post-publication tooling (retro impl, Jenkins scout, Resolve API)
stays out of scope.

This phase delivers **reusable tooling** (commands + Remotion + scripts) *and* **executes it**
to produce ep001's artifacts. Six DoR items, all must go green.

---

## 0. Settled decisions (from kickoff Q&A)

**Star-history data source — tiered, real-only.** The REST `/stargazers` listing 404s for
*every* repo in this environment (verified against `sveltejs/svelte`; not a rate-limit — 4,998
req remaining, `star+json` media-type honored). **GraphQL works** and yields the full real
per-star history: `repository.stargazers(orderBy: STARRED_AT ASC){ edges{ starredAt } }`,
cursor-paginated — confirmed `totalCount: 7860`, `first:100`, `hasNextPage`. So the fetcher is
tiered, tries in order, and **records which tier produced the data** in the cache so the chart
label derives automatically:

| Tier | Source | Result | Label |
|------|--------|--------|-------|
| A | GraphQL `starredAt` (primary) | full real curve | *(none — full data)* |
| B | REST `star+json` paginate | full real curve | *(none)* |
| C | Wayback CDX snapshots of the repo page | sparse real points | `по снимкам Wayback Machine` |
| D | 2 real anchor points (creation ≈ 0, today = real total) | 2 real points | `по двум опорным точкам (детальная история недоступна)` |

For **ep001 in this environment: Tier A** → a real curve from 7,860 real `starredAt`
timestamps.

**Honesty hard rule (new, permanent).** Added to `CLAUDE.md` content rules:
> Star/metric charts render **real data only** — real → sparse real → no chart. Reconstructed
> or modeled data curves are **permanently banned**. A star-forensics channel that fabricates a
> star curve is dead on arrival.

**Naming:** capitalized `StarChart.mp4 / Intro.mp4 / VerdictCard.mp4` (match composition IDs);
thumbnails `thumb-v1.png / thumb-v2.png / thumb-v3.png`.

**Cyrillic fonts:** bundle a local Cyrillic-capable woff2 (Montserrat, regular+bold) in
`remotion/public/fonts/`, loaded via `@font-face` + `staticFile` and a `delayRender` gate until
`document.fonts.ready`. Local + offline-deterministic; no fetch-at-render dependency.

---

## 1. Architecture — units & boundaries

Small, independently-testable units. Pure logic separated from IO/render so vitest can cover it.

### Pure libraries (unit-tested, no IO)
- `scripts/lib/star-history.ts` — `aggregateStarHistory(timestamps: string[], opts) → StarPoint[]`.
  Buckets raw `starredAt` ISO timestamps into a **cumulative** series matching the existing
  `StarChartProps` shape. **Adaptive bucketing:** weekly (`date:'YYYY-Www'`) when repo age
  < 12 months, monthly (`date:'YYYY-MM'`) otherwise; cap total points at ~52 (downsample evenly
  if exceeded). astryx is ~6 months old → ~26 weekly points, a fuller animation than 7 monthly.
  Also `anchorPoints(createdAt, total)` for Tier D. No network.
- `scripts/lib/script-cues.ts` — parses `script.md` text (legend comment block **excluded**):
  - `extractMemeCues(md) → {beat, raw}[]`
  - `extractScreencastCues(md) → {beat, raw}[]`
  - `extractShortCuts(md) → {beat, raw}[]`
  Each cue is tagged with the `##` beat heading it falls under.

### IO / side-effecting scripts
- `scripts/fetch-star-history.ts` — tiered fetch (A→D), auth token from `GITHUB_TOKEN` env or
  `gh auth token` (never written to disk, never logged). Writes cache
  `episodes/<ep>/assets/star-history.raw.json` `{ repo, tier, fetchedAt, totalCount, points }`
  (gitignored) and derives `episodes/<ep>/assets/StarChart.props.json` for Remotion. Re-runs
  read the cache instead of re-fetching unless `--refresh`.

### Remotion compositions (`remotion/src/`)
- `loadFonts.ts` — registers the bundled woff2 via `@font-face`, `delayRender` until ready.
- `StarChart.tsx` — **unchanged logic** (already real + NaN-guarded); consumes props from the
  fetcher. Add optional `sourceLabel?: string` slot rendered as a small caption when present.
- `Intro.tsx` — finished. Props `{ episodeNumber, branding }`, `branding = { channelName,
  tagline, accent }` with neutral placeholder defaults (channel has no name yet) — **swappable
  via prop**. Animated logo mark (programmatic geometric) + «Выпуск #N» + channel name + tagline.
- `VerdictCard.tsx` — finished. Props `{ verdict, repoName?, branding }`. Per-verdict color:
  ГОДНОТА green · ХАЙП amber · НАКРУТКА red · РАНО blue. Animated stamp reveal.
- `ThumbTemplate.tsx` — real parameterized design (1280×720, `durationInFrames:1`). Props
  `{ hookText, repoName, verdict, bgVariant, branding }`. Slots: bold short hook text · repo
  name/mark · verdict sticker (one of the 4) · high-contrast bg (variant-driven). Three prop
  sets → three variants.
- `Root.tsx` — updated `defaultProps` for the new prop shapes.

---

## 2. Commands

### `/assets` (skeleton → implemented) — owns the **assets phase**
Mirrors `/script`'s structure (read STATE → do work → update STATE → metrics → output contract).
Resume-guarded (if `assets` box checked, stop). Steps:
1. Read `STATE.md` (repo_url, number, verdict, resume guard).
2. **Fetch star history** → run `scripts/fetch-star-history.ts` (cache + props JSON).
3. **Render media** via `remotion render` from `remotion/`:
   - `StarChart` → `assets/StarChart.mp4` (props = fetched series + source label)
   - `Intro` → `assets/Intro.mp4` (episodeNumber, neutral branding)
   - `VerdictCard` → `assets/VerdictCard.mp4` (verdict from STATE)
   - `ThumbTemplate` ×3 → `assets/thumb-v1.png|v2|v3.png` (1280×720; 3 hook-sourced prop sets)
4. **Generate prep docs** (derived from `script.md` via `script-cues.ts`):
   - `assets/MEME_LIST.md` (DoR #4) — each `[МЕМ]` cue: beat · concrete meme suggestion ·
     download source link. Plus a stock-sound list (whoosh, verdict stinger, keyboard) with
     free-source links (Pixabay/Freesound). **Suggestions + links only — no auto-download.**
   - `SHOTLIST.md` at episode root (DoR #6) — every `[СКРИНКАСТ]` cue in order, numbered,
     each a `- [ ]` checkbox, tagged with its beat. The host's Screen Studio checklist.
5. **Update STATE.md** — `current_phase: assets`, `phase_status: done`, check `assets` box,
   `updated:` today. Rewrite `## Next action` into a **manual-phase prep checklist** including
   the music line (DoR #5): `- [ ] Музыка: сгенерировать трек в Suno`, plus voice, screencast
   (→ SHOTLIST.md), memes/sounds (→ MEME_LIST.md), Resolve edit, timecode reconciliation.
   Update `## Artifacts` (assets present).
6. **Metrics** — one `phase_metrics` row, phase `assets` (same inline `db/client.ts` pattern).

### `/publish-pack` (skeleton → implemented, long-video part) — DoR #3
Re-scoped to run **pre-manual** (reads `report.md` / `script.md` / `STATE.md` / verdict; does
**not** need the finished video). Shorts caption part stays an explicit TODO until `/cut-shorts`.
Writes **git-tracked text** to `episodes/<ep>/publish/`:
- `titles.md` — 3–5 Russian titles, ≤100 chars, no clickbait hysteria (CLAUDE.md tone).
- `description.md` — Russian description + **placeholder timecode block** (`00:00 — …` filled
  after edit) + repo link + channel-boilerplate placeholder.
- `tags.txt` — tags (niche + repo topics: дизайн-система, React, StyleX, open source, …).
- `shorts-pitches.md` — one-line pitch per `[SHORT cut]` candidate (2 in ep001's script).

**Does NOT advance the phase state machine.** Pipeline order is assets → manual → publish, so a
pre-manual pack must not claim `publish` is done (it would break resume guards & checklist
semantics — publish "done" while manual hasn't started). Therefore it leaves `current_phase`
and the checklist **untouched**, adds `publish/: present (pre-pack)` to `## Artifacts`, and
records a `phase_metrics` row with `phase: 'publish'`, `notes: 'pre-manual pack'` (metrics may
reference a phase without advancing it). The `publish` box gets checked later, at the real
post-edit publish handoff. This nuance is documented in the command file. Resume-guarded on the
existence of `publish/` files, not on phase state.

---

## 3. `.gitignore` change (DoR #3 & #4)

Text prep docs must stay tracked while rendered media stays ignored. `episodes/*/assets/*`
currently ignores *everything* under assets — which would swallow `MEME_LIST.md`. Fix:

```
episodes/*/assets/*
!episodes/*/assets/.gitkeep
!episodes/*/assets/*.md          # keep text prep docs (MEME_LIST.md) tracked
```

Rendered media (`*.mp4 *.png *.raw.json *.props.json`) stay ignored by the wildcard.
`episodes/*/publish/` is **not** ignored → its text files track by default (no rule needed).
`SHOTLIST.md` lives at episode root → tracked.

---

## 4. ep001 execution (produces the artifacts)

Run the finished tooling against ep001:
- Fetch real star history (Tier A) → `StarChart.mp4` with a real curve.
- Render `Intro.mp4`, `VerdictCard.mp4` (ГОДНОТА), `thumb-v1/v2/v3.png`.
- 3 thumb hook texts drawn from the script hook: v1 «8 лет в Meta?» · v2 «13 000+ приложений?»
  · v3 «тихий postinstall» — all with `astryx` + ГОДНОТА sticker.
- Generate `MEME_LIST.md` (2 meme cues + sounds), `SHOTLIST.md` (11 screencast cues), publish
  bundle (titles/description/tags/short-pitches).
- Update STATE.md, record metrics rows.

---

## 5. Testing

- `star-history.test.ts` — aggregation: raw timestamps → cumulative; weekly-vs-monthly bucket
  selection by repo age; ~52-point cap; single-point & empty edge cases; anchor-points fallback.
- `script-cues.test.ts` — asserts against a **frozen fixture** `scripts/__fixtures__/script-ep001.md`
  (a snapshot copy), NOT the live episode file — the host will edit the real script (adding humor
  is his job) and that must not break the suite. Extractors ignore the legend comment block;
  return exactly 2 meme / 11 screencast / 2 short cues with correct beat tags. Optional
  non-blocking sanity check: cues parse without error and counts > 0 against the live file.
- Remotion visual output verified by rendering (not unit-tested).
- `pnpm test` stays green.

---

## 6. Out of scope (backlog, untouched)

`/retro` impl · Jenkins scout · Resolve API · `/cut-shorts` · Shorts captions in `/publish-pack`
· whisper-subs · real channel branding (kept as swappable placeholder props).

---

## 7. Commit plan (atomic) → PR into `main`

1. `docs: phase-2 DoR design spec + star-honesty content rule in CLAUDE.md`
2. `feat(remotion): bundle Cyrillic font + loadFonts helper`
3. `feat(remotion): finish Intro + VerdictCard compositions`
4. `feat(remotion): real parameterized ThumbTemplate`
5. `feat(scripts): tiered star-history fetcher + aggregation lib + tests`
6. `feat(scripts): script-cue extractors + tests`
7. `feat(assets): implement /assets command (render + prep docs)`
8. `feat(publish): implement /publish-pack (long-video part)`
9. `chore(gitignore): track assets/*.md prep docs, ignore rendered media`
10. `feat(ep001): render assets, generate MEME/SHOT/publish, advance STATE`
