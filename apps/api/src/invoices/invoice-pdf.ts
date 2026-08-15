import PDFDocument from "pdfkit";
import type { InvoiceDetail } from "@fieldflow/shared-types";

export function generateInvoicePdf(invoice: InvoiceDetail, organizationName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).text(organizationName);
    doc.moveDown(0.5);
    doc.fontSize(14).text("Invoice", { underline: true });
    doc.moveDown(0.5);

    doc.fontSize(10);
    doc.text(`Status: ${invoice.status}`);
    doc.text(`Bill to: ${invoice.customer.name}`);
    if (invoice.issuedAt) doc.text(`Issued: ${new Date(invoice.issuedAt).toLocaleDateString()}`);
    if (invoice.dueAt) doc.text(`Due: ${new Date(invoice.dueAt).toLocaleDateString()}`);
    doc.moveDown();

    doc.fontSize(11).text("Line Items", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    if (invoice.lineItems.length === 0) {
      doc.text("(none)");
    }
    for (const item of invoice.lineItems) {
      const lineTotal = item.quantity * item.unitPrice;
      doc.text(
        `${item.description}  —  ${item.quantity} x $${item.unitPrice.toFixed(2)}  =  $${lineTotal.toFixed(2)}`,
      );
    }
    doc.moveDown();

    if (invoice.tax) {
      doc.text(`Tax: $${invoice.tax.toFixed(2)}`);
    }
    doc.fontSize(13).text(`Total: $${invoice.total.toFixed(2)}`, { underline: true });

    doc.end();
  });
}
