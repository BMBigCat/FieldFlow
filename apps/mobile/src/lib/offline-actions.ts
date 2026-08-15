import { randomUUID } from "expo-crypto";
import type { JobNote, JobPhoto, JobSignature, JobStatus, JobTimeEntry } from "@fieldflow/shared-types";
import * as repo from "../db/repo";

/**
 * Every offline mutation follows the same shape (build plan §6): write the
 * local cache row first (optimistic), enqueue the matching outbox item, and
 * let the sync engine push it whenever connectivity allows. No branch here
 * checks whether the device is online — that's the whole point.
 */

export async function addNoteOffline(jobId: string, authorId: string, body: string): Promise<JobNote> {
  const clientGeneratedId = randomUUID();
  const createdAt = new Date().toISOString();
  const note: JobNote = { id: clientGeneratedId, jobId, authorId, body, createdAt, clientGeneratedId };
  await repo.upsertNotes([note]);
  await repo.enqueueOutboxItem({ entityType: "job_note", clientGeneratedId, jobId, body, createdAt });
  return note;
}

export async function addPhotoOffline(
  jobId: string,
  localUri: string,
  mimeType: string,
  caption?: string,
): Promise<JobPhoto> {
  const clientGeneratedId = randomUUID();
  const capturedAt = new Date().toISOString();
  const photo: JobPhoto = {
    id: clientGeneratedId,
    jobId,
    storagePath: "",
    caption: caption ?? null,
    uploadedBy: "",
    uploadedAt: capturedAt,
    clientGeneratedId,
  };
  await repo.upsertPhotos([photo], { [clientGeneratedId]: localUri });
  await repo.enqueueOutboxItem({
    entityType: "job_photo",
    clientGeneratedId,
    jobId,
    caption,
    localUri,
    mimeType,
    capturedAt,
  });
  return photo;
}

export async function addSignatureOffline(
  jobId: string,
  localUri: string,
  mimeType: string,
  signedByName: string,
): Promise<JobSignature> {
  const clientGeneratedId = randomUUID();
  const signedAt = new Date().toISOString();
  const signature: JobSignature = {
    id: clientGeneratedId,
    jobId,
    storagePath: "",
    signedByName,
    signedAt,
    clientGeneratedId,
  };
  await repo.upsertSignatures([signature], { [clientGeneratedId]: localUri });
  await repo.enqueueOutboxItem({
    entityType: "job_signature",
    clientGeneratedId,
    jobId,
    signedByName,
    localUri,
    mimeType,
    signedAt,
  });
  return signature;
}

export async function clockInOffline(jobId: string, technicianId: string): Promise<JobTimeEntry> {
  const clientGeneratedId = randomUUID();
  const clockInAt = new Date().toISOString();
  const entry: JobTimeEntry = {
    id: clientGeneratedId,
    jobId,
    technicianId,
    clockInAt,
    clockOutAt: null,
    clientGeneratedId,
    createdAt: clockInAt,
  };
  await repo.upsertTimeEntries([entry]);
  await repo.enqueueOutboxItem({ entityType: "job_time_entry", clientGeneratedId, jobId, kind: "clock_in", at: clockInAt });
  return entry;
}

export async function clockOutOffline(jobId: string, openEntry: JobTimeEntry): Promise<JobTimeEntry> {
  const clockOutAt = new Date().toISOString();
  const entry: JobTimeEntry = { ...openEntry, clockOutAt };
  await repo.upsertTimeEntries([entry]);
  await repo.enqueueOutboxItem({
    entityType: "job_time_entry",
    clientGeneratedId: openEntry.clientGeneratedId,
    jobId,
    kind: "clock_out",
    at: clockOutAt,
  });
  return entry;
}

export async function setJobStatusOffline(
  jobId: string,
  baseLocalVersion: number,
  status: JobStatus,
): Promise<void> {
  const updatedAt = new Date().toISOString();
  await repo.patchLocalJob(jobId, { status, updatedAt });
  await repo.enqueueOutboxItem({ entityType: "job_status", jobId, status, baseLocalVersion, updatedAt });
}
