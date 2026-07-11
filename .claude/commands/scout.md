# /scout

**Status: SKELETON — not implemented. Contract only.**

Discover episode candidates: trending GitHub repos scored by star-growth velocity,
deduped against already-reviewed episodes, filtered for "does a Russian video already
exist?".

Designed to be headless / CLI-friendly (runnable non-interactively, output to a file)
so a future Jenkins job can run it on a schedule.

## Input
- (optional) `--limit N` — how many candidates to return (default 5).
- No positional args. Reads trending data via the global `github-trending` skill (see below).

## Output
- A ranked candidate list to stdout AND written to a file (e.g. `scratch/candidates.md`).
  Each candidate: repo, url, total stars, stars-this-week, growth score, dedupe status,
  "RU video exists?" flag.

## Side-effects
- Invokes the global `github-trending` skill, which WebFetches
  `https://github.com/trending?since=weekly` and writes
  `~/atlas-knowledge/news/github-trending.md` (overwritten each run).
- Reads `episodes/` to dedupe against repos already reviewed.
- Does NOT create an episode — `/review-repo <url>` does that for a chosen candidate.

## TODO (not implemented)
- [ ] Run/parse the `github-trending` digest (`~/atlas-knowledge/news/github-trending.md`).
- [ ] Score by star-growth velocity (stars-this-week relative to total / repo age).
- [ ] Dedupe against `episodes/*/STATE.md` `repo_url` fields (never re-review the same repo).
- [ ] Check whether a Russian-language video already covers the repo (search heuristic — TBD source).
- [ ] Emit the ranked candidate list to stdout + file; keep it non-interactive for Jenkins.
- [ ] Decide the "RU video exists?" data source (YouTube search API vs scrape).
