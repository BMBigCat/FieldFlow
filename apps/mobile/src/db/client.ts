import * as SQLite from "expo-sqlite";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  status TEXT NOT NULL,
  scheduled_start TEXT,
  updated_at TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS service_addresses (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS equipment (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  data TEXT NOT NULL
);
-- Keyed by client_generated_id (not the server id): a locally-captured row
-- is written with a temp id before it's ever synced, and must be updated in
-- place — not duplicated — once the server's canonical id comes back on the
-- next pull. client_generated_id is the one identifier stable across both.
CREATE TABLE IF NOT EXISTS job_notes (
  client_generated_id TEXT PRIMARY KEY,
  id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS job_photos (
  client_generated_id TEXT PRIMARY KEY,
  id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  local_uri TEXT,
  uploaded_at TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS job_signatures (
  client_generated_id TEXT PRIMARY KEY,
  id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  local_uri TEXT,
  signed_at TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS job_time_entries (
  client_generated_id TEXT PRIMARY KEY,
  id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  clock_in_at TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS outbox (
  client_generated_id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  job_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("fieldflow.db").then(async (db) => {
      await db.execAsync("PRAGMA journal_mode = WAL;");
      await db.execAsync(SCHEMA_SQL);
      return db;
    });
  }
  return dbPromise;
}
