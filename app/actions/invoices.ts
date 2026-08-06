"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { getNextInvoiceNo, getOrCreateCompanySettings } from "@/lib/bootstrap";
import { requireSessionUser } from "@/lib/auth";
import {
  calculateLineAmount,
  calculateTotals,
  getTaxMode,
  amountInWordsINR,
  roundMoney,
} from "@/lib/calculations";
import { DEFAULT_COMPANY_STATE } from "@/lib/defaults";
import { syncInvoiceToGDrive, deleteInvoiceFromGDrive } from "@/lib/gdrive";

const lineItemSchema = z.object({
  sno: z.number().int().min(1),
  description: z.string().min(1),
  hsnSac: z.string().optional().nullable(),
  unit: z.string().min(1),
  qty: z.number().nonnegative(),
  rate: z.number().nonnegative(),
  equipmentId: z.number().int().optional().nullable(),
  meterStart: z.number().optional().nullable(),
  meterEnd: z.number().optional().nullable(),
});

const invoiceSchema = z.object({
  id: z.number().int().optional(),
  invoiceNo: z.string().min(1),
  invoiceDate: z.string().min(1),
  poNo: z.string().optional().nullable(),
  referenceNo: z.string().optional().nullable(),
  referenceDate: z.string().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  termsOfDelivery: z.string().optional().nullable(),
  billPeriodStart: z.string().optional().nullable(),
  billPeriodEnd: z.string().optional().nullable(),

  state: z.string().min(1),
  stateCode: z.string().min(1),
  transportMode: z.string().optional().nullable(),
  vehicleNo: z.string().optional().nullable(),
  placeOfSupply: z.string().optional().nullable(),
  irn: z.string().optional().nullable(),
  ewayBillNo: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "SENT", "PAID", "QUOTATION"]),
  reverseCharge: z.boolean(),

  cgstRate: z.number().nonnegative(),
  sgstRate: z.number().nonnegative(),
  igstRate: z.number().nonnegative(),

  client: z.object({
    id: z.number().int().optional(),
    name: z.string().min(1),
    address: z.string().min(1),
    gstin: z.string().min(1),
    state: z.string().min(1),
    stateCode: z.string().min(1),
    shipToName: z.string().optional().nullable(),
    shipToAddress: z.string().optional().nullable(),
    shipToGstin: z.string().optional().nullable(),
    shipToState: z.string().optional().nullable(),
    shipToStateCode: z.string().optional().nullable(),
  }),

  lineItems: z.array(lineItemSchema).min(1),

  signature: z
    .object({
      dataUrl: z.string().min(1),
      type: z.enum(["DRAWN", "UPLOADED", "TYPED"]),
    })
    .optional()
    .nullable(),
});

function toDecimal(value: number) {
  return new Prisma.Decimal(roundMoney(Number(value) || 0).toFixed(2));
}

function toDate(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createInvoice(input: z.infer<typeof invoiceSchema>) {
  const user = await requireSessionUser();
  const parsed = invoiceSchema.omit({ id: true }).safeParse(input);
  if (!parsed.success) throw new Error("Invalid invoice payload");

  const data = parsed.data;

  const settings = await getOrCreateCompanySettings(user.id);
  const companyStateCode = settings.stateCode ?? DEFAULT_COMPANY_STATE.stateCode;
  const taxMode = getTaxMode(companyStateCode, data.client.stateCode);
  const totals = calculateTotals({
    items: data.lineItems.map((li) => ({ qty: li.qty, rate: li.rate })),
    cgstRate: data.cgstRate,
    sgstRate: data.sgstRate,
    igstRate: data.igstRate,
    taxMode,
  });
  const amountInWords = amountInWordsINR(totals.grandTotal);

  const invoiceNo = data.invoiceNo.trim()
    ? data.invoiceNo.trim()
    : await getNextInvoiceNo(user.id);

  const client = data.client.id
    ? await (async () => {
        const existing = await prisma.client.findFirst({
          where: { id: data.client.id, userId: user.id },
          select: { id: true },
        });
        if (!existing) throw new Error("Client not found or access denied");
        return prisma.client.update({
          where: { id: existing.id },
          data: {
            name: data.client.name,
            address: data.client.address,
            gstin: data.client.gstin,
            state: data.client.state,
            stateCode: data.client.stateCode,
            shipToName: data.client.shipToName ?? null,
            shipToAddress: data.client.shipToAddress ?? null,
            shipToGstin: data.client.shipToGstin ?? null,
            shipToState: data.client.shipToState ?? null,
            shipToStateCode: data.client.shipToStateCode ?? null,
          },
        });
      })()
    : await prisma.client.create({
        data: {
          userId: user.id,
          name: data.client.name,
          address: data.client.address,
          gstin: data.client.gstin,
          state: data.client.state,
          stateCode: data.client.stateCode,
          shipToName: data.client.shipToName ?? null,
          shipToAddress: data.client.shipToAddress ?? null,
          shipToGstin: data.client.shipToGstin ?? null,
          shipToState: data.client.shipToState ?? null,
          shipToStateCode: data.client.shipToStateCode ?? null,
        },
      });

  const invoice = await prisma.invoice.create({
    data: {
      userId: user.id,
      invoiceNo,
      invoiceDate: new Date(data.invoiceDate),
      poNo: data.poNo ?? null,
      referenceNo: data.referenceNo ?? null,
      referenceDate: data.referenceDate ?? null,
      paymentTerms: data.paymentTerms ?? null,
      termsOfDelivery: data.termsOfDelivery ?? null,
      billPeriodStart: toDate(data.billPeriodStart) ?? undefined,
      billPeriodEnd: toDate(data.billPeriodEnd) ?? undefined,

      state: data.state,
      stateCode: data.stateCode,
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
      amountInWords,

      clientId: client.id,
      lineItems: {
        create: data.lineItems.map((li) => ({
          sno: li.sno,
          description: li.description,
          hsnSac: li.hsnSac ?? null,
          unit: li.unit,
          qty: toDecimal(li.qty),
          rate: toDecimal(li.rate),
          amount: toDecimal(calculateLineAmount(li.qty, li.rate)),
          equipmentId: li.equipmentId ?? null,
          meterStart: li.meterStart != null ? toDecimal(li.meterStart) : null,
          meterEnd: li.meterEnd != null ? toDecimal(li.meterEnd) : null,
        })),
      },
      signature: data.signature
        ? {
            create: {
              dataUrl: data.signature.dataUrl,
              type: data.signature.type,
            },
          }
        : undefined,
    },
    select: { id: true },
  });

  revalidatePath("/dashboard");
  syncInvoiceToGDrive(invoice.id).catch(() => {});
  return { success: true, id: invoice.id };
}

export async function updateInvoice(input: z.infer<typeof invoiceSchema>) {
  const user = await requireSessionUser();
  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid invoice payload");
  if (!parsed.data.id) throw new Error("Missing invoice id");

  const data = parsed.data;
  const existingInvoice = await prisma.invoice.findFirst({
    where: { id: data.id, userId: user.id },
    select: { id: true },
  });
  if (!existingInvoice) throw new Error("Invoice not found or access denied");

  const settings = await getOrCreateCompanySettings(user.id);
  const companyStateCode = settings.stateCode ?? DEFAULT_COMPANY_STATE.stateCode;
  const taxMode = getTaxMode(companyStateCode, data.client.stateCode);
  const totals = calculateTotals({
    items: data.lineItems.map((li) => ({ qty: li.qty, rate: li.rate })),
    cgstRate: data.cgstRate,
    sgstRate: data.sgstRate,
    igstRate: data.igstRate,
    taxMode,
  });
  const amountInWords = amountInWordsINR(totals.grandTotal);

  const client = data.client.id
    ? await (async () => {
        const existing = await prisma.client.findFirst({
          where: { id: data.client.id, userId: user.id },
          select: { id: true },
        });
        if (!existing) throw new Error("Client not found or access denied");
        return prisma.client.update({
          where: { id: existing.id },
          data: {
            name: data.client.name,
            address: data.client.address,
            gstin: data.client.gstin,
            state: data.client.state,
            stateCode: data.client.stateCode,
            shipToName: data.client.shipToName ?? null,
            shipToAddress: data.client.shipToAddress ?? null,
            shipToGstin: data.client.shipToGstin ?? null,
            shipToState: data.client.shipToState ?? null,
            shipToStateCode: data.client.shipToStateCode ?? null,
          },
        });
      })()
    : await prisma.client.create({
        data: {
          userId: user.id,
          name: data.client.name,
          address: data.client.address,
          gstin: data.client.gstin,
          state: data.client.state,
          stateCode: data.client.stateCode,
          shipToName: data.client.shipToName ?? null,
          shipToAddress: data.client.shipToAddress ?? null,
          shipToGstin: data.client.shipToGstin ?? null,
          shipToState: data.client.shipToState ?? null,
          shipToStateCode: data.client.shipToStateCode ?? null,
        },
      });

  await prisma.$transaction(
    async (tx) => {
      await tx.lineItem.deleteMany({ where: { invoiceId: data.id } });
      await tx.signature.deleteMany({ where: { invoiceId: data.id } });

      await tx.invoice.update({
        where: { id: existingInvoice.id },
        data: {
          invoiceNo: data.invoiceNo.trim(),
          invoiceDate: new Date(data.invoiceDate),
          poNo: data.poNo ?? null,
          referenceNo: data.referenceNo ?? null,
          referenceDate: data.referenceDate ?? null,
          paymentTerms: data.paymentTerms ?? null,
          termsOfDelivery: data.termsOfDelivery ?? null,
          billPeriodStart: toDate(data.billPeriodStart) ?? undefined,
          billPeriodEnd: toDate(data.billPeriodEnd) ?? undefined,

          state: data.state,
          stateCode: data.stateCode,
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
          amountInWords,

          clientId: client.id,
          lineItems: {
            create: data.lineItems.map((li) => ({
              sno: li.sno,
              description: li.description,
              hsnSac: li.hsnSac ?? null,
              unit: li.unit,
              qty: toDecimal(li.qty),
              rate: toDecimal(li.rate),
              amount: toDecimal(calculateLineAmount(li.qty, li.rate)),
              equipmentId: li.equipmentId ?? null,
              meterStart: li.meterStart != null ? toDecimal(li.meterStart) : null,
              meterEnd: li.meterEnd != null ? toDecimal(li.meterEnd) : null,
            })),
          },
          signature: data.signature
            ? {
                create: {
                  dataUrl: data.signature.dataUrl,
                  type: data.signature.type,
                },
              }
            : undefined,
        },
      });
    },
    {
      maxWait: 10000,
      timeout: 20000,
    }
  );

  revalidatePath("/dashboard");
  revalidatePath(`/invoices/${data.id}`);
  syncInvoiceToGDrive(existingInvoice.id).catch(() => {});
  return { ok: true };
}

export async function deleteInvoice(id: number) {
  const user = await requireSessionUser();
  const existing = await prisma.invoice.findFirst({
    where: { id, userId: user.id },
    select: { id: true, invoiceNo: true, invoiceDate: true, pdfName: true },
  });
  if (!existing) throw new Error("Invoice not found or access denied");

  await prisma.invoice.delete({ where: { id: existing.id } });

  deleteInvoiceFromGDrive(
    {
      invoiceNo: existing.invoiceNo,
      invoiceDate: existing.invoiceDate,
      pdfName: existing.pdfName,
    },
    user.id
  ).catch(() => {});

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function saveInvoicePdf(invoiceId: number, filename: string, base64Data: string) {
  const user = await requireSessionUser();
  const existing = await prisma.invoice.findFirst({
    where: { id: invoiceId, userId: user.id },
    select: { id: true },
  });
  if (!existing) throw new Error("Invoice not found or access denied");

  await prisma.invoice.update({
    where: { id: existing.id },
    data: {
      pdfName: filename,
      pdfData: base64Data,
    },
  });
  revalidatePath("/dashboard");
  revalidatePath(`/invoices/${invoiceId}`);
  syncInvoiceToGDrive(invoiceId).catch(() => {});
  return { ok: true };
}
