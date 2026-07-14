// Tick carry-over for the regenerated RECORDING.md. The host ticks scene boxes DURING a session;
// a regeneration must never silently destroy that progress — nor keep a tick on a scene whose
// content changed (that would claim footage exists for a scene that no longer matches it).
//
// Matching is BY SCENE ID, never by position: if scenes were inserted or removed, an orphaned
// tick is dropped and reported, never migrated onto a different scene.
//
// The fingerprint covers the DERIVED payload (title + commands + on-screen + wait/cut + reset +
// voice refs), not the raw file text — so the host's own scribbles inside a block never read as
// "the scene changed". No IO.

import { createHash } from 'node:crypto'

export function fingerprint(payload: string): string {
  return createHash('sha256').update(payload).digest('hex').slice(0, 8)
}

export interface OldTick {
  ticked: boolean
  fp: string
}

// `- [x] #3 — приложение нотаризовано, коробка нет  <!-- fp:a91c40de -->`
const BOX = /^- \[([ xX])\]\s+(#\d+)\b.*?<!--\s*fp:([0-9a-f]{8})\s*-->/gm

export function parseRecordingTicks(md: string): Map<string, OldTick> {
  const out = new Map<string, OldTick>()
  for (const m of md.matchAll(BOX)) {
    out.set(m[2], { ticked: m[1].toLowerCase() === 'x', fp: m[3] })
  }
  return out
}

export type TickState = 'ticked' | 'reset' | 'open'

export interface MergeReport {
  carried: string[]
  reset: string[]
  dropped: string[]
}

export function mergeTicks(
  scenes: { id: string; fp: string }[],
  old: Map<string, OldTick>,
): { state: Map<string, TickState>; report: MergeReport } {
  const state = new Map<string, TickState>()
  const report: MergeReport = { carried: [], reset: [], dropped: [] }

  for (const s of scenes) {
    const prev = old.get(s.id)
    if (prev?.ticked && prev.fp === s.fp) {
      state.set(s.id, 'ticked')
      report.carried.push(s.id)
    } else if (prev?.ticked) {
      state.set(s.id, 'reset')
      report.reset.push(s.id)
    } else {
      state.set(s.id, 'open')
    }
  }

  const live = new Set(scenes.map((s) => s.id))
  for (const [id, prev] of old) {
    if (prev.ticked && !live.has(id)) report.dropped.push(id)
  }
  return { state, report }
}
