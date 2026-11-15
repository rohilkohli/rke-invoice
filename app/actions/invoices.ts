"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { getOrCreateCompanySettings } from "@/lib/bootstrap";
import { requireSessionUser } from "@/lib/auth";
import { calculateInvoiceTotals, roundMoney } from "@/lib/calculations";
import { clientSnapshot } from "@/lib/clientIdentity";
import { resolveClientId } from "@/lib/clients";
import { deleteInvoiceFromGDrive, syncInvoiceInBackground } from "@/lib/gdrive";

const optionalText = z.string().optional().nullable();
const requiredText = (message: string) => z.string().trim().min(1, message);

const lineItemSchema = z.object({
  sno: z.number().int().min(1),
  description: requiredText("Every line needs a description."),
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

const invoiceSchema = z.object({
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
    address: requiredText("Enter the client's address."),
    gstin: requiredText("Enter the client's GSTIN."),
    state: requiredText("Choose the client's state."),
    stateCode: requiredText("Choose the client's state."),
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

type ParsedInvoice = z.infer<typeof invoiceSchema>;

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "The invoice is not valid.";
}

function toDecimal(value: number) {
  return new Prisma.Decimal(roundMoney(Number(value) || 0).toFixed(2));
}

/** An empty date box saves as no date, which also lets an earlier date be cleared. */
function toDate(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function duplicateInvoiceNoError(invoiceNo: string) {
  return `Invoice number "${invoiceNo}" is already used by another invoice. Enter a different number.`;
}

/** True only for the unique index on an account's invoice numbers (not e.g. a repeated line number). */
function isInvoiceNoClash(e: unknown) {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2002") return false;
  const target = e.meta?.target;
  return Array.isArray(target)
    ? target.includes("invoiceNo")
    : String(target ?? "").includes("invoiceNo");
}

/** True when another invoice of this account (other than `exceptId`) already has this number. */
async function invoiceNoTaken(userId: number, invoiceNo: string, exceptId?: number) {
  const clash = await prisma.invoice.findFirst({
    where: { userId, invoiceNo },
    select: { id: true },
  });
  return Boolean(clash && clash.id !== exceptId);
}

/** Everything saved on the invoice row itself, shared by create and update. */
function invoiceFields(
  data: ParsedInvoice,
  totals: ReturnType<typeof calculateInvoiceTotals>,
  clientId: number,
) {
  const snapshot = clientSnapshot(data.client);
  return {
    invoiceNo: data.invoiceNo,
    invoiceDate: new Date(data.invoiceDate),
    poNo: data.poNo ?? null,
    referenceNo: data.referenceNo ?? null,
    referenceDate: data.referenceDate ?? null,
    buyerOrderNo: data.buyerOrderNo ?? null,
    paymentTerms: data.paymentTerms ?? null,
    termsOfDelivery: data.termsOfDelivery ?? null,
    billPeriodStart: toDate(data.billPeriodStart),
    billPeriodEnd: toDate(data.billPeriodEnd),

    state: data.state.trim() || snapshot.clientState,
    stateCode: data.stateCode.trim() || snapshot.clientStateCode,
    transportMode: data.transportMode ?? null,
    vehicleNo: data.vehicleNo ?? null,
    placeOfSupply: data.placeOfSupply ?? null,
    irn: data.irn ?? null,
    ewayBillNo: data.ewayBillNo ?? null,
    status: data.status,
    reverseCharge: data.reverseCharge,

    cgstRate: toDecimal(data.cgstRate),
    sgstRate: toDecimal(data.sgstRate),
    igstRate: toDecimal(data.igstRate),

    totalBeforeTax: toDecimal(totals.totalBeforeTax),
    cgst: toDecimal(totals.cgst),
    sgst: toDecimal(totals.sgst),
    igst: toDecimal(totals.igst),
    grandTotal: toDecimal(totals.grandTotal),
    amountInWords: totals.amountInWords,

    // The invoice keeps its own copy of the bill-to and ship-to details.
    ...snapshot,
    clientId,
  };
}

function lineItemRows(data: ParsedInvoice) {
  return data.lineItems.map((li) => ({
    sno: li.sno,
    description: li.description,
    hsnSac: li.hsnSac ?? null,
    unit: li.unit,
    qty: li.qty,
    rate: li.rate,
    amount: toDecimal(li.amount),
    equipmentId: li.equipmentId ?? null,
    meterStart: li.meterStart != null ? toDecimal(li.meterStart) : null,
    meterEnd: li.meterEnd != null ? toDecimal(li.meterEnd) : null,
  }));
}

export async function createInvoice(input: z.input<typeof invoiceSchema>) {
  const user = await requireSessionUser();
  const parsed = invoiceSchema.omit({ id: true }).safeParse(input);
  if (!parsed.success) return { success: false as const, error: firstIssue(parsed.error) };

  const data = parsed.data;

  // Checked before anything is written, so a clash never leaves a half-saved record behind.
  if (await invoiceNoTaken(user.id, data.invoiceNo)) {
    return { success: false as const, error: duplicateInvoiceNoError(data.invoiceNo) };
  }

  const company = await getOrCreateCompanySettings(user.id);
  const totals = calculateInvoiceTotals({
    lineItems: data.lineItems,
    cgstRate: data.cgstRate,
    sgstRate: data.sgstRate,
    igstRate: data.igstRate,
    company,
    client: data.client,
  });

  const clientId = await resolveClientId(user.id, data.client);

  const invoice = await prisma.invoice
    .create({
      data: {
        userId: user.id,
        ...invoiceFields(data, totals, clientId),
        lineItems: { create: lineItemRows(data) },
        signature: data.signature
          ? { create: { dataUrl: data.signature.dataUrl, type: data.signature.type } }
          : undefined,
      },
      select: { id: true },
    })
    .catch((e: unknown) => {
      // Two saves racing for the same number: the unique index has the final say.
      if (isInvoiceNoClash(e)) return null;
      throw e;
    });
  if (!invoice) {
    return { success: false as const, error: duplicateInvoiceNoError(data.invoiceNo) };
  }

  revalidatePath("/dashboard");
  // After the reply, and kept alive by the host until it finishes.
  after(() => syncInvoiceInBackground(user.id, invoice.id));
  return { success: true as const, id: invoice.id };
}

export async function updateInvoice(input: z.input<typeof invoiceSchema>) {
  const user = await requireSessionUser();
  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: firstIssue(parsed.error) };
  if (!parsed.data.id) return { ok: false as const, error: "This invoice has not been saved yet." };

  const data = parsed.data;
  const existing = await prisma.invoice.findFirst({
    where: { id: data.id, userId: user.id },
    select: { id: true, clientId: true },
  });
  if (!existing) throw new Error("Invoice not found or access denied");

  if (await invoiceNoTaken(user.id, data.invoiceNo, existing.id)) {
    return { ok: false as const, error: duplicateInvoiceNoError(data.invoiceNo) };
  }

  const company = await getOrCreateCompanySettings(user.id);
  const totals = calculateInvoiceTotals({
    lineItems: data.lineItems,
    cgstRate: data.cgstRate,
    sgstRate: data.sgstRate,
    igstRate: data.igstRate,
    company,
    client: data.client,
  });

  const clientId = await resolveClientId(user.id, data.client, existing.clientId);

  const racedForNumber = await prisma
    .$transaction(
      async (tx) => {
        await tx.lineItem.deleteMany({ where: { invoiceId: existing.id } });
        await tx.signature.deleteMany({ where: { invoiceId: existing.id } });

        await tx.invoice.update({
          where: { id: existing.id },
          data: {
            ...invoiceFields(data, totals, clientId),
            lineItems: { create: lineItemRows(data) },
            signature: data.signature
              ? { create: { dataUrl: data.signature.dataUrl, type: data.signature.type } }
              : undefined,
          },
        });
      },
      { maxWait: 10000, timeout: 20000 },
    )
    .then(
      () => false,
      (e: unknown) => {
        // Rolled back by the transaction; only a number clash is reported, the rest still throws.
        if (isInvoiceNoClash(e)) return true;
        throw e;
      },
    );
  if (racedForNumber) {
    return { ok: false as const, error: duplicateInvoiceNoError(data.invoiceNo) };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/invoices/${existing.id}`);
  after(() => syncInvoiceInBackground(user.id, existing.id));
  return { ok: true as const };
}

export async function deleteInvoice(id: number) {
  const user = await requireSessionUser();
  const existing = await prisma.invoice.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      invoiceNo: true,
      invoiceDate: true,
      driveSyncedNo: true,
      driveSyncedYear: true,
      driveSyncedFile: true,
    },
  });
  if (!existing) throw new Error("Invoice not found or access denied");

  await prisma.invoice.delete({ where: { id: existing.id } });

  after(async () => {
    try {
      const result = await deleteInvoiceFromGDrive(existing, user.id);
      if (!result.success) console.error("[GDrive Sync] delete", existing.invoiceNo, result.error);
    } catch (err) {
      console.error("[GDrive Sync] delete", existing.invoiceNo, err);
    }
  });

  revalidatePath("/dashboard");
  return { ok: true as const };
}
