import type { ISODateString, UUID } from "./common.js";
import type { Customer } from "./customer.js";

/** Build plan §5 Phase 5 scope. */
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "void";

/** Build plan §5 — external sync target, once a real adapter exists (Phase 7). */
export type InvoiceExternalSystem = "quickbooks" | "xero" | null;

/** Build plan §4 `invoices`. v1 is 1 job : 1 invoice, hence nullable `jobId`. */
export interface Invoice {
  id: UUID;
  orgId: UUID;
  customerId: UUID;
  jobId: UUID | null;
  status: InvoiceStatus;
  issuedAt: ISODateString | null;
  dueAt: ISODateString | null;
  total: number;
  tax: number;
  paidAt: ISODateString | null;
  /** Id of this invoice in an external system, once synced (Phase 7). */
  externalRef: string | null;
  externalSystem: InvoiceExternalSystem;
}

/** Build plan §4 `invoice_line_items`. */
export type InvoiceLineItemKind = "labor" | "part" | "fee";

export interface InvoiceLineItem {
  id: UUID;
  invoiceId: UUID;
  description: string;
  quantity: number;
  unitPrice: number;
  kind: InvoiceLineItemKind;
}

/** POST /invoices — generates a draft invoice from a completed job. */
export interface CreateInvoiceRequest {
  jobId: UUID;
}

export interface InvoiceLineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  kind: InvoiceLineItemKind;
}

/** PATCH /invoices/:id. `lineItems`, when present, replaces the full set. */
export interface UpdateInvoiceRequest {
  status?: InvoiceStatus;
  tax?: number;
  dueAt?: ISODateString;
  lineItems?: InvoiceLineItemInput[];
}

/** GET /invoices — list view; full line items aren't needed there. */
export interface InvoiceListItem extends Invoice {
  customer: Pick<Customer, "id" | "name">;
}

/** GET /invoices/:id */
export interface InvoiceDetail extends Invoice {
  customer: Pick<Customer, "id" | "name">;
  lineItems: InvoiceLineItem[];
}

/** POST /invoices/:id/send */
export interface SendInvoiceResponse {
  invoice: InvoiceDetail;
  email: {
    sent: boolean;
    /** Present when sent is false — e.g. no email provider configured yet. */
    reason?: string;
  };
}
