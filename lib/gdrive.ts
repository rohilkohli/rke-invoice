import { prisma } from "@/lib/db";
import { generateInvoicePdfBase64Server } from "@/lib/generatePdfServer";

export interface GDriveSyncResult {
  success: boolean;
  message?: string;
  error?: string;
}

export async function postToGDriveWebhook(webhookUrl: string, payload: unknown): Promise<GDriveSyncResult> {
  if (!webhookUrl || !webhookUrl.startsWith("http")) {
    return { success: false, error: "Invalid Webhook URL" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    let response: Response;
    try {
      response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
          "Accept": "application/json, text/plain, */*",
        },
        body: JSON.stringify(payload),
        redirect: "follow",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok && response.status !== 200) {
      return {
        success: false,
        error: `Webhook returned HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const resText = await response.text();
    let resJson: { status?: string; error?: string; message?: string } = {};

    try {
      resJson = JSON.parse(resText);
    } catch {
      // Ignore if not JSON
    }

    if (resJson.status === "SUCCESS") {
      return { success: true, message: resJson.message || "Synced successfully to Google Drive" };
    } else {
      return { success: false, error: resJson.error || "Google Drive script returned an error" };
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const isTimeout = errorMessage.includes("abort") || errorMessage.includes("timeout");
    return {
      success: false,
      error: isTimeout
        ? "Google Drive Webhook timed out after 30 seconds. Check your Apps Script deployment."
        : `Failed to connect to Google Drive Webhook: ${errorMessage}`,
    };
  }
}

export async function testGDriveWebhook(webhookUrl: string): Promise<GDriveSyncResult> {
  return postToGDriveWebhook(webhookUrl, { action: "PING" });
}

export async function syncInvoiceToGDrive(invoiceId: number, overrideUrl?: string): Promise<GDriveSyncResult> {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { client: true, lineItems: true, signature: true },
    });

    if (!invoice) return { success: false, error: "Invoice not found" };

    let webhookUrl = overrideUrl;
    let company = null;
    if (invoice.userId) {
      company = await prisma.companySettings.findFirst({
        where: { userId: invoice.userId },
      });
      if (!webhookUrl) {
        webhookUrl = company?.gdriveWebhookUrl ?? undefined;
      }
    }

    if (!webhookUrl) {
      return { success: false, error: "Google Drive Webhook URL not configured" };
    }

    const year = new Date(invoice.invoiceDate).getFullYear().toString();
    const filename = invoice.pdfName || `${invoice.invoiceNo}.pdf`;
    
    // Clean base64 string if data URL prefix exists or auto-generate server-side
    let pdfBase64 = invoice.pdfData || "";
    if (pdfBase64.includes("base64,")) {
      pdfBase64 = pdfBase64.split("base64,")[1];
    }
    pdfBase64 = pdfBase64.trim().replace(/\s+/g, "");

    if (!pdfBase64) {
      try {
        console.log("[GDrive Sync] pdfData empty, generating server-side PDF for invoice", invoice.invoiceNo);
        const generated = await generateInvoicePdfBase64Server(invoice, company);
        pdfBase64 = generated.includes("base64,") ? generated.split("base64,")[1] : generated;
        pdfBase64 = pdfBase64.trim().replace(/\s+/g, "");

        if (pdfBase64) {
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: { pdfName: filename, pdfData: pdfBase64 },
          });
          console.log("[GDrive Sync] Server-side PDF generated and saved for", invoice.invoiceNo);
        } else {
          console.error("[GDrive Sync] Server-side PDF generation returned empty string for", invoice.invoiceNo);
          return { success: false, error: "PDF generation returned empty result" };
        }
      } catch (genErr) {
        const msg = genErr instanceof Error ? genErr.message : String(genErr);
        console.error("[GDrive Sync] Server-side PDF generation failed:", msg);
        return { success: false, error: `PDF generation failed: ${msg}` };
      }
    }

    // 1. Upload PDF file if available
    if (pdfBase64) {
      await postToGDriveWebhook(webhookUrl, {
        action: "UPLOAD_INVOICE_PDF",
        filename,
        year,
        pdfBase64,
      });
    }

    // 2. Log summary to Google Sheet Ledger
    const result = await postToGDriveWebhook(webhookUrl, {
      action: "LOG_TO_SHEET",
      invoiceSummary: {
        invoiceNo: invoice.invoiceNo,
        date: invoice.invoiceDate.toISOString().split("T")[0],
        clientName: invoice.client.name,
        grandTotal: Number(invoice.grandTotal),
        status: invoice.status,
      },
    });

    return result;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMessage };
  }
}

export async function syncFullBackupToGDrive(userId: number, overrideUrl?: string): Promise<GDriveSyncResult> {
  try {
    let webhookUrl = overrideUrl;
    if (!webhookUrl) {
      const settings = await prisma.companySettings.findFirst({
        where: { userId },
        select: { gdriveWebhookUrl: true },
      });
      webhookUrl = settings?.gdriveWebhookUrl ?? undefined;
    }

    if (!webhookUrl) {
      return { success: false, error: "Google Drive Webhook URL not configured" };
    }

    const [invoices, clients, payments, equipment, settings] = await Promise.all([
      prisma.invoice.findMany({ where: { userId }, include: { lineItems: true, client: true } }),
      prisma.client.findMany({ where: { userId } }),
      prisma.payment.findMany({ where: { userId } }),
      prisma.equipment.findMany({ where: { userId } }),
      prisma.companySettings.findFirst({ where: { userId } }),
    ]);

    const backupPayload = {
      exportDate: new Date().toISOString(),
      app: "RKE GST Invoice Generator",
      counts: {
        invoices: invoices.length,
        clients: clients.length,
        payments: payments.length,
        equipment: equipment.length,
      },
      settings,
      clients,
      invoices,
      payments,
      equipment,
    };

    return postToGDriveWebhook(webhookUrl, {
      action: "UPLOAD_DB_BACKUP",
      backupJson: JSON.stringify(backupPayload, null, 2),
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMessage };
  }
}

export async function deleteInvoiceFromGDrive(
  invoiceInfo: {
    invoiceNo: string;
    invoiceDate: Date;
    pdfName?: string | null;
  },
  userId: number
): Promise<GDriveSyncResult> {
  try {
    const settings = await prisma.companySettings.findFirst({
      where: { userId },
      select: { gdriveWebhookUrl: true },
    });

    const webhookUrl = settings?.gdriveWebhookUrl ?? undefined;
    if (!webhookUrl) return { success: false, error: "Webhook not configured" };

    const year = new Date(invoiceInfo.invoiceDate).getFullYear().toString();
    const filename = invoiceInfo.pdfName || `${invoiceInfo.invoiceNo}.pdf`;

    // 1. Send delete action to Google Apps Script
    await postToGDriveWebhook(webhookUrl, {
      action: "DELETE_INVOICE",
      invoiceNo: invoiceInfo.invoiceNo,
      year,
      filename,
    });

    // 2. Trigger full DB backup update to Google Drive
    await syncFullBackupToGDrive(userId, webhookUrl);

    return { success: true, message: "Invoice deleted from Google Drive" };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMessage };
  }
}

