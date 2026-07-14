import { describe, it, expect } from 'vitest'
import { fingerprint, parseRecordingTicks, mergeTicks } from './recording-merge'

const line = (mark: string, id: string, fp: string, title = 'сцена') =>
  `- [${mark}] ${id} — ${title}  <!-- fp:${fp} -->`

describe('fingerprint', () => {
  it('is stable and 8 hex chars', () => {
    expect(fingerprint('payload')).toMatch(/^[0-9a-f]{8}$/)
    expect(fingerprint('payload')).toBe(fingerprint('payload'))
  })

  it('changes when the payload changes', () => {
    expect(fingerprint('a')).not.toBe(fingerprint('b'))
  })
})

describe('parseRecordingTicks', () => {
  it('reads the tick state and fingerprint of every scene box', () => {
    const md = [line('x', '#1', 'aaaaaaaa'), line(' ', '#2', 'bbbbbbbb')].join('\n')
    const ticks = parseRecordingTicks(md)
    expect(ticks.get('#1')).toEqual({ ticked: true, fp: 'aaaaaaaa' })
    expect(ticks.get('#2')).toEqual({ ticked: false, fp: 'bbbbbbbb' })
  })

  it('ignores checkboxes that are not scene boxes', () => {
    expect(parseRecordingTicks('- [x] купить кофе\n').size).toBe(0)
  })

  it('returns an empty map for a file that does not exist yet (empty string)', () => {
    expect(parseRecordingTicks('').size).toBe(0)
  })
})

describe('mergeTicks', () => {
  const old = new Map([
    ['#1', { ticked: true, fp: 'aaaaaaaa' }],
    ['#2', { ticked: true, fp: 'bbbbbbbb' }],
    ['#3', { ticked: false, fp: 'cccccccc' }],
  ])

  it('carries a tick when the ID matches AND the scene is unchanged', () => {
    const { state, report } = mergeTicks([{ id: '#1', fp: 'aaaaaaaa' }], old)
    expect(state.get('#1')).toBe('ticked')
    expect(report.carried).toEqual(['#1'])
    expect(report.reset).toEqual([])
  })

  it('RESETS a tick when the scene content changed since it was ticked', () => {
    // A ticked box on changed content would claim footage exists for a scene that no longer
    // matches it.
    const { state, report } = mergeTicks([{ id: '#2', fp: 'ZZZZZZZZ' }], old)
    expect(state.get('#2')).toBe('reset')
    expect(report.reset).toEqual(['#2'])
    expect(report.carried).toEqual([])
  })

  it('leaves an unticked box open regardless of fingerprint', () => {
    const { state, report } = mergeTicks([{ id: '#3', fp: 'dddddddd' }], old)
    expect(state.get('#3')).toBe('open')
    expect(report.reset).toEqual([])
  })

  it('drops a tick whose scene ID is gone — never guesses a new home for it', () => {
    // Renumbering safety: #1 and #2 were ticked; the new script only has #9.
    const { state, report } = mergeTicks([{ id: '#9', fp: 'aaaaaaaa' }], old)
    expect(state.get('#9')).toBe('open') // same fp as old #1, but a DIFFERENT scene — no carry
    expect(report.dropped).toEqual(['#1', '#2'])
    expect(report.carried).toEqual([])
  })

  it('reports nothing when there is no previous file', () => {
    const { state, report } = mergeTicks([{ id: '#1', fp: 'aaaaaaaa' }], new Map())
    expect(state.get('#1')).toBe('open')
    expect(report).toEqual({ carried: [], reset: [], dropped: [] })
  })
})
