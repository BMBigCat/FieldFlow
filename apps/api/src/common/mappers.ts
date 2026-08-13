import type { Organization, User, UserRole } from "@fieldflow/shared-types";

interface OrganizationRow {
  id: string;
  name: string;
  display_name: string | null;
  logo_url: string | null;
  brand_primary_color: string | null;
  brand_updated_at: string | null;
  created_at: string;
}

interface UserRow {
  id: string;
  org_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  push_token: string | null;
  created_at: string;
}

export function toOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    displayName: row.display_name,
    logoUrl: row.logo_url,
    brandPrimaryColor: row.brand_primary_color,
    brandUpdatedAt: row.brand_updated_at,
  };
}

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    orgId: row.org_id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    phone: row.phone,
    pushToken: row.push_token,
    createdAt: row.created_at,
  };
}
