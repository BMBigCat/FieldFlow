import { Injectable, InternalServerErrorException } from "@nestjs/common";
import type { JobsCompletedByTechnician, OverdueInvoiceSummary, ReportsSummaryResponse } from "@fieldflow/shared-types";
import type { RequestUser } from "../auth/request-user";
import { SupabaseUserClientFactory } from "../supabase/supabase-user-client.factory";

export interface ReportsFilters {
  from?: string;
  to?: string;
}

interface JobWithAssignments {
  id: string;
  actual_end: string | null;
  job_assignments: { technician_id: string; users: { id: string; full_name: string } }[];
}

interface OverdueInvoiceRow {
  id: string;
  customer_id: string;
  status: OverdueInvoiceSummary["status"];
  total: number;
  due_at: string | null;
  customers: { name: string };
}

@Injectable()
export class ReportsService {
  constructor(private readonly userClientFactory: SupabaseUserClientFactory) {}

  async getSummary(user: RequestUser, filters: ReportsFilters): Promise<ReportsSummaryResponse> {
    const scoped = this.userClientFactory.forToken(user.accessToken);

    const [jobsByTechnician, revenue, { overdueInvoices, overdueTotal }] = await Promise.all([
      this.getJobsCompletedByTechnician(scoped, filters),
      this.getRevenue(scoped, filters),
      this.getOverdueInvoices(scoped),
    ]);

    return {
      from: filters.from ?? null,
      to: filters.to ?? null,
      jobsByTechnician,
      revenue,
      overdueInvoices,
      overdueTotal,
    };
  }

  private async getJobsCompletedByTechnician(
    scoped: ReturnType<SupabaseUserClientFactory["forToken"]>,
    filters: ReportsFilters,
  ): Promise<JobsCompletedByTechnician[]> {
    // "completed" per §8 acceptance criteria, plus "invoiced" — a completed
    // job flips to invoiced once billed (InvoicesService.create), so
    // excluding it would undercount every job that's already been billed.
    let query = scoped
      .from("jobs")
      .select("id, actual_end, job_assignments(technician_id, users(id, full_name))")
      .in("status", ["completed", "invoiced"]);
    if (filters.from) query = query.gte("actual_end", filters.from);
    if (filters.to) query = query.lte("actual_end", filters.to);

    const { data, error } = await query;
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const counts = new Map<string, JobsCompletedByTechnician>();
    for (const job of (data ?? []) as unknown as JobWithAssignments[]) {
      for (const assignment of job.job_assignments ?? []) {
        const existing = counts.get(assignment.technician_id);
        if (existing) {
          existing.jobsCompleted += 1;
        } else {
          counts.set(assignment.technician_id, {
            technicianId: assignment.technician_id,
            technicianName: assignment.users.full_name,
            jobsCompleted: 1,
          });
        }
      }
    }
    return Array.from(counts.values()).sort((a, b) => b.jobsCompleted - a.jobsCompleted);
  }

  private async getRevenue(
    scoped: ReturnType<SupabaseUserClientFactory["forToken"]>,
    filters: ReportsFilters,
  ): Promise<{ totalRevenue: number; from: string | null; to: string | null }> {
    // Revenue recognized = paid invoices, scoped by when they were paid
    // (not issued) — the more defensible "revenue per period" reading.
    let query = scoped.from("invoices").select("total, paid_at").eq("status", "paid");
    if (filters.from) query = query.gte("paid_at", filters.from);
    if (filters.to) query = query.lte("paid_at", filters.to);

    const { data, error } = await query;
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    const totalRevenue = (data ?? []).reduce((sum: number, row: { total: number }) => sum + Number(row.total), 0);
    return { totalRevenue, from: filters.from ?? null, to: filters.to ?? null };
  }

  private async getOverdueInvoices(
    scoped: ReturnType<SupabaseUserClientFactory["forToken"]>,
  ): Promise<{ overdueInvoices: OverdueInvoiceSummary[]; overdueTotal: number }> {
    // Nothing auto-flips an invoice to `overdue` (see InvoicesService — it's
    // a manual status change only), so also catch any `sent` invoice whose
    // due date has already passed, or this report would miss them.
    const nowIso = new Date().toISOString();
    const { data, error } = await scoped
      .from("invoices")
      .select("id, customer_id, status, total, due_at, customers(name)")
      .or(`status.eq.overdue,and(status.eq.sent,due_at.lt.${nowIso})`)
      .order("due_at", { ascending: true });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const overdueInvoices = ((data ?? []) as unknown as OverdueInvoiceRow[]).map((row) => ({
      id: row.id,
      customerId: row.customer_id,
      customerName: row.customers.name,
      status: row.status,
      total: row.total,
      dueAt: row.due_at,
    }));
    const overdueTotal = overdueInvoices.reduce((sum, invoice) => sum + Number(invoice.total), 0);
    return { overdueInvoices, overdueTotal };
  }
}
