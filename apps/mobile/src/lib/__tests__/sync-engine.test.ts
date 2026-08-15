import type { JobListItem } from "@fieldflow/shared-types";

// Factory form so Jest never has to load the real ../api (which pulls in
// AsyncStorage/react-native-url-polyfill — unavailable under plain Node).
jest.mock("../api", () => ({ apiFetch: jest.fn() }));

const baseJob: JobListItem = {
  id: "job-1",
  orgId: "org-1",
  customerId: "cust-1",
  serviceAddressId: "addr-1",
  equipmentId: null,
  type: "repair",
  status: "scheduled",
  priority: "normal",
  description: null,
  scheduledStart: "2026-01-01T10:00:00.000Z",
  scheduledEnd: "2026-01-01T11:00:00.000Z",
  actualStart: null,
  actualEnd: null,
  createdBy: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  localVersion: 1,
  updatedAt: "2026-01-01T00:00:00.000Z",
  technicianIds: ["tech-1"],
};

describe("lib/sync-engine", () => {
  let repo: typeof import("../../db/repo");
  let syncEngine: typeof import("../sync-engine");
  let apiFetch: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    repo = require("../../db/repo");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    apiFetch = require("../api").apiFetch;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    syncEngine = require("../sync-engine");
  });

  test("pushOutbox handles applied / duplicate_ignored / conflict / rejected outcomes distinctly", async () => {
    await repo.upsertJobs([baseJob]);
    await repo.enqueueOutboxItem({ entityType: "job_note", clientGeneratedId: "n1", jobId: "job-1", body: "a", createdAt: "t" });
    await repo.enqueueOutboxItem({ entityType: "job_note", clientGeneratedId: "n2", jobId: "job-1", body: "b", createdAt: "t" });
    await repo.enqueueOutboxItem({ entityType: "job_status", jobId: "job-1", status: "completed", baseLocalVersion: 1, updatedAt: "t" });
    await repo.enqueueOutboxItem({ entityType: "job_note", clientGeneratedId: "n4", jobId: "job-1", body: "d", createdAt: "t" });

    apiFetch.mockImplementation(async (path: string) => {
      if (path === "/sync/push") {
        return {
          serverTime: "t2",
          results: [
            { jobId: "job-1", entityType: "job_note", clientGeneratedId: "n1", outcome: "applied" },
            { jobId: "job-1", entityType: "job_note", clientGeneratedId: "n2", outcome: "duplicate_ignored" },
            {
              jobId: "job-1",
              entityType: "job_status",
              outcome: "conflict",
              conflict: { serverStatus: "in_progress", serverLocalVersion: 5, serverUpdatedAt: "t3" },
            },
            { jobId: "job-1", entityType: "job_note", clientGeneratedId: "n4", outcome: "rejected", errorMessage: "no longer assigned" },
          ],
        };
      }
      if (path === "/sync/pull") {
        return {
          serverTime: "t4",
          jobs: [],
          customers: [],
          serviceAddresses: [],
          equipment: [],
          jobNotes: [],
          jobPhotos: [],
          jobSignatures: [],
          jobTimeEntries: [],
          removedJobIds: [],
        };
      }
      throw new Error(`unexpected path ${path}`);
    });

    const result = await syncEngine.runSync();

    expect(result.pushed).toBe(2); // applied + duplicate_ignored
    expect(result.conflicts).toBe(1);
    expect(await repo.countPendingOutbox()).toBe(0); // every item cleared, including the rejected one

    // Server wins the conflict (build plan §6 last-write-wins) — local cache reconciled.
    const job = await repo.getJob("job-1");
    expect(job?.status).toBe("in_progress");
    expect(job?.localVersion).toBe(5);
  });

  test("pullFromServer upserts new entities, applies removedJobIds, and advances the sync cursor", async () => {
    await repo.upsertJobs([{ ...baseJob, id: "stale-job" }]);

    apiFetch.mockImplementation(async (path: string, init?: { body?: string }) => {
      if (path === "/sync/push") return { serverTime: "t", results: [] };
      if (path === "/sync/pull") {
        const body = JSON.parse(init?.body ?? "{}");
        expect(body.knownJobIds).toEqual(["stale-job"]);
        expect(body.since).toBeNull();
        return {
          serverTime: "t5",
          jobs: [{ ...baseJob, id: "new-job" }],
          customers: [],
          serviceAddresses: [],
          equipment: [],
          jobNotes: [],
          jobPhotos: [],
          jobSignatures: [],
          jobTimeEntries: [],
          removedJobIds: ["stale-job"],
        };
      }
      throw new Error("unexpected path");
    });

    await syncEngine.runSync();

    expect(await repo.getJob("stale-job")).toBeNull();
    expect(await repo.getJob("new-job")).not.toBeNull();
    expect(await repo.getLastSyncAt()).toBe("t5");
  });

  test("a failed network call leaves the outbox intact for the next retry", async () => {
    await repo.enqueueOutboxItem({ entityType: "job_note", clientGeneratedId: "n1", jobId: "job-1", body: "a", createdAt: "t" });
    apiFetch.mockRejectedValue(new Error("Network request failed"));

    await expect(syncEngine.runSync()).rejects.toThrow("Network request failed");
    expect(await repo.countPendingOutbox()).toBe(1);
  });

  test("photo/signature outbox items are resolved from their local file before push (fileBase64 attached, localUri stripped)", async () => {
    await repo.enqueueOutboxItem({
      entityType: "job_photo",
      clientGeneratedId: "p1",
      jobId: "job-1",
      localUri: "file:///tmp/photo.jpg",
      mimeType: "image/jpeg",
      capturedAt: "t",
    });

    let pushedItems: unknown[] = [];
    apiFetch.mockImplementation(async (path: string, init?: { body?: string }) => {
      if (path === "/sync/push") {
        pushedItems = JSON.parse(init?.body ?? "{}").items;
        return { serverTime: "t", results: [{ jobId: "job-1", entityType: "job_photo", clientGeneratedId: "p1", outcome: "applied" }] };
      }
      if (path === "/sync/pull") {
        return {
          serverTime: "t",
          jobs: [],
          customers: [],
          serviceAddresses: [],
          equipment: [],
          jobNotes: [],
          jobPhotos: [],
          jobSignatures: [],
          jobTimeEntries: [],
          removedJobIds: [],
        };
      }
      throw new Error("unexpected path");
    });

    await syncEngine.runSync();

    expect(pushedItems).toHaveLength(1);
    expect(pushedItems[0]).toMatchObject({
      entityType: "job_photo",
      fileBase64: "base64-of-file:///tmp/photo.jpg",
    });
    expect(pushedItems[0]).not.toHaveProperty("localUri");
  });
});
