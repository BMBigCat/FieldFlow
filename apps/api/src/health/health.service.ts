import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool } from "pg";

export interface DbHealth {
  ok: boolean;
  error?: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly pool: Pool | null;

  constructor(private readonly config: ConfigService) {
    const connectionString = this.config.get<string>("DATABASE_URL");
    // No DATABASE_URL yet (no Supabase project created) is expected in
    // early Phase 0 — report it as a health failure rather than crashing.
    this.pool = connectionString
      ? new Pool({ connectionString, connectionTimeoutMillis: 3000 })
      : null;
  }

  async checkDb(): Promise<DbHealth> {
    if (!this.pool) {
      return { ok: false, error: "DATABASE_URL is not configured" };
    }
    try {
      await this.pool.query("SELECT 1");
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`DB health check failed: ${message}`);
      return { ok: false, error: message };
    }
  }
}
