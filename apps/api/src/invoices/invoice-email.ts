import { Resend } from "resend";

export interface SendInvoiceEmailResult {
  sent: boolean;
  /** Set whenever sent is false — why, so the caller can surface it rather than pretend it worked. */
  reason?: string;
}

/**
 * Build plan §5 "PDF generation + email send (Resend/Postmark)". No Resend
 * account/API key exists in this environment, so this can't be exercised
 * end-to-end here — matching this codebase's established pattern (see
 * apps/web's supabase client, and Phase 1's invite-link-instead-of-email
 * decision), it degrades to a clearly-reported no-op rather than crashing
 * the request when RESEND_API_KEY isn't configured, or when the customer
 * has no email on file.
 */
export async function sendInvoiceEmail(params: {
  apiKey: string | undefined;
  fromAddress: string | undefined;
  to: string | null;
  organizationName: string;
  invoiceTotal: number;
  pdf: Buffer;
}): Promise<SendInvoiceEmailResult> {
  if (!params.apiKey) {
    return { sent: false, reason: "RESEND_API_KEY is not configured" };
  }
  if (!params.to) {
    return { sent: false, reason: "Customer has no email on file" };
  }

  const resend = new Resend(params.apiKey);
  const { error } = await resend.emails.send({
    from: params.fromAddress ?? "invoices@fieldflow.app",
    to: params.to,
    subject: `Invoice from ${params.organizationName}`,
    text: `Your invoice for $${params.invoiceTotal.toFixed(2)} from ${params.organizationName} is attached.`,
    attachments: [{ filename: "invoice.pdf", content: params.pdf }],
  });
  if (error) {
    return { sent: false, reason: error.message };
  }
  return { sent: true };
}
