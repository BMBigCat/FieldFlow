import { Test, TestingModule } from "@nestjs/testing";
import { MaintenancePlansService } from "./maintenance-plans.service";
import { PushService } from "../notifications/push.service";
import { SupabaseAdminService } from "../supabase/supabase-admin.service";
import { SupabaseUserClientFactory } from "../supabase/supabase-user-client.factory";
import type { RequestUser } from "../auth/request-user";

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "insert", "update", "eq", "lte", "order", "in", "limit"]) {
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

describe("MaintenancePlansService", () => {
  let service: MaintenancePlansService;
  let fromMock: jest.Mock;
  let adminFromMock: jest.Mock;
  let notifyMock: jest.Mock;

  beforeEach(async () => {
    fromMock = jest.fn();
    adminFromMock = jest.fn();
    notifyMock = jest.fn().mockResolvedValue(undefined);
    const userClientFactory = { forToken: jest.fn().mockReturnValue({ from: fromMock }) };
    const supabaseAdmin = { client: { from: adminFromMock } };
    const pushService = { notify: notifyMock };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenancePlansService,
        { provide: SupabaseUserClientFactory, useValue: userClientFactory },
        { provide: SupabaseAdminService, useValue: supabaseAdmin },
        { provide: PushService, useValue: pushService },
      ],
    }).compile();
    service = module.get(MaintenancePlansService);
  });

  it("processDue creates an unscheduled job from a due plan and advances next_due_date by frequencyMonths", async () => {
    const duePlanRow = {
      id: "plan-1",
      customer_id: "cust-1",
      equipment_id: "equip-1",
      frequency_months: 6,
      next_due_date: "2026-01-01",
      job_template: { type: "routine_maintenance", priority: "normal" },
      equipment: { service_address_id: "addr-1" },
    };
    const dueSelectBuilder = makeQueryBuilder({ data: [duePlanRow], error: null });
    const jobInsertBuilder = makeQueryBuilder({ data: { id: "job-new-1" }, error: null });
    const advanceBuilder = makeQueryBuilder({ data: null, error: null });
    fromMock.mockReturnValueOnce(dueSelectBuilder).mockReturnValueOnce(jobInsertBuilder).mockReturnValueOnce(advanceBuilder);

    const result = await service.processDue(requestUser);

    expect(result.createdJobIds).toEqual(["job-new-1"]);
    expect(jobInsertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: "org-1",
        customer_id: "cust-1",
        service_address_id: "addr-1",
        equipment_id: "equip-1",
        type: "routine_maintenance",
        status: "unscheduled",
        created_by: "user-1",
      }),
    );
    expect(advanceBuilder.update).toHaveBeenCalledWith({ next_due_date: "2026-07-01" });
  });

  it("processDue skips a plan whose equipment no longer exists rather than failing the whole batch", async () => {
    const orphanedPlanRow = {
      id: "plan-2",
      customer_id: "cust-1",
      equipment_id: "deleted-equip",
      frequency_months: 3,
      next_due_date: "2026-01-01",
      job_template: {},
      equipment: null,
    };
    const dueSelectBuilder = makeQueryBuilder({ data: [orphanedPlanRow], error: null });
    fromMock.mockReturnValueOnce(dueSelectBuilder);

    const result = await service.processDue(requestUser);

    expect(result.createdJobIds).toEqual([]);
    expect(fromMock).toHaveBeenCalledTimes(1); // only the due-plans select — no job insert attempted
  });

  it("processDue returns no created jobs when nothing is due", async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: [], error: null }));

    const result = await service.processDue(requestUser);

    expect(result.createdJobIds).toEqual([]);
  });

  it("create inserts a plan with an empty job_template default", async () => {
    const insertBuilder = makeQueryBuilder({
      data: { id: "plan-1", customer_id: "cust-1", equipment_id: "equip-1", frequency_months: 12, next_due_date: "2027-01-01", job_template: {} },
      error: null,
    });
    fromMock.mockReturnValueOnce(insertBuilder);

    const result = await service.create(requestUser, {
      customerId: "cust-1",
      equipmentId: "equip-1",
      frequencyMonths: 12,
      nextDueDate: "2027-01-01",
    });

    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ customer_id: "cust-1", equipment_id: "equip-1", frequency_months: 12, job_template: {} }),
    );
    expect(result.frequencyMonths).toBe(12);
  });

  describe("processDueAllOrgs", () => {
    it("creates a job for a due plan using the org's admin as actor, advances the plan, and notifies office/admin", async () => {
      const duePlanRow = {
        id: "plan-1",
        customer_id: "cust-1",
        equipment_id: "equip-1",
        frequency_months: 6,
        next_due_date: "2026-01-01",
        job_template: { type: "routine_maintenance", priority: "normal" },
        equipment: { service_address_id: "addr-1" },
        customers: { org_id: "org-1" },
      };
      const dueSelectBuilder = makeQueryBuilder({ data: [duePlanRow], error: null });
      const adminLookupBuilder = makeQueryBuilder({ data: { id: "admin-1" }, error: null });
      const jobInsertBuilder = makeQueryBuilder({ data: { id: "job-new-1" }, error: null });
      const advanceBuilder = makeQueryBuilder({ data: null, error: null });
      const officeLookupBuilder = makeQueryBuilder({ data: [{ id: "admin-1" }, { id: "office-1" }], error: null });
      adminFromMock
        .mockReturnValueOnce(dueSelectBuilder)
        .mockReturnValueOnce(adminLookupBuilder)
        .mockReturnValueOnce(jobInsertBuilder)
        .mockReturnValueOnce(advanceBuilder)
        .mockReturnValueOnce(officeLookupBuilder);

      const result = await service.processDueAllOrgs();

      expect(result.createdJobIds).toEqual(["job-new-1"]);
      expect(jobInsertBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ org_id: "org-1", created_by: "admin-1", status: "unscheduled" }),
      );
      expect(advanceBuilder.update).toHaveBeenCalledWith({ next_due_date: "2026-07-01" });
      expect(notifyMock).toHaveBeenCalledTimes(2);
      expect(notifyMock).toHaveBeenCalledWith(expect.anything(), "admin-1", "maintenance_auto_scheduled", {
        jobId: "job-new-1",
        maintenancePlanId: "plan-1",
      });
      expect(notifyMock).toHaveBeenCalledWith(expect.anything(), "office-1", "maintenance_auto_scheduled", {
        jobId: "job-new-1",
        maintenancePlanId: "plan-1",
      });
    });

    it("skips a due plan whose org has no admin on file, without failing the batch", async () => {
      const duePlanRow = {
        id: "plan-2",
        customer_id: "cust-2",
        equipment_id: "equip-2",
        frequency_months: 3,
        next_due_date: "2026-01-01",
        job_template: {},
        equipment: { service_address_id: "addr-2" },
        customers: { org_id: "org-2" },
      };
      const dueSelectBuilder = makeQueryBuilder({ data: [duePlanRow], error: null });
      const adminLookupBuilder = makeQueryBuilder({ data: null, error: null });
      adminFromMock.mockReturnValueOnce(dueSelectBuilder).mockReturnValueOnce(adminLookupBuilder);

      const result = await service.processDueAllOrgs();

      expect(result.createdJobIds).toEqual([]);
      expect(notifyMock).not.toHaveBeenCalled();
    });
  });
});
