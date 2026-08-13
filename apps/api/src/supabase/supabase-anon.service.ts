import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Anon-key client with no session persistence. Used for password-grant
 * login (POST /auth/login) and for verifying a bearer token via
 * `auth.getUser(jwt)` in JwtAuthGuard — both are stateless, single-shot
 * calls to Supabase Auth, not RLS-scoped Postgres queries.
 */
@Injectable()
export class SupabaseAnonService {
  readonly client: SupabaseClient;

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>("SUPABASE_URL");
    const anonKey = config.getOrThrow<string>("SUPABASE_ANON_KEY");
    this.client = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
}
