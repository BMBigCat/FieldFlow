// Web build of the local DB client. expo-sqlite's web target needs
// cross-origin isolation (SharedArrayBuffer) that this dev server doesn't
// provide, which hangs database open indefinitely. Native (the real target
// platform per the build plan) is unaffected and keeps using expo-sqlite —
// see client.ts, which Metro picks automatically off-web via the .web.ts
// convention. This uses sql.js in single-threaded mode instead, which needs
// no special headers, persisting to localStorage between writes so state
// survives a page reload during a web-preview session.
import initSqlJs, { type Database } from "sql.js";

const STORAGE_KEY = "fieldflow-sqlite-db";

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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

class WebSQLiteDatabase {
  constructor(private db: Database) {}

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, bytesToBase64(this.db.export()));
    } catch {
      // Non-fatal — worst case, state doesn't survive a reload this session.
    }
  }

  async execAsync(sql: string): Promise<void> {
    this.db.run(sql);
    this.persist();
  }

  async runAsync(sql: string, params: unknown[] = []): Promise<void> {
    this.db.run(sql, params as never);
    this.persist();
  }

  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    stmt.bind(params as never);
    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return rows;
  }

  async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.getAllAsync<T>(sql, params);
    return rows[0] ?? null;
  }
}

let dbPromise: Promise<WebSQLiteDatabase> | null = null;

export function getDb(): Promise<WebSQLiteDatabase> {
  if (!dbPromise) {
    // Served from apps/mobile/public/ (copied from node_modules/sql.js/dist)
    // rather than fetched from a CDN, so this doesn't depend on outbound
    // network access to a third-party host.
    dbPromise = initSqlJs({ locateFile: () => "/sql-wasm.wasm" }).then((SQL) => {
      const saved = localStorage.getItem(STORAGE_KEY);
      const db = saved ? new SQL.Database(base64ToBytes(saved)) : new SQL.Database();
      db.run(SCHEMA_SQL);
      return new WebSQLiteDatabase(db);
    });
  }
  return dbPromise;
}
