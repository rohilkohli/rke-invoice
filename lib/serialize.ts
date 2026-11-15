import "server-only";

import type { CompanySettings, Prisma } from "@prisma/client";

import type { CompanySettingsPreview } from "@/components/invoice/InvoicePreview";
import type { ClientForm, InvoiceFormData } from "@/components/invoice/types";
import { legacyDecimalText } from "@/lib/calculations";
import { resolveLogoDataUrl } from "@/lib/resolveLogoUrl";

/**
 * A saved invoice with everything needed to show or print it. The stored PDF copy is
 * left out of every query (see lib/db.ts), so it is not part of this type.
 */
type InvoiceWithRelations = Prisma.InvoiceGetPayload<{
  include: { client: true; lineItems: true; signature: true };
}>;
export type StoredInvoice = Omit<InvoiceWithRelations, "pdfData" | "signature"> & {
  signature?: InvoiceWithRelations["signature"];
};

const day = (date: Date | null | undefined) => (date ? date.toISOString().slice(0, 10) : "");

/**
 * Bill-to and ship-to as saved on the invoice. Invoices saved before the invoice kept its own
 * copy have none, and fall back to the client record they are linked to.
 */
export function billToOf(
  invoice: Pick<
    StoredInvoice,
    | "clientName"
    | "clientAddress"
    | "clientGstin"
    | "clientState"
    | "clientStateCode"
    | "shipToName"
    | "shipToAddress"
    | "shipToGstin"
    | "shipToState"
    | "shipToStateCode"
    | "client"
  >,
): ClientForm {
  if (invoice.clientName != null) {
    return {
      name: invoice.clientName,
      address: invoice.clientAddress ?? "",
      gstin: invoice.clientGstin ?? "",
      state: invoice.clientState ?? "",
      stateCode: invoice.clientStateCode ?? "",
      shipToName: invoice.shipToName ?? "",
      shipToAddress: invoice.shipToAddress ?? "",
      shipToGstin: invoice.shipToGstin ?? "",
      shipToState: invoice.shipToState ?? "",
      shipToStateCode: invoice.shipToStateCode ?? "",
    };
  }
  const c = invoice.client;
  return {
    name: c.name,
    address: c.address,
    gstin: c.gstin,
    state: c.state,
    stateCode: c.stateCode,
    shipToName: c.shipToName ?? "",
    shipToAddress: c.shipToAddress ?? "",
    shipToGstin: c.shipToGstin ?? "",
    shipToState: c.shipToState ?? "",
    shipToStateCode: c.shipToStateCode ?? "",
  };
}

/** The one conversion from a stored invoice to what the form, preview, PDF and spreadsheet use. */
export function toInvoiceFormData(invoice: StoredInvoice): InvoiceFormData {
  return {
    id: invoice.id,
    invoiceNo: invoice.invoiceNo,
    invoiceDate: day(invoice.invoiceDate),
    poNo: invoice.poNo ?? "",
    referenceNo: invoice.referenceNo ?? "",
    referenceDate: invoice.referenceDate ?? "",
    buyerOrderNo: invoice.buyerOrderNo ?? "",
    paymentTerms: invoice.paymentTerms ?? "",
    termsOfDelivery: invoice.termsOfDelivery ?? "",
    billPeriodStart: day(invoice.billPeriodStart),
    billPeriodEnd: day(invoice.billPeriodEnd),
    state: invoice.state,
    stateCode: invoice.stateCode,
    transportMode: invoice.transportMode ?? "",
    vehicleNo: invoice.vehicleNo ?? "",
    placeOfSupply: invoice.placeOfSupply ?? "",
    irn: invoice.irn ?? "",
    ewayBillNo: invoice.ewayBillNo ?? "",
    status: invoice.status,
    reverseCharge: invoice.reverseCharge,
    cgstRate: Number(invoice.cgstRate),
    sgstRate: Number(invoice.sgstRate),
    igstRate: Number(invoice.igstRate),
    client: billToOf(invoice),
    lineItems: [...invoice.lineItems]
      .sort((a, b) => a.sno - b.sno)
      .map((li) => ({
        sno: li.sno,
        description: li.description,
        hsnSac: li.hsnSac ?? "",
        unit: li.unit,
        qty: legacyDecimalText(li.qty),
        rate: legacyDecimalText(li.rate, { money: true }),
        amount: String(Number(li.amount)),
        equipmentId: li.equipmentId,
        meterStart: li.meterStart != null ? Number(li.meterStart) : null,
        meterEnd: li.meterEnd != null ? Number(li.meterEnd) : null,
      })),
    signature: invoice.signature
      ? { dataUrl: invoice.signature.dataUrl, type: invoice.signature.type }
      : null,
  };
}

/**
 * Company details as the preview, PDF and spreadsheet need them. The Google Drive address and
 * key are never part of this: it is handed to the browser. Pass `logo: false` when the logo
 * (a large data URL) is not needed.
 */
export function toCompanyPreview(
  company: CompanySettings,
  options?: { logo?: boolean },
): CompanySettingsPreview {
  return {
    companyName: company.companyName,
    gstin: company.gstin,
    address: company.address,
    email: company.email,
    phone: company.phone,
    bankName: company.bankName,
    branch: company.branch,
    accountNo: company.accountNo,
    ifsc: company.ifsc,
    upiId: company.upiId,
    logoUrl: options?.logo === false ? null : resolveLogoDataUrl(company.logoUrl),
    termsAndConditions: company.termsAndConditions,
    tagline: company.tagline,
    accountType: company.accountType,
    stateCode: company.stateCode,
    state: company.state,
  };
}
