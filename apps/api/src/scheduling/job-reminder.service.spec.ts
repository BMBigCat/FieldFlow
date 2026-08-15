import { Test, TestingModule } from "@nestjs/testing";
import { JobReminderService } from "./job-reminder.service";
import { PushService } from "../notifications/push.service";
import { SupabaseAdminService } from "../supabase/supabase-admin.service";

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "gte", "lte"]) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }
  builder.maybeSingle = jest.fn().mockResolvedValue(result);
  builder.then = (resolve: (value: unknown) => unknown) => resolve(result);
  return builder;
}

describe("JobReminderService", () => {
  let service: JobReminderService;
  let fromMock: jest.Mock;
  let notifyMock: jest.Mock;

  beforeEach(async () => {
    fromMock = jest.fn();
    notifyMock = jest.fn().mockResolvedValue(undefined);
    const supabaseAdmin = { client: { from: fromMock } };
    const pushService = { notify: notifyMock };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobReminderService,
        { provide: SupabaseAdminService, useValue: supabaseAdmin },
        { provide: PushService, useValue: pushService },
      ],
    }).compile();
    service = module.get(JobReminderService);
  });

  it("sends a reminder to each assigned technician on a due job with no prior reminder logged", async () => {
    const dueJobsBuilder = makeQueryBuilder({
      data: [{ id: "job-1", scheduled_start: "2026-01-01T12:00:00Z", job_assignments: [{ technician_id: "tech-1" }] }],
      error: null,
    });
    const existingCheckBuilder = makeQueryBuilder({ data: null, error: null });
    fromMock.mockReturnValueOnce(dueJobsBuilder).mockReturnValueOnce(existingCheckBuilder);

    await service.sendDueReminders();

    expect(notifyMock).toHaveBeenCalledWith(expect.anything(), "tech-1", "job_reminder", { jobId: "job-1" });
  });

  it("does not re-notify a technician who already has a job_reminder logged for this job", async () => {
    const dueJobsBuilder = makeQueryBuilder({
      data: [{ id: "job-1", scheduled_start: "2026-01-01T12:00:00Z", job_assignments: [{ technician_id: "tech-1" }] }],
      error: null,
    });
    const existingCheckBuilder = makeQueryBuilder({ data: { id: "log-1" }, error: null });
    fromMock.mockReturnValueOnce(dueJobsBuilder).mockReturnValueOnce(existingCheckBuilder);

    await service.sendDueReminders();

    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("throws when the due-jobs query fails", async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: null, error: { message: "boom" } }));

    await expect(service.sendDueReminders()).rejects.toThrow("boom");
  });
});
