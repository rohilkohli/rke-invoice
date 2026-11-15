"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Cloud, Loader2 } from "lucide-react";

import { createInvoice, updateInvoice } from "@/app/actions/invoices";
import { syncSingleInvoiceAction } from "@/app/actions/gdrive";
import { PdfActions } from "@/components/pdf/PdfActions";
import { XlsxActions } from "@/components/export/XlsxActions";
import { calculateInvoiceTotals, lineAmount } from "@/lib/calculations";
import { buildInvoiceQrText, generateQrPngDataUrl } from "@/lib/qr";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

import { InvoiceForm } from "./InvoiceForm";
import { InvoicePreview, type CompanySettingsPreview } from "./InvoicePreview";
import type { DriveStatus, InvoiceFormData, SavedClient } from "./types";
import { findInvoiceProblem, isBlankLine } from "./validation";
import { useInvoiceStore } from "./useInvoiceStore";

const LOCAL_SIGNATURE_KEY = "rke_invoice_signature_v1";
type InvoiceActionInput = Parameters<typeof updateInvoice>[0];

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function InvoiceEditor(props: {
  initialInvoice: InvoiceFormData;
  company: CompanySettingsPreview;
  clients: SavedClient[];
  drive: DriveStatus;
}) {
  const router = useRouter();
  const setInvoice = useInvoiceStore((s) => s.setInvoice);
  const invoice = useInvoiceStore((s) => s.invoice);
  const setSignature = useInvoiceStore((s) => s.setSignature);
  const [saving, startTransition] = useTransition();
  const [syncingDrive, startDriveTransition] = useTransition();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  // What the last manual "Sync to Drive" found, for the invoice it was run on.
  const [driveResult, setDriveResult] = useState<{ id: number; status: DriveStatus } | null>(null);
  const drive = driveResult && driveResult.id === invoice.id ? driveResult.status : props.drive;

  const onSyncDrive = () => {
    const invoiceId = invoice.id;
    if (!invoiceId) return;
    startDriveTransition(async () => {
      try {
        const res = await syncSingleInvoiceAction(invoiceId);
        setDriveResult({
          id: invoiceId,
          status: {
            enabled: true,
            syncedAt: res.success ? new Date().toISOString() : props.drive.syncedAt,
            error: res.success ? null : (res.error ?? "Sync failed"),
          },
        });
        if (res.success) {
          toast.success(res.message || "Synced to Google Drive");
          if (res.warning) toast.warning(res.warning, { duration: 12000 });
        } else {
          toast.error(res.error || "Failed to sync to Google Drive");
        }
      } catch (err) {
        toast.error("Failed to sync to Google Drive");
        console.error(err);
      }
    });
  };

  useEffect(() => {
    setInvoice(props.initialInvoice);

    if (!props.initialInvoice.id) {
      try {
        const raw = localStorage.getItem(LOCAL_SIGNATURE_KEY);
        if (raw) setSignature(JSON.parse(raw));
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.initialInvoice.id]);

  useEffect(() => {
    if (invoice.signature?.dataUrl) {
      localStorage.setItem(LOCAL_SIGNATURE_KEY, JSON.stringify(invoice.signature));
    }
  }, [invoice.signature]);

  const onSave = () => {
    const problem = findInvoiceProblem(invoice);
    if (problem) {
      toast.error(problem);
      return;
    }

    startTransition(async () => {
      try {
        // An unfinished draft does not keep empty rows, but always keeps at least one.
        const nonBlank = invoice.lineItems.filter((li) => !isBlankLine(li));
        const rows =
          invoice.status === "DRAFT" && nonBlank.length ? nonBlank : invoice.lineItems;

        const payload: InvoiceActionInput = {
          ...invoice,
          invoiceNo: invoice.invoiceNo.trim(),
          lineItems: rows.map((li, idx) => ({
            ...li,
            sno: idx + 1,
            // Sent as typed; only the amount is a number.
            unit: li.unit.trim(),
            qty: li.qty.trim(),
            rate: li.rate.trim(),
            amount: lineAmount(li.amount),
          })),
          cgstRate: Number(invoice.cgstRate) || 0,
          sgstRate: Number(invoice.sgstRate) || 0,
          igstRate: Number(invoice.igstRate) || 0,
        };

        if (invoice.id) {
          const res = await updateInvoice(payload);
          if (res.ok) {
            toast.success("Invoice updated successfully");
          } else {
            toast.error(res.error);
          }
        } else {
          const res = await createInvoice(payload);
          if (res.success) {
            toast.success("Invoice created successfully");
            router.push(`/invoices/${res.id}`);
          } else {
            toast.error(res.error);
          }
        }
      } catch (e) {
        toast.error("Failed to save invoice");
        console.error(e);
      }
    });
  };

  // One QR text, built the same way as for the PDFs made on the server.
  const grandTotal = useMemo(
    () =>
      calculateInvoiceTotals({
        lineItems: invoice.lineItems,
        cgstRate: invoice.cgstRate,
        sgstRate: invoice.sgstRate,
        igstRate: invoice.igstRate,
        company: props.company,
        client: invoice.client,
      }).grandTotal,
    [invoice.lineItems, invoice.cgstRate, invoice.sgstRate, invoice.igstRate, invoice.client, props.company],
  );

  const qrText = useMemo(
    () =>
      buildInvoiceQrText({
        companyName: props.company.companyName,
        gstin: props.company.gstin,
        invoiceNo: invoice.invoiceNo,
        invoiceDate: invoice.invoiceDate,
        billedTo: invoice.client.name,
        grandTotal,
      }),
    [props.company.companyName, props.company.gstin, invoice.invoiceNo, invoice.invoiceDate, invoice.client.name, grandTotal],
  );

  useEffect(() => {
    let cancelled = false;
    generateQrPngDataUrl(qrText, { width: 256 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [qrText]);

  return (
    <div className={`grid gap-6 ${showPreview ? "lg:grid-cols-[1fr_640px]" : "grid-cols-1"}`}>
      <div className="min-w-0">
        {/* Export & Preview Controls */}
        <div className="mb-5 rounded-xl border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Export Options</div>
            <div className="flex flex-wrap gap-2">
              <PdfActions
                invoice={invoice}
                company={props.company}
                qrDataUrl={qrDataUrl}
              />
              <XlsxActions invoice={invoice} company={props.company} />
              {drive.enabled && invoice.id ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={syncingDrive}
                  onClick={onSyncDrive}
                >
                  {syncingDrive ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Cloud className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Sync to Drive
                </Button>
              ) : null}
            </div>
            {drive.enabled && invoice.id ? (
              <p
                className={`mt-2 text-xs ${drive.error ? "text-destructive" : "text-muted-foreground"}`}
                data-testid="drive-status"
              >
                {drive.error
                  ? `Last Drive sync failed: ${drive.error}`
                  : drive.syncedAt
                    ? `Last synced to Drive ${formatWhen(drive.syncedAt)}`
                    : "Not synced to Drive yet. It syncs each time you save."}
              </p>
            ) : null}
          </div>

          <div className="hidden lg:flex items-center gap-3 border-l border-border pl-4">
            <Switch
              id="show-preview"
              checked={showPreview}
              onCheckedChange={setShowPreview}
            />
            <Label htmlFor="show-preview" className="text-sm font-medium cursor-pointer">
              Live Preview
            </Label>
          </div>
        </div>

        <InvoiceForm
          onSave={onSave}
          saving={saving}
          company={props.company}
          clients={props.clients}
        />
      </div>

      {showPreview && (
        <div className="hidden lg:block">
          <div className="sticky top-20">
            <div className="mb-2 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-muted-foreground">Live Preview</span>
            </div>
            <div className="rounded-xl border border-border bg-slate-200/60 dark:bg-neutral-950 p-2 shadow-sm">
              <InvoicePreview company={props.company} qrDataUrl={qrDataUrl} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
