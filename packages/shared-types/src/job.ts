import type { ISODateString, UUID } from "./common.js";
import type { Customer, Equipment, ServiceAddress } from "./customer.js";
import type { User } from "./user.js";

/** Build plan §2 core feature list. */
export type JobType =
  | "scheduled_service"
  | "routine_maintenance"
  | "new_install"
  | "repair";

/** Build plan §4 `jobs.status` lifecycle. */
export type JobStatus =
  | "unscheduled"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "invoiced"
  | "canceled";

/**
 * Not enumerated in the build plan (§4 just lists `priority`) — flagging this
 * as an assumption per §10.8 rather than guessing silently in prose. Revisit
 * in Phase 3 when the calendar/dispatch UI needs concrete priority levels.
 */
export type JobPriority = "low" | "normal" | "high" | "urgent";

/** Build plan §4 `jobs`. */
export interface Job {
  id: UUID;
  orgId: UUID;
  customerId: UUID;
  serviceAddressId: UUID;
  equipmentId: UUID | null;
  type: JobType;
  status: JobStatus;
  priority: JobPriority;
  description: string | null;
  scheduledStart: ISODateString | null;
  scheduledEnd: ISODateString | null;
  actualStart: ISODateString | null;
  actualEnd: ISODateString | null;
  createdBy: UUID;
  createdAt: ISODateString;
  /** Incremented on each update; used for offline sync conflict detection (§6). */
  localVersion: number;
  updatedAt: ISODateString;
}

/** Build plan §4 `job_assignments`. */
export interface JobAssignment {
  id: UUID;
  jobId: UUID;
  technicianId: UUID;
  assignedAt: ISODateString;
}

/** Build plan §4 `job_notes`. `clientGeneratedId` supports offline dedupe (§6). */
export interface JobNote {
  id: UUID;
  jobId: UUID;
  authorId: UUID;
  body: string;
  createdAt: ISODateString;
  clientGeneratedId: UUID;
}

/** Build plan §4 `job_photos`. */
export interface JobPhoto {
  id: UUID;
  jobId: UUID;
  storagePath: string;
  caption: string | null;
  uploadedBy: UUID;
  uploadedAt: ISODateString;
  clientGeneratedId: UUID;
}

/** Build plan §4 `job_signatures`. `clientGeneratedId` supports offline dedupe (§6). */
export interface JobSignature {
  id: UUID;
  jobId: UUID;
  storagePath: string;
  signedByName: string;
  signedAt: ISODateString;
  clientGeneratedId: UUID;
}

/**
 * Build plan §4 `job_time_entries` (Phase 4 addition — one row per clock
 * session, so multiple assigned technicians can clock in/out independently
 * on the same job; see hvac-app-build-plan.md Phase 4 plan, decision D1).
 */
export interface JobTimeEntry {
  id: UUID;
  jobId: UUID;
  technicianId: UUID;
  clockInAt: ISODateString;
  clockOutAt: ISODateString | null;
  clientGeneratedId: UUID;
  createdAt: ISODateString;
}

/** GET /jobs — lightweight enough for calendar/list rendering, includes
 * which technician(s) are assigned so cards can be placed without an N+1
 * detail fetch per job. */
export interface JobListItem extends Job {
  technicianIds: UUID[];
}

/** POST /jobs */
export interface CreateJobRequest {
  customerId: UUID;
  serviceAddressId: UUID;
  equipmentId?: UUID;
  type: JobType;
  priority?: JobPriority;
  description?: string;
  scheduledStart?: ISODateString;
  scheduledEnd?: ISODateString;
  /** Initial assignment(s); creates the job_assignments rows in the same call. */
  technicianIds?: UUID[];
}

/** PATCH /jobs/:id — technicianIds, when present, replaces the full assignment set. */
export interface UpdateJobRequest {
  status?: JobStatus;
  priority?: JobPriority;
  description?: string;
  scheduledStart?: ISODateString;
  scheduledEnd?: ISODateString;
  actualStart?: ISODateString;
  actualEnd?: ISODateString;
  technicianIds?: UUID[];
}

/**
 * POST /jobs/:id/notes. `clientGeneratedId`/`createdAt` are optional — set by
 * the sync push path (§6) so an offline-captured note keeps its real
 * authored time and survives retries; omitted by direct online callers
 * (web), which get a server-minted id and `now()` as before.
 */
export interface CreateJobNoteRequest {
  body: string;
  clientGeneratedId?: UUID;
  createdAt?: ISODateString;
}

/** POST /jobs/:id/photos — fields alongside the multipart file. */
export interface CreateJobPhotoRequest {
  caption?: string;
  clientGeneratedId?: UUID;
  uploadedAt?: ISODateString;
}

/** POST /jobs/:id/signature — fields alongside the multipart file. */
export interface CreateJobSignatureRequest {
  signedByName: string;
  clientGeneratedId?: UUID;
  signedAt?: ISODateString;
}

/** POST /jobs/:id/clock-in */
export interface ClockInRequest {
  clientGeneratedId?: UUID;
  clockInAt?: ISODateString;
}

/** POST /jobs/:id/clock-out */
export interface ClockOutRequest {
  clientGeneratedId?: UUID;
  clockOutAt?: ISODateString;
}

/** GET /jobs/:id — everything the detail page needs in one call. */
export interface JobDetail extends Job {
  customer: Pick<Customer, "id" | "name">;
  serviceAddress: ServiceAddress;
  equipment: Equipment | null;
  assignedTechnicians: Pick<User, "id" | "fullName">[];
  notes: JobNote[];
  photos: JobPhoto[];
  signatures: JobSignature[];
  timeEntries: JobTimeEntry[];
}

/** Build plan §4 `recurring_maintenance_plans`. */
export interface RecurringMaintenancePlan {
  id: UUID;
  customerId: UUID;
  equipmentId: UUID;
  frequencyMonths: number;
  nextDueDate: ISODateString;
  /**
   * Default fields applied to the auto-generated job (§6.2 background job).
   * Kept loose here since the exact template shape is a Phase 6 decision.
   */
  jobTemplate: Partial<Pick<Job, "type" | "priority" | "description">>;
}

/** POST /maintenance-plans */
export interface CreateMaintenancePlanRequest {
  customerId: UUID;
  equipmentId: UUID;
  frequencyMonths: number;
  nextDueDate: ISODateString;
  jobTemplate?: Partial<Pick<Job, "type" | "priority" | "description">>;
}

/** POST /maintenance-plans/process-due response — build plan §6 background
 * job, triggered manually here (no BullMQ/Redis available yet — see build
 * plan §6.2 decision note) rather than on a real schedule. */
export interface ProcessDuePlansResponse {
  createdJobIds: UUID[];
}
