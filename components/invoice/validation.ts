import { parseAmount } from "@/lib/calculations";

import type { InvoiceFormData } from "./types";

/** What is wrong with the invoice's basic details, in plain words, or null. */
export function findDetailsProblem(invoice: InvoiceFormData): string | null {
  if (!invoice.invoiceNo.trim()) return "Enter an invoice number before saving.";
  if (!invoice.invoiceDate.trim()) return "Enter the invoice date.";
  return null;
}

/** What is wrong with the client details, or null. */
export function findClientProblem(invoice: InvoiceFormData): string | null {
  const c = invoice.client;
  if (!c.name.trim()) return "Enter the client's name.";
  if (!c.gstin.trim()) return "Enter the client's GSTIN.";
  if (!c.address.trim()) return "Enter the client's address.";
  if (!c.state.trim() || !c.stateCode.trim()) return "Choose the client's state.";
  return null;
}

/** What is wrong with the line items, or null. Every line needs a description and a typed amount. */
export function findLineItemsProblem(invoice: InvoiceFormData): string | null {
  if (!invoice.lineItems.length) return "Add at least one line item.";
  for (let i = 0; i < invoice.lineItems.length; i++) {
    const li = invoice.lineItems[i]!;
    if (!li.description.trim()) return `Line ${i + 1}: enter a description.`;
    if (Number.isNaN(parseAmount(li.amount))) {
      return `Line ${i + 1}: type the amount as a number (for example 150000 or 1,50,000.50).`;
    }
  }
  return null;
}

/** The first thing stopping this invoice from being saved, or null if it can be. */
export function findInvoiceProblem(invoice: InvoiceFormData): string | null {
  return findDetailsProblem(invoice) ?? findClientProblem(invoice) ?? findLineItemsProblem(invoice);
}
