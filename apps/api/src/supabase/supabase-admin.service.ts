import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS entirely. Only for operations that
 * legitimately have no acting user yet (org/admin signup) or that require
 * Supabase's Auth admin API (which always needs the service role key,
 * independent of Postgres RLS): inviting a user, generating action links.
 */
@Injectable()
export class SupabaseAdminService {
  readonly client: SupabaseClient;

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>("SUPABASE_URL");
    const serviceRoleKey = config.getOrThrow<string>("SUPABASE_SERVICE_ROLE_KEY");
    this.client = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
}
