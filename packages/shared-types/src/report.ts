import type { ISODateString, UUID } from "./common.js";
import type { InvoiceStatus } from "./invoice.js";

/** Build plan §8 Phase 7 — "jobs completed per tech" line item. */
export interface JobsCompletedByTechnician {
  technicianId: UUID;
  technicianName: string;
  jobsCompleted: number;
}

/** Build plan §8 Phase 7 — "revenue per period". Revenue = sum of paid invoice totals with `paidAt` in range. */
export interface RevenueSummary {
  totalRevenue: number;
  from: ISODateString | null;
  to: ISODateString | null;
}

/**
 * Build plan §8 Phase 7 — "overdue invoices". Not period-bound: covers any
 * invoice manually flagged `overdue`, plus any `sent` invoice whose `dueAt`
 * has already passed (nothing auto-flips status to `overdue` today — see
 * InvoicesService — so this catches those too, not just the manually-set ones).
 */
export interface OverdueInvoiceSummary {
  id: UUID;
  customerId: UUID;
  customerName: string;
  status: InvoiceStatus;
  total: number;
  dueAt: ISODateString | null;
}

/** GET /reports/summary?from=&to= — `from`/`to` scope jobsByTechnician (by actual_end) and revenue (by paidAt); overdueInvoices is always as-of-now. */
export interface ReportsSummaryResponse {
  from: ISODateString | null;
  to: ISODateString | null;
  jobsByTechnician: JobsCompletedByTechnician[];
  revenue: RevenueSummary;
  overdueInvoices: OverdueInvoiceSummary[];
  overdueTotal: number;
}
