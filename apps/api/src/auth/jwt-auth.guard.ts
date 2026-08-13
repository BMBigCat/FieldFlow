import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { SupabaseAdminService } from "../supabase/supabase-admin.service";
import { SupabaseAnonService } from "../supabase/supabase-anon.service";
import type { RequestUser } from "./request-user";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly supabaseAnon: SupabaseAnonService,
    private readonly supabaseAdmin: SupabaseAdminService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }
    const accessToken = authHeader.slice("Bearer ".length);

    const { data, error } = await this.supabaseAnon.client.auth.getUser(accessToken);
    if (error || !data.user) {
      throw new UnauthorizedException("Invalid or expired token");
    }

    // Service-role lookup here is infra plumbing to build the request
    // context (we don't have org_id/role until we know who this is), not a
    // user-facing data query — same exception as invite's user creation.
    const { data: profile, error: profileError } = await this.supabaseAdmin.client
      .from("users")
      .select("org_id, role, email")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      throw new UnauthorizedException("No profile found for this account");
    }

    const requestUser: RequestUser = {
      id: data.user.id,
      email: profile.email,
      orgId: profile.org_id,
      role: profile.role,
      accessToken,
    };
    request.user = requestUser;
    return true;
  }
}
