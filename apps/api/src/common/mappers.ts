import type {
  Customer,
  CustomerNote,
  Equipment,
  Organization,
  ServiceAddress,
  User,
  UserRole,
} from "@fieldflow/shared-types";

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

interface CustomerRow {
  id: string;
  org_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  billing_address: string | null;
  created_at: string;
  created_by: string;
}

interface ServiceAddressRow {
  id: string;
  customer_id: string;
  label: string | null;
  address: string;
  lat: number | null;
  lng: number | null;
}

interface EquipmentRow {
  id: string;
  customer_id: string;
  service_address_id: string;
  type: string;
  make: string | null;
  model: string | null;
  serial_number: string | null;
  install_date: string | null;
  warranty_expires: string | null;
  filter_size: string | null;
  notes: string | null;
}

interface CustomerNoteRow {
  id: string;
  customer_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export function toCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    billingAddress: row.billing_address,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

export function toServiceAddress(row: ServiceAddressRow): ServiceAddress {
  return {
    id: row.id,
    customerId: row.customer_id,
    label: row.label,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
  };
}

export function toEquipment(row: EquipmentRow): Equipment {
  return {
    id: row.id,
    customerId: row.customer_id,
    serviceAddressId: row.service_address_id,
    type: row.type,
    make: row.make,
    model: row.model,
    serialNumber: row.serial_number,
    installDate: row.install_date,
    warrantyExpires: row.warranty_expires,
    filterSize: row.filter_size,
    notes: row.notes,
  };
}

export function toCustomerNote(row: CustomerNoteRow): CustomerNote {
  return {
    id: row.id,
    customerId: row.customer_id,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at,
  };
}
