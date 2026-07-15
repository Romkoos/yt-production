import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const episodes = sqliteTable('episodes', {
  id: text('id').primaryKey(), // e.g. 2026-07-epNNN
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
