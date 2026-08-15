import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { buildLaborLineItem, calculateInvoiceTotal, NullAdapter, type InvoiceExportAdapter } from "@fieldflow/invoicing-core";
import type { Invoice, InvoiceDetail, InvoiceListItem, SendInvoiceResponse } from "@fieldflow/shared-types";
import type { RequestUser } from "../auth/request-user";
import { toInvoice, toInvoiceLineItem } from "../common/mappers";
import { SupabaseUserClientFactory } from "../supabase/supabase-user-client.factory";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";
import { generateInvoicePdf } from "./invoice-pdf";
import { sendInvoiceEmail } from "./invoice-email";

const exportAdapter: InvoiceExportAdapter = new NullAdapter();

@Injectable()
export class InvoicesService {
  constructor(private readonly userClientFactory: SupabaseUserClientFactory) {}

  async list(user: RequestUser): Promise<InvoiceListItem[]> {
    const scoped = this.userClientFactory.forToken(user.accessToken);
    const { data, error } = await scoped
      .from("invoices")
      .select("*, customers(id, name)")
      .order("issued_at", { ascending: false, nullsFirst: true });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return (data ?? []).map((row) => {
      const { customers, ...invoiceRow } = row;
      return { ...toInvoice(invoiceRow), customer: { id: customers.id, name: customers.name } };
    });
  }

  async create(user: RequestUser, dto: CreateInvoiceDto): Promise<InvoiceDetail> {
    const scoped = this.userClientFactory.forToken(user.accessToken);

    const { data: job, error: jobError } = await scoped
      .from("jobs")
      .select("id, org_id, customer_id, status, job_time_entries(clock_in_at, clock_out_at)")
      .eq("id", dto.jobId)
      .maybeSingle();
    if (jobError) {
      throw new InternalServerErrorException(jobError.message);
    }
    if (!job) {
      throw new NotFoundException("Job not found");
    }
    if (job.status !== "completed") {
      throw new BadRequestException("Only a completed job can be invoiced");
    }

    const { data: org, error: orgError } = await scoped
      .from("organizations")
      .select("default_labor_rate")
      .eq("id", user.orgId)
      .single();
    if (orgError) {
      throw new InternalServerErrorException(orgError.message);
    }

    const laborLineItem = buildLaborLineItem(
      (job.job_time_entries ?? []).map((entry: { clock_in_at: string; clock_out_at: string | null }) => ({
        clockInAt: entry.clock_in_at,
        clockOutAt: entry.clock_out_at,
      })),
      org.default_labor_rate,
    );

    const { data: invoiceRow, error: invoiceError } = await scoped
      .from("invoices")
      .insert({ org_id: job.org_id, customer_id: job.customer_id, job_id: job.id, status: "draft" })
      .select()
      .single();
    if (invoiceError || !invoiceRow) {
      throw new InternalServerErrorException(invoiceError?.message ?? "Failed to create invoice");
    }

    if (laborLineItem) {
      const { error: lineItemError } = await scoped.from("invoice_line_items").insert({
        invoice_id: invoiceRow.id,
        description: laborLineItem.description,
        quantity: laborLineItem.quantity,
        unit_price: laborLineItem.unitPrice,
        kind: laborLineItem.kind,
      });
      if (lineItemError) {
        throw new InternalServerErrorException(lineItemError.message);
      }
    }

    const total = laborLineItem ? calculateInvoiceTotal([laborLineItem], 0) : 0;
    const { error: totalError } = await scoped.from("invoices").update({ total }).eq("id", invoiceRow.id);
    if (totalError) {
      throw new InternalServerErrorException(totalError.message);
    }

    const { error: jobUpdateError } = await scoped.from("jobs").update({ status: "invoiced" }).eq("id", job.id);
    if (jobUpdateError) {
      throw new InternalServerErrorException(jobUpdateError.message);
    }

    // Integration seam per build plan §5 — no-op until a real adapter exists (Phase 7).
    await exportAdapter.push({ id: invoiceRow.id, total });

    return this.getDetail(user, invoiceRow.id);
  }

  async getDetail(user: RequestUser, invoiceId: string): Promise<InvoiceDetail> {
    const scoped = this.userClientFactory.forToken(user.accessToken);
    const { data, error } = await scoped
      .from("invoices")
      .select("*, customers(id, name), invoice_line_items(*)")
      .eq("id", invoiceId)
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      throw new NotFoundException("Invoice not found");
    }
    const { customers, invoice_line_items, ...invoiceRow } = data;
    return {
      ...toInvoice(invoiceRow),
      customer: { id: customers.id, name: customers.name },
      lineItems: (invoice_line_items ?? []).map(toInvoiceLineItem),
    };
  }

  async update(user: RequestUser, invoiceId: string, dto: UpdateInvoiceDto): Promise<InvoiceDetail> {
    const scoped = this.userClientFactory.forToken(user.accessToken);
    const current = await this.getInvoiceOrThrow(scoped, invoiceId);

    if (dto.lineItems !== undefined) {
      const { error: deleteError } = await scoped.from("invoice_line_items").delete().eq("invoice_id", invoiceId);
      if (deleteError) {
        throw new InternalServerErrorException(deleteError.message);
      }
      if (dto.lineItems.length > 0) {
        const { error: insertError } = await scoped.from("invoice_line_items").insert(
          dto.lineItems.map((item) => ({
            invoice_id: invoiceId,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            kind: item.kind,
          })),
        );
        if (insertError) {
          throw new InternalServerErrorException(insertError.message);
        }
      }
    }

    const patch: Record<string, unknown> = {};
    if (dto.status !== undefined) {
      patch.status = dto.status;
      if (dto.status === "paid") patch.paid_at = new Date().toISOString();
      if (dto.status === "sent" && !current.issuedAt) patch.issued_at = new Date().toISOString();
    }
    if (dto.dueAt !== undefined) patch.due_at = dto.dueAt;

    const tax = dto.tax !== undefined ? dto.tax : current.tax;
    if (dto.tax !== undefined) patch.tax = dto.tax;
    if (dto.lineItems !== undefined || dto.tax !== undefined) {
      const lineItems = dto.lineItems ?? (await this.getDetail(user, invoiceId)).lineItems;
      patch.total = calculateInvoiceTotal(lineItems, tax);
    }

    if (Object.keys(patch).length > 0) {
      const { error: updateError } = await scoped.from("invoices").update(patch).eq("id", invoiceId);
      if (updateError) {
        throw new InternalServerErrorException(updateError.message);
      }
    }

    return this.getDetail(user, invoiceId);
  }

  async send(user: RequestUser, invoiceId: string): Promise<SendInvoiceResponse> {
    const scoped = this.userClientFactory.forToken(user.accessToken);
    const detail = await this.getDetail(user, invoiceId);
    const { organizationName, customerEmail } = await this.getSendContext(scoped, user.orgId, detail.customer.id);

    const pdf = await generateInvoicePdf(detail, organizationName);
    const email = await sendInvoiceEmail({
      apiKey: process.env.RESEND_API_KEY,
      fromAddress: process.env.RESEND_FROM_EMAIL,
      to: customerEmail,
      organizationName,
      invoiceTotal: detail.total,
      pdf,
    });

    const patch: Record<string, unknown> = { status: "sent" };
    if (!detail.issuedAt) patch.issued_at = new Date().toISOString();
    const { error: updateError } = await scoped.from("invoices").update(patch).eq("id", invoiceId);
    if (updateError) {
      throw new InternalServerErrorException(updateError.message);
    }

    return { invoice: await this.getDetail(user, invoiceId), email };
  }

  async getPdf(user: RequestUser, invoiceId: string): Promise<Buffer> {
    const scoped = this.userClientFactory.forToken(user.accessToken);
    const detail = await this.getDetail(user, invoiceId);
    const { organizationName } = await this.getSendContext(scoped, user.orgId, detail.customer.id);
    return generateInvoicePdf(detail, organizationName);
  }

  private async getSendContext(
    client: ReturnType<SupabaseUserClientFactory["forToken"]>,
    orgId: string,
    customerId: string,
  ): Promise<{ organizationName: string; customerEmail: string | null }> {
    const [{ data: org, error: orgError }, { data: customer, error: customerError }] = await Promise.all([
      client.from("organizations").select("name, display_name").eq("id", orgId).single(),
      client.from("customers").select("email").eq("id", customerId).single(),
    ]);
    if (orgError || !org) {
      throw new InternalServerErrorException(orgError?.message ?? "Failed to load organization");
    }
    if (customerError || !customer) {
      throw new InternalServerErrorException(customerError?.message ?? "Failed to load customer");
    }
    return { organizationName: org.display_name ?? org.name, customerEmail: customer.email };
  }

  private async getInvoiceOrThrow(
    client: ReturnType<SupabaseUserClientFactory["forToken"]>,
    invoiceId: string,
  ): Promise<Invoice> {
    const { data, error } = await client.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      throw new NotFoundException("Invoice not found");
    }
    return toInvoice(data);
  }
}
