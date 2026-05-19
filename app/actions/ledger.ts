"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";

const paymentSchema = z.object({
  clientId: z.number().int(),
  date: z.string().min(1),
  amount: z.number().positive(),
  referenceNo: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

export async function createPayment(input: z.infer<typeof paymentSchema>) {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Invalid payment details");
  }

  const { clientId, date, amount, referenceNo, description } = parsed.data;

  const payment = await prisma.payment.create({
    data: {
      clientId,
      userId: user.id,
      date: new Date(date),
      amount: new Prisma.Decimal(amount.toFixed(2)),
      referenceNo: referenceNo || null,
      description: description || null,
    },
  });

  revalidatePath("/ledger");
  return { success: true, paymentId: payment.id };
}

export async function getLedgerData(clientId?: number) {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  // Fetch all clients for the selector
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
  });

  // Calculate totals scoped to the user
  const allInvoices = await prisma.invoice.findMany({
    where: { userId: user.id },
    select: { grandTotal: true, clientId: true },
  });
  const allPayments = await prisma.payment.findMany({
    where: { userId: user.id },
    select: { amount: true, clientId: true },
  });

  let filteredInvoices = allInvoices;
  let filteredPayments = allPayments;

  if (clientId) {
    filteredInvoices = allInvoices.filter((i) => i.clientId === clientId);
    filteredPayments = allPayments.filter((p) => p.clientId === clientId);
  }

  const totalBilled = filteredInvoices.reduce((sum, i) => sum + Number(i.grandTotal), 0);
  const totalPaid = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalOutstanding = totalBilled - totalPaid;

  // Fetch detail entries scoped to the user
  let invoiceDetailList = await prisma.invoice.findMany({
    where: {
      userId: user.id,
      ...(clientId ? { clientId } : {}),
    },
    include: { client: true },
    orderBy: { invoiceDate: "asc" },
  });

  let paymentDetailList = await prisma.payment.findMany({
    where: {
      userId: user.id,
      ...(clientId ? { clientId } : {}),
    },
    include: { client: true },
    orderBy: { date: "asc" },
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

  for (const inv of invoiceDetailList) {
    entries.push({
      id: `inv-${inv.id}`,
      date: inv.invoiceDate.toISOString().slice(0, 10),
      rawDate: inv.invoiceDate,
      type: "INVOICE",
      docNo: inv.invoiceNo,
      clientName: inv.client.name,
      description: `Billed Invoice: ${inv.invoiceNo}`,
      debit: Number(inv.grandTotal),
      credit: 0,
      runningBalance: 0,
    });
  }

  for (const p of paymentDetailList) {
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

  // Sort by date chronologically
  entries.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());

  // Compute running balance
  let currentBalance = 0;
  for (const entry of entries) {
    currentBalance += entry.debit - entry.credit;
    entry.runningBalance = currentBalance;
  }

  // Return reverse-chronological list for UI, but compute running balance chronologically
  const reversedEntries = [...entries].reverse();

  return {
    clients,
    entries: reversedEntries,
    summary: {
      totalBilled,
      totalPaid,
      totalOutstanding,
    },
  };
}

export async function deletePayment(id: number) {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

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
