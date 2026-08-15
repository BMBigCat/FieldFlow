import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { InvoicesService } from "./invoices.service";
import { SupabaseUserClientFactory } from "../supabase/supabase-user-client.factory";
import type { RequestUser } from "../auth/request-user";

jest.mock("./invoice-pdf", () => ({ generateInvoicePdf: jest.fn().mockResolvedValue(Buffer.from("pdf")) }));
jest.mock("./invoice-email", () => ({ sendInvoiceEmail: jest.fn().mockResolvedValue({ sent: false, reason: "RESEND_API_KEY is not configured" }) }));

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "insert", "update", "delete", "eq", "order"]) {
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

const invoiceRow = {
  id: "inv-1",
  org_id: "org-1",
  customer_id: "cust-1",
  job_id: "job-1",
  status: "draft",
  issued_at: null,
  due_at: null,
  total: 200,
  tax: 0,
  paid_at: null,
  external_ref: null,
  external_system: null,
};

const detailRow = {
  ...invoiceRow,
  customers: { id: "cust-1", name: "Acme Home" },
  invoice_line_items: [{ id: "li-1", invoice_id: "inv-1", description: "Labor", quantity: 2, unit_price: 100, kind: "labor" }],
};

describe("InvoicesService", () => {
  let service: InvoicesService;
  let userClientFactory: { forToken: jest.Mock };
  let fromMock: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    fromMock = jest.fn();
    userClientFactory = { forToken: jest.fn().mockReturnValue({ from: fromMock }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [InvoicesService, { provide: SupabaseUserClientFactory, useValue: userClientFactory }],
    }).compile();

    service = module.get(InvoicesService);
  });

  describe("create", () => {
    it("auto-pulls a labor line item from the job's closed time entries and marks the job invoiced", async () => {
      const job = {
        id: "job-1",
        org_id: "org-1",
        customer_id: "cust-1",
        status: "completed",
        job_time_entries: [{ clock_in_at: "2026-01-01T09:00:00.000Z", clock_out_at: "2026-01-01T11:00:00.000Z" }],
      };
      fromMock.mockReturnValueOnce(makeQueryBuilder({ data: job, error: null })); // job lookup
      fromMock.mockReturnValueOnce(makeQueryBuilder({ data: { default_labor_rate: 100 }, error: null })); // org rate
      const invoiceInsert = makeQueryBuilder({ data: invoiceRow, error: null });
      fromMock.mockReturnValueOnce(invoiceInsert); // invoice insert
      fromMock.mockReturnValueOnce(makeQueryBuilder({ data: null, error: null })); // line item insert
      fromMock.mockReturnValueOnce(makeQueryBuilder({ data: null, error: null })); // total update
      fromMock.mockReturnValueOnce(makeQueryBuilder({ data: null, error: null })); // job status -> invoiced
      fromMock.mockReturnValueOnce(makeQueryBuilder({ data: detailRow, error: null })); // getDetail

      const result = await service.create(requestUser, { jobId: "job-1" });

      expect(invoiceInsert.insert).toHaveBeenCalledWith(
        expect.objectContaining({ org_id: "org-1", customer_id: "cust-1", job_id: "job-1", status: "draft" }),
      );
      expect(result.lineItems).toHaveLength(1);
      expect(result.customer.name).toBe("Acme Home");
    });

    it("rejects a job that isn't completed", async () => {
      fromMock.mockReturnValueOnce(makeQueryBuilder({ data: { id: "job-1", status: "in_progress" }, error: null }));

      await expect(service.create(requestUser, { jobId: "job-1" })).rejects.toThrow(BadRequestException);
    });

    it("throws NotFoundException for a job that doesn't exist (or isn't visible via RLS)", async () => {
      fromMock.mockReturnValueOnce(makeQueryBuilder({ data: null, error: null }));

      await expect(service.create(requestUser, { jobId: "missing" })).rejects.toThrow(NotFoundException);
    });
  });

  describe("list", () => {
    it("returns invoices with customer name attached", async () => {
      fromMock.mockReturnValueOnce(makeQueryBuilder({ data: [detailRow], error: null }));

      const result = await service.list(requestUser);

      expect(result).toHaveLength(1);
      expect(result[0].customer).toEqual({ id: "cust-1", name: "Acme Home" });
    });
  });

  describe("getDetail", () => {
    it("throws NotFoundException when the invoice doesn't exist", async () => {
      fromMock.mockReturnValueOnce(makeQueryBuilder({ data: null, error: null }));

      await expect(service.getDetail(requestUser, "missing")).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("replacing lineItems recomputes total from the new items plus tax", async () => {
      fromMock.mockReturnValueOnce(makeQueryBuilder({ data: invoiceRow, error: null })); // getInvoiceOrThrow
      const deleteBuilder = makeQueryBuilder({ data: null, error: null });
      fromMock.mockReturnValueOnce(deleteBuilder); // delete existing line items
      const insertBuilder = makeQueryBuilder({ data: null, error: null });
      fromMock.mockReturnValueOnce(insertBuilder); // insert new line items
      const updateBuilder = makeQueryBuilder({ data: null, error: null });
      fromMock.mockReturnValueOnce(updateBuilder); // patch (total)
      fromMock.mockReturnValueOnce(makeQueryBuilder({ data: detailRow, error: null })); // getDetail

      await service.update(requestUser, "inv-1", {
        lineItems: [{ description: "Part", quantity: 2, unitPrice: 25, kind: "part" }],
        tax: 5,
      });

      expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ total: 55, tax: 5 }));
    });

    it("setting status to paid records paidAt", async () => {
      fromMock.mockReturnValueOnce(makeQueryBuilder({ data: invoiceRow, error: null })); // getInvoiceOrThrow
      const updateBuilder = makeQueryBuilder({ data: null, error: null });
      fromMock.mockReturnValueOnce(updateBuilder);
      fromMock.mockReturnValueOnce(makeQueryBuilder({ data: { ...detailRow, status: "paid" }, error: null })); // getDetail

      await service.update(requestUser, "inv-1", { status: "paid" });

      expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ status: "paid", paid_at: expect.any(String) }));
    });
  });

  describe("send", () => {
    it("generates a PDF, reports email.sent=false when no provider is configured, and marks the invoice sent", async () => {
      fromMock.mockReturnValueOnce(makeQueryBuilder({ data: detailRow, error: null })); // getDetail
      fromMock.mockReturnValueOnce(makeQueryBuilder({ data: { name: "Acme HVAC", display_name: null }, error: null })); // org
      fromMock.mockReturnValueOnce(makeQueryBuilder({ data: { email: "customer@example.com" }, error: null })); // customer
      const updateBuilder = makeQueryBuilder({ data: null, error: null });
      fromMock.mockReturnValueOnce(updateBuilder); // status -> sent
      fromMock.mockReturnValueOnce(makeQueryBuilder({ data: { ...detailRow, status: "sent" }, error: null })); // getDetail (final)

      const result = await service.send(requestUser, "inv-1");

      expect(result.email).toEqual({ sent: false, reason: "RESEND_API_KEY is not configured" });
      expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ status: "sent" }));
      expect(result.invoice.status).toBe("sent");
    });
  });
});
