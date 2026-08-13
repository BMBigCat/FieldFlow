import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Builds a client scoped to a specific caller's access token, so Postgres
 * sees `authenticated` role + `auth.uid()` and RLS policies from
 * 0001_init.sql actually apply. Use this for anything that should be
 * genuinely user-scoped rather than bypassed via the service-role client.
 */
@Injectable()
export class SupabaseUserClientFactory {
  constructor(private readonly config: ConfigService) {}

  forToken(accessToken: string): SupabaseClient {
    const url = this.config.getOrThrow<string>("SUPABASE_URL");
    const anonKey = this.config.getOrThrow<string>("SUPABASE_ANON_KEY");
    return createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
  }
}
