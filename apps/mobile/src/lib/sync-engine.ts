import { File } from "expo-file-system";
import type {
  SyncPullRequest,
  SyncPullResponse,
  SyncPushItem,
  SyncPushRequest,
  SyncPushResponse,
} from "@fieldflow/shared-types";
import { apiFetch } from "./api";
import * as repo from "../db/repo";
import type { OutboxPayload } from "../db/repo";

async function resolveOutboxItemForPush(payload: OutboxPayload): Promise<SyncPushItem> {
  if (payload.entityType === "job_photo" || payload.entityType === "job_signature") {
    const { localUri, ...rest } = payload;
    const file = new File(localUri);
    const fileBase64 = await file.base64();
    return { ...rest, fileBase64 } as SyncPushItem;
  }
  return payload;
}

async function pushOutbox(deviceId: string): Promise<{ pushed: number; conflicts: number }> {
  const pending = await repo.listPendingOutbox();
  if (pending.length === 0) return { pushed: 0, conflicts: 0 };

  const items = await Promise.all(pending.map((row) => resolveOutboxItemForPush(row.payload)));
  const response = await apiFetch<SyncPushResponse>("/sync/push", {
    method: "POST",
    body: JSON.stringify({ deviceId, items } as SyncPushRequest),
  });

  let pushed = 0;
  let conflicts = 0;
  for (let i = 0; i < pending.length; i++) {
    const row = pending[i];
    const result = response.results[i];
    if (!row || !result) continue;

    if (result.outcome === "applied" || result.outcome === "duplicate_ignored") {
      pushed += 1;
      await repo.removeOutboxItem(row.clientGeneratedId);
    } else if (result.outcome === "conflict") {
      conflicts += 1;
      if (result.conflict) {
        // Server wins (build plan §6 last-write-wins on status/schedule) — reconcile
        // the local cache so the technician sees the real current state.
        await repo.patchLocalJob(row.jobId, {
          status: result.conflict.serverStatus,
          localVersion: result.conflict.serverLocalVersion,
          updatedAt: result.conflict.serverUpdatedAt,
        });
      }
      await repo.removeOutboxItem(row.clientGeneratedId);
    } else {
      // "rejected" can never succeed by retrying (e.g. job reassigned away
      // while offline) — drop it rather than block the queue forever.
      console.warn("[sync] item rejected:", row.entityType, row.jobId, result.errorMessage);
      await repo.removeOutboxItem(row.clientGeneratedId);
    }
  }
  return { pushed, conflicts };
}

async function pullFromServer(deviceId: string): Promise<{ pulled: number; removed: number }> {
  const since = await repo.getLastSyncAt();
  const knownJobIds = await repo.getAllJobIds();

  const response = await apiFetch<SyncPullResponse>("/sync/pull", {
    method: "POST",
    body: JSON.stringify({ since, deviceId, knownJobIds } as SyncPullRequest),
  });

  await repo.removeJobs(response.removedJobIds);
  await repo.upsertCustomers(response.customers);
  await repo.upsertServiceAddresses(response.serviceAddresses);
  await repo.upsertEquipment(response.equipment);
  await repo.upsertJobs(response.jobs);
  await repo.upsertNotes(response.jobNotes);
  await repo.upsertPhotos(response.jobPhotos);
  await repo.upsertSignatures(response.jobSignatures);
  await repo.upsertTimeEntries(response.jobTimeEntries);
  await repo.setLastSyncAt(response.serverTime);

  const pulled =
    response.jobs.length +
    response.customers.length +
    response.serviceAddresses.length +
    response.equipment.length +
    response.jobNotes.length +
    response.jobPhotos.length +
    response.jobSignatures.length +
    response.jobTimeEntries.length;

  return { pulled, removed: response.removedJobIds.length };
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  conflicts: number;
  removed: number;
}

/** Push queued offline mutations before pulling, so local edits reach the
 * server before a fresh snapshot overwrites what the technician just did. */
export async function runSync(): Promise<SyncResult> {
  const deviceId = await repo.getDeviceId();
  const { pushed, conflicts } = await pushOutbox(deviceId);
  const { pulled, removed } = await pullFromServer(deviceId);
  return { pushed, pulled, conflicts, removed };
}
