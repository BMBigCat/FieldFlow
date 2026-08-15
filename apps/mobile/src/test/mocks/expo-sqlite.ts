// Test-only stand-in for expo-sqlite, backed by sql.js (real SQLite compiled
// to WASM) so repo.ts is exercised against a real SQL engine, not a hand-rolled
// fake — the goal is to actually prove the schema/queries are correct.
import initSqlJs, { type Database } from "sql.js";

let sqlModulePromise: ReturnType<typeof initSqlJs> | null = null;

class FakeSQLiteDatabase {
  constructor(private db: Database) {}

  async execAsync(sql: string): Promise<void> {
    this.db.run(sql);
  }

  async runAsync(sql: string, params: unknown[] = []): Promise<void> {
    this.db.run(sql, params as never);
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

export async function openDatabaseAsync(_name: string): Promise<FakeSQLiteDatabase> {
  if (!sqlModulePromise) sqlModulePromise = initSqlJs();
  const SQL = await sqlModulePromise;
  return new FakeSQLiteDatabase(new SQL.Database());
}
