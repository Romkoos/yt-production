---
name: star-forensics
description: Heuristics for detecting inflated or manufactured GitHub star growth — used by the review phase to inform the НАКРУТКА verdict. SKELETON, not implemented.
---

# star-forensics (SKELETON)

**Status: not implemented. Contract only.**

## Purpose
Given a repo, estimate whether its star growth is organic or manufactured, producing a
signal for the "Подозрительно" section of `report.md` and the НАКРУТКА verdict.

## Input
- Repo URL / owner+name.
- Star history, contributor count, repo age, issue/PR activity, follower graph of
  early stargazers.

## Output
- A forensics summary: growth-curve shape (organic S-curve vs. suspicious step/spike),
  velocity vs. contributor count, ratio of stars to real engagement (issues/forks/PRs),
  and a confidence-tagged verdict signal (organic / suspicious / likely inflated).

## TODO (not implemented)
- [ ] Choose a star-history data source (star-history.com API, GH GraphQL stargazer timestamps).
- [ ] Implement growth-curve shape analysis (detect star bursts / bot waves).
- [ ] Compare star velocity against contributors, age, and real engagement signals.
- [ ] Inspect early-stargazer accounts for bot patterns (created-at clustering, empty profiles).
- [ ] Emit a confidence-tagged signal the review phase can drop into the report.
