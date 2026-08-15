import type { InvoiceLineItemInput, InvoiceStatus } from "@fieldflow/shared-types";

/**
 * Build plan §5 — keeps external sync (QuickBooks/Xero, Phase 7) an
 * additive change: nothing in Phases 0-6 calls a concrete adapter, only
 * this interface. `push` registers the invoice with the external system
 * and returns its id there; `pullPaymentStatus` checks whether it's been
 * paid on that system's side.
 */
export interface InvoiceExportAdapter {
  push(invoice: { id: string; total: number }): Promise<{ externalRef: string } | null>;
  pullPaymentStatus(externalRef: string): Promise<InvoiceStatus | null>;
}

/** Phase 5 default — no external system configured yet, so this is a no-op. */
export class NullAdapter implements InvoiceExportAdapter {
  async push(): Promise<null> {
    return null;
  }

  async pullPaymentStatus(): Promise<null> {
    return null;
  }
}

export interface TimeEntryDuration {
  clockInAt: string;
  clockOutAt: string | null;
}

/**
 * Build plan §5 "auto-pull logged labor time" — one Labor line item summing
 * every closed clock session on the job. Open sessions (still clocked in)
 * are excluded rather than guessed at. Returns null when there's nothing to
 * bill for labor yet, so callers can decide whether that's worth surfacing
 * (e.g. a job marked complete without ever being clocked into).
 *
 * There's no rate anywhere else in the schema (build plan §4 has no
 * per-technician or per-job-type rate), so this takes the org's single
 * default rate and prices at $0 when that hasn't been set — never throws
 * over missing pricing config, matching this codebase's established
 * "surface it, don't crash" convention (see apps/web's supabase client).
 */
export function buildLaborLineItem(
  timeEntries: TimeEntryDuration[],
  hourlyRate: number | null,
): InvoiceLineItemInput | null {
  const closed = timeEntries.filter((entry): entry is { clockInAt: string; clockOutAt: string } =>
    Boolean(entry.clockOutAt),
  );
  if (closed.length === 0) return null;

  const totalHours = closed.reduce((sum, entry) => {
    const ms = new Date(entry.clockOutAt).getTime() - new Date(entry.clockInAt).getTime();
    return sum + ms / 3_600_000;
  }, 0);

  return {
    description: "Labor",
    quantity: roundTo(totalHours, 2),
    unitPrice: hourlyRate ?? 0,
    kind: "labor",
  };
}

/** Build plan §5 — `tax` is a flat amount the office enters, not a computed rate. */
export function calculateInvoiceTotal(
  lineItems: Pick<InvoiceLineItemInput, "quantity" | "unitPrice">[],
  tax: number,
): number {
  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  return roundTo(subtotal + tax, 2);
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
