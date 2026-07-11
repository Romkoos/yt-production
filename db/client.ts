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
