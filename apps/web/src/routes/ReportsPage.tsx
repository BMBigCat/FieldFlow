import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { ReportsSummaryResponse } from "@fieldflow/shared-types";
import { apiFetch } from "../lib/api";

function toQueryString(from: string, to: string): string {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function ReportsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const reportsQuery = useQuery({
    queryKey: ["reports-summary", from, to],
    queryFn: () => apiFetch<ReportsSummaryResponse>(`/reports/summary${toQueryString(from, to)}`),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-lg font-semibold text-foreground">Reports</h2>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="reportsFrom" className="block text-xs font-medium text-foreground">
              From
            </label>
            <input
              id="reportsFrom"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-1 block rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
            />
          </div>
          <div>
            <label htmlFor="reportsTo" className="block text-xs font-medium text-foreground">
              To
            </label>
            <input
              id="reportsTo"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="mt-1 block rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
            />
          </div>
          {(from || to) && (
            <button
              onClick={() => {
                setFrom("");
                setTo("");
              }}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {reportsQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {reportsQuery.isError && <p className="text-sm text-destructive">Failed to load reports.</p>}

      {reportsQuery.data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
              <p className="text-sm text-muted-foreground">
                Revenue {from || to ? "in range" : "(all time)"}
              </p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                ${reportsQuery.data.revenue.totalRevenue.toFixed(2)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">From paid invoices</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
              <p className="text-sm text-muted-foreground">Overdue invoices</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                ${reportsQuery.data.overdueTotal.toFixed(2)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {reportsQuery.data.overdueInvoices.length} invoice
                {reportsQuery.data.overdueInvoices.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Jobs completed per technician {from || to ? "in range" : "(all time)"}
            </h3>
            {reportsQuery.data.jobsByTechnician.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No completed jobs in this range.</p>
            ) : (
              <div className="mt-2 overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Technician</th>
                      <th className="px-4 py-2 text-right font-medium">Jobs completed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {reportsQuery.data.jobsByTechnician.map((row) => (
                      <tr key={row.technicianId} className="bg-card">
                        <td className="px-4 py-2 text-foreground">{row.technicianName}</td>
                        <td className="px-4 py-2 text-right text-foreground">{row.jobsCompleted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground">Overdue invoices</h3>
            {reportsQuery.data.overdueInvoices.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Nothing overdue.</p>
            ) : (
              <div className="mt-2 overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Customer</th>
                      <th className="px-4 py-2 font-medium">Due</th>
                      <th className="px-4 py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {reportsQuery.data.overdueInvoices.map((invoice) => (
                      <tr key={invoice.id} className="bg-card hover:bg-muted/50">
                        <td className="px-4 py-2">
                          <Link to={`/invoices/${invoice.id}`} className="text-foreground underline hover:no-underline">
                            {invoice.customerName}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {invoice.dueAt ? new Date(invoice.dueAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-2 text-right text-foreground">${invoice.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
