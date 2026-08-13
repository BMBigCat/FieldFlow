import type { UserRole } from "@fieldflow/shared-types";

export interface RequestUser {
  id: string;
  email: string;
  orgId: string;
  role: UserRole;
  /** Forwarded to SupabaseUserClientFactory so downstream queries run RLS-scoped as this user. */
  accessToken: string;
}

declare module "express" {
  interface Request {
    user?: RequestUser;
  }
}
