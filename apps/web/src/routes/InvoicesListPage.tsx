import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { InvoiceListItem, InvoiceStatus } from "@fieldflow/shared-types";
import { apiFetch } from "../lib/api";

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  draft: "border-border text-muted-foreground",
  sent: "border-blue-500/40 text-blue-600 dark:text-blue-400",
  paid: "border-green-500/40 text-green-600 dark:text-green-400",
  overdue: "border-destructive/40 text-destructive",
  void: "border-border text-muted-foreground line-through",
};

export function InvoicesListPage() {
  const invoicesQuery = useQuery({
    queryKey: ["invoices"],
    queryFn: () => apiFetch<InvoiceListItem[]>("/invoices"),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Invoices</h2>

      {invoicesQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {invoicesQuery.isError && <p className="text-sm text-destructive">Failed to load invoices.</p>}

      {invoicesQuery.data && invoicesQuery.data.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No invoices yet — generate one from a completed job's detail page.
        </p>
      )}

      {invoicesQuery.data && invoicesQuery.data.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Issued</th>
                <th className="px-4 py-2 font-medium">Due</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoicesQuery.data.map((invoice) => (
                <tr key={invoice.id} className="bg-card hover:bg-muted/50">
                  <td className="px-4 py-2">
                    <Link to={`/invoices/${invoice.id}`} className="text-foreground underline hover:no-underline">
                      {invoice.customer.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_BADGE[invoice.status]}`}>
                      {STATUS_LABEL[invoice.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleDateString() : "—"}
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
  );
}
