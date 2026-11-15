import "server-only";

import { prisma } from "@/lib/db";
import { DEFAULT_COMPANY } from "@/lib/defaults";

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
