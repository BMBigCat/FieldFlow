import { randomUUID } from "expo-crypto";
import type {
  Customer,
  Equipment,
  JobDetail,
  JobListItem,
  JobNote,
  JobPhoto,
  JobSignature,
  JobTimeEntry,
  ServiceAddress,
  SyncPushJobNoteItem,
  SyncPushJobSignatureItem,
  SyncPushJobStatusItem,
  SyncPushJobTimeEntryItem,
  SyncPushJobPhotoItem,
  UUID,
} from "@fieldflow/shared-types";
import { getDb } from "./client";

export type OutboxPhotoPayload = Omit<SyncPushJobPhotoItem, "fileBase64"> & { localUri: string };
export type OutboxSignaturePayload = Omit<SyncPushJobSignatureItem, "fileBase64"> & { localUri: string };
export type OutboxPayload =
  | SyncPushJobNoteItem
  | OutboxPhotoPayload
  | OutboxSignaturePayload
  | SyncPushJobTimeEntryItem
  | SyncPushJobStatusItem;

export interface OutboxRow {
  clientGeneratedId: UUID;
  entityType: OutboxPayload["entityType"];
  jobId: UUID;
  payload: OutboxPayload;
  createdAt: string;
  status: "pending";
}

// ---- jobs ----

export async function upsertJobs(jobs: JobListItem[]): Promise<void> {
  const db = await getDb();
  for (const job of jobs) {
    await db.runAsync(
      `INSERT INTO jobs (id, customer_id, status, scheduled_start, updated_at, data)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         customer_id = excluded.customer_id,
         status = excluded.status,
         scheduled_start = excluded.scheduled_start,
         updated_at = excluded.updated_at,
         data = excluded.data`,
      [job.id, job.customerId, job.status, job.scheduledStart, job.updatedAt, JSON.stringify(job)],
    );
  }
}

export async function removeJobs(jobIds: string[]): Promise<void> {
  if (jobIds.length === 0) return;
  const db = await getDb();
  const placeholders = jobIds.map(() => "?").join(",");
  for (const table of ["jobs", "job_notes", "job_photos", "job_signatures", "job_time_entries"]) {
    await db.runAsync(`DELETE FROM ${table} WHERE ${table === "jobs" ? "id" : "job_id"} IN (${placeholders})`, jobIds);
  }
}

export async function getJobsForRange(fromISO: string, toISO: string): Promise<JobListItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ data: string }>(
    `SELECT data FROM jobs WHERE scheduled_start IS NOT NULL AND scheduled_start >= ? AND scheduled_start <= ? ORDER BY scheduled_start ASC`,
    [fromISO, toISO],
  );
  return rows.map((r) => JSON.parse(r.data) as JobListItem);
}

export async function getJob(id: string): Promise<JobListItem | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ data: string }>(`SELECT data FROM jobs WHERE id = ?`, [id]);
  return row ? (JSON.parse(row.data) as JobListItem) : null;
}

export async function getAllJobIds(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string }>(`SELECT id FROM jobs`);
  return rows.map((r) => r.id);
}

async function patchLocalJob(id: string, patch: Partial<JobListItem>): Promise<void> {
  const existing = await getJob(id);
  if (!existing) return;
  const updated: JobListItem = { ...existing, ...patch };
  await upsertJobs([updated]);
}

// ---- customers / addresses / equipment ----

export async function upsertCustomers(customers: Customer[]): Promise<void> {
  const db = await getDb();
  for (const c of customers) {
    await db.runAsync(
      `INSERT INTO customers (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
      [c.id, JSON.stringify(c)],
    );
  }
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ data: string }>(`SELECT data FROM customers WHERE id = ?`, [id]);
  return row ? (JSON.parse(row.data) as Customer) : null;
}

export async function upsertServiceAddresses(addresses: ServiceAddress[]): Promise<void> {
  const db = await getDb();
  for (const a of addresses) {
    await db.runAsync(
      `INSERT INTO service_addresses (id, customer_id, data) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET customer_id = excluded.customer_id, data = excluded.data`,
      [a.id, a.customerId, JSON.stringify(a)],
    );
  }
}

export async function getServiceAddress(id: string): Promise<ServiceAddress | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ data: string }>(`SELECT data FROM service_addresses WHERE id = ?`, [id]);
  return row ? (JSON.parse(row.data) as ServiceAddress) : null;
}

export async function upsertEquipment(items: Equipment[]): Promise<void> {
  const db = await getDb();
  for (const e of items) {
    await db.runAsync(
      `INSERT INTO equipment (id, customer_id, data) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET customer_id = excluded.customer_id, data = excluded.data`,
      [e.id, e.customerId, JSON.stringify(e)],
    );
  }
}

export async function getEquipmentById(id: string | null): Promise<Equipment | null> {
  if (!id) return null;
  const db = await getDb();
  const row = await db.getFirstAsync<{ data: string }>(`SELECT data FROM equipment WHERE id = ?`, [id]);
  return row ? (JSON.parse(row.data) as Equipment) : null;
}

// ---- job children (notes / photos / signatures / time entries) ----

export async function upsertNotes(notes: JobNote[]): Promise<void> {
  const db = await getDb();
  for (const n of notes) {
    await db.runAsync(
      `INSERT INTO job_notes (client_generated_id, id, job_id, created_at, data) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(client_generated_id) DO UPDATE SET id = excluded.id, data = excluded.data`,
      [n.clientGeneratedId, n.id, n.jobId, n.createdAt, JSON.stringify(n)],
    );
  }
}

export async function upsertPhotos(photos: JobPhoto[], localUriByClientId: Record<string, string> = {}): Promise<void> {
  const db = await getDb();
  for (const p of photos) {
    await db.runAsync(
      `INSERT INTO job_photos (client_generated_id, id, job_id, local_uri, uploaded_at, data) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(client_generated_id) DO UPDATE SET
         id = excluded.id,
         data = excluded.data,
         local_uri = COALESCE(job_photos.local_uri, excluded.local_uri)`,
      [p.clientGeneratedId, p.id, p.jobId, localUriByClientId[p.clientGeneratedId] ?? null, p.uploadedAt, JSON.stringify(p)],
    );
  }
}

export async function upsertSignatures(
  signatures: JobSignature[],
  localUriByClientId: Record<string, string> = {},
): Promise<void> {
  const db = await getDb();
  for (const s of signatures) {
    await db.runAsync(
      `INSERT INTO job_signatures (client_generated_id, id, job_id, local_uri, signed_at, data) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(client_generated_id) DO UPDATE SET
         id = excluded.id,
         data = excluded.data,
         local_uri = COALESCE(job_signatures.local_uri, excluded.local_uri)`,
      [s.clientGeneratedId, s.id, s.jobId, localUriByClientId[s.clientGeneratedId] ?? null, s.signedAt, JSON.stringify(s)],
    );
  }
}

export async function upsertTimeEntries(entries: JobTimeEntry[]): Promise<void> {
  const db = await getDb();
  for (const t of entries) {
    await db.runAsync(
      `INSERT INTO job_time_entries (client_generated_id, id, job_id, clock_in_at, data) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(client_generated_id) DO UPDATE SET id = excluded.id, data = excluded.data`,
      [t.clientGeneratedId, t.id, t.jobId, t.clockInAt, JSON.stringify(t)],
    );
  }
}

export async function getJobChildren(jobId: string): Promise<{
  notes: JobNote[];
  photos: (JobPhoto & { localUri: string | null })[];
  signatures: (JobSignature & { localUri: string | null })[];
  timeEntries: JobTimeEntry[];
}> {
  const db = await getDb();
  const [notes, photos, signatures, timeEntries] = await Promise.all([
    db.getAllAsync<{ data: string }>(`SELECT data FROM job_notes WHERE job_id = ? ORDER BY created_at ASC`, [jobId]),
    db.getAllAsync<{ data: string; local_uri: string | null }>(
      `SELECT data, local_uri FROM job_photos WHERE job_id = ? ORDER BY uploaded_at ASC`,
      [jobId],
    ),
    db.getAllAsync<{ data: string; local_uri: string | null }>(
      `SELECT data, local_uri FROM job_signatures WHERE job_id = ? ORDER BY signed_at ASC`,
      [jobId],
    ),
    db.getAllAsync<{ data: string }>(`SELECT data FROM job_time_entries WHERE job_id = ? ORDER BY clock_in_at ASC`, [jobId]),
  ]);
  return {
    notes: notes.map((r) => JSON.parse(r.data) as JobNote),
    photos: photos.map((r) => ({ ...(JSON.parse(r.data) as JobPhoto), localUri: r.local_uri })),
    signatures: signatures.map((r) => ({ ...(JSON.parse(r.data) as JobSignature), localUri: r.local_uri })),
    timeEntries: timeEntries.map((r) => JSON.parse(r.data) as JobTimeEntry),
  };
}

/** Best-effort JobDetail reconstructed entirely from local cache, for offline viewing. */
export async function getCachedJobDetail(
  jobId: string,
  currentUser: { id: string; fullName: string },
): Promise<JobDetail | null> {
  const job = await getJob(jobId);
  if (!job) return null;
  const [customer, address, equipment, children] = await Promise.all([
    getCustomer(job.customerId),
    getServiceAddress(job.serviceAddressId),
    getEquipmentById(job.equipmentId),
    getJobChildren(jobId),
  ]);
  if (!customer || !address) return null;

  return {
    ...job,
    customer: { id: customer.id, name: customer.name },
    serviceAddress: address,
    equipment,
    assignedTechnicians: job.technicianIds.map((id) =>
      id === currentUser.id ? { id, fullName: currentUser.fullName } : { id, fullName: "Teammate" },
    ),
    notes: children.notes,
    photos: children.photos,
    signatures: children.signatures,
    timeEntries: children.timeEntries,
  };
}

// ---- outbox (write queue) ----

export async function enqueueOutboxItem(payload: OutboxPayload): Promise<void> {
  const db = await getDb();
  const clientGeneratedId = "clientGeneratedId" in payload ? payload.clientGeneratedId : `${payload.jobId}:${payload.baseLocalVersion}`;
  await db.runAsync(
    `INSERT OR REPLACE INTO outbox (client_generated_id, entity_type, job_id, payload, created_at, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [clientGeneratedId, payload.entityType, payload.jobId, JSON.stringify(payload), new Date().toISOString()],
  );
}

export async function listPendingOutbox(): Promise<OutboxRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    client_generated_id: string;
    entity_type: OutboxPayload["entityType"];
    job_id: string;
    payload: string;
    created_at: string;
    status: "pending";
  }>(`SELECT * FROM outbox ORDER BY created_at ASC`);
  return rows.map((r) => ({
    clientGeneratedId: r.client_generated_id,
    entityType: r.entity_type,
    jobId: r.job_id,
    payload: JSON.parse(r.payload) as OutboxPayload,
    createdAt: r.created_at,
    status: r.status,
  }));
}

export async function countPendingOutbox(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM outbox`);
  return row?.count ?? 0;
}

export async function removeOutboxItem(clientGeneratedId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM outbox WHERE client_generated_id = ?`, [clientGeneratedId]);
}

// ---- sync_meta (cursor, device id, current-user cache) ----

async function getMeta(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(`SELECT value FROM sync_meta WHERE key = ?`, [key]);
  return row?.value ?? null;
}

async function setMeta(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [
    key,
    value,
  ]);
}

export async function getLastSyncAt(): Promise<string | null> {
  return getMeta("last_sync_at");
}

export async function setLastSyncAt(iso: string): Promise<void> {
  await setMeta("last_sync_at", iso);
}

export async function getDeviceId(): Promise<string> {
  const existing = await getMeta("device_id");
  if (existing) return existing;
  const id = randomUUID();
  await setMeta("device_id", id);
  return id;
}

export async function setCachedCurrentUser(user: { id: string; fullName: string }): Promise<void> {
  await setMeta("current_user", JSON.stringify(user));
}

export async function getCachedCurrentUser(): Promise<{ id: string; fullName: string } | null> {
  const raw = await getMeta("current_user");
  return raw ? JSON.parse(raw) : null;
}

export { patchLocalJob };
