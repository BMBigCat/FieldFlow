import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { SupabaseAdminService } from "../supabase/supabase-admin.service";
import { SupabaseAnonService } from "../supabase/supabase-anon.service";
import { SupabaseUserClientFactory } from "../supabase/supabase-user-client.factory";
import { RolesGuard } from "./roles.guard";
import { Reflector } from "@nestjs/core";
import type { ExecutionContext } from "@nestjs/common";

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, jest.Mock> = {};
  builder.insert = jest.fn().mockReturnValue(builder);
  builder.select = jest.fn().mockReturnValue(builder);
  builder.eq = jest.fn().mockReturnValue(builder);
  builder.single = jest.fn().mockResolvedValue(result);
  return builder;
}

describe("AuthService", () => {
  let service: AuthService;
  let supabaseAdmin: { client: { from: jest.Mock; auth: { admin: { createUser: jest.Mock; generateLink: jest.Mock } } } };
  let supabaseAnon: { client: { auth: { signInWithPassword: jest.Mock } } };
  let userClientFactory: { forToken: jest.Mock };

  beforeEach(async () => {
    supabaseAdmin = {
      client: {
        from: jest.fn(),
        auth: {
          admin: {
            createUser: jest.fn(),
            generateLink: jest.fn(),
          },
        },
      },
    };
    supabaseAnon = { client: { auth: { signInWithPassword: jest.fn() } } };
    userClientFactory = { forToken: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: SupabaseAdminService, useValue: supabaseAdmin },
        { provide: SupabaseAnonService, useValue: supabaseAnon },
        { provide: SupabaseUserClientFactory, useValue: userClientFactory },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it("signup creates an org, an auth user, and an admin profile", async () => {
    const orgRow = { id: "org-1", name: "Acme HVAC", display_name: null, logo_url: null, brand_primary_color: null, brand_updated_at: null, created_at: "2026-01-01T00:00:00Z" };
    const userRow = { id: "user-1", org_id: "org-1", email: "admin@acme.test", full_name: "Ada Admin", role: "admin", phone: null, push_token: null, created_at: "2026-01-01T00:00:00Z" };

    supabaseAdmin.client.from.mockReturnValueOnce(makeQueryBuilder({ data: orgRow, error: null }));
    supabaseAdmin.client.auth.admin.createUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    supabaseAdmin.client.from.mockReturnValueOnce(makeQueryBuilder({ data: userRow, error: null }));

    const result = await service.signup({
      orgName: "Acme HVAC",
      adminEmail: "admin@acme.test",
      adminPassword: "hunter22222",
      adminFullName: "Ada Admin",
    });

    expect(result.organization.id).toBe("org-1");
    expect(result.user.role).toBe("admin");
    expect(supabaseAdmin.client.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "admin@acme.test", email_confirm: true }),
    );
  });

  it("throws when org creation fails", async () => {
    supabaseAdmin.client.from.mockReturnValueOnce(makeQueryBuilder({ data: null, error: { message: "boom" } }));

    await expect(
      service.signup({
        orgName: "Acme HVAC",
        adminEmail: "admin@acme.test",
        adminPassword: "hunter22222",
        adminFullName: "Ada Admin",
      }),
    ).rejects.toThrow();
  });

  it("login rejects invalid credentials", async () => {
    supabaseAnon.client.auth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: "Invalid login credentials" },
    });

    await expect(service.login({ email: "nobody@acme.test", password: "wrong" })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("invite fails clearly when Supabase cannot generate a link", async () => {
    supabaseAdmin.client.auth.admin.generateLink.mockResolvedValue({ data: { user: null }, error: { message: "already exists" } });

    await expect(
      service.invite(
        { id: "admin-1", email: "admin@acme.test", orgId: "org-1", role: "admin", accessToken: "tok" },
        { email: "tech@acme.test", fullName: "Tim Tech", role: "technician" },
      ),
    ).rejects.toThrow(ConflictException);
  });

  it("whoami returns the resolved user and org", async () => {
    const userRow = { id: "user-1", org_id: "org-1", email: "tech@acme.test", full_name: "Tim Tech", role: "technician", phone: null, push_token: null, created_at: "2026-01-01T00:00:00Z" };
    const orgRow = { id: "org-1", name: "Acme HVAC", display_name: "Acme", logo_url: null, brand_primary_color: null };

    const scopedClient = {
      from: jest.fn((table: string) =>
        table === "users"
          ? makeQueryBuilder({ data: userRow, error: null })
          : makeQueryBuilder({ data: orgRow, error: null }),
      ),
    };
    userClientFactory.forToken.mockReturnValue(scopedClient);

    const result = await service.whoami({
      id: "user-1",
      email: "tech@acme.test",
      orgId: "org-1",
      role: "technician",
      accessToken: "tok",
    });

    expect(result.user.role).toBe("technician");
    expect(result.organization.displayName).toBe("Acme");
  });
});

describe("RolesGuard", () => {
  function contextWithUser(user: { role: string } | undefined, requiredRoles: string[] | undefined) {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(requiredRoles) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext;
    return { guard, context };
  }

  it("allows a request when the user's role is in the required list", () => {
    const { guard, context } = contextWithUser({ role: "office" }, ["admin", "office"]);
    expect(guard.canActivate(context)).toBe(true);
  });

  it("rejects a request when the user's role is not permitted", () => {
    const { guard, context } = contextWithUser({ role: "technician" }, ["admin", "office"]);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it("allows any authenticated user when no roles are required", () => {
    const { guard, context } = contextWithUser({ role: "technician" }, undefined);
    expect(guard.canActivate(context)).toBe(true);
  });
});
