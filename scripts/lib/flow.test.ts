import { describe, it, expect } from 'vitest'
import { nextCommand, nextPhase, parseState, renderFlow } from './flow'

const STATE = `---
episode: 2026-07-ep001
number: 1
repo_url: https://github.com/facebook/astryx
title:
current_phase: assets
phase_status: done
verdict: ГОДНОТА
youtube_video_id:
updated: 2026-07-11
---

## Phase checklist
- [-] scout (skipped — direct review)
- [x] review
- [x] script
- [x] assets
- [ ] manual
- [ ] publish
- [ ] retro

## Next action
Manual phase — подготовка к записи:
- [ ] Голос: записать озвучку по script.md
- [ ] Монтаж в DaVinci Resolve

## Artifacts
- report.md: present
`

describe('parseState', () => {
  it('reads the frontmatter fields the cheat sheet prints', () => {
    const s = parseState(STATE)
    expect(s.episode).toBe('2026-07-ep001')
    expect(s.number).toBe('1')
    expect(s.repoUrl).toBe('https://github.com/facebook/astryx')
    expect(s.currentPhase).toBe('assets')
    expect(s.phaseStatus).toBe('done')
    expect(s.verdict).toBe('ГОДНОТА')
    expect(s.updated).toBe('2026-07-11')
  })

  it('reads every checklist marker, keeping the skip reason', () => {
    const { checklist } = parseState(STATE)
    expect(checklist).toEqual([
      { phase: 'scout', marker: '-', note: 'skipped — direct review' },
      { phase: 'review', marker: 'x', note: '' },
      { phase: 'script', marker: 'x', note: '' },
      { phase: 'assets', marker: 'x', note: '' },
      { phase: 'manual', marker: ' ', note: '' },
      { phase: 'publish', marker: ' ', note: '' },
      { phase: 'retro', marker: ' ', note: '' },
    ])
  })

  it('reads the Next action body and stops at the next heading', () => {
    const { nextAction } = parseState(STATE)
    expect(nextAction).toContain('Manual phase — подготовка к записи:')
    expect(nextAction).toContain('- [ ] Монтаж в DaVinci Resolve')
    expect(nextAction).not.toContain('Artifacts')
    expect(nextAction).not.toContain('report.md')
  })

  it('refuses a file with no frontmatter rather than printing an empty sheet', () => {
    expect(() => parseState('## Phase checklist\n- [ ] scout\n')).toThrow(/frontmatter/)
  })
})

describe('nextPhase', () => {
  // "<marker><phase>", pipe-separated — the pending marker IS a space, so a space cannot separate.
  const items = (spec: string) =>
    spec.split('|').map((s) => ({ phase: s.slice(1), marker: s[0] as ' ' | '~' | 'x' | '-', note: '' }))

  it('is the first unchecked phase, skipping done and skipped ones', () => {
    expect(nextPhase(items('-scout|xreview|xscript|xassets| manual| publish'))?.phase).toBe('manual')
  })

  it('prefers a phase already in progress over a later pending one', () => {
    expect(nextPhase(items('xreview|~script| assets'))?.phase).toBe('script')
  })

  it('is null when nothing is left', () => {
    expect(nextPhase(items('xreview|xscript|-assets'))).toBeNull()
  })
})

describe('nextCommand', () => {
  const withChecklist = (spec: string) =>
    parseState(STATE.replace(/## Phase checklist\n[\s\S]*?\n\n/, `## Phase checklist\n${spec}\n\n`))

  it('names the phase command, with the repo url filled in for review', () => {
    const s = withChecklist('- [x] scout\n- [ ] review')
    expect(nextCommand(s).command).toBe('/review-repo https://github.com/facebook/astryx')
  })

  it('points assets at the thumbnail leg — the scripts, not the slash command alone', () => {
    const s = withChecklist('- [x] script\n- [ ] assets')
    const { command, hint } = nextCommand(s)
    expect(command).toBe('/assets')
    expect(hint).toContain('pnpm scene && pnpm thumbs')
  })

  it('has no command for the manual phase — that phase is the human', () => {
    const s = withChecklist('- [x] assets\n- [ ] manual')
    const { command, hint } = nextCommand(s)
    expect(command).toBeNull()
    expect(hint).toMatch(/DaVinci|screencast|таймкод/i)
  })

  it('says the episode is finished when every phase is closed', () => {
    const s = withChecklist('- [x] review\n- [x] retro')
    expect(nextCommand(s).command).toBeNull()
    expect(nextCommand(s).hint).toMatch(/done/i)
  })
})

describe('renderFlow', () => {
  it('prints the checklist, marks the next phase, and ends with the next command', () => {
    const out = renderFlow(parseState(STATE))
    expect(out).toContain('2026-07-ep001')
    expect(out).toContain('facebook/astryx')
    expect(out).toContain('[-] scout')
    expect(out).toContain('skipped — direct review')
    expect(out).toMatch(/\[ \] manual.*←/)
    expect(out).toContain('Монтаж в DaVinci Resolve')
    expect(out).toContain('/publish-pack') // the command that unblocks once the manual phase is over
  })
})
