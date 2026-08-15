import type { Organization } from "./organization.js";
import type { User, UserRole } from "./user.js";

/** POST /auth/signup — bootstraps a new org + its first admin user. */
export interface SignupRequest {
  orgName: string;
  adminEmail: string;
  adminPassword: string;
  adminFullName: string;
}

export interface SignupResponse {
  organization: Organization;
  user: User;
}

/** POST /auth/login */
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

/**
 * POST /auth/invite (admin/office only). No email provider is wired up
 * until Phase 5 (§5), so this returns the Supabase-generated action link
 * directly instead of sending an email — see build plan Phase 1 decisions.
 */
export interface InviteRequest {
  email: string;
  fullName: string;
  role: UserRole;
}

export interface InviteResponse {
  user: User;
  actionLink: string;
}

/** GET /auth/whoami */
export interface WhoAmIResponse {
  user: User;
  organization: Pick<
    Organization,
    "id" | "name" | "displayName" | "logoUrl" | "brandPrimaryColor"
  >;
}

/** PATCH /organizations/me (admin only) */
export type UpdateOrganizationRequest = Partial<
  Pick<Organization, "displayName" | "brandPrimaryColor" | "defaultLaborRate">
>;
