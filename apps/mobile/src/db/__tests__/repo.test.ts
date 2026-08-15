import type { Customer, JobListItem, ServiceAddress } from "@fieldflow/shared-types";

const baseJob: JobListItem = {
  id: "job-1",
  orgId: "org-1",
  customerId: "cust-1",
  serviceAddressId: "addr-1",
  equipmentId: null,
  type: "repair",
  status: "scheduled",
  priority: "normal",
  description: "Fix it",
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

describe("db/repo", () => {
  let repo: typeof import("../repo");

  beforeEach(() => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    repo = require("../repo");
  });

  test("upsertJobs + getJob roundtrip", async () => {
    await repo.upsertJobs([baseJob]);
    expect(await repo.getJob("job-1")).toEqual(baseJob);
  });

  test("getJobsForRange only returns jobs whose scheduledStart falls in the window", async () => {
    await repo.upsertJobs([baseJob, { ...baseJob, id: "job-2", scheduledStart: "2026-02-01T10:00:00.000Z" }]);
    const inRange = await repo.getJobsForRange("2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z");
    expect(inRange.map((j) => j.id)).toEqual(["job-1"]);
  });

  test("removeJobs cascades to every child table", async () => {
    await repo.upsertJobs([baseJob]);
    await repo.upsertNotes([
      { id: "n1", jobId: "job-1", authorId: "u1", body: "hi", createdAt: "2026-01-01T00:00:00.000Z", clientGeneratedId: "cgid-1" },
    ]);
    await repo.removeJobs(["job-1"]);
    expect(await repo.getJob("job-1")).toBeNull();
    const children = await repo.getJobChildren("job-1");
    expect(children.notes).toHaveLength(0);
  });

  test("upsertNotes dedupes by clientGeneratedId: a synced note replaces its temp local row instead of duplicating it", async () => {
    const clientGeneratedId = "cgid-note-1";
    // Optimistic local write happens before any server id exists, so the temp id === clientGeneratedId.
    await repo.upsertNotes([
      { id: clientGeneratedId, jobId: "job-1", authorId: "u1", body: "temp", createdAt: "2026-01-01T00:00:00.000Z", clientGeneratedId },
    ]);
    // A later pull returns the canonical row under the server's real id, same clientGeneratedId.
    await repo.upsertNotes([
      { id: "server-note-id", jobId: "job-1", authorId: "u1", body: "temp", createdAt: "2026-01-01T00:00:00.000Z", clientGeneratedId },
    ]);
    const children = await repo.getJobChildren("job-1");
    expect(children.notes).toHaveLength(1);
    expect(children.notes[0].id).toBe("server-note-id");
  });

  test("outbox: enqueue, list, count, remove", async () => {
    await repo.enqueueOutboxItem({
      entityType: "job_note",
      clientGeneratedId: "cgid-1",
      jobId: "job-1",
      body: "hi",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(await repo.countPendingOutbox()).toBe(1);
    const pending = await repo.listPendingOutbox();
    expect(pending).toHaveLength(1);
    expect(pending[0].entityType).toBe("job_note");
    await repo.removeOutboxItem("cgid-1");
    expect(await repo.countPendingOutbox()).toBe(0);
  });

  test("outbox: enqueueing the same clientGeneratedId twice replaces, not duplicates (e.g. clock-out reusing the clock-in id)", async () => {
    await repo.enqueueOutboxItem({ entityType: "job_time_entry", clientGeneratedId: "session-1", jobId: "job-1", kind: "clock_in", at: "t1" });
    await repo.enqueueOutboxItem({ entityType: "job_time_entry", clientGeneratedId: "session-1", jobId: "job-1", kind: "clock_out", at: "t2" });
    expect(await repo.countPendingOutbox()).toBe(1);
    const [item] = await repo.listPendingOutbox();
    expect(item.payload).toMatchObject({ kind: "clock_out" });
  });

  test("getCachedJobDetail reconstructs a JobDetail-shaped object from cache", async () => {
    const customer: Customer = {
      id: "cust-1",
      orgId: "org-1",
      name: "Acme",
      phone: null,
      email: null,
      billingAddress: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      createdBy: "user-1",
    };
    const address: ServiceAddress = { id: "addr-1", customerId: "cust-1", label: null, address: "123 Main St", lat: null, lng: null };
    await repo.upsertJobs([baseJob]);
    await repo.upsertCustomers([customer]);
    await repo.upsertServiceAddresses([address]);

    const detail = await repo.getCachedJobDetail("job-1", { id: "tech-1", fullName: "Tech One" });
    expect(detail?.customer).toEqual({ id: "cust-1", name: "Acme" });
    expect(detail?.serviceAddress).toEqual(address);
    expect(detail?.assignedTechnicians).toEqual([{ id: "tech-1", fullName: "Tech One" }]);
  });

  test("getCachedJobDetail returns null when the customer/address haven't been cached yet", async () => {
    await repo.upsertJobs([baseJob]);
    expect(await repo.getCachedJobDetail("job-1", { id: "tech-1", fullName: "Tech One" })).toBeNull();
  });

  test("getDeviceId is generated once and persisted across calls", async () => {
    const id1 = await repo.getDeviceId();
    const id2 = await repo.getDeviceId();
    expect(id1).toBe(id2);
    expect(id1).toHaveLength(36);
  });

  test("patchLocalJob only overwrites the given fields", async () => {
    await repo.upsertJobs([baseJob]);
    await repo.patchLocalJob("job-1", { status: "completed" });
    const updated = await repo.getJob("job-1");
    expect(updated?.status).toBe("completed");
    expect(updated?.description).toBe(baseJob.description);
  });
});
