import { z } from "zod";

/**
 * What the server accepts when an invoice is saved. It lives here, apart from the server
 * actions, so the rules can be tested.
 *
 * Every invoice needs a number, a date and the client's name. A DRAFT needs nothing more, so
 * unfinished work can be saved and picked up later from any device. Every other status needs
 * the full details (see findMissingDetail).
 */

const optionalText = z.string().optional().nullable();
const requiredText = (message: string) => z.string().trim().min(1, message);

const lineItemSchema = z.object({
  sno: z.number().int().min(1),
  // Required unless the invoice is a draft: see findMissingDetail.
  description: z.string().trim(),
  hsnSac: optionalText,
  // Free text, stored and printed exactly as typed. Never used in a calculation.
  unit: z.string().max(60, "Unit is too long."),
  qty: z.string().max(60, "Quantity is too long."),
  rate: z.string().max(60, "Rate is too long."),
  // Typed by the user; the only line figure that feeds the totals.
  amount: z.number().nonnegative("A line amount cannot be negative."),
  equipmentId: z.number().int().optional().nullable(),
  meterStart: z.number().optional().nullable(),
  meterEnd: z.number().optional().nullable(),
});

const taxRate = z.number().nonnegative("A tax rate cannot be negative.").max(100, "A tax rate cannot be more than 100%.");

export const invoiceSchema = z.object({
  id: z.number().int().optional(),
  // Always typed in by the user — never generated here. Blank is rejected.
  invoiceNo: requiredText("Enter an invoice number."),
  invoiceDate: z
    .string()
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Enter a valid invoice date."),
  poNo: optionalText,
  referenceNo: optionalText,
  referenceDate: optionalText,
  buyerOrderNo: optionalText,
  paymentTerms: optionalText,
  termsOfDelivery: optionalText,
  billPeriodStart: optionalText,
  billPeriodEnd: optionalText,

  // "State of supply". Left blank it follows the client's state.
  state: z.string().optional().default(""),
  stateCode: z.string().optional().default(""),
  transportMode: optionalText,
  vehicleNo: optionalText,
  placeOfSupply: optionalText,
  irn: optionalText,
  ewayBillNo: optionalText,
  status: z.enum(["DRAFT", "SENT", "PAID", "QUOTATION"]),
  reverseCharge: z.boolean(),

  cgstRate: taxRate,
  sgstRate: taxRate,
  igstRate: taxRate,

  client: z.object({
    name: requiredText("Enter the client's name."),
    // Required unless the invoice is a draft: see findMissingDetail.
    address: z.string().trim(),
    gstin: z.string().trim(),
    state: z.string().trim(),
    stateCode: z.string().trim(),
    shipToName: optionalText,
    shipToAddress: optionalText,
    shipToGstin: optionalText,
    shipToState: optionalText,
    shipToStateCode: optionalText,
  }),

  lineItems: z.array(lineItemSchema).min(1, "Add at least one line item."),

  signature: z
    .object({
      dataUrl: z.string().min(1),
      type: z.enum(["DRAWN", "UPLOADED", "TYPED"]),
    })
    .optional()
    .nullable(),
});

export type ParsedInvoice = z.infer<typeof invoiceSchema>;

export function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "The invoice is not valid.";
}

/**
 * The first detail still missing from an invoice that is not a draft, or null. A draft is never
 * held back by missing details.
 */
export function findMissingDetail(
  data: Pick<ParsedInvoice, "status" | "client" | "lineItems">,
): string | null {
  if (data.status === "DRAFT") return null;

  const c = data.client;
  if (!c.gstin) return "Enter the client's GSTIN.";
  if (!c.address) return "Enter the client's address.";
  if (!c.state || !c.stateCode) return "Choose the client's state.";
  for (let i = 0; i < data.lineItems.length; i++) {
    if (!data.lineItems[i]!.description) return `Line ${i + 1}: enter a description.`;
  }
  return null;
}
