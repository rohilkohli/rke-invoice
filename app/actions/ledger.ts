"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireSessionUser } from "@/lib/auth";
import { roundMoney } from "@/lib/calculations";
import { BILLED_STATUSES } from "@/lib/invoiceStatus";

const paymentSchema = z.object({
  clientId: z.number().int(),
  date: z.string().min(1),
  amount: z.number().positive(),
  referenceNo: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

export async function createPayment(input: z.infer<typeof paymentSchema>) {
  const user = await requireSessionUser();

  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Invalid payment details");
  }

  const { clientId, date, amount, referenceNo, description } = parsed.data;
  const client = await prisma.client.findFirst({
    where: { id: clientId, userId: user.id },
    select: { id: true },
  });
  if (!client) {
    throw new Error("Client not found or access denied");
  }

  const payment = await prisma.payment.create({
    data: {
      clientId,
      userId: user.id,
      date: new Date(date),
      amount: new Prisma.Decimal(roundMoney(amount).toFixed(2)),
      referenceNo: referenceNo || null,
      description: description || null,
    },
  });

  revalidatePath("/ledger");
  return { success: true, paymentId: payment.id };
}

export async function getLedgerData(clientId?: number) {
  const user = await requireSessionUser();

  if (clientId) {
    const selectedClient = await prisma.client.findFirst({
      where: { id: clientId, userId: user.id },
      select: { id: true },
    });
    if (!selectedClient) {
      throw new Error("Client not found or access denied");
    }
  }

  // Clients to choose from: only ones that have been billed or paid, so the stray records the
  // old "new invoice" page used to create do not clutter the list.
  const clients = await prisma.client.findMany({
    where: {
      userId: user.id,
      OR: [{ invoices: { some: {} } }, { payments: { some: {} } }],
    },
    orderBy: { name: "asc" },
  });

  // Light rows only: no stored PDFs and no line items are loaded for a statement.
  const invoiceList = await prisma.invoice.findMany({
    where: {
      userId: user.id,
      // A quotation is an offer, not a bill, so it is not a debit.
      status: { in: BILLED_STATUSES },
      ...(clientId ? { clientId } : {}),
    },
    select: {
      id: true,
      invoiceNo: true,
      invoiceDate: true,
      grandTotal: true,
      clientName: true,
      client: { select: { name: true } },
    },
    orderBy: [{ invoiceDate: "asc" }, { id: "asc" }],
  });

  const paymentList = await prisma.payment.findMany({
    where: {
      userId: user.id,
      ...(clientId ? { clientId } : {}),
    },
    include: { client: { select: { name: true } } },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });

  // Combine invoices and payments into a ledger
  // An invoice is a DEBIT (client owes us money, increases ledger balance)
  // A payment is a CREDIT (client paid us money, decreases ledger balance)
  interface LedgerEntry {
    id: string;
    date: string;
    rawDate: Date;
    type: "INVOICE" | "PAYMENT";
    docNo: string;
    clientName: string;
    description: string;
    debit: number;
    credit: number;
    runningBalance: number;
  }

  const entries: LedgerEntry[] = [];

  for (const inv of invoiceList) {
    entries.push({
      id: `inv-${inv.id}`,
      date: inv.invoiceDate.toISOString().slice(0, 10),
      rawDate: inv.invoiceDate,
      type: "INVOICE",
      docNo: inv.invoiceNo,
      clientName: inv.clientName ?? inv.client.name,
      description: `Billed Invoice: ${inv.invoiceNo}`,
      debit: Number(inv.grandTotal),
      credit: 0,
      runningBalance: 0,
    });
  }

  for (const p of paymentList) {
    entries.push({
      id: `pay-${p.id}`,
      date: p.date.toISOString().slice(0, 10),
      rawDate: p.date,
      type: "PAYMENT",
      docNo: p.referenceNo || "-",
      clientName: p.client.name,
      description: p.description || `Payment received ref: ${p.referenceNo || "N/A"}`,
      debit: 0,
      credit: Number(p.amount),
      runningBalance: 0,
    });
  }

  // Sort by date chronologically (stable: on the same day, invoices come before payments)
  entries.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());

  // Compute running balance, and the totals, from the same list the statement shows
  let currentBalance = 0;
  let totalBilled = 0;
  let totalPaid = 0;
  for (const entry of entries) {
    currentBalance += entry.debit - entry.credit;
    entry.runningBalance = currentBalance;
    totalBilled += entry.debit;
    totalPaid += entry.credit;
  }

  // Return reverse-chronological list for UI, but compute running balance chronologically
  const reversedEntries = [...entries].reverse();

  return {
    clients,
    entries: reversedEntries,
    summary: {
      totalBilled,
      totalPaid,
      totalOutstanding: totalBilled - totalPaid,
    },
  };
}

export async function deletePayment(id: number) {
  const user = await requireSessionUser();

  const payment = await prisma.payment.findUnique({
    where: { id },
  });

  if (!payment || payment.userId !== user.id) {
    throw new Error("Payment record not found or access denied");
  }

  await prisma.payment.delete({ where: { id } });
  revalidatePath("/ledger");
  return { success: true };
}
