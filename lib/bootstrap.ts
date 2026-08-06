import "server-only";

import { prisma } from "@/lib/db";
import { DEFAULT_CLIENT, DEFAULT_COMPANY } from "@/lib/defaults";

export async function getOrCreateCompanySettings(userId: number) {
  const existing = await prisma.companySettings.findUnique({
    where: { userId },
  });
  if (existing) return existing;

  return prisma.companySettings.create({
    data: {
      userId,
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
      tagline: DEFAULT_COMPANY.tagline,
      accountType: DEFAULT_COMPANY.accountType,
      state: DEFAULT_COMPANY.state,
      stateCode: DEFAULT_COMPANY.stateCode,
      invoicePrefix: DEFAULT_COMPANY.invoicePrefix,
      defaultCgstRate: DEFAULT_COMPANY.defaultCgstRate,
      defaultSgstRate: DEFAULT_COMPANY.defaultSgstRate,
      defaultIgstRate: DEFAULT_COMPANY.defaultIgstRate,
      termsAndConditions: DEFAULT_COMPANY.termsAndConditions,
    },
  });
}

export async function getOrCreateDefaultClient(userId: number) {
  const existing = await prisma.client.findFirst({
    where: { userId, gstin: DEFAULT_CLIENT.gstin },
  });
  if (existing) return existing;

  return prisma.client.create({ data: { ...DEFAULT_CLIENT, userId } });
}

export async function getNextInvoiceNo(userId: number, params?: { invoicePrefix?: string }) {
  const settings = await getOrCreateCompanySettings(userId);
  const prefix = (params?.invoicePrefix ?? settings.invoicePrefix ?? "").trim();

  // Use findFirst ordered by id desc instead of fetching up to 5,000 rows.
  // Invoices are always created in sequential order, so the latest id
  // has the highest sequence number.
  const latest = await prisma.invoice.findFirst({
    where: {
      userId,
      ...(prefix ? { invoiceNo: { startsWith: prefix } } : {}),
    },
    select: { invoiceNo: true },
    orderBy: { id: "desc" },
  });

  let maxSeq = 0;
  if (latest?.invoiceNo) {
    const suffix = prefix ? latest.invoiceNo.slice(prefix.length) : latest.invoiceNo;
    const num = Number.parseInt(suffix.replace(/[^\d]/g, ""), 10);
    if (Number.isFinite(num)) maxSeq = num;
  }

  const next = maxSeq + 1;
  const padded = String(next).padStart(3, "0");
  return `${prefix}${padded}`;
}
