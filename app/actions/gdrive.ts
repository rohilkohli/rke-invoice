"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth";
import { testGDriveWebhook, syncInvoiceToGDrive, syncFullBackupToGDrive } from "@/lib/gdrive";

export async function saveGDriveWebhookAction(webhookUrl: string) {
  const user = await requireSessionUser();
  const trimmedUrl = webhookUrl.trim();

  if (trimmedUrl && !trimmedUrl.startsWith("https://script.google.com/")) {
    return { success: false, error: "URL must be a valid Google Apps Script URL starting with https://script.google.com/" };
  }

  const existingSettings = await prisma.companySettings.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });

  if (!existingSettings) {
    return { success: false, error: "Company settings not found" };
  }

  await prisma.companySettings.update({
    where: { id: existingSettings.id },
    data: { gdriveWebhookUrl: trimmedUrl || null },
  });

  revalidatePath("/settings");
  return { success: true };
}

export async function testGDriveConnectionAction(overrideUrl?: string) {
  const user = await requireSessionUser();
  let url = overrideUrl?.trim();

  if (!url) {
    const settings = await prisma.companySettings.findFirst({
      where: { userId: user.id },
      select: { gdriveWebhookUrl: true },
    });
    url = settings?.gdriveWebhookUrl ?? undefined;
  }

  if (!url) {
    return { success: false, error: "No Google Drive Webhook URL configured" };
  }

  return testGDriveWebhook(url);
}

export async function syncSingleInvoiceAction(invoiceId: number) {
  return syncInvoiceToGDrive(invoiceId);
}

export async function syncAllDataAction() {
  const user = await requireSessionUser();
  
  const settings = await prisma.companySettings.findFirst({
    where: { userId: user.id },
    select: { gdriveWebhookUrl: true },
  });

  if (!settings?.gdriveWebhookUrl) {
    return { success: false, error: "Please configure and save your Google Drive Webhook URL first." };
  }

  // 1. Sync full DB backup
  const backupRes = await syncFullBackupToGDrive(user.id, settings.gdriveWebhookUrl);
  if (!backupRes.success) {
    return backupRes;
  }

  // 2. Fetch all user invoices and sync each
  const invoices = await prisma.invoice.findMany({
    where: { userId: user.id },
    select: { id: true },
  });

  let syncedCount = 0;
  for (const inv of invoices) {
    const res = await syncInvoiceToGDrive(inv.id, settings.gdriveWebhookUrl);
    if (res.success) syncedCount++;
  }

  revalidatePath("/dashboard");
  revalidatePath("/settings");

  return {
    success: true,
    message: `Successfully synced database backup and ${syncedCount} of ${invoices.length} invoices to Google Drive!`,
  };
}
