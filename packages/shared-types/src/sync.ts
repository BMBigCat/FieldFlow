import type { ISODateString, UUID } from "./common.js";
import type { Customer, Equipment, ServiceAddress } from "./customer.js";
import type { JobListItem, JobNote, JobPhoto, JobSignature, JobStatus, JobTimeEntry } from "./job.js";

/** Build plan §4/§6 `sync_log` — mobile offline sync audit trail. */
export interface SyncLog {
  id: UUID;
  technicianId: UUID;
  deviceId: string;
  syncedAt: ISODateString;
  recordsPushed: number;
  recordsPulled: number;
  conflictsResolved: number;
}

/**
 * Phase 4 offline sync protocol (build plan §6/§7). POST /sync/push carries
 * a batch of offline-queued mutations, each tagged with a `clientGeneratedId`
 * (except `job_status`, which carries `baseLocalVersion` instead — see
 * hvac-app-build-plan.md Phase 4 plan §"Sync Protocol").
 */
export type SyncPushEntityType = "job_note" | "job_photo" | "job_signature" | "job_time_entry" | "job_status";

export interface SyncPushJobNoteItem {
  entityType: "job_note";
  clientGeneratedId: UUID;
  jobId: UUID;
  body: string;
  createdAt: ISODateString;
}

export interface SyncPushJobPhotoItem {
  entityType: "job_photo";
  clientGeneratedId: UUID;
  jobId: UUID;
  caption?: string;
  fileBase64: string;
  mimeType: string;
  capturedAt: ISODateString;
}

export interface SyncPushJobSignatureItem {
  entityType: "job_signature";
  clientGeneratedId: UUID;
  jobId: UUID;
  signedByName: string;
  fileBase64: string;
  mimeType: string;
  signedAt: ISODateString;
}

/**
 * `clientGeneratedId` identifies the clock *session* and is reused across
 * both events on that session — the clock-in item creates the
 * `job_time_entries` row, the clock-out item (same id) fills in its
 * `clockOutAt`.
 */
export interface SyncPushJobTimeEntryItem {
  entityType: "job_time_entry";
  clientGeneratedId: UUID;
  jobId: UUID;
  kind: "clock_in" | "clock_out";
  at: ISODateString;
}

/** No `clientGeneratedId` — conflict detection is via `baseLocalVersion` (§6). */
export interface SyncPushJobStatusItem {
  entityType: "job_status";
  jobId: UUID;
  status?: JobStatus;
  scheduledStart?: ISODateString;
  scheduledEnd?: ISODateString;
  baseLocalVersion: number;
  updatedAt: ISODateString;
}

export type SyncPushItem =
  | SyncPushJobNoteItem
  | SyncPushJobPhotoItem
  | SyncPushJobSignatureItem
  | SyncPushJobTimeEntryItem
  | SyncPushJobStatusItem;

export interface SyncPushRequest {
  deviceId: string;
  items: SyncPushItem[];
}

export interface SyncPushItemResult {
  clientGeneratedId?: UUID;
  jobId: UUID;
  entityType: SyncPushEntityType;
  outcome: "applied" | "duplicate_ignored" | "conflict" | "rejected";
  /** Present when outcome is "conflict" — the server's current state, so the client can reconcile locally. */
  conflict?: { serverStatus: JobStatus; serverLocalVersion: number; serverUpdatedAt: ISODateString };
  /** Present when outcome is "rejected" (e.g. no longer assigned to this job). */
  errorMessage?: string;
}

export interface SyncPushResponse {
  results: SyncPushItemResult[];
  serverTime: ISODateString;
}

/**
 * POST (not GET — see Phase 4 plan decision D4) so the device can send
 * `knownJobIds` to let the server compute `removedJobIds`, which a GET query
 * string can't carry at scale.
 */
export interface SyncPullRequest {
  since: ISODateString | null;
  deviceId: string;
  knownJobIds: UUID[];
}

export interface SyncPullResponse {
  serverTime: ISODateString;
  jobs: JobListItem[];
  customers: Customer[];
  serviceAddresses: ServiceAddress[];
  equipment: Equipment[];
  jobNotes: JobNote[];
  jobPhotos: JobPhoto[];
  jobSignatures: JobSignature[];
  jobTimeEntries: JobTimeEntry[];
  /** Job ids the device has cached that are no longer assigned to this technician. */
  removedJobIds: UUID[];
}
