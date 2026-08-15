import { Test, TestingModule } from "@nestjs/testing";
import { ReportsService } from "./reports.service";
import { SupabaseUserClientFactory } from "../supabase/supabase-user-client.factory";
import type { RequestUser } from "../auth/request-user";

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "gte", "lte", "or", "order"]) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }
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

describe("ReportsService", () => {
  let service: ReportsService;
  let fromMock: jest.Mock;

  beforeEach(async () => {
    fromMock = jest.fn();
    const userClientFactory = { forToken: jest.fn().mockReturnValue({ from: fromMock }) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportsService, { provide: SupabaseUserClientFactory, useValue: userClientFactory }],
    }).compile();
    service = module.get(ReportsService);
  });

  it("aggregates jobs completed per technician, revenue from paid invoices, and overdue invoices", async () => {
    const jobsBuilder = makeQueryBuilder({
      data: [
        {
          id: "job-1",
          actual_end: "2026-01-05T00:00:00Z",
          job_assignments: [{ technician_id: "tech-1", users: { id: "tech-1", full_name: "Alex Tech" } }],
        },
        {
          id: "job-2",
          actual_end: "2026-01-06T00:00:00Z",
          job_assignments: [
            { technician_id: "tech-1", users: { id: "tech-1", full_name: "Alex Tech" } },
            { technician_id: "tech-2", users: { id: "tech-2", full_name: "Sam Tech" } },
          ],
        },
      ],
      error: null,
    });
    const revenueBuilder = makeQueryBuilder({ data: [{ total: 150 }, { total: 250 }], error: null });
    const overdueBuilder = makeQueryBuilder({
      data: [
        {
          id: "inv-1",
          customer_id: "cust-1",
          status: "sent",
          total: 99.5,
          due_at: "2025-12-01T00:00:00Z",
          customers: { name: "Acme Home" },
        },
      ],
      error: null,
    });
    fromMock.mockReturnValueOnce(jobsBuilder).mockReturnValueOnce(revenueBuilder).mockReturnValueOnce(overdueBuilder);

    const result = await service.getSummary(requestUser, { from: "2026-01-01", to: "2026-01-31" });

    expect(result.jobsByTechnician).toEqual([
      { technicianId: "tech-1", technicianName: "Alex Tech", jobsCompleted: 2 },
      { technicianId: "tech-2", technicianName: "Sam Tech", jobsCompleted: 1 },
    ]);
    expect(result.revenue).toEqual({ totalRevenue: 400, from: "2026-01-01", to: "2026-01-31" });
    expect(result.overdueInvoices).toEqual([
      { id: "inv-1", customerId: "cust-1", customerName: "Acme Home", status: "sent", total: 99.5, dueAt: "2025-12-01T00:00:00Z" },
    ]);
    expect(result.overdueTotal).toBe(99.5);
    expect(jobsBuilder.in).toHaveBeenCalledWith("status", ["completed", "invoiced"]);
    expect(jobsBuilder.gte).toHaveBeenCalledWith("actual_end", "2026-01-01");
    expect(jobsBuilder.lte).toHaveBeenCalledWith("actual_end", "2026-01-31");
    expect(revenueBuilder.eq).toHaveBeenCalledWith("status", "paid");
  });

  it("returns empty results with no filters applied when nothing matches and no date range is given", async () => {
    fromMock
      .mockReturnValueOnce(makeQueryBuilder({ data: [], error: null }))
      .mockReturnValueOnce(makeQueryBuilder({ data: [], error: null }))
      .mockReturnValueOnce(makeQueryBuilder({ data: [], error: null }));

    const result = await service.getSummary(requestUser, {});

    expect(result).toEqual({
      from: null,
      to: null,
      jobsByTechnician: [],
      revenue: { totalRevenue: 0, from: null, to: null },
      overdueInvoices: [],
      overdueTotal: 0,
    });
  });
});
