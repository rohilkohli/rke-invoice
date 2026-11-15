import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";
import type { CompanySettings } from "@prisma/client";
import React from "react";

import { InvoicePDF } from "@/components/pdf/InvoicePDF";
import { calculateInvoiceTotals } from "@/lib/calculations";
import { buildInvoiceQrText, generateQrPngDataUrl } from "@/lib/qr";
import { toCompanyPreview, toInvoiceFormData, type StoredInvoice } from "@/lib/serialize";

/**
 * The invoice PDF, made from the saved invoice. Every download from the dashboard and every
 * copy sent to Google Drive comes through here, so they are always the same document and
 * always reflect what is saved right now.
 */
export async function generateInvoicePdfBuffer(
  invoice: StoredInvoice,
  company: CompanySettings,
): Promise<Buffer> {
  const invoiceData = toInvoiceFormData(invoice);
  const companyData = toCompanyPreview(company);

  const { grandTotal } = calculateInvoiceTotals({
    lineItems: invoiceData.lineItems,
    cgstRate: invoiceData.cgstRate,
    sgstRate: invoiceData.sgstRate,
    igstRate: invoiceData.igstRate,
    company: companyData,
    client: invoiceData.client,
  });

  const qrDataUrl = await generateQrPngDataUrl(
    buildInvoiceQrText({
      companyName: companyData.companyName,
      gstin: companyData.gstin,
      invoiceNo: invoiceData.invoiceNo,
      invoiceDate: invoiceData.invoiceDate,
      billedTo: invoiceData.client.name,
      grandTotal,
    }),
    { width: 256 },
  );

  const element = React.createElement(InvoicePDF, {
    invoice: invoiceData,
    company: companyData,
    copy: "ORIGINAL",
    qrDataUrl,
  });
  return renderToBuffer(element as unknown as Parameters<typeof renderToBuffer>[0]);
}

export async function generateInvoicePdfBase64Server(
  invoice: StoredInvoice,
  company: CompanySettings,
): Promise<string> {
  return (await generateInvoicePdfBuffer(invoice, company)).toString("base64");
}
