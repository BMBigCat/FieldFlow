import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { JobsService } from "./jobs.service";
import { SupabaseUserClientFactory } from "../supabase/supabase-user-client.factory";
import type { RequestUser } from "../auth/request-user";

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "insert", "update", "delete", "eq", "order", "gte", "lte", "is", "limit"]) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }
  builder.single = jest.fn().mockResolvedValue(result);
  builder.maybeSingle = jest.fn().mockResolvedValue(result);
  builder.then = (resolve: (value: unknown) => unknown) => resolve(result);
  return builder;
}

const requestUser: RequestUser = {
  id: "user-1",
  email: "office@acme.test",
  orgId: "org-1",
  role: "office",
  accessToken: "tok",
};

const baseJobRow = {
  id: "job-1",
  org_id: "org-1",
  customer_id: "c-1",
  service_address_id: "a-1",
  equipment_id: null,
  type: "repair",
  status: "unscheduled",
  priority: "normal",
  description: null,
  scheduled_start: null,
  scheduled_end: null,
  actual_start: null,
  actual_end: null,
  created_by: "user-1",
  created_at: "2026-01-01T00:00:00Z",
  local_version: 1,
  updated_at: "2026-01-01T00:00:00Z",
};

describe("JobsService", () => {
  let service: JobsService;
  let userClientFactory: { forToken: jest.Mock };
  let fromMock: jest.Mock;
  let storageFromMock: jest.Mock;

  beforeEach(async () => {
    fromMock = jest.fn();
    storageFromMock = jest.fn();
    userClientFactory = {
      forToken: jest.fn().mockReturnValue({ from: fromMock, storage: { from: storageFromMock } }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [JobsService, { provide: SupabaseUserClientFactory, useValue: userClientFactory }],
    }).compile();

    service = module.get(JobsService);
  });

  it("list with no filters returns mapped jobs with embedded technicianIds", async () => {
    const row = { ...baseJobRow, job_assignments: [{ technician_id: "tech-1" }] };
    const builder = makeQueryBuilder({ data: [row], error: null });
    fromMock.mockReturnValueOnce(builder);

    const result = await service.list(requestUser, {});

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("job-1");
    expect(result[0].technicianIds).toEqual(["tech-1"]);
    expect(builder.select).toHaveBeenCalledWith(expect.stringContaining("job_assignments(technician_id)"));
    expect(builder.eq).not.toHaveBeenCalled();
  });

  it("list with a technician filter joins job_assignments", async () => {
    const builder = makeQueryBuilder({ data: [baseJobRow], error: null });
    fromMock.mockReturnValueOnce(builder);

    await service.list(requestUser, { technician: "tech-1" });

    expect(builder.select).toHaveBeenCalledWith(expect.stringContaining("job_assignments!inner"));
    expect(builder.eq).toHaveBeenCalledWith("job_assignments.technician_id", "tech-1");
  });

  it("list applies status/from/to filters", async () => {
    const builder = makeQueryBuilder({ data: [], error: null });
    fromMock.mockReturnValueOnce(builder);

    await service.list(requestUser, { status: "scheduled", from: "2026-01-01", to: "2026-01-31" });

    expect(builder.eq).toHaveBeenCalledWith("status", "scheduled");
    expect(builder.gte).toHaveBeenCalledWith("scheduled_start", "2026-01-01");
    expect(builder.lte).toHaveBeenCalledWith("scheduled_start", "2026-01-31");
  });

  it("create sets status=scheduled when a scheduledStart is given, and orgId/createdBy from the user", async () => {
    const jobBuilder = makeQueryBuilder({
      data: { ...baseJobRow, status: "scheduled", scheduled_start: "2026-02-01T09:00:00Z" },
      error: null,
    });
    fromMock.mockReturnValueOnce(jobBuilder);

    const result = await service.create(requestUser, {
      customerId: "c-1",
      serviceAddressId: "a-1",
      type: "repair",
      scheduledStart: "2026-02-01T09:00:00Z",
    });

    expect(jobBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ org_id: "org-1", created_by: "user-1", status: "scheduled" }),
    );
    expect(result.status).toBe("scheduled");
    expect(fromMock).toHaveBeenCalledTimes(1); // no technicianIds -> no job_assignments insert
  });

  it("create defaults to status=unscheduled and assigns technicians when provided", async () => {
    const jobBuilder = makeQueryBuilder({ data: baseJobRow, error: null });
    const assignmentBuilder = makeQueryBuilder({ data: null, error: null });
    fromMock.mockReturnValueOnce(jobBuilder).mockReturnValueOnce(assignmentBuilder);

    await service.create(requestUser, {
      customerId: "c-1",
      serviceAddressId: "a-1",
      type: "repair",
      technicianIds: ["tech-1", "tech-2"],
    });

    expect(jobBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ status: "unscheduled" }));
    expect(assignmentBuilder.insert).toHaveBeenCalledWith([
      { job_id: "job-1", technician_id: "tech-1" },
      { job_id: "job-1", technician_id: "tech-2" },
    ]);
  });

  it("getDetail maps nested customer/serviceAddress/equipment/assignedTechnicians/notes/photos", async () => {
    const row = {
      ...baseJobRow,
      customers: { id: "c-1", name: "Acme Home" },
      service_addresses: { id: "a-1", customer_id: "c-1", label: "Main", address: "1 Main St", lat: null, lng: null },
      equipment: null,
      job_assignments: [{ technician_id: "tech-1", users: { id: "tech-1", full_name: "Tina Tech" } }],
      job_notes: [{ id: "n-1", job_id: "job-1", author_id: "user-1", body: "note", created_at: "2026-01-02T00:00:00Z", client_generated_id: "cg-1" }],
      job_photos: [],
    };
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: row, error: null }));

    const result = await service.getDetail(requestUser, "job-1");

    expect(result.customer).toEqual({ id: "c-1", name: "Acme Home" });
    expect(result.serviceAddress.address).toBe("1 Main St");
    expect(result.equipment).toBeNull();
    expect(result.assignedTechnicians).toEqual([{ id: "tech-1", fullName: "Tina Tech" }]);
    expect(result.notes).toHaveLength(1);
  });

  it("getDetail throws NotFoundException when the job doesn't exist", async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: null, error: null }));

    await expect(service.getDetail(requestUser, "missing")).rejects.toThrow(NotFoundException);
  });

  it("update patches only provided fields when technicianIds is absent", async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: { id: "job-1" }, error: null })); // getJobOrThrow
    const updateBuilder = makeQueryBuilder({ data: { ...baseJobRow, status: "in_progress" }, error: null });
    fromMock.mockReturnValueOnce(updateBuilder);

    const result = await service.update(requestUser, "job-1", { status: "in_progress" });

    expect(updateBuilder.update).toHaveBeenCalledWith({ status: "in_progress" });
    expect(result.status).toBe("in_progress");
  });

  it("update replaces the full assignment set when technicianIds is provided", async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: { id: "job-1" }, error: null })); // getJobOrThrow
    const deleteBuilder = makeQueryBuilder({ data: null, error: null });
    const insertBuilder = makeQueryBuilder({ data: null, error: null });
    const selectBuilder = makeQueryBuilder({ data: baseJobRow, error: null }); // no other patch fields -> plain select
    fromMock.mockReturnValueOnce(deleteBuilder).mockReturnValueOnce(insertBuilder).mockReturnValueOnce(selectBuilder);

    await service.update(requestUser, "job-1", { technicianIds: ["tech-1"] });

    expect(deleteBuilder.delete).toHaveBeenCalled();
    expect(insertBuilder.insert).toHaveBeenCalledWith([{ job_id: "job-1", technician_id: "tech-1" }]);
    expect(selectBuilder.update).not.toHaveBeenCalled();
  });

  it("update clears all assignments when technicianIds is an empty array", async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: { id: "job-1" }, error: null })); // getJobOrThrow
    const deleteBuilder = makeQueryBuilder({ data: null, error: null });
    const selectBuilder = makeQueryBuilder({ data: baseJobRow, error: null });
    fromMock.mockReturnValueOnce(deleteBuilder).mockReturnValueOnce(selectBuilder);

    await service.update(requestUser, "job-1", { technicianIds: [] });

    expect(deleteBuilder.delete).toHaveBeenCalled();
    // second from() call is the plain select, not a job_assignments insert
    expect(fromMock).toHaveBeenCalledTimes(3);
  });

  it("update throws NotFoundException when the job doesn't exist", async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: null, error: null }));

    await expect(service.update(requestUser, "missing", { status: "scheduled" })).rejects.toThrow(NotFoundException);
  });

  it("addNote creates a note with a generated clientGeneratedId", async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: { id: "job-1" }, error: null })); // getJobOrThrow
    const insertBuilder = makeQueryBuilder({
      data: { id: "n-1", job_id: "job-1", author_id: "user-1", body: "Called ahead", created_at: "2026-01-02T00:00:00Z", client_generated_id: "cg-1" },
      error: null,
    });
    fromMock.mockReturnValueOnce(insertBuilder);

    const result = await service.addNote(requestUser, "job-1", { body: "Called ahead" });

    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ job_id: "job-1", author_id: "user-1", body: "Called ahead" }),
    );
    expect(result.clientGeneratedId).toBeDefined();
  });

  it("addNote throws NotFoundException when the job doesn't exist", async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: null, error: null }));

    await expect(service.addNote(requestUser, "missing", { body: "x" })).rejects.toThrow(NotFoundException);
  });

  it("addPhoto rejects disallowed file types before touching storage", async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: { id: "job-1" }, error: null }));

    await expect(
      service.addPhoto(requestUser, "job-1", {
        mimetype: "application/pdf",
        buffer: Buffer.from(""),
        originalname: "doc.pdf",
      } as Express.Multer.File),
    ).rejects.toThrow(BadRequestException);

    expect(storageFromMock).not.toHaveBeenCalled();
  });

  it("addPhoto uploads and saves the resulting public URL", async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: { id: "job-1" }, error: null })); // getJobOrThrow
    const bucket = {
      upload: jest.fn().mockResolvedValue({ error: null }),
      getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: "https://example.test/job-photos/org-1/job-1/photo-1.jpg" } }),
    };
    storageFromMock.mockReturnValue(bucket);
    const insertBuilder = makeQueryBuilder({
      data: { id: "p-1", job_id: "job-1", storage_path: "https://example.test/job-photos/org-1/job-1/photo-1.jpg", caption: null, uploaded_by: "user-1", uploaded_at: "2026-01-02T00:00:00Z", client_generated_id: "cg-1" },
      error: null,
    });
    fromMock.mockReturnValueOnce(insertBuilder);

    const result = await service.addPhoto(requestUser, "job-1", {
      mimetype: "image/jpeg",
      buffer: Buffer.from("fake-image-bytes"),
      originalname: "photo.jpg",
    } as Express.Multer.File);

    expect(bucket.upload).toHaveBeenCalled();
    expect(result.storagePath).toBe("https://example.test/job-photos/org-1/job-1/photo-1.jpg");
  });

  it("addPhoto throws NotFoundException when the job doesn't exist", async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: null, error: null }));

    await expect(
      service.addPhoto(requestUser, "missing", {
        mimetype: "image/jpeg",
        buffer: Buffer.from(""),
        originalname: "photo.jpg",
      } as Express.Multer.File),
    ).rejects.toThrow(NotFoundException);
  });

  it("addSignature uploads and saves the resulting public URL", async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: { id: "job-1" }, error: null })); // getJobOrThrow
    const bucket = {
      upload: jest.fn().mockResolvedValue({ error: null }),
      getPublicUrl: jest
        .fn()
        .mockReturnValue({ data: { publicUrl: "https://example.test/job-signatures/org-1/job-1/signature-1.png" } }),
    };
    storageFromMock.mockReturnValue(bucket);
    const insertBuilder = makeQueryBuilder({
      data: {
        id: "s-1",
        job_id: "job-1",
        storage_path: "https://example.test/job-signatures/org-1/job-1/signature-1.png",
        signed_by_name: "Jane Doe",
        signed_at: "2026-01-02T00:00:00Z",
        client_generated_id: "cg-1",
      },
      error: null,
    });
    fromMock.mockReturnValueOnce(insertBuilder);

    const result = await service.addSignature(
      requestUser,
      "job-1",
      { mimetype: "image/png", buffer: Buffer.from("sig-bytes"), originalname: "sig.png" } as Express.Multer.File,
      { signedByName: "Jane Doe" },
    );

    expect(bucket.upload).toHaveBeenCalled();
    expect(result.signedByName).toBe("Jane Doe");
  });

  it("clockIn creates a new time entry when none is open", async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: { id: "job-1" }, error: null })); // getJobOrThrow
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: [], error: null })); // no open entries
    const insertBuilder = makeQueryBuilder({
      data: {
        id: "te-1",
        job_id: "job-1",
        technician_id: "user-1",
        clock_in_at: "2026-01-02T08:00:00Z",
        clock_out_at: null,
        client_generated_id: "cg-1",
        created_at: "2026-01-02T08:00:00Z",
      },
      error: null,
    });
    fromMock.mockReturnValueOnce(insertBuilder);

    const result = await service.clockIn(requestUser, "job-1", {});

    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ job_id: "job-1", technician_id: "user-1" }),
    );
    expect(result.clockOutAt).toBeNull();
  });

  it("clockIn rejects a second concurrent session for the same technician", async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: { id: "job-1" }, error: null })); // getJobOrThrow
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: [{ client_generated_id: "other-cg" }], error: null }));

    await expect(service.clockIn(requestUser, "job-1", { clientGeneratedId: "cg-1" })).rejects.toThrow(
      BadRequestException,
    );
  });

  it("clockOut closes the technician's open entry", async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: { id: "job-1" }, error: null })); // getJobOrThrow
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: { id: "te-1", clock_out_at: null }, error: null }));
    const updateBuilder = makeQueryBuilder({
      data: {
        id: "te-1",
        job_id: "job-1",
        technician_id: "user-1",
        clock_in_at: "2026-01-02T08:00:00Z",
        clock_out_at: "2026-01-02T12:00:00Z",
        client_generated_id: "cg-1",
        created_at: "2026-01-02T08:00:00Z",
      },
      error: null,
    });
    fromMock.mockReturnValueOnce(updateBuilder);

    const result = await service.clockOut(requestUser, "job-1", {});

    expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ clock_out_at: expect.any(String) }));
    expect(result.clockOutAt).toBe("2026-01-02T12:00:00Z");
  });

  it("clockOut is idempotent when the targeted entry is already closed", async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: { id: "job-1" }, error: null })); // getJobOrThrow
    fromMock.mockReturnValueOnce(
      makeQueryBuilder({ data: { id: "te-1", clock_out_at: "2026-01-02T12:00:00Z" }, error: null }),
    );

    const result = await service.clockOut(requestUser, "job-1", { clientGeneratedId: "cg-1" });

    expect(result.clockOutAt).toBe("2026-01-02T12:00:00Z");
    expect(fromMock).toHaveBeenCalledTimes(2); // no update call — already closed
  });

  it("clockOut throws BadRequestException when there's nothing to close", async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: { id: "job-1" }, error: null })); // getJobOrThrow
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: null, error: null })); // no open entry

    await expect(service.clockOut(requestUser, "job-1", {})).rejects.toThrow(BadRequestException);
  });
});
