import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  InvoiceDetail,
  InvoiceLineItemInput,
  InvoiceLineItemKind,
  InvoiceStatus,
  SendInvoiceResponse,
  UpdateInvoiceRequest,
} from "@fieldflow/shared-types";
import { apiFetch, apiFetchBlob } from "../lib/api";

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

const LINE_ITEM_KINDS: InvoiceLineItemKind[] = ["labor", "part", "fee"];

const emptyLineItem = (): InvoiceLineItemInput => ({ description: "", quantity: 1, unitPrice: 0, kind: "fee" });

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const invoiceQuery = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => apiFetch<InvoiceDetail>(`/invoices/${id}`),
    enabled: Boolean(id),
  });

  const [lineItems, setLineItems] = useState<InvoiceLineItemInput[]>([]);
  const [tax, setTax] = useState("0");
  const [dueAt, setDueAt] = useState("");
  const [emailResult, setEmailResult] = useState<SendInvoiceResponse["email"] | null>(null);

  useEffect(() => {
    if (invoiceQuery.data) {
      setLineItems(
        invoiceQuery.data.lineItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          kind: item.kind,
        })),
      );
      setTax(String(invoiceQuery.data.tax));
      setDueAt(invoiceQuery.data.dueAt ? invoiceQuery.data.dueAt.slice(0, 10) : "");
    }
  }, [invoiceQuery.data]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["invoice", id] });
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch<InvoiceDetail>(`/invoices/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          lineItems,
          tax: Number(tax || 0),
          ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}),
        } satisfies UpdateInvoiceRequest),
      }),
    onSuccess: invalidate,
  });

  const sendMutation = useMutation({
    mutationFn: () => apiFetch<SendInvoiceResponse>(`/invoices/${id}/send`, { method: "POST" }),
    onSuccess: (data) => {
      setEmailResult(data.email);
      invalidate();
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: InvoiceStatus) =>
      apiFetch<InvoiceDetail>(`/invoices/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status } satisfies UpdateInvoiceRequest),
      }),
    onSuccess: invalidate,
  });

  const [downloading, setDownloading] = useState(false);
  async function downloadPdf() {
    setDownloading(true);
    try {
      const blob = await apiFetchBlob(`/invoices/${id}/pdf`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoice-${id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  function updateLineItem(index: number, patch: Partial<InvoiceLineItemInput>) {
    setLineItems((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  function removeLineItem(index: number) {
    setLineItems((items) => items.filter((_, i) => i !== index));
  }

  if (invoiceQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (invoiceQuery.isError || !invoiceQuery.data) {
    return <p className="text-sm text-destructive">Invoice not found.</p>;
  }

  const invoice = invoiceQuery.data;
  const editable = invoice.status === "draft";
  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const total = subtotal + Number(tax || 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Invoice —{" "}
            <Link to={`/customers/${invoice.customer.id}`} className="underline hover:no-underline">
              {invoice.customer.name}
            </Link>
          </h2>
          <span className="rounded-full border border-border px-2 py-1 text-xs text-muted-foreground">
            {STATUS_LABEL[invoice.status]}
          </span>
        </div>
        <dl className="mt-2 space-y-1 text-sm text-muted-foreground">
          {invoice.issuedAt && <div>Issued: {new Date(invoice.issuedAt).toLocaleString()}</div>}
          {invoice.paidAt && <div>Paid: {new Date(invoice.paidAt).toLocaleString()}</div>}
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          {editable && (
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {saveMutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          )}
          {editable && (
            <button
              type="button"
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {sendMutation.isPending ? "Sending…" : "Send Invoice"}
            </button>
          )}
          {(invoice.status === "sent" || invoice.status === "overdue") && (
            <>
              <button
                type="button"
                onClick={() => statusMutation.mutate("paid")}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
              >
                Mark Paid
              </button>
              {invoice.status === "sent" && (
                <button
                  type="button"
                  onClick={() => statusMutation.mutate("overdue")}
                  className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  Mark Overdue
                </button>
              )}
              <button
                type="button"
                onClick={() => statusMutation.mutate("void")}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                Void
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => void downloadPdf()}
            disabled={downloading}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {downloading ? "Preparing…" : "Download PDF"}
          </button>
        </div>

        {emailResult && (
          <p className={`mt-3 text-sm ${emailResult.sent ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
            {emailResult.sent ? "Emailed to the customer." : `Not emailed: ${emailResult.reason}`}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground">Line Items</h3>
        <div className="mt-3 space-y-2">
          {lineItems.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                value={item.description}
                onChange={(event) => updateLineItem(index, { description: event.target.value })}
                disabled={!editable}
                placeholder="Description"
                className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground disabled:opacity-60"
              />
              <select
                value={item.kind}
                onChange={(event) => updateLineItem(index, { kind: event.target.value as InvoiceLineItemKind })}
                disabled={!editable}
                className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground disabled:opacity-60"
              >
                {LINE_ITEM_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                step={0.01}
                value={item.quantity}
                onChange={(event) => updateLineItem(index, { quantity: Number(event.target.value) })}
                disabled={!editable}
                className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground disabled:opacity-60"
              />
              <span className="text-sm text-muted-foreground">×</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={item.unitPrice}
                onChange={(event) => updateLineItem(index, { unitPrice: Number(event.target.value) })}
                disabled={!editable}
                className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground disabled:opacity-60"
              />
              <span className="w-20 text-right text-sm text-foreground">
                ${(item.quantity * item.unitPrice).toFixed(2)}
              </span>
              {editable && (
                <button
                  type="button"
                  onClick={() => removeLineItem(index)}
                  className="text-sm text-muted-foreground hover:text-destructive"
                  aria-label="Remove line item"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {lineItems.length === 0 && <p className="text-sm text-muted-foreground">No line items yet.</p>}
        </div>

        {editable && (
          <button
            type="button"
            onClick={() => setLineItems((items) => [...items, emptyLineItem()])}
            className="mt-3 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            + Add line item
          </button>
        )}

        <div className="mt-4 flex items-center justify-end gap-6 border-t border-border pt-4 text-sm">
          <span className="text-muted-foreground">Subtotal: ${subtotal.toFixed(2)}</span>
          <label className="flex items-center gap-2 text-muted-foreground">
            Tax:
            <input
              type="number"
              min={0}
              step={0.01}
              value={tax}
              onChange={(event) => setTax(event.target.value)}
              disabled={!editable}
              className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground disabled:opacity-60"
            />
          </label>
          <span className="font-semibold text-foreground">Total: ${editable ? total.toFixed(2) : invoice.total.toFixed(2)}</span>
        </div>

        {editable && (
          <div className="mt-4 flex items-center gap-2 text-sm">
            <label htmlFor="dueAt" className="font-medium text-foreground">
              Due date
            </label>
            <input
              id="dueAt"
              type="date"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
            />
          </div>
        )}
      </section>
    </div>
  );
}
