import "server-only";

import crypto from "crypto";

import { prisma } from "@/lib/db";
import {
  driveFileName,
  driveYear,
  isAllowedWebhookUrl,
  parseWebhookReply,
  planDriveCleanup,
  scriptVersionWarning,
} from "@/lib/gdriveCore";
import { generateInvoicePdfBase64Server } from "@/lib/generatePdfServer";
import { billToOf } from "@/lib/serialize";

export interface GDriveSyncResult {
  success: boolean;
  message?: string;
  error?: string;
  /** The sync worked, but something needs attention (for example an outdated script). */
  warning?: string;
  version?: number;
}

type WebhookConfig = { url: string; secret: string };

const REQUEST_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** The private key the Apps Script checks. Made once per account, and never sent to the browser. */
export async function ensureWebhookSecret(userId: number): Promise<string> {
  const settings = await prisma.companySettings.findFirst({
    where: { userId },
    select: { id: true, gdriveWebhookSecret: true },
  });
  if (!settings) throw new Error("Company settings not found");
  if (settings.gdriveWebhookSecret) return settings.gdriveWebhookSecret;

  // Only fill it in if it is still empty, so two requests at once cannot hand out different keys.
  await prisma.companySettings.updateMany({
    where: { id: settings.id, gdriveWebhookSecret: null },
    data: { gdriveWebhookSecret: crypto.randomBytes(24).toString("hex") },
  });
  const fresh = await prisma.companySettings.findUnique({
    where: { id: settings.id },
    select: { gdriveWebhookSecret: true },
  });
  if (!fresh?.gdriveWebhookSecret) throw new Error("Could not create the Google Drive key");
  return fresh.gdriveWebhookSecret;
}

async function getConfig(userId: number): Promise<WebhookConfig | null> {
  const settings = await prisma.companySettings.findFirst({
    where: { userId },
    select: { gdriveWebhookUrl: true },
  });
  if (!settings?.gdriveWebhookUrl || !isAllowedWebhookUrl(settings.gdriveWebhookUrl)) return null;
  return { url: settings.gdriveWebhookUrl, secret: await ensureWebhookSecret(userId) };
}

// ---------------------------------------------------------------------------
// The one place that talks to Google
// ---------------------------------------------------------------------------

async function post(
  config: WebhookConfig,
  payload: Record<string, unknown>,
): Promise<GDriveSyncResult> {
  // Checked again here, not only when the address is saved: this is what keeps the server
  // from being pointed at anything but a Google Apps Script.
  if (!isAllowedWebhookUrl(config.url)) {
    return {
      success: false,
      error:
        "The Google Drive address must be a deployed Apps Script web app " +
        "(it starts with https://script.google.com/macros/).",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
        Accept: "application/json, text/plain, */*",
      },
      body: JSON.stringify({ ...payload, secret: config.secret }),
      redirect: "follow",
      signal: controller.signal,
    });
    const reply = parseWebhookReply(response.status, response.statusText, await response.text());
    return reply.ok
      ? { success: true, message: reply.message, version: reply.version }
      : { success: false, error: reply.error };
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");
    return {
      success: false,
      error: timedOut
        ? "Google Drive did not answer within 30 seconds. Check your Apps Script deployment."
        : `Could not reach Google Drive: ${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function testGDriveWebhook(url: string, secret: string): Promise<GDriveSyncResult> {
  const result = await post({ url, secret }, { action: "PING" });
  if (!result.success) return result;
  return { ...result, warning: scriptVersionWarning(result.version) };
}

// ---------------------------------------------------------------------------
// One invoice
// ---------------------------------------------------------------------------

async function recordFailure(invoiceId: number, error: string): Promise<GDriveSyncResult> {
  try {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { driveSyncError: error.slice(0, 500) },
    });
  } catch (e) {
    console.error("[GDrive Sync] could not record the failure", e);
  }
  return { success: false, error };
}

/**
 * Sends the invoice's current PDF and ledger row to Drive. The PDF is always made fresh from
 * what is saved, every step's result is checked, and the outcome is stored on the invoice so
 * a failure is visible later instead of being lost.
 */
export async function syncInvoiceToGDrive(
  invoiceId: number,
  userId: number,
): Promise<GDriveSyncResult> {
  try {
    const config = await getConfig(userId);
    if (!config) {
      return {
        success: false,
        error: "Google Drive is not set up. Add your Apps Script address in Settings.",
      };
    }

    // Looked up by owner as well as id: this is reachable from the browser.
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, userId },
      include: { client: true, lineItems: true, signature: true },
    });
    if (!invoice) return { success: false, error: "Invoice not found" };

    const company = await prisma.companySettings.findFirst({ where: { userId } });
    if (!company) return { success: false, error: "Company settings not found" };

    const filename = driveFileName(invoice.invoiceNo);
    const year = driveYear(invoice.invoiceDate);

    let pdfBase64: string;
    try {
      pdfBase64 = await generateInvoicePdfBase64Server(invoice, company);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[GDrive Sync] PDF generation failed:", msg);
      return recordFailure(invoice.id, `Could not make the PDF: ${msg}`);
    }
    if (!pdfBase64) return recordFailure(invoice.id, "Could not make the PDF: it came out empty.");

    const upload = await post(config, { action: "UPLOAD_INVOICE_PDF", filename, year, pdfBase64 });
    if (!upload.success) {
      return recordFailure(invoice.id, `Uploading the PDF failed: ${upload.error}`);
    }

    const row = await post(config, {
      action: "LOG_TO_SHEET",
      invoiceSummary: {
        invoiceNo: invoice.invoiceNo,
        date: invoice.invoiceDate.toISOString().slice(0, 10),
        clientName: billToOf(invoice).name,
        grandTotal: Number(invoice.grandTotal),
        status: invoice.status,
      },
    });
    if (!row.success) {
      return recordFailure(invoice.id, `Updating the ledger sheet failed: ${row.error}`);
    }

    // Tidy up what an earlier sync left behind under another name or number.
    const plan = planDriveCleanup(
      { no: invoice.driveSyncedNo, year: invoice.driveSyncedYear, file: invoice.driveSyncedFile },
      { no: invoice.invoiceNo, year, file: filename },
    );
    const warnings: string[] = [];
    if (plan.trash) {
      const res = await post(config, {
        action: "TRASH_INVOICE_FILE",
        year: plan.trash.year,
        filename: plan.trash.file,
      });
      if (!res.success) warnings.push(`The old file ${plan.trash.file} could not be removed: ${res.error}`);
    }
    if (plan.deleteRowOf) {
      const res = await post(config, { action: "DELETE_INVOICE", invoiceNo: plan.deleteRowOf });
      if (!res.success) {
        warnings.push(`The old ledger row for ${plan.deleteRowOf} could not be removed: ${res.error}`);
      }
    }

    const now = new Date();
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        driveSyncedNo: invoice.invoiceNo,
        driveSyncedYear: year,
        driveSyncedFile: filename,
        driveSyncedAt: now,
        driveSyncError: null,
        // Same instant as the sync, so this update does not make the invoice look edited since.
        updatedAt: now,
      },
    });

    const warning = warnings.join(" ") || scriptVersionWarning(upload.version);
    return { success: true, message: "Synced to Google Drive", warning };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** After a save: does nothing when Drive is not set up, and records any failure on the invoice. */
export async function syncInvoiceInBackground(userId: number, invoiceId: number) {
  try {
    const settings = await prisma.companySettings.findFirst({
      where: { userId },
      select: { gdriveWebhookUrl: true },
    });
    if (!settings?.gdriveWebhookUrl) return;
    const result = await syncInvoiceToGDrive(invoiceId, userId);
    if (!result.success) console.error("[GDrive Sync] invoice", invoiceId, result.error);
  } catch (err) {
    console.error("[GDrive Sync] invoice", invoiceId, err);
  }
}

// ---------------------------------------------------------------------------
// Backup and bulk sync
// ---------------------------------------------------------------------------

export async function syncFullBackupToGDrive(
  userId: number,
  existingConfig?: WebhookConfig | null,
): Promise<GDriveSyncResult> {
  try {
    const config = existingConfig ?? (await getConfig(userId));
    if (!config) {
      return { success: false, error: "Google Drive is not set up. Add your Apps Script address in Settings." };
    }

    // No PDFs (the Prisma client leaves them out) and no Google Drive address or key.
    const [invoices, clients, payments, equipment, settings] = await Promise.all([
      prisma.invoice.findMany({ where: { userId }, include: { lineItems: true, client: true } }),
      prisma.client.findMany({ where: { userId } }),
      prisma.payment.findMany({ where: { userId } }),
      prisma.equipment.findMany({ where: { userId } }),
      prisma.companySettings.findFirst({ where: { userId } }),
    ]);

    const backup = {
      exportDate: new Date().toISOString(),
      app: "RKE GST Invoice Generator",
      counts: {
        invoices: invoices.length,
        clients: clients.length,
        payments: payments.length,
        equipment: equipment.length,
      },
      settings: settings
        ? { ...settings, gdriveWebhookUrl: undefined, gdriveWebhookSecret: undefined }
        : null,
      clients,
      invoices,
      payments,
      equipment,
    };

    return post(config, { action: "UPLOAD_DB_BACKUP", backupJson: JSON.stringify(backup, null, 2) });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Brings Drive up to date for the invoices that need it: never synced, last sync failed, or
 * edited since. Works through them a few at a time and stops before the host's time limit,
 * so a large account is finished by pressing the button again rather than timing out.
 */
export async function syncPendingInvoices(
  userId: number,
  budgetMs = 40_000,
): Promise<{
  success: boolean;
  error?: string;
  synced: number;
  failed: number;
  remaining: number;
  total: number;
  failures: string[];
}> {
  const empty = { synced: 0, failed: 0, remaining: 0, total: 0, failures: [] as string[] };
  const config = await getConfig(userId);
  if (!config) {
    return { ...empty, success: false, error: "Please save your Google Drive address in Settings first." };
  }

  const backup = await syncFullBackupToGDrive(userId, config);
  if (!backup.success) return { ...empty, success: false, error: backup.error };

  const all = await prisma.invoice.findMany({
    where: { userId },
    select: { id: true, invoiceNo: true, updatedAt: true, driveSyncedAt: true, driveSyncError: true },
    orderBy: { id: "asc" },
  });
  const pending = all.filter(
    (inv) => !inv.driveSyncedAt || inv.driveSyncError || inv.updatedAt > inv.driveSyncedAt,
  );

  const deadline = Date.now() + budgetMs;
  const queue = [...pending];
  let synced = 0;
  const failures: string[] = [];

  async function lane() {
    while (queue.length && Date.now() < deadline) {
      const inv = queue.shift();
      if (!inv) return;
      const result = await syncInvoiceToGDrive(inv.id, userId);
      if (result.success) synced++;
      else failures.push(`${inv.invoiceNo}: ${result.error}`);
    }
  }
  await Promise.all([lane(), lane(), lane()]);

  return {
    success: true,
    synced,
    failed: failures.length,
    remaining: queue.length,
    total: all.length,
    failures: failures.slice(0, 3),
  };
}

// ---------------------------------------------------------------------------
// Deleting
// ---------------------------------------------------------------------------

/** Removes a deleted invoice's PDF and ledger row, using the names recorded when it was synced. */
export async function deleteInvoiceFromGDrive(
  invoice: {
    invoiceNo: string;
    invoiceDate: Date;
    driveSyncedNo: string | null;
    driveSyncedYear: string | null;
    driveSyncedFile: string | null;
  },
  userId: number,
): Promise<GDriveSyncResult> {
  try {
    const config = await getConfig(userId);
    if (!config) return { success: true, message: "Google Drive is not set up, so there is nothing to remove." };

    const result = await post(config, {
      action: "DELETE_INVOICE",
      invoiceNo: invoice.driveSyncedNo ?? invoice.invoiceNo,
      year: invoice.driveSyncedYear ?? driveYear(invoice.invoiceDate),
      filename: invoice.driveSyncedFile ?? driveFileName(invoice.invoiceNo),
    });
    if (!result.success) return result;

    // Keep the backup file in step with what is left.
    await syncFullBackupToGDrive(userId, config);
    return { success: true, message: "Invoice removed from Google Drive" };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
