# yt-production — Phase 1 Bootstrap Design

**Date:** 2026-07-11
**Status:** Approved (with amendments)
**Scope:** Lay the architecture of the `yt-production` content pipeline and ship a working Phase-1 MVP.

---

## 1. Product context

`yt-production` is the working name (not the channel name) for a Russian-language
YouTube channel in the niche "разбор трендовых GitHub-репозиториев" — the format is
"a repo is on the rise: deserved, or hype?". The host actually clones, runs and tests
the repo, then delivers an ironic verdict: what in the README is true, what is a lie,
whether the stars are inflated.

Stylistic reference: Fireship — fast pacing, screencasts, code animations, memes, no
face on camera, a **live human voice (never AI)**.

Production cadence: 1 long video (8–12 min) + 3 Shorts per week, on a 3–6 h/week budget,
three evenings per episode. The pipeline automates everything **except**: the host's
voice, the final verdict, the humor, and the DaVinci Resolve edit.

### Full episode lifecycle (7 phases)

1. **scout** — find candidates: trending repos, score by star-growth velocity, check whether a Russian video already exists.
2. **review** — agentic test of the repo: clone into a sandbox, bring it up, run scenarios, write a report of "README vs reality" discrepancies with timecodes of interesting moments.
3. **script** — draft a script from the report by template: hook → what it is → the test → where they lie → verdict.
4. **assets** — render Remotion scenes (star-growth chart, intro, verdict card) and 3 thumbnail variants from a parameterized template.
5. **manual** — human phase: record voice, record screencast (Screen Studio), edit in Resolve. The pipeline waits here.
6. **publish** — slice Shorts from the finished video by timecode (FFmpeg), subtitles (Whisper, Russian), generate descriptions/tags, hand off to the existing Late API pipeline.
7. **retro** — collect YouTube Analytics into SQLite, compare against past episodes, record hypotheses, convert session friction into skill/command fixes.

Phase 1 (this build) makes **only `review` and `script` fully working**; the rest are
documented skeletons.

---

## 2. Repository topology

- The GitHub repo `Romkoos/yt-production` already exists (branch `main`); it is cloned
  into `~/Projects/PersonalProjects/yt-production/` as a **nested git repo** (its own
  `.git`), matching how sibling projects `atlas-os` / `claude-os` already live inside the
  `PersonalProjects` workspace repo. All work and commits happen in `yt-production`'s own
  history; the parent workspace merely sees an untracked nested repo.
- Package manager: **pnpm** (9.x). Node 22.
- Commits are atomic per step; a `push` to `origin main` at the end of Phase 1.

---

## 3. Directory structure

```
yt-production/
├── CLAUDE.md              # project charter (see §5)
├── README.md              # pipeline map + build order (see §11)
├── .gitignore             # see §9
├── .claude/
│   ├── commands/          # review-repo.md, script.md (real)
│   │                      # scout.md, assets.md, cut-shorts.md,
│   │                      # publish-pack.md, retro.md (skeletons)
│   └── skills/            # star-forensics, remotion-scenes,
│                          # thumb-gen, whisper-subs (skeleton SKILL.md)
├── remotion/              # standalone package (own package.json)
│   ├── package.json
│   ├── remotion.config.ts
│   └── src/
│       ├── Root.tsx       # registers compositions
│       ├── StarChart.tsx  # WORKING PoC
│       ├── Intro.tsx      # stub
│       ├── VerdictCard.tsx# stub
│       └── ThumbTemplate.tsx # stub
├── episodes/
│   └── YYYY-MM-epNNN/      # STATE.md, report.md, script.md (git-tracked)
│       ├── sandbox/        # cloned third-party repos (GITIGNORED)
│       ├── assets/         # rendered mp4 / thumbnails (GITIGNORED)
│       └── shorts/         # rendered shorts mp4 (GITIGNORED)
├── templates/             # STATE.md, report.md, script.md
├── db/
│   ├── schema.ts          # Drizzle schema
│   ├── drizzle.config.ts
│   └── tracker.sqlite     # GITIGNORED
└── scripts/               # CLI helpers (episode init, scoring)
```

---

## 4. Episode identity & STATE.md contract

### Episode id

Format `YYYY-MM-epNNN`, e.g. `2026-07-ep001`, `2026-08-ep005`.

- `NNN` is a **channel-wide sequential number that NEVER resets** — not per month, not
  per year. "Episode #17" is a channel-level concept used later in titles, retro, and
  analytics.
- The `YYYY-MM` date prefix exists **only for folder sorting**; it is not part of the
  episode's identity number.
- The next number is derived by scanning existing `episodes/` folders for the highest
  `epNNN` and incrementing (a helper in `scripts/`).

### STATE.md

Every episode owns a `STATE.md` — the single source of truth for "where is this episode".
Any phase command **reads it first** (to resume after a session break) and **writes it
last**. Frontmatter + body:

```markdown
---
episode: 2026-07-ep001
number: 1
repo_url: https://github.com/owner/repo
title: <working title, filled once known>
current_phase: review        # scout|review|script|assets|manual|publish|retro
phase_status: in_progress     # pending|in_progress|blocked|done
verdict:                      # ГОДНОТА|ХАЙП|НАКРУТКА|РАНО (empty until decided)
youtube_video_id:             # filled at/after publish
updated: 2026-07-11
---

## Phase checklist
- [x] scout
- [~] review        # ~ = in progress
- [ ] script
- [ ] assets
- [ ] manual
- [ ] publish
- [ ] retro

## Next action
<one line: what the next session should do>

## Artifacts
- report.md: present
- script.md: —
- sandbox/: <repo> cloned at <path>
- assets/: —
```

Each phase is independently runnable and survives a session break because all state lives
in STATE.md + the episode's files.

---

## 5. CLAUDE.md (project charter — must be self-sufficient)

A fresh Claude Code session must understand the project from CLAUDE.md alone. Contents:

- **Channel concept, format, tone** — ironic experienced-developer voice, no cringe, no
  clickbait hysteria; verdicts are honest and argued.
- **Script structure with timing** — hook (0–15s) → what the repo is (15–60s) → live test
  (the core) → "where the README lies" → verdict.
- **Verdict scale (fixed):**
  - **ГОДНОТА** — genuinely good, delivers what it claims.
  - **ХАЙП** — overhyped: works, but nowhere near the promise / the buzz.
  - **НАКРУТКА** — inflated stars / fake traction; the popularity is manufactured.
  - **РАНО** — promising but too early: not usable yet, come back later.
- **Phases & transitions** — the 7-phase pipeline and the STATE.md contract (§4).
- **Content rules** — no AI voice, no AI video b-roll (the audience is developers; the
  slop detector is instant); thumbnail text is **always a programmatic render**, never
  generative.
- **Conventions** — content language Russian; code and commit language English.
- **Safety rules for `/review-repo`** — see §6.

---

## 6. Phase-1 MVP commands (fully working)

### `/review-repo <url> [--episode <id>]`

The core of the whole pipeline.

1. Resolve or create the episode: if `--episode` is omitted, create
   `episodes/<YYYY-MM-epNNN>/` (next channel-wide number) with a STATE.md seeded from the
   template and `repo_url` set.
2. Clone the target into `episodes/<ep>/sandbox/<repo>`. **The sandbox is the only area
   where third-party code, network access, and execution are allowed.** Nothing is
   installed globally.
3. **Safety gate:** scan for dangerous patterns before running anything — `postinstall` /
   `preinstall` scripts, `curl … | sh`, `wget … | bash`, obfuscated payloads, network
   calls in build scripts. Any hit is **flagged in the report and NOT executed without the
   host's explicit go-ahead**. The candidate repo is also shown to the host before any of
   its code is executed.
4. Read the README + code structure; attempt install & run for the detected stack; run
   basic usage scenarios inside the sandbox.
5. Write `episodes/<ep>/report.md`:
   - **Claimed** (what the README/marketing says)
   - **Works** (what actually worked)
   - **Broke** (what failed, with errors)
   - **Suspicious** (red flags, star-forensics signal)
   - **Video moments** — candidates with sandbox timecodes for the screencast
   - **Draft verdict lean** — a first guess on the ГОДНОТА/ХАЙП/НАКРУТКА/РАНО scale, argued
6. Update STATE.md → `current_phase: review`, `phase_status: done`; write phase metrics
   (§8).

### `/script [--episode <id>]`

1. Read `report.md` + the CLAUDE.md script structure.
2. Write `episodes/<ep>/script.md` following hook → what → test → lies → verdict, with
   inline production tags:
   - `[ГОЛОС]` — voiceover line
   - `[СКРИНКАСТ tt:tt из теста]` — screencast reference to a sandbox timecode
   - `[АНИМАЦИЯ: …]` — Remotion scene cue
   - `[МЕМ: …]` — meme cue
   - `[SHORT cut: tt:tt–tt:tt]` — marks a segment as a future Shorts slice (consumed by
     `cut-shorts` later)
3. Update STATE.md → `current_phase: script`, `phase_status: done`; write phase metrics.

---

## 7. Skeleton commands & skills (contract + TODO only, no logic)

Each skeleton documents **input / output / side-effects / TODO**; no implementation.

**Commands** (`.claude/commands/`):
- `scout` — wraps the global `github-trending` skill. That skill `WebFetch`es
  `github.com/trending?since=weekly`, extracts the top 10 (rank, name, url, desc, language,
  total stars, **stars this week**, forks, topics) and writes a markdown digest to
  `~/atlas-knowledge/news/github-trending.md` (overwritten each run). `scout` runs it,
  parses that file, scores by star-growth velocity, dedupes against already-reviewed
  episodes, checks for an existing Russian video, and emits a candidate list. Designed
  headless/CLI-friendly (for a future Jenkins job): runnable from CLI, output to a file.
- `assets` — render Remotion scenes (StarChart/Intro/VerdictCard) + 3 thumbnail variants.
- `cut-shorts` — FFmpeg slice by `[SHORT cut]` timecodes + Whisper Russian subtitles.
- `publish-pack` — generate descriptions/tags; prepare artifacts for the existing Late API
  pipeline (does not publish itself).
- `retro` — pull YouTube Analytics into `db/tracker.sqlite`, compare against past episodes,
  record hypotheses, propose skill/command fixes.

**Skills** (`.claude/skills/`), skeleton `SKILL.md` with contract:
- `star-forensics` — heuristics for detecting inflated/manufactured star growth.
- `remotion-scenes` — how to parameterize and render the Remotion compositions.
- `thumb-gen` — programmatic thumbnail rendering (3 variants).
- `whisper-subs` — Russian subtitle generation via Whisper.

---

## 8. Drizzle schema (local episode metrics — no coupling to Atlas OS)

`db/tracker.sqlite` is **entirely local to yt-production**; it has no relationship to the
global Atlas OS productivity tracker (the deprecated `[TRACK]` format is not used).

**`episodes`**
- `id` (text, PK — the episode id, e.g. `2026-07-ep001`)
- `number` (integer — channel-wide sequential)
- `repo_url` (text)
- `title` (text, nullable)
- `verdict` (text, nullable — ГОДНОТА/ХАЙП/НАКРУТКА/РАНО)
- `current_phase` (text)
- `youtube_video_id` (text, **nullable**) — added now so the retro phase can join YouTube
  Analytics without a pointless migration later
- `created_at` (integer, epoch)

**`phase_metrics`**
- `id` (integer, PK, autoincrement)
- `episode_id` (text, FK → episodes.id)
- `phase` (text — scout|review|script|assets|manual|publish|retro)
- `started_at` / `ended_at` (integer, epoch)
- `duration_s` (integer)
- `iterations` (integer)
- `notes` (text, nullable)

YouTube-analytics detail columns (views, retention, CTR, …) are deferred to the retro build.

---

## 9. .gitignore policy

**Only text artifacts are tracked:** `STATE.md`, `report.md`, `script.md`, and Remotion
source code. Heavy/binary artifacts are ignored:

```
# episode heavy artifacts
episodes/*/sandbox/          # cloned third-party repos incl. their node_modules
episodes/*/assets/*.mp4
episodes/*/assets/*.png      # rendered thumbnails
episodes/*/assets/*.jpg
episodes/*/shorts/*.mp4

# local db
db/tracker.sqlite
db/tracker.sqlite-*          # wal/shm

# node
node_modules/
remotion/node_modules/
```

(`.gitkeep` files preserve the empty `assets/` and `shorts/` directory structure where
needed.)

---

## 10. Remotion PoC

- Standalone `remotion/` package (own `package.json`, pnpm), Remotion 4.x.
- `Root.tsx` registers all compositions.
- **`StarChart` is fully working**: an animated star-growth line chart driven entirely by
  props (`{ data: {date: string; stars: number}[]; repoName: string }`), with a spring-in
  reveal. Test data lets `npx remotion studio` open and animate it.
- `Intro`, `VerdictCard`, `ThumbTemplate` are minimal registered stubs.
- **DoD:** `npx remotion studio` opens; StarChart animates with test data.

---

## 11. README (pipeline map + build order)

README documents the conveyor map (the 7 phases, which are real vs skeleton) and the
guiding build principle for what to automate next:

> **Automate next whatever phase hurt most in the last retro.**

---

## 12. Plugin portability

Commands and skills are authored to be liftable into a command marketplace plugin later:
no absolute paths baked in beyond the one documented external dependency (the global
`github-trending` skill); episode paths are resolved relative to the repo root.

---

## 13. Constraints & principles

- Don't overcomplicate: no orchestrators, queues, or microservices. Files, CLI, markdown.
- Each phase runs independently and survives a session break (all state in STATE.md +
  episode files).
- `/review-repo` runs untrusted code: clone into the episode sandbox only; install nothing
  globally; never run flagged/suspicious scripts without explicit host approval; don't
  touch secrets; network + execution scoped to the sandbox.

---

## 14. Phase-1 Definition of Done

- [ ] Work in the clone of `Romkoos/yt-production`; structure created; atomic commits; push at the end.
- [ ] CLAUDE.md complete and self-sufficient.
- [ ] `/review-repo` tested on a real small trending repo → substantive `report.md` (candidate shown to host before executing its code).
- [ ] `/script` produced a coherent draft from that report by template.
- [ ] `npx remotion studio` opens; StarChart animates with test data.
- [ ] Episode STATE.md correctly reflects completed phases.
- [ ] All skeletons contain contracts + TODOs.
