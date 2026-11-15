import { parseAmount } from "@/lib/calculations";

import type { InvoiceFormData } from "./types";

/**
 * A draft can be saved unfinished, so only its number, date and client's name are required.
 * Every other status needs the full details. Keep this in step with findMissingDetail in
 * lib/invoiceInput.ts, which the server applies.
 */
const isDraft = (invoice: InvoiceFormData) => invoice.status === "DRAFT";

/** Added to what is missing when the invoice is not a draft, so the way out is clear. */
const DRAFT_HINT = " Or set the status to Draft to save it unfinished.";

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
  if (isDraft(invoice)) return null;
  if (!c.gstin.trim()) return "Enter the client's GSTIN." + DRAFT_HINT;
  if (!c.address.trim()) return "Enter the client's address." + DRAFT_HINT;
  if (!c.state.trim() || !c.stateCode.trim()) return "Choose the client's state." + DRAFT_HINT;
  return null;
}

/**
 * What is wrong with the line items, or null. Outside a draft every line needs a description and
 * a typed amount. In a draft a line may be unfinished, but an amount that is typed must be a number.
 */
export function findLineItemsProblem(invoice: InvoiceFormData): string | null {
  const draft = isDraft(invoice);
  if (!invoice.lineItems.length) return "Add at least one line item.";
  for (let i = 0; i < invoice.lineItems.length; i++) {
    const li = invoice.lineItems[i]!;
    if (!draft && !li.description.trim()) return `Line ${i + 1}: enter a description.` + DRAFT_HINT;
    const blankAmount = String(li.amount ?? "").trim() === "";
    if (Number.isNaN(parseAmount(li.amount)) && !(draft && blankAmount)) {
      return (
        `Line ${i + 1}: type the amount as a number (for example 150000 or 1,50,000.50).` +
        (draft ? "" : DRAFT_HINT)
      );
    }
  }
  return null;
}

/** The first thing stopping this invoice from being saved, or null if it can be. */
export function findInvoiceProblem(invoice: InvoiceFormData): string | null {
  return findDetailsProblem(invoice) ?? findClientProblem(invoice) ?? findLineItemsProblem(invoice);
}

/** True when a line has nothing typed in it at all. */
export function isBlankLine(li: InvoiceFormData["lineItems"][number]): boolean {
  return (
    !li.description.trim() &&
    !(li.hsnSac ?? "").trim() &&
    !li.unit.trim() &&
    !li.qty.trim() &&
    !li.rate.trim() &&
    String(li.amount ?? "").trim() === "" &&
    li.meterStart == null &&
    li.meterEnd == null
  );
}
