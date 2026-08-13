import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import type {
  InviteRequest,
  InviteResponse,
  LoginRequest,
  LoginResponse,
  SignupRequest,
  SignupResponse,
  WhoAmIResponse,
} from "@fieldflow/shared-types";
import { toOrganization, toUser } from "../common/mappers";
import { SupabaseAdminService } from "../supabase/supabase-admin.service";
import { SupabaseAnonService } from "../supabase/supabase-anon.service";
import { SupabaseUserClientFactory } from "../supabase/supabase-user-client.factory";
import type { RequestUser } from "./request-user";

@Injectable()
export class AuthService {
  constructor(
    private readonly supabaseAdmin: SupabaseAdminService,
    private readonly supabaseAnon: SupabaseAnonService,
    private readonly userClientFactory: SupabaseUserClientFactory,
  ) {}

  async signup(dto: SignupRequest): Promise<SignupResponse> {
    const { data: org, error: orgError } = await this.supabaseAdmin.client
      .from("organizations")
      .insert({ name: dto.orgName })
      .select()
      .single();
    if (orgError || !org) {
      throw new InternalServerErrorException(orgError?.message ?? "Failed to create organization");
    }

    // No email provider wired up until Phase 5 (§5) — email_confirm skips
    // a confirmation step we can't fulfill yet. Revisit once transactional
    // email exists.
    const { data: created, error: createUserError } = await this.supabaseAdmin.client.auth.admin.createUser({
      email: dto.adminEmail,
      password: dto.adminPassword,
      email_confirm: true,
      user_metadata: { full_name: dto.adminFullName },
    });
    if (createUserError || !created.user) {
      throw new ConflictException(createUserError?.message ?? "Failed to create admin user");
    }

    const { data: userRow, error: userError } = await this.supabaseAdmin.client
      .from("users")
      .insert({
        id: created.user.id,
        org_id: org.id,
        email: dto.adminEmail,
        full_name: dto.adminFullName,
        role: "admin",
      })
      .select()
      .single();
    if (userError || !userRow) {
      throw new InternalServerErrorException(userError?.message ?? "Failed to create admin profile");
    }

    return { organization: toOrganization(org), user: toUser(userRow) };
  }

  async login(dto: LoginRequest): Promise<LoginResponse> {
    const { data, error } = await this.supabaseAnon.client.auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    });
    if (error || !data.session) {
      throw new UnauthorizedException(error?.message ?? "Invalid credentials");
    }

    const scoped = this.userClientFactory.forToken(data.session.access_token);
    const { data: userRow, error: userError } = await scoped
      .from("users")
      .select("*")
      .eq("id", data.session.user.id)
      .single();
    if (userError || !userRow) {
      throw new UnauthorizedException("No profile found for this account");
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: toUser(userRow),
    };
  }

  async invite(inviter: RequestUser, dto: InviteRequest): Promise<InviteResponse> {
    // Supabase Auth's admin API always requires the service-role key,
    // independent of Postgres RLS.
    const { data, error } = await this.supabaseAdmin.client.auth.admin.generateLink({
      type: "invite",
      email: dto.email,
      options: { data: { full_name: dto.fullName } },
    });
    if (error || !data.user) {
      throw new ConflictException(error?.message ?? "Failed to generate invite");
    }

    // User-scoped on purpose: exercises the real "admins and office invite
    // org users" RLS policy rather than bypassing it.
    const scoped = this.userClientFactory.forToken(inviter.accessToken);
    const { data: userRow, error: userError } = await scoped
      .from("users")
      .insert({
        id: data.user.id,
        org_id: inviter.orgId,
        email: dto.email,
        full_name: dto.fullName,
        role: dto.role,
      })
      .select()
      .single();
    if (userError || !userRow) {
      throw new InternalServerErrorException(userError?.message ?? "Failed to create invited user profile");
    }

    const actionLink = data.properties?.action_link;
    if (!actionLink) {
      throw new InternalServerErrorException("Supabase did not return an invite action link");
    }

    return { user: toUser(userRow), actionLink };
  }

  async whoami(user: RequestUser): Promise<WhoAmIResponse> {
    const scoped = this.userClientFactory.forToken(user.accessToken);

    const [{ data: userRow, error: userError }, { data: orgRow, error: orgError }] = await Promise.all([
      scoped.from("users").select("*").eq("id", user.id).single(),
      scoped
        .from("organizations")
        .select("id, name, display_name, logo_url, brand_primary_color")
        .eq("id", user.orgId)
        .single(),
    ]);

    if (userError || !userRow || orgError || !orgRow) {
      throw new UnauthorizedException("Unable to resolve current user/org");
    }

    return {
      user: toUser(userRow),
      organization: {
        id: orgRow.id,
        name: orgRow.name,
        displayName: orgRow.display_name,
        logoUrl: orgRow.logo_url,
        brandPrimaryColor: orgRow.brand_primary_color,
      },
    };
  }
}
