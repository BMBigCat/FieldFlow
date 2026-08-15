import { Test, TestingModule } from "@nestjs/testing";
import { PushService } from "./push.service";

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "insert", "eq"]) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }
  builder.maybeSingle = jest.fn().mockResolvedValue(result);
  builder.then = (resolve: (value: unknown) => unknown) => resolve(result);
  return builder;
}

describe("PushService", () => {
  let service: PushService;
  let fromMock: jest.Mock;

  beforeEach(async () => {
    fromMock = jest.fn();
    const module: TestingModule = await Test.createTestingModule({ providers: [PushService] }).compile();
    service = module.get(PushService);
  });

  it("always logs to notifications_log, even with no push token on file", async () => {
    const logBuilder = makeQueryBuilder({ data: null, error: null });
    const userBuilder = makeQueryBuilder({ data: { push_token: null }, error: null });
    fromMock.mockReturnValueOnce(logBuilder).mockReturnValueOnce(userBuilder);
    const scoped = { from: fromMock } as never;

    await service.notify(scoped, "user-1", "job_assigned", { jobId: "job-1" });

    expect(logBuilder.insert).toHaveBeenCalledWith({ user_id: "user-1", type: "job_assigned", payload: { jobId: "job-1" } });
  });

  it("never throws when the user lookup errors — a notification failure must not fail the caller", async () => {
    const logBuilder = makeQueryBuilder({ data: null, error: null });
    const userBuilder = makeQueryBuilder({ data: null, error: { message: "boom" } });
    fromMock.mockReturnValueOnce(logBuilder).mockReturnValueOnce(userBuilder);
    const scoped = { from: fromMock } as never;

    await expect(service.notify(scoped, "user-1", "job_canceled", {})).resolves.toBeUndefined();
  });

  it("never throws when logging itself fails", async () => {
    const logBuilder = makeQueryBuilder({ data: null, error: { message: "log failed" } });
    const userBuilder = makeQueryBuilder({ data: { push_token: null }, error: null });
    fromMock.mockReturnValueOnce(logBuilder).mockReturnValueOnce(userBuilder);
    const scoped = { from: fromMock } as never;

    await expect(service.notify(scoped, "user-1", "job_changed", {})).resolves.toBeUndefined();
  });
});
