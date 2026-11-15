"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth";
import {
  ensureWebhookSecret,
  syncInvoiceToGDrive,
  syncPendingInvoices,
  testGDriveWebhook,
} from "@/lib/gdrive";
import { isAllowedWebhookUrl } from "@/lib/gdriveCore";
import { renderGDriveScript } from "@/lib/gdriveScript";

const ADDRESS_RULE =
  "The address must be your deployed Apps Script web app (it starts with https://script.google.com/macros/).";

export async function saveGDriveWebhookAction(webhookUrl: string) {
  const user = await requireSessionUser();
  const trimmedUrl = webhookUrl.trim();

  if (trimmedUrl && !isAllowedWebhookUrl(trimmedUrl)) {
    return { success: false, error: ADDRESS_RULE };
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
  // The script needs a private key from the moment an address is saved.
  if (trimmedUrl) await ensureWebhookSecret(user.id);

  revalidatePath("/settings");
  return { success: true };
}

export async function testGDriveConnectionAction(overrideUrl?: string) {
  const user = await requireSessionUser();
  let url = overrideUrl?.trim();

  // Whatever is typed in the box is checked before the server sends anything to it.
  if (url && !isAllowedWebhookUrl(url)) {
    return { success: false, error: ADDRESS_RULE };
  }

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

  return testGDriveWebhook(url, await ensureWebhookSecret(user.id));
}

export async function syncSingleInvoiceAction(invoiceId: number) {
  const user = await requireSessionUser();
  const result = await syncInvoiceToGDrive(invoiceId, user.id);
  revalidatePath(`/invoices/${invoiceId}`);
  return result;
}

export async function syncAllDataAction() {
  const user = await requireSessionUser();
  const result = await syncPendingInvoices(user.id);

  revalidatePath("/dashboard");
  revalidatePath("/settings");

  if (!result.success) return { success: false, error: result.error };

  const parts = [`Database backup uploaded. ${result.synced} invoice${result.synced === 1 ? "" : "s"} synced.`];
  if (result.remaining > 0) {
    parts.push(`${result.remaining} more still waiting: press the button again to continue.`);
  } else if (result.failed === 0) {
    parts.push("Everything is up to date.");
  }
  if (result.failed > 0) {
    return {
      success: false,
      error: `${parts.join(" ")} ${result.failed} failed: ${result.failures.join("; ")}`,
    };
  }
  return { success: true, message: parts.join(" ") };
}

/** The Apps Script to paste into Google, with this account's private key already in it. */
export async function getGDriveScriptAction() {
  const user = await requireSessionUser();
  return { script: renderGDriveScript(await ensureWebhookSecret(user.id)) };
}
