"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth";

const settingsSchema = z.object({
  id: z.number().int(),
  companyName: z.string().min(1),
  gstin: z.string().min(1),
  address: z.string().min(1),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),

  bankName: z.string().optional().nullable(),
  branch: z.string().optional().nullable(),
  accountNo: z.string().optional().nullable(),
  ifsc: z.string().optional().nullable(),
  upiId: z.string().optional().nullable(),

  logoUrl: z.string().optional().nullable(),
  signatureUrl: z.string().optional().nullable(),
  invoicePrefix: z.string().optional().nullable(),

  defaultCgstRate: z.number().nonnegative(),
  defaultSgstRate: z.number().nonnegative(),
  defaultIgstRate: z.number().nonnegative(),

  termsAndConditions: z.string().optional().nullable(),
  tagline: z.string().optional().nullable(),
  accountType: z.string().optional().nullable(),
  stateCode: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
});

function toDecimal(value: number) {
  return new Prisma.Decimal((Number(value) || 0).toFixed(2));
}

export async function updateCompanySettings(input: z.infer<typeof settingsSchema>) {
  const user = await requireSessionUser();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid settings payload");

  const data = parsed.data;

  const existing = await prisma.companySettings.findFirst({
    where: { id: data.id, userId: user.id },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("Company settings not found");
  }

  await prisma.companySettings.update({
    where: { id: existing.id },
    data: {
      companyName: data.companyName,
      gstin: data.gstin,
      address: data.address,
      email: data.email ?? null,
      phone: data.phone ?? null,
      bankName: data.bankName ?? null,
      branch: data.branch ?? null,
      accountNo: data.accountNo ?? null,
      ifsc: data.ifsc ?? null,
      upiId: data.upiId ?? null,
      logoUrl: data.logoUrl ?? null,
      signatureUrl: data.signatureUrl ?? null,
      invoicePrefix: data.invoicePrefix ?? null,
      defaultCgstRate: toDecimal(data.defaultCgstRate),
      defaultSgstRate: toDecimal(data.defaultSgstRate),
      defaultIgstRate: toDecimal(data.defaultIgstRate),
      termsAndConditions: data.termsAndConditions ?? null,
      tagline: data.tagline ?? null,
      accountType: data.accountType ?? null,
      stateCode: data.stateCode ?? null,
      state: data.state ?? null,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/invoices/new");
  return { ok: true };
}
