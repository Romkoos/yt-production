# yt-production

Content pipeline for a Russian-language YouTube channel reviewing trending GitHub repos —
*«репозиторий на подъёме — заслуженно или хайп?»*. The host clones, runs, and tests a
trending repo, then gives an honest, ironic verdict.

> `yt-production` is the working project name, not the channel name.
> Full project charter (tone, script structure, verdict scale, rules): see **[CLAUDE.md](./CLAUDE.md)**.

## Pipeline map

An episode flows through 7 phases. Each is an independently runnable command; state lives
in the episode's `STATE.md` so any phase resumes cleanly in a fresh session.

| # | Phase | Command | What it does | Phase 1 |
|---|-------|---------|--------------|---------|
| 1 | scout | `/scout` | Find trending candidates, score by star velocity, dedupe | skeleton |
| 2 | review | `/review-repo <url>` | Clone into sandbox, test safely, write `report.md` | **✅ built** |
| 3 | script | `/script` | Draft `script.md` from the report by template | **✅ built** |
| 4 | assets | `/assets` | Render Remotion scenes + 3 thumbnails | skeleton |
| 5 | manual | (human) | Record voice + screencast, edit in Resolve, reconcile timecodes | — |
| 6 | publish | `/publish-pack` | Descriptions/tags + hand-off to the Late API pipeline | skeleton |
| 7 | retro | `/retro` | Pull YouTube Analytics, compare, propose pipeline fixes | skeleton |

Skeletons contain full input/output/side-effect contracts + TODOs — see `.claude/commands/`.

## Quick start

```bash
# install (root: scripts, db, tests)
pnpm install

# review a repo — creates episodes/<YYYY-MM-epNNN>/, clones into a sandbox, writes report.md
#   (shows you the candidate and asks before running any of its code)
/review-repo https://github.com/owner/repo

# draft the script from that report
/script

# Remotion scenes (standalone package)
cd remotion && pnpm install && pnpm studio   # opens studio; StarChart animates with test data
```

Create an episode manually: `pnpm episode:init <repo_url>`. Run tests: `pnpm test`.
Metrics DB: `pnpm db:migrate` creates `db/tracker.sqlite` (local only, gitignored).

## Layout

```
CLAUDE.md            project charter (read this first)
.claude/commands/    the 7 phase commands (review-repo + script are real; rest are skeletons)
.claude/skills/      star-forensics, remotion-scenes, thumb-gen, whisper-subs (skeletons)
remotion/            standalone Remotion package — StarChart works; Intro/VerdictCard/ThumbTemplate stubs
episodes/            per-episode STATE.md / report.md / script.md (sandbox/assets/shorts gitignored)
templates/           STATE.md / report.md / script.md templates
db/                  Drizzle schema + local tracker.sqlite
scripts/             episode-id + init-episode helpers
```

## Build order (after Phase 1)

**Automate next whatever phase hurt most in the last retro.** Don't pre-build phases on a
hunch — let the retro of each episode tell you where the pain is, then automate that.
