import type {
  Customer,
  CustomerNote,
  Equipment,
  Job,
  JobAssignment,
  JobNote,
  JobPhoto,
  JobPriority,
  JobSignature,
  JobStatus,
  JobTimeEntry,
  JobType,
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

interface JobRow {
  id: string;
  org_id: string;
  customer_id: string;
  service_address_id: string;
  equipment_id: string | null;
  type: JobType;
  status: JobStatus;
  priority: JobPriority;
  description: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  created_by: string;
  created_at: string;
  local_version: number;
  updated_at: string;
}

interface JobAssignmentRow {
  id: string;
  job_id: string;
  technician_id: string;
  assigned_at: string;
}

interface JobNoteRow {
  id: string;
  job_id: string;
  author_id: string;
  body: string;
  created_at: string;
  client_generated_id: string;
}

interface JobPhotoRow {
  id: string;
  job_id: string;
  storage_path: string;
  caption: string | null;
  uploaded_by: string;
  uploaded_at: string;
  client_generated_id: string;
}

export function toJob(row: JobRow): Job {
  return {
    id: row.id,
    orgId: row.org_id,
    customerId: row.customer_id,
    serviceAddressId: row.service_address_id,
    equipmentId: row.equipment_id,
    type: row.type,
    status: row.status,
    priority: row.priority,
    description: row.description,
    scheduledStart: row.scheduled_start,
    scheduledEnd: row.scheduled_end,
    actualStart: row.actual_start,
    actualEnd: row.actual_end,
    createdBy: row.created_by,
    createdAt: row.created_at,
    localVersion: row.local_version,
    updatedAt: row.updated_at,
  };
}

export function toJobAssignment(row: JobAssignmentRow): JobAssignment {
  return {
    id: row.id,
    jobId: row.job_id,
    technicianId: row.technician_id,
    assignedAt: row.assigned_at,
  };
}

export function toJobNote(row: JobNoteRow): JobNote {
  return {
    id: row.id,
    jobId: row.job_id,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at,
    clientGeneratedId: row.client_generated_id,
  };
}

export function toJobPhoto(row: JobPhotoRow): JobPhoto {
  return {
    id: row.id,
    jobId: row.job_id,
    storagePath: row.storage_path,
    caption: row.caption,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at,
    clientGeneratedId: row.client_generated_id,
  };
}

interface JobSignatureRow {
  id: string;
  job_id: string;
  storage_path: string;
  signed_by_name: string;
  signed_at: string;
  client_generated_id: string;
}

interface JobTimeEntryRow {
  id: string;
  job_id: string;
  technician_id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  client_generated_id: string;
  created_at: string;
}

export function toJobSignature(row: JobSignatureRow): JobSignature {
  return {
    id: row.id,
    jobId: row.job_id,
    storagePath: row.storage_path,
    signedByName: row.signed_by_name,
    signedAt: row.signed_at,
    clientGeneratedId: row.client_generated_id,
  };
}

export function toJobTimeEntry(row: JobTimeEntryRow): JobTimeEntry {
  return {
    id: row.id,
    jobId: row.job_id,
    technicianId: row.technician_id,
    clockInAt: row.clock_in_at,
    clockOutAt: row.clock_out_at,
    clientGeneratedId: row.client_generated_id,
    createdAt: row.created_at,
  };
}
