import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { InvoicePDF } from "@/components/pdf/InvoicePDF";
import type { InvoiceFormData } from "@/components/invoice/types";
import type { CompanySettingsPreview } from "@/components/invoice/InvoicePreview";
import { DEFAULT_COMPANY_STATE } from "@/lib/defaults";
import { calculateTotals, getTaxMode } from "@/lib/calculations";
import { generateQrPngDataUrl } from "@/lib/qr";
import { resolveLogoDataUrl } from "@/lib/resolveLogoUrl";

export async function generateInvoicePdfBase64Server(
  invoiceRecord: {
    id: number;
    invoiceNo: string;
    invoiceDate: Date;
    poNo?: string | null;
    referenceNo?: string | null;
    referenceDate?: string | null;
    buyerOrderNo?: string | null;
    paymentTerms?: string | null;
    termsOfDelivery?: string | null;
    billPeriodStart?: Date | null;
    billPeriodEnd?: Date | null;
    state: string;
    stateCode: string;
    transportMode?: string | null;
    vehicleNo?: string | null;
    placeOfSupply?: string | null;
    irn?: string | null;
    ewayBillNo?: string | null;
    status: string;
    reverseCharge: boolean;
    cgstRate: unknown;
    sgstRate: unknown;
    igstRate: unknown;
    client: {
      id: number;
      name: string;
      address: string;
      gstin: string;
      state: string;
      stateCode: string;
      shipToName?: string | null;
      shipToAddress?: string | null;
      shipToGstin?: string | null;
      shipToState?: string | null;
      shipToStateCode?: string | null;
    };
    lineItems: Array<{
      sno: number;
      description: string;
      hsnSac?: string | null;
      unit: string;
      qty: unknown;
      rate: unknown;
      equipmentId?: number | null;
      meterStart?: unknown | null;
      meterEnd?: unknown | null;
    }>;
    signature?: {
      dataUrl: string;
      type: string;
    } | null;
  },
  companyRecord?: {
    companyName: string;
    gstin: string;
    address: string;
    email?: string | null;
    phone?: string | null;
    bankName?: string | null;
    branch?: string | null;
    accountNo?: string | null;
    ifsc?: string | null;
    upiId?: string | null;
    logoUrl?: string | null;
    termsAndConditions?: string | null;
    tagline?: string | null;
    accountType?: string | null;
    stateCode?: string | null;
    state?: string | null;
  } | null
): Promise<string> {
  const invoiceData: InvoiceFormData = {
    id: invoiceRecord.id,
    invoiceNo: invoiceRecord.invoiceNo,
    invoiceDate: invoiceRecord.invoiceDate ? invoiceRecord.invoiceDate.toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    poNo: invoiceRecord.poNo ?? undefined,
    referenceNo: invoiceRecord.referenceNo ?? undefined,
    referenceDate: invoiceRecord.referenceDate ?? undefined,
    buyerOrderNo: invoiceRecord.buyerOrderNo ?? undefined,
    paymentTerms: invoiceRecord.paymentTerms ?? undefined,
    termsOfDelivery: invoiceRecord.termsOfDelivery ?? undefined,
    billPeriodStart: invoiceRecord.billPeriodStart ? invoiceRecord.billPeriodStart.toISOString().split("T")[0] : undefined,
    billPeriodEnd: invoiceRecord.billPeriodEnd ? invoiceRecord.billPeriodEnd.toISOString().split("T")[0] : undefined,
    state: invoiceRecord.state,
    stateCode: invoiceRecord.stateCode,
    transportMode: invoiceRecord.transportMode ?? undefined,
    vehicleNo: invoiceRecord.vehicleNo ?? undefined,
    placeOfSupply: invoiceRecord.placeOfSupply ?? undefined,
    irn: invoiceRecord.irn ?? undefined,
    ewayBillNo: invoiceRecord.ewayBillNo ?? undefined,
    status: (invoiceRecord.status as InvoiceFormData["status"]) || "DRAFT",
    reverseCharge: invoiceRecord.reverseCharge,
    cgstRate: Number(invoiceRecord.cgstRate) || 9,
    sgstRate: Number(invoiceRecord.sgstRate) || 9,
    igstRate: Number(invoiceRecord.igstRate) || 18,
    client: {
      id: invoiceRecord.client.id,
      name: invoiceRecord.client.name,
      address: invoiceRecord.client.address,
      gstin: invoiceRecord.client.gstin,
      state: invoiceRecord.client.state,
      stateCode: invoiceRecord.client.stateCode,
      shipToName: invoiceRecord.client.shipToName ?? undefined,
      shipToAddress: invoiceRecord.client.shipToAddress ?? undefined,
      shipToGstin: invoiceRecord.client.shipToGstin ?? undefined,
      shipToState: invoiceRecord.client.shipToState ?? undefined,
      shipToStateCode: invoiceRecord.client.shipToStateCode ?? undefined,
    },
    lineItems: invoiceRecord.lineItems.map((li) => ({
      sno: li.sno,
      description: li.description,
      hsnSac: li.hsnSac ?? undefined,
      unit: li.unit,
      qty: Number(li.qty) || 0,
      rate: Number(li.rate) || 0,
      equipmentId: li.equipmentId ?? undefined,
      meterStart: li.meterStart != null ? Number(li.meterStart) : undefined,
      meterEnd: li.meterEnd != null ? Number(li.meterEnd) : undefined,
    })),
    signature: invoiceRecord.signature
      ? {
          dataUrl: invoiceRecord.signature.dataUrl,
          type: invoiceRecord.signature.type as "DRAWN" | "UPLOADED" | "TYPED",
        }
      : null,
  };

  // Safely resolve Logo URL (uses shared utility with disk fallback)
  const logoUrl = resolveLogoDataUrl(companyRecord?.logoUrl ?? null);

  const companyData: CompanySettingsPreview = {
    companyName: companyRecord?.companyName || "M/S RADHA KISHAN ENTERPRISES",
    gstin: companyRecord?.gstin || "09ABFPR0000A1Z5",
    address: companyRecord?.address || "Head Office, City Center, Road No 1, UP",
    email: companyRecord?.email ?? null,
    phone: companyRecord?.phone ?? null,
    bankName: companyRecord?.bankName ?? null,
    branch: companyRecord?.branch ?? null,
    accountNo: companyRecord?.accountNo ?? null,
    ifsc: companyRecord?.ifsc ?? null,
    upiId: companyRecord?.upiId ?? null,
    logoUrl,
    termsAndConditions: companyRecord?.termsAndConditions ?? null,
    tagline: companyRecord?.tagline ?? null,
    accountType: companyRecord?.accountType ?? "Current",
    stateCode: companyRecord?.stateCode ?? "09",
    state: companyRecord?.state ?? "Uttar Pradesh",
  };

  // Generate UPI QR Code Data URL on Server
  let qrDataUrl: string | null = null;
  try {
    const companyStateCode = companyData.stateCode ?? DEFAULT_COMPANY_STATE.stateCode;
    const taxMode = getTaxMode(companyStateCode, invoiceData.client.stateCode);
    const totals = calculateTotals({
      items: invoiceData.lineItems.map((li) => ({ qty: li.qty, rate: li.rate })),
      cgstRate: invoiceData.cgstRate,
      sgstRate: invoiceData.sgstRate,
      igstRate: invoiceData.igstRate,
      taxMode,
    });
    const upiId = companyData.upiId || "agranitinkohli@gmail.com";
    const upiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(companyData.companyName)}&am=${totals.grandTotal}&cu=INR&tn=${encodeURIComponent(`Invoice ${invoiceData.invoiceNo}`)}`;
    qrDataUrl = await generateQrPngDataUrl(upiUri, { width: 128 });
  } catch (qrErr) {
    console.error("Failed to generate UPI QR code on server:", qrErr);
  }

  const pdfElement = React.createElement(InvoicePDF, {
    invoice: invoiceData,
    company: companyData,
    copy: "ORIGINAL",
    qrDataUrl,
  });

  const buffer = await renderToBuffer(pdfElement as unknown as Parameters<typeof renderToBuffer>[0]);
  return buffer.toString("base64");
}
