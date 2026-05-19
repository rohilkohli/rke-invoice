import "server-only";

import { prisma } from "@/lib/db";
import { DEFAULT_CLIENT, DEFAULT_COMPANY } from "@/lib/defaults";

export async function getOrCreateCompanySettings() {
  const existing = await prisma.companySettings.findFirst();
  if (existing) return existing;

  return prisma.companySettings.create({
    data: {
      companyName: DEFAULT_COMPANY.companyName,
      gstin: DEFAULT_COMPANY.gstin,
      address: DEFAULT_COMPANY.address,
      email: DEFAULT_COMPANY.email,
      phone: DEFAULT_COMPANY.phone,
      bankName: DEFAULT_COMPANY.bankName,
      branch: DEFAULT_COMPANY.branch,
      accountNo: DEFAULT_COMPANY.accountNo,
      ifsc: DEFAULT_COMPANY.ifsc,
      upiId: DEFAULT_COMPANY.upiId,
      invoicePrefix: DEFAULT_COMPANY.invoicePrefix,
      defaultCgstRate: DEFAULT_COMPANY.defaultCgstRate,
      defaultSgstRate: DEFAULT_COMPANY.defaultSgstRate,
      defaultIgstRate: DEFAULT_COMPANY.defaultIgstRate,
      termsAndConditions: DEFAULT_COMPANY.termsAndConditions,
    },
  });
}

export async function getOrCreateDefaultClient() {
  const existing = await prisma.client.findFirst({
    where: { gstin: DEFAULT_CLIENT.gstin },
  });
  if (existing) return existing;

  return prisma.client.create({ data: DEFAULT_CLIENT });
}

export async function getNextInvoiceNo(params?: { invoicePrefix?: string }) {
  const settings = await getOrCreateCompanySettings();
  const prefix = (params?.invoicePrefix ?? settings.invoicePrefix ?? "").trim();

  const candidates = await prisma.invoice.findMany({
    where: prefix ? { invoiceNo: { startsWith: prefix } } : undefined,
    select: { invoiceNo: true },
    orderBy: { id: "desc" },
    take: 5000,
  });

  let maxSeq = 0;
  for (const row of candidates) {
    const invoiceNo = row.invoiceNo ?? "";
    const suffix = prefix ? invoiceNo.slice(prefix.length) : invoiceNo;
    const num = Number.parseInt(suffix.replace(/[^\d]/g, ""), 10);
    if (Number.isFinite(num) && num > maxSeq) maxSeq = num;
  }

  const next = maxSeq + 1;
  const padded = String(next).padStart(3, "0");
  return `${prefix}${padded}`;
}

