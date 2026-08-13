import type { ISODateString, UUID } from "./common.js";

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

/** Build plan §4 `job_signatures`. */
export interface JobSignature {
  id: UUID;
  jobId: UUID;
  storagePath: string;
  signedByName: string;
  signedAt: ISODateString;
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
