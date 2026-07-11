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
