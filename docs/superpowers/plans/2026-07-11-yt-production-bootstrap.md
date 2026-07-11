# yt-production Phase 1 Bootstrap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the architecture of the `yt-production` content pipeline and ship a working Phase-1 MVP: two real commands (`/review-repo`, `/script`), a working Remotion `StarChart`, a local Drizzle metrics DB, plus documented skeletons for every remaining phase.

**Architecture:** File-based pipeline — no orchestrators/queues/services. Each of 7 phases is an independently runnable Claude Code command (`.claude/commands/*.md`) driven by a per-episode `STATE.md`. Third-party code runs only inside `episodes/<ep>/sandbox/`. Remotion lives as a standalone pnpm package under `remotion/`. A local `db/tracker.sqlite` (Drizzle) records episode/phase metrics, decoupled from any global tracker.

**Tech Stack:** TypeScript, Node 22, pnpm 9, Drizzle ORM + better-sqlite3, drizzle-kit, vitest, tsx, Remotion 4.x (React 19).

**Source of truth:** `docs/superpowers/specs/2026-07-11-yt-production-bootstrap-design.md`. Read it before starting; this plan implements it section by section.

---

## File structure (what gets created)

```
CLAUDE.md                              # project charter (spec §5, §5a)
README.md                              # pipeline map + build order (spec §11)
.gitignore                             # spec §9
package.json                           # root: tsx, vitest, drizzle, better-sqlite3
pnpm-workspace.yaml                    # excludes remotion/ from root install (standalone)
tsconfig.json
vitest.config.ts
.claude/commands/review-repo.md        # REAL (spec §6)
.claude/commands/script.md             # REAL (spec §6)
.claude/commands/scout.md              # skeleton (spec §7)
.claude/commands/assets.md             # skeleton
.claude/commands/cut-shorts.md         # skeleton (timecode discipline, spec §5a/§7)
.claude/commands/publish-pack.md       # skeleton
.claude/commands/retro.md              # skeleton
.claude/skills/star-forensics/SKILL.md # skeleton (spec §7)
.claude/skills/remotion-scenes/SKILL.md
.claude/skills/thumb-gen/SKILL.md
.claude/skills/whisper-subs/SKILL.md
templates/STATE.md                     # spec §4
templates/report.md                    # spec §6
templates/script.md                    # spec §6, §5a
db/schema.ts                           # Drizzle schema (spec §8)
db/drizzle.config.ts
db/client.ts                           # openDb() helper
scripts/episode-id.ts                  # pure nextEpisodeId() (spec §4)
scripts/episode-id.test.ts             # vitest
scripts/init-episode.ts               # CLI: create episode dir + STATE.md
scripts/init-episode.test.ts           # vitest (pure parts)
remotion/package.json                  # standalone package
remotion/remotion.config.ts
remotion/tsconfig.json
remotion/src/Root.tsx                  # registers compositions
remotion/src/StarChart.tsx             # WORKING PoC (spec §10)
remotion/src/starchart-data.ts         # test data + prop types
remotion/src/Intro.tsx                 # stub
remotion/src/VerdictCard.tsx           # stub
remotion/src/ThumbTemplate.tsx         # stub
episodes/.gitkeep
```

---

## Task 1: Project scaffolding (pnpm, gitignore, tsconfig, dirs)

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `episodes/.gitkeep`

- [ ] **Step 1: Write `.gitignore`** (spec §9 — directories wholesale, not extensions)

```gitignore
# episode heavy artifacts
episodes/*/sandbox/
episodes/*/assets/*
episodes/*/shorts/*
!episodes/*/assets/.gitkeep
!episodes/*/shorts/.gitkeep

# local db
db/tracker.sqlite
db/tracker.sqlite-*

# node
node_modules/
remotion/node_modules/

# build/os
dist/
.DS_Store
```

- [ ] **Step 2: Write root `package.json`**

```json
{
  "name": "yt-production",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate --config db/drizzle.config.ts",
    "db:migrate": "drizzle-kit migrate --config db/drizzle.config.ts",
    "episode:init": "tsx scripts/init-episode.ts"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "@types/node": "^22.10.0",
    "drizzle-kit": "^0.30.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  },
  "dependencies": {
    "better-sqlite3": "^11.7.0",
    "drizzle-orm": "^0.38.0"
  }
}
```

- [ ] **Step 3: Write `pnpm-workspace.yaml`** (keep `remotion/` out of the root install — it is a standalone package with its own lockfile)

```yaml
packages: []
# remotion/ is intentionally standalone: install/run it from inside remotion/.
```

- [ ] **Step 4: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"],
    "noEmit": true
  },
  "include": ["scripts/**/*.ts", "db/**/*.ts"],
  "exclude": ["node_modules", "remotion", "episodes"]
}
```

- [ ] **Step 5: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['scripts/**/*.test.ts', 'db/**/*.test.ts'],
    environment: 'node',
  },
})
```

- [ ] **Step 6: Create dir markers**

Run:
```bash
mkdir -p episodes .claude/commands .claude/skills templates db scripts
touch episodes/.gitkeep
```

- [ ] **Step 7: Install and verify**

Run: `pnpm install`
Expected: installs without error; `node_modules/` present; `pnpm test` runs (0 tests found is fine at this point — exit 0).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold pnpm project, gitignore, tsconfig, vitest"
```

---

## Task 2: Episode-id helper (pure, TDD)

Implements spec §4: channel-wide sequential `NNN` that never resets; `YYYY-MM` prefix for sorting only.

**Files:**
- Create: `scripts/episode-id.ts`, `scripts/episode-id.test.ts`

- [ ] **Step 1: Write the failing test** → `scripts/episode-id.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { nextEpisodeNumber, formatEpisodeId, nextEpisodeId } from './episode-id'

describe('nextEpisodeNumber', () => {
  it('returns 1 when there are no episodes', () => {
    expect(nextEpisodeNumber([])).toBe(1)
  })
  it('is channel-wide max+1, ignoring date prefix and month', () => {
    expect(nextEpisodeNumber(['2026-07-ep001', '2026-08-ep005', '2026-06-ep003'])).toBe(6)
  })
  it('ignores non-episode dir names', () => {
    expect(nextEpisodeNumber(['.gitkeep', 'scratch', '2026-07-ep002'])).toBe(3)
  })
  it('does not reset per month', () => {
    expect(nextEpisodeNumber(['2026-12-ep009', '2027-01-ep010'])).toBe(11)
  })
})

describe('formatEpisodeId', () => {
  it('zero-pads NNN to 3 digits and prefixes year-month', () => {
    expect(formatEpisodeId(7, '2026-07')).toBe('2026-07-ep007')
    expect(formatEpisodeId(42, '2026-07')).toBe('2026-07-ep042')
  })
  it('does not truncate numbers above 999', () => {
    expect(formatEpisodeId(1000, '2030-01')).toBe('2030-01-ep1000')
  })
})

describe('nextEpisodeId', () => {
  it('combines next number with the given year-month', () => {
    expect(nextEpisodeId(['2026-07-ep001'], '2026-08')).toBe('2026-08-ep002')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run scripts/episode-id.test.ts`
Expected: FAIL — cannot resolve `./episode-id`.

- [ ] **Step 3: Write `scripts/episode-id.ts`**

```ts
const EPISODE_DIR_RE = /-ep(\d+)$/

/** Highest channel-wide episode number across all folder names, +1. Never resets. */
export function nextEpisodeNumber(dirNames: string[]): number {
  let max = 0
  for (const name of dirNames) {
    const m = name.match(EPISODE_DIR_RE)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return max + 1
}

/** `YYYY-MM` prefix is for folder sorting only; NNN is the channel-wide identity. */
export function formatEpisodeId(n: number, yearMonth: string): string {
  return `${yearMonth}-ep${String(n).padStart(3, '0')}`
}

export function nextEpisodeId(dirNames: string[], yearMonth: string): string {
  return formatEpisodeId(nextEpisodeNumber(dirNames), yearMonth)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run scripts/episode-id.test.ts`
Expected: PASS (8 assertions).

- [ ] **Step 5: Commit**

```bash
git add scripts/episode-id.ts scripts/episode-id.test.ts
git commit -m "feat: channel-wide episode-id helper"
```

---

## Task 3: STATE.md template + init-episode CLI

Implements spec §4. The template is the contract; the CLI seeds a new episode from it.

**Files:**
- Create: `templates/STATE.md`, `scripts/init-episode.ts`, `scripts/init-episode.test.ts`

- [ ] **Step 1: Write `templates/STATE.md`** (placeholders in `{{...}}`)

```markdown
---
episode: {{EPISODE_ID}}
number: {{NUMBER}}
repo_url: {{REPO_URL}}
title:
current_phase: scout
phase_status: pending
verdict:
youtube_video_id:
updated: {{DATE}}
---

## Phase checklist
- [ ] scout
- [ ] review
- [ ] script
- [ ] assets
- [ ] manual
- [ ] publish
- [ ] retro

## Next action
Run `/review-repo {{REPO_URL}}` for this episode.

## Artifacts
- report.md: —
- script.md: —
- sandbox/: —
- assets/: —
```

- [ ] **Step 2: Write the failing test** → `scripts/init-episode.test.ts`

Tests the pure rendering function (no filesystem):

```ts
import { describe, it, expect } from 'vitest'
import { renderState } from './init-episode'

describe('renderState', () => {
  it('substitutes every placeholder', () => {
    const tpl = 'episode: {{EPISODE_ID}}\nnumber: {{NUMBER}}\nrepo_url: {{REPO_URL}}\nupdated: {{DATE}}'
    const out = renderState(tpl, {
      episodeId: '2026-07-ep001',
      number: 1,
      repoUrl: 'https://github.com/o/r',
      date: '2026-07-11',
    })
    expect(out).toBe('episode: 2026-07-ep001\nnumber: 1\nrepo_url: https://github.com/o/r\nupdated: 2026-07-11')
    expect(out).not.toMatch(/\{\{/)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run scripts/init-episode.test.ts`
Expected: FAIL — cannot resolve `./init-episode`.

- [ ] **Step 4: Write `scripts/init-episode.ts`**

```ts
import { readdirSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { nextEpisodeId, nextEpisodeNumber } from './episode-id'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const EPISODES = join(ROOT, 'episodes')

export interface StateVars {
  episodeId: string
  number: number
  repoUrl: string
  date: string
}

export function renderState(template: string, v: StateVars): string {
  return template
    .replaceAll('{{EPISODE_ID}}', v.episodeId)
    .replaceAll('{{NUMBER}}', String(v.number))
    .replaceAll('{{REPO_URL}}', v.repoUrl)
    .replaceAll('{{DATE}}', v.date)
}

function listEpisodeDirs(): string[] {
  if (!existsSync(EPISODES)) return []
  return readdirSync(EPISODES, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

// CLI: pnpm episode:init <repo_url>
function main() {
  const repoUrl = process.argv[2]
  if (!repoUrl) {
    console.error('Usage: pnpm episode:init <repo_url>')
    process.exit(1)
  }
  const dirs = listEpisodeDirs()
  const date = today()
  const yearMonth = date.slice(0, 7)
  const episodeId = nextEpisodeId(dirs, yearMonth)
  const number = nextEpisodeNumber(dirs)
  const epDir = join(EPISODES, episodeId)
  mkdirSync(join(epDir, 'assets'), { recursive: true })
  mkdirSync(join(epDir, 'shorts'), { recursive: true })
  writeFileSync(join(epDir, 'assets', '.gitkeep'), '')
  writeFileSync(join(epDir, 'shorts', '.gitkeep'), '')
  const tpl = readFileSync(join(ROOT, 'templates', 'STATE.md'), 'utf8')
  writeFileSync(join(epDir, 'STATE.md'), renderState(tpl, { episodeId, number, repoUrl, date }))
  console.log(episodeId)
}

// Run main only when invoked directly, not when imported by tests.
if (process.argv[1] && process.argv[1].endsWith('init-episode.ts')) main()
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run scripts/init-episode.test.ts`
Expected: PASS.

- [ ] **Step 6: Smoke-test the CLI, then delete the throwaway episode**

Run: `pnpm episode:init https://github.com/o/r && ls episodes && cat episodes/*/STATE.md`
Expected: prints `2026-07-ep001`; STATE.md has no `{{` left; `assets/.gitkeep` and `shorts/.gitkeep` exist.
Then: `rm -rf episodes/2026-07-ep001` (keep the repo clean; real episodes come in Task 11).

- [ ] **Step 7: Commit**

```bash
git add templates/STATE.md scripts/init-episode.ts scripts/init-episode.test.ts
git commit -m "feat: STATE.md template + init-episode CLI"
```

---

## Task 4: Drizzle schema + client + migration (spec §8)

**Files:**
- Create: `db/schema.ts`, `db/drizzle.config.ts`, `db/client.ts`

- [ ] **Step 1: Write `db/schema.ts`**

```ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const episodes = sqliteTable('episodes', {
  id: text('id').primaryKey(), // e.g. 2026-07-ep001
  number: integer('number').notNull(), // channel-wide sequential
  repoUrl: text('repo_url').notNull(),
  title: text('title'),
  verdict: text('verdict'), // ГОДНОТА | ХАЙП | НАКРУТКА | РАНО
  currentPhase: text('current_phase').notNull().default('scout'),
  youtubeVideoId: text('youtube_video_id'), // nullable now; retro joins Analytics later
  createdAt: integer('created_at').notNull(),
})

export const phaseMetrics = sqliteTable('phase_metrics', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  episodeId: text('episode_id')
    .notNull()
    .references(() => episodes.id),
  phase: text('phase').notNull(), // scout|review|script|assets|manual|publish|retro
  startedAt: integer('started_at'),
  endedAt: integer('ended_at'),
  durationS: integer('duration_s'),
  iterations: integer('iterations'),
  notes: text('notes'),
})
```

- [ ] **Step 2: Write `db/drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './db/schema.ts',
  out: './db/migrations',
  dbCredentials: { url: './db/tracker.sqlite' },
})
```

- [ ] **Step 3: Write `db/client.ts`**

```ts
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as schema from './schema'

const DB_PATH = join(dirname(fileURLToPath(import.meta.url)), 'tracker.sqlite')

export function openDb(path: string = DB_PATH) {
  const sqlite = new Database(path)
  sqlite.pragma('journal_mode = WAL')
  return drizzle(sqlite, { schema })
}

export { schema }
```

- [ ] **Step 4: Generate the migration and verify columns exist**

Run: `pnpm db:generate`
Expected: creates `db/migrations/0000_*.sql`.
Verify: `grep -E "youtube_video_id|phase_metrics|episodes" db/migrations/*.sql`
Expected: migration SQL contains the `episodes` table with `youtube_video_id`, and the `phase_metrics` table.

- [ ] **Step 5: Apply migration to a throwaway db and inspect schema, then delete it**

Run:
```bash
pnpm db:migrate
sqlite3 db/tracker.sqlite ".schema episodes" ".schema phase_metrics"
rm -f db/tracker.sqlite db/tracker.sqlite-*
```
Expected: both tables print with the columns from §8, including nullable `youtube_video_id`. (`tracker.sqlite` is gitignored — deleting keeps things clean; it is recreated on demand.)

- [ ] **Step 6: Commit**

```bash
git add db/schema.ts db/drizzle.config.ts db/client.ts db/migrations
git commit -m "feat: drizzle schema for episode + phase metrics"
```

---

## Task 5: report.md + script.md templates (spec §6, §5a)

**Files:**
- Create: `templates/report.md`, `templates/script.md`

- [ ] **Step 1: Write `templates/report.md`** — semantic video moments, NO timecodes (clock (a))

```markdown
# Review: {{REPO}}

**URL:** {{REPO_URL}}
**Reviewed:** {{DATE}}

## Заявлено (Claimed)
<what the README / marketing promises>

## Работает (Works)
<what actually worked in the sandbox>

## Сломалось (Broke)
<what failed, with the actual errors>

## Подозрительно (Suspicious)
<red flags; star-forensics signal — velocity vs contributors/age/issues>

## Моменты для видео (Video moments — semantic, NO timecodes)
<!-- Clock (a): there is no recording of the test run. Describe WHAT to show,
     never "tt:tt". e.g. "the moment `npm start` crashes with ERR_X" -->
- <moment 1>
- <moment 2>

## Черновой вердикт (Draft verdict lean)
**{{VERDICT}}** — <argued in one paragraph. Scale: ГОДНОТА / ХАЙП / НАКРУТКА / РАНО>
```

- [ ] **Step 2: Write `templates/script.md`** — semantic screencast cues + candidate SHORT markers (clocks (b), (c))

```markdown
# Сценарий: {{REPO}} — {{VERDICT}}?

<!-- Tags:
     [ГОЛОС] voiceover line
     [СКРИНКАСТ: что показать] — shooting instruction (clock b), NOT a timecode
     [АНИМАЦИЯ: ...] Remotion scene cue
     [МЕМ: ...] meme cue
     [SHORT cut: <narrative beat>] — CANDIDATE Short (clock c). Real final-video
        timecodes are reconciled after the Resolve edit; /cut-shorts uses THOSE. -->

## Хук (0–15 сек)
[ГОЛОС] ...
[СКРИНКАСТ: ...]

## Что это за репо (15–60 сек)
[ГОЛОС] ...
[АНИМАЦИЯ: StarChart — рост звёзд]

## Живой тест (основа)
[ГОЛОС] ...
[СКРИНКАСТ: ...]
[SHORT cut: <the funniest failure beat>]

## Где README врёт
[ГОЛОС] ...

## Вердикт
[ГОЛОС] ...
[АНИМАЦИЯ: VerdictCard — {{VERDICT}}]
```

- [ ] **Step 3: Verify templates have no leftover conflicting guidance**

Run: `grep -nE "tt:tt|из теста" templates/*.md`
Expected: no matches (the deprecated timecode style must be absent).

- [ ] **Step 4: Commit**

```bash
git add templates/report.md templates/script.md
git commit -m "feat: report.md and script.md templates with three-clocks discipline"
```

---

## Task 6: `/review-repo` command (spec §6) — REAL

Command files are Markdown instructions Claude Code executes. The "test" is a real run in Task 11; here we author a complete, unambiguous procedure.

**Files:**
- Create: `.claude/commands/review-repo.md`

- [ ] **Step 1: Write `.claude/commands/review-repo.md`**

Author the command with these mandatory sections (full prose, no placeholders left):
  - **Usage:** `/review-repo <url> [--episode <id>]`
  - **Step 1 — Resolve episode:** if `--episode` given, use it; else run `pnpm episode:init <url>` and capture the printed episode id. Read the episode's `STATE.md` first.
  - **Step 2 — Clone into sandbox:** `git clone --depth 1 <url> episodes/<ep>/sandbox/<repo>`. State plainly: the sandbox is the ONLY place third-party code, network, and execution are allowed; install nothing globally.
  - **Step 3 — Safety gate (spec §6.3):** before running anything, scan for `postinstall`/`preinstall` in package.json, `curl … | sh`, `wget … | bash`, obfuscated payloads, network calls in build scripts. Any hit → record under "Suspicious" in report and **STOP for explicit host approval before executing**. Also show the host the candidate repo before executing any of its code.
  - **Step 4 — Understand & run:** read README + structure; detect stack; attempt install & run and a basic usage scenario, all inside the sandbox.
  - **Step 5 — Write report:** copy `templates/report.md` → `episodes/<ep>/report.md`, fill every section. **Video moments are semantic — never timecodes (clock (a), spec §5a).**
  - **Step 6 — Update STATE.md:** `current_phase: review`, `phase_status: done`, update Artifacts + Next action (`Run /script`); check the review box.
  - **Step 7 — Record metrics:** append a `phase_metrics` row (phase `review`, duration, iterations) via a short `tsx` snippet using `db/client.ts` (`openDb()`), inserting the episode row if missing.
  - **Output contract / side-effects** block at the end (writes only within `episodes/<ep>/`, plus `db/tracker.sqlite`).

- [ ] **Step 2: Verify the command forbids timecodes and encodes the safety gate**

Run: `grep -nE "semantic|Suspicious|postinstall|approval|tt:tt" .claude/commands/review-repo.md`
Expected: `semantic`, `Suspicious`, `postinstall`, `approval` present; `tt:tt` absent.

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/review-repo.md
git commit -m "feat: /review-repo command (sandboxed repo review)"
```

---

## Task 7: `/script` command (spec §6) — REAL

**Files:**
- Create: `.claude/commands/script.md`

- [ ] **Step 1: Write `.claude/commands/script.md`**

Author with these mandatory sections:
  - **Usage:** `/script [--episode <id>]` (default: the most recent episode whose `phase_status` for review is `done`).
  - **Step 1 — Read inputs:** the episode `STATE.md`, `report.md`, and the script structure + verdict scale from `CLAUDE.md`.
  - **Step 2 — Write script:** copy `templates/script.md` → `episodes/<ep>/script.md`; fill the five beats (hook 0–15s → what-is-it 15–60s → live test → where-README-lies → verdict). Use tags exactly: `[ГОЛОС]`, `[СКРИНКАСТ: <what to show>]` (semantic, clock (b)), `[АНИМАЦИЯ: …]`, `[МЕМ: …]`, `[SHORT cut: <narrative beat>]` (candidate only, clock (c)). Explicitly forbid `tt:tt`/"из теста" and any claim of real timecodes.
  - **Step 3 — Update STATE.md:** `current_phase: script`, `phase_status: done`, Artifacts (`script.md: present`), Next action (`Manual phase: record voice + screencast, edit in Resolve, then reconcile timecodes`); check the script box.
  - **Step 4 — Record metrics:** append `phase_metrics` row (phase `script`) via `db/client.ts`.
  - **Output contract / side-effects** block.

- [ ] **Step 2: Verify tag discipline**

Run: `grep -nE "СКРИНКАСТ: <what to show>|SHORT cut: <narrative beat>|tt:tt" .claude/commands/script.md`
Expected: both semantic tag forms present; `tt:tt` absent.

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/script.md
git commit -m "feat: /script command (draft from report by template)"
```

---

## Task 8: Skeleton commands (spec §7) — contracts + TODO only

**Files:**
- Create: `.claude/commands/scout.md`, `assets.md`, `cut-shorts.md`, `publish-pack.md`, `retro.md`

Each file has the SAME shape: `# <name>`, one-line purpose, **Input**, **Output**, **Side-effects**, and a `## TODO (not implemented)` list. No logic.

- [ ] **Step 1: Write `scout.md`**

Content requirements: purpose = discover candidates. Input: none (or `--limit N`). Process contract: run the global `github-trending` skill (it WebFetches `github.com/trending?since=weekly` and writes `~/atlas-knowledge/news/github-trending.md`), parse that file, score by stars-this-week velocity, dedupe against existing `episodes/`, check for an existing Russian video, emit a candidate list to stdout/file. Note headless/CLI + future Jenkins compatibility. TODO list.

- [ ] **Step 2: Write `assets.md`**

Purpose = render Remotion scenes + 3 thumbnails. Input: `--episode <id>` + verdict + star data from report. Output: files in `episodes/<ep>/assets/` (gitignored). Side-effects: invokes Remotion render. TODO list.

- [ ] **Step 3: Write `cut-shorts.md`** — MUST encode timecode discipline (spec §5a/§7)

Purpose = slice Shorts + Russian subs. **Input: the RECONCILED real final-video timecodes** written into STATE.md/script.md during the manual phase — explicitly NOT the `[SHORT cut]` candidate markers from the script draft (those are narrative beats). Output: `episodes/<ep>/shorts/*` (gitignored). Side-effects: FFmpeg + Whisper. A prominent WARNING that the implementation must never assume script-draft timecodes are real. TODO list.

- [ ] **Step 4: Write `publish-pack.md`**

Purpose = prepare artifacts for the existing Late API pipeline (does NOT publish). Input: `--episode <id>`, finished video + shorts. Output: descriptions/tags + a hand-off bundle. Side-effects: none external. TODO list.

- [ ] **Step 5: Write `retro.md`**

Purpose = pull YouTube Analytics → `db/tracker.sqlite`, compare vs past episodes, record hypotheses, propose skill/command fixes. Input: `--episode <id>` (needs `youtube_video_id` in STATE.md/db). Output: retro notes + metric rows. TODO list.

- [ ] **Step 6: Verify all five are skeletons with contracts**

Run: `for f in scout assets cut-shorts publish-pack retro; do echo "== $f =="; grep -cE "Input|Output|Side-effects|TODO" .claude/commands/$f.md; done`
Expected: each prints `4` (all four contract headings present).
Also: `grep -n "reconcil" .claude/commands/cut-shorts.md` → matches (timecode discipline documented).

- [ ] **Step 7: Commit**

```bash
git add .claude/commands/scout.md .claude/commands/assets.md .claude/commands/cut-shorts.md .claude/commands/publish-pack.md .claude/commands/retro.md
git commit -m "docs: skeleton contracts for scout/assets/cut-shorts/publish-pack/retro"
```

---

## Task 9: Skeleton skills (spec §7)

**Files:**
- Create: `.claude/skills/{star-forensics,remotion-scenes,thumb-gen,whisper-subs}/SKILL.md`

Each `SKILL.md` has valid frontmatter (`name`, `description`) + a body with **Purpose**, **Input**, **Output**, `## TODO (not implemented)`.

- [ ] **Step 1: Write `star-forensics/SKILL.md`** — heuristics for detecting inflated/manufactured star growth (velocity vs age, contributor count, issue/PR activity, star-burst patterns).

- [ ] **Step 2: Write `remotion-scenes/SKILL.md`** — how to parameterize and render the Remotion compositions (props contracts for StarChart/Intro/VerdictCard).

- [ ] **Step 3: Write `thumb-gen/SKILL.md`** — programmatic thumbnail rendering, 3 variants (text always rendered, never generative — spec §5 content rule).

- [ ] **Step 4: Write `whisper-subs/SKILL.md`** — Russian subtitle generation via Whisper.

- [ ] **Step 5: Verify frontmatter is valid on all four**

Run: `for d in star-forensics remotion-scenes thumb-gen whisper-subs; do echo "== $d =="; head -4 .claude/skills/$d/SKILL.md; done`
Expected: each starts with `---` then `name:` and `description:`.

- [ ] **Step 6: Commit**

```bash
git add .claude/skills
git commit -m "docs: skeleton SKILL.md for star-forensics/remotion-scenes/thumb-gen/whisper-subs"
```

---

## Task 10: Remotion standalone package + working StarChart (spec §10)

Standalone package: install and run from inside `remotion/` (not part of the root pnpm install).

**Files:**
- Create: `remotion/package.json`, `remotion/remotion.config.ts`, `remotion/tsconfig.json`, `remotion/src/{Root,StarChart,Intro,VerdictCard,ThumbTemplate}.tsx`, `remotion/src/starchart-data.ts`

- [ ] **Step 1: Scaffold the package**

Run: `cd remotion && pnpm dlx create-video@latest --help >/dev/null 2>&1 || true`
Then author files manually (do NOT rely on interactive scaffolding). Write `remotion/package.json`:

```json
{
  "name": "yt-production-remotion",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "studio": "remotion studio",
    "compositions": "remotion compositions src/Root.tsx"
  },
  "dependencies": {
    "@remotion/cli": "^4.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "remotion": "^4.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Write `remotion/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "lib": ["ES2022", "DOM"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `remotion/remotion.config.ts`**

```ts
import { Config } from '@remotion/cli/config'

Config.setVideoImageFormat('jpeg')
Config.setOverwriteOutput(true)
```

- [ ] **Step 4: Write `remotion/src/starchart-data.ts`** (prop types + test data)

```ts
export interface StarPoint {
  date: string
  stars: number
}

export interface StarChartProps {
  repoName: string
  data: StarPoint[]
}

export const TEST_STARCHART: StarChartProps = {
  repoName: 'owner/hyped-repo',
  data: [
    { date: '2026-01', stars: 120 },
    { date: '2026-02', stars: 340 },
    { date: '2026-03', stars: 900 },
    { date: '2026-04', stars: 2600 },
    { date: '2026-05', stars: 7100 },
    { date: '2026-06', stars: 15200 },
  ],
}
```

- [ ] **Step 5: Write `remotion/src/StarChart.tsx`** (fully working, spring-in reveal, props-driven)

```tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion'
import type { StarChartProps } from './starchart-data'

export const StarChart: React.FC<StarChartProps> = ({ repoName, data }) => {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()

  const pad = 80
  const chartW = width - pad * 2
  const chartH = height - pad * 2
  const maxStars = Math.max(...data.map((d) => d.stars), 1)

  const points = data.map((d, i) => ({
    x: pad + (chartW * i) / (data.length - 1),
    y: pad + chartH - (chartH * d.stars) / maxStars,
    stars: d.stars,
    date: d.date,
  }))

  // Reveal the line progressively; spring the whole thing in.
  const grow = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 60 })
  const shown = Math.max(1, Math.round(grow * points.length))
  const visible = points.slice(0, shown)
  const path = visible.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{ backgroundColor: '#0d1117', fontFamily: 'sans-serif' }}>
      <svg width={width} height={height}>
        <text x={pad} y={pad - 30} fill="#e6edf3" fontSize={44} opacity={titleOpacity}>
          ⭐ {repoName}
        </text>
        {/* baseline axis */}
        <line x1={pad} y1={pad + chartH} x2={pad + chartW} y2={pad + chartH} stroke="#30363d" strokeWidth={2} />
        <path d={path} fill="none" stroke="#facc15" strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />
        {visible.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={8} fill="#facc15" />
            <text x={p.x} y={p.y - 18} fill="#e6edf3" fontSize={24} textAnchor="middle">
              {p.stars.toLocaleString()}
            </text>
            <text x={p.x} y={pad + chartH + 34} fill="#8b949e" fontSize={22} textAnchor="middle">
              {p.date}
            </text>
          </g>
        ))}
      </svg>
    </AbsoluteFill>
  )
}
```

- [ ] **Step 6: Write the three stubs**

`remotion/src/Intro.tsx`:
```tsx
import { AbsoluteFill } from 'remotion'
// STUB: channel intro. TODO: animate logo + episode number.
export const Intro: React.FC<{ episodeNumber: number }> = ({ episodeNumber }) => (
  <AbsoluteFill style={{ backgroundColor: '#0d1117', color: '#e6edf3', justifyContent: 'center', alignItems: 'center', fontSize: 80, fontFamily: 'sans-serif' }}>
    #{episodeNumber}
  </AbsoluteFill>
)
```

`remotion/src/VerdictCard.tsx`:
```tsx
import { AbsoluteFill } from 'remotion'
// STUB: verdict plate. TODO: per-verdict color + animation.
export const VerdictCard: React.FC<{ verdict: string }> = ({ verdict }) => (
  <AbsoluteFill style={{ backgroundColor: '#0d1117', color: '#facc15', justifyContent: 'center', alignItems: 'center', fontSize: 96, fontFamily: 'sans-serif', fontWeight: 700 }}>
    {verdict}
  </AbsoluteFill>
)
```

`remotion/src/ThumbTemplate.tsx`:
```tsx
import { AbsoluteFill } from 'remotion'
// STUB: thumbnail (text ALWAYS programmatic, never generative — spec §5). TODO: 3 variants.
export const ThumbTemplate: React.FC<{ repoName: string; verdict: string }> = ({ repoName, verdict }) => (
  <AbsoluteFill style={{ backgroundColor: '#0d1117', color: '#e6edf3', justifyContent: 'center', alignItems: 'center', fontSize: 64, fontFamily: 'sans-serif' }}>
    {repoName} — {verdict}?
  </AbsoluteFill>
)
```

- [ ] **Step 7: Write `remotion/src/Root.tsx`** (register all compositions)

```tsx
import { Composition } from 'remotion'
import { StarChart } from './StarChart'
import { Intro } from './Intro'
import { VerdictCard } from './VerdictCard'
import { ThumbTemplate } from './ThumbTemplate'
import { TEST_STARCHART } from './starchart-data'

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="StarChart"
      component={StarChart}
      durationInFrames={120}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={TEST_STARCHART}
    />
    <Composition id="Intro" component={Intro} durationInFrames={90} fps={30} width={1920} height={1080} defaultProps={{ episodeNumber: 1 }} />
    <Composition id="VerdictCard" component={VerdictCard} durationInFrames={90} fps={30} width={1920} height={1080} defaultProps={{ verdict: 'ХАЙП' }} />
    <Composition id="ThumbTemplate" component={ThumbTemplate} durationInFrames={1} fps={30} width={1280} height={720} defaultProps={{ repoName: 'owner/repo', verdict: 'ХАЙП' }} />
  </>
)
```

Remotion also needs an entry that calls `registerRoot`. Write `remotion/src/index.ts`:
```ts
import { registerRoot } from 'remotion'
import { RemotionRoot } from './Root'
registerRoot(RemotionRoot)
```
And set `"remotion": { "entry": "src/index.ts" }` OR pass `src/Root.tsx` to CLI. Simplest: keep `registerRoot` in `index.ts` and add to `remotion/remotion.config.ts` nothing extra; run studio via `remotion studio src/index.ts`. Update the two scripts in `remotion/package.json` accordingly (`"studio": "remotion studio src/index.ts"`, `"compositions": "remotion compositions src/index.ts"`).

- [ ] **Step 8: Install and verify compositions list (headless, no GUI needed)**

Run:
```bash
cd remotion && pnpm install && pnpm compositions
```
Expected: output lists `StarChart`, `Intro`, `VerdictCard`, `ThumbTemplate`. This proves the project compiles and registers correctly without needing a visual studio window.

- [ ] **Step 9: (Optional visual confirm) render one StarChart frame**

Run: `cd remotion && pnpm dlx remotion render src/index.ts StarChart /tmp/starchart.mp4 --frames=0-59`
Expected: renders without error (requires Chromium download on first run). If the environment can't render, skip — Step 8 already proves compilation. Delete `/tmp/starchart.mp4` after.

- [ ] **Step 10: Commit**

```bash
cd .. && git add remotion && git commit -m "feat: standalone remotion package + working StarChart PoC"
```

---

## Task 11: CLAUDE.md + README + end-to-end validation

CLAUDE.md must be self-sufficient (spec §5). README is the pipeline map (spec §11). Then run the two real commands on a real repo.

**Files:**
- Create: `CLAUDE.md`, overwrite `README.md`

- [ ] **Step 1: Write `CLAUDE.md`** covering (spec §5, §5a): channel concept/format/tone; script structure with timing; verdict scale (ГОДНОТА/ХАЙП/НАКРУТКА/РАНО with the §5 definitions); the 7 phases + transitions + STATE.md contract (§4); the three-clocks timecode discipline (§5a); content rules (no AI voice/b-roll; thumbnail text always programmatic); conventions (content RU, code+commits EN); `/review-repo` safety rules (§6.3). Reference commands by name.

- [ ] **Step 2: Write `README.md`** (overwrite the stub): pipeline map (7 phases, which are real vs skeleton in Phase 1), quick start (`pnpm install`; `/review-repo <url>`; `/script`; `cd remotion && pnpm install && pnpm studio`), and the build-order principle: *automate next whatever phase hurt most in the last retro.*

- [ ] **Step 3: Verify CLAUDE.md completeness**

Run: `grep -cE "ГОДНОТА|ХАЙП|НАКРУТКА|РАНО|STATE.md|screencast|AI-голос|AI voice|programmatic|clock" CLAUDE.md`
Expected: ≥ 6 (all key concepts present). Manually confirm each spec §5 bullet is covered.

- [ ] **Step 4: Commit docs**

```bash
git add CLAUDE.md README.md
git commit -m "docs: self-sufficient CLAUDE.md charter + README pipeline map"
```

- [ ] **Step 5: Pick a small real trending repo and get host go-ahead**

Run the global `github-trending` skill (or read `~/atlas-knowledge/news/github-trending.md` if fresh). Choose a SMALL repo (not a huge framework). **Show the host the candidate and get explicit go-ahead before executing any of its code** (spec §6.3, standing user instruction).

- [ ] **Step 6: Run `/review-repo <chosen-url>` end-to-end**

Expected: episode dir created (`2026-07-ep001`); repo cloned under `episodes/2026-07-ep001/sandbox/`; safety gate ran; `report.md` filled with all sections, video moments SEMANTIC (no `tt:tt`); STATE.md shows `review: done`; a `phase_metrics` review row exists.
Verify: `grep -c tt:tt episodes/2026-07-ep001/report.md` → `0`.

- [ ] **Step 7: Run `/script` end-to-end**

Expected: `script.md` created with the five beats and correct tags (`[СКРИНКАСТ: …]` semantic, `[SHORT cut: …]` candidate, no `tt:tt`); STATE.md shows `script: done`.
Verify: `grep -c tt:tt episodes/2026-07-ep001/script.md` → `0`.

- [ ] **Step 8: Commit the sample episode's TEXT artifacts only**

```bash
git add episodes/2026-07-ep001/STATE.md episodes/2026-07-ep001/report.md episodes/2026-07-ep001/script.md
git status --porcelain   # confirm sandbox/, assets/, shorts/ are NOT staged (gitignore working)
git commit -m "test: sample episode 001 review + script artifacts"
```

- [ ] **Step 9: Verify gitignore held**

Run: `git ls-files episodes/ | grep -E "sandbox/|assets/[^.]|shorts/[^.]"`
Expected: no output (only STATE.md/report.md/script.md and `.gitkeep` files are tracked).

---

## Task 12: Final push

- [ ] **Step 1: Full verification sweep**

Run:
```bash
pnpm test            # episode-id + init-episode tests pass
git status            # clean tree
git log --oneline     # atomic commits per task
```
Expected: tests green, tree clean.

- [ ] **Step 2: Push to origin**

```bash
git push -u origin main
```
Expected: pushes all Phase-1 commits to `Romkoos/yt-production`.

---

## Notes for the executor
- Content language is Russian (templates, script output, report headings may be RU); code and commit messages are English.
- Never run flagged/suspicious third-party scripts without explicit host approval; keep all third-party execution inside `episodes/<ep>/sandbox/`.
- `db/tracker.sqlite`, `episodes/*/sandbox/`, `episodes/*/assets/*`, `episodes/*/shorts/*` are gitignored — never force-add them.
