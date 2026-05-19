"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { createInvoice, updateInvoice } from "@/app/actions/invoices";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PdfActions } from "@/components/pdf/PdfActions";
import { UPIQRCode } from "@/components/qr/UPIQRCode";
import { XlsxActions } from "@/components/export/XlsxActions";
import { buildUpiDeepLink, calculateTotals, getTaxMode } from "@/lib/calculations";
import { DEFAULT_COMPANY_STATE } from "@/lib/defaults";

import { InvoiceForm } from "./InvoiceForm";
import { InvoicePreview, type CompanySettingsPreview } from "./InvoicePreview";
import type { InvoiceFormData } from "./types";
import { useInvoiceStore } from "./useInvoiceStore";

const LOCAL_SIGNATURE_KEY = "rke_invoice_signature_v1";
type InvoiceActionInput = Parameters<typeof updateInvoice>[0];

export function InvoiceEditor(props: {
  initialInvoice: InvoiceFormData;
  company: CompanySettingsPreview;
}) {
  const setInvoice = useInvoiceStore((s) => s.setInvoice);
  const invoice = useInvoiceStore((s) => s.invoice);
  const setSignature = useInvoiceStore((s) => s.setSignature);
  const [saving, startTransition] = useTransition();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

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
    startTransition(async () => {
      try {
        const payload: InvoiceActionInput = {
          ...invoice,
          lineItems: invoice.lineItems.map((li, idx) => ({
            ...li,
            sno: idx + 1,
            qty: Number(li.qty) || 0,
            rate: Number(li.rate) || 0,
          })),
          cgstRate: Number(invoice.cgstRate) || 0,
          sgstRate: Number(invoice.sgstRate) || 0,
          igstRate: Number(invoice.igstRate) || 0,
        };

        if (invoice.id) {
          await updateInvoice(payload);
          toast.success("Invoice updated");
        } else {
          await createInvoice(payload);
        }
      } catch (e) {
        toast.error("Failed to save invoice");
        console.error(e);
      }
    });
  };

  const qrPayload = useMemo(() => {
    const taxMode = getTaxMode(DEFAULT_COMPANY_STATE.stateCode, invoice.client.stateCode);
    const totals = calculateTotals({
      items: invoice.lineItems.map((li) => ({ qty: li.qty, rate: li.rate })),
      cgstRate: invoice.cgstRate,
      sgstRate: invoice.sgstRate,
      igstRate: invoice.igstRate,
      taxMode,
    });
    const company = props.company.companyName || "M/S RADHA KISHAN ENTERPRISES";
    const gstin = props.company.gstin || "09ABCFR1989E1ZX";
    const invoiceNo = invoice.invoiceNo || "";
    const date = invoice.invoiceDate || "";
    const billedTo = invoice.client.name || "";
    const totalAmount = totals.grandTotal.toFixed(2);

    return `COMPANY: ${company}
GSTIN: ${gstin}
Invoice No: ${invoiceNo}
Date: ${date}
Billed To: ${billedTo}
Total Amount: ₹${totalAmount}`;
  }, [
    props.company.companyName,
    props.company.gstin,
    invoice.invoiceNo,
    invoice.invoiceDate,
    invoice.client.name,
    invoice.client.stateCode,
    invoice.cgstRate,
    invoice.sgstRate,
    invoice.igstRate,
    invoice.lineItems,
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_480px]">
      <div className="min-w-0">
        <div className="mb-4 rounded-xl border bg-card p-4">
          <div className="text-sm font-medium">Exports</div>
          <div className="mt-3">
            <div className="flex flex-wrap gap-2">
              <PdfActions
                invoice={invoice}
                company={props.company}
                qrDataUrl={qrDataUrl}
              />
              <XlsxActions invoice={invoice} company={props.company} />
            </div>
          </div>
        </div>

        <InvoiceForm onSave={onSave} saving={saving} company={props.company} />
      </div>

      <div className="hidden lg:block">
        <div className="sticky top-6">
          <div className="mb-3 text-sm font-medium text-muted-foreground">
            Live Preview
          </div>
          <ScrollArea className="h-[calc(100vh-8rem)] rounded-xl">
            <div className="p-2">
              <InvoicePreview company={props.company} />
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Hidden QR renderer used to embed QR into the generated PDF */}
      {qrPayload ? (
        <div className="sr-only" aria-hidden>
          <UPIQRCode value={qrPayload} size={256} onDataUrl={setQrDataUrl} />
        </div>
      ) : null}
    </div>
  );
}
