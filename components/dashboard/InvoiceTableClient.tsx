"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import JSZip from "jszip";
import { pdf } from "@react-pdf/renderer";
import * as XLSX from "xlsx";
import { Download, FileSpreadsheet, MoreHorizontal, Package, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { InvoiceStatus } from "@/components/invoice/types";
import type { CompanySettingsPreview } from "@/components/invoice/InvoicePreview";
import type { InvoiceFormData } from "@/components/invoice/types";
import { InvoicePDF } from "@/components/pdf/InvoicePDF";
import { buildUpiDeepLink, calculateTotals, getTaxMode } from "@/lib/calculations";
import { DEFAULT_COMPANY_STATE } from "@/lib/defaults";
import { generateQrPngDataUrl } from "@/lib/qr";
import { buildInvoiceSheet, workbookToBlob } from "@/lib/export";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteInvoice } from "@/app/actions/invoices";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type InvoiceRow = {
  id: number;
  invoiceNo: string;
  clientName: string;
  invoiceDate: string;
  amount: number;
  status: InvoiceStatus;
  pdfName?: string | null;
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function InvoiceTableClient(props: {
  rows: InvoiceRow[];
  company: CompanySettingsPreview;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState<null | "zip" | "xlsx">(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"ALL" | InvoiceStatus>("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const visibleRows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return props.rows.filter((r) => {
      if (status !== "ALL" && r.status !== status) return false;
      if (from && r.invoiceDate < from) return false;
      if (to && r.invoiceDate > to) return false;
      if (!query) return true;
      return (
        r.invoiceNo.toLowerCase().includes(query) ||
        r.clientName.toLowerCase().includes(query)
      );
    });
  }, [props.rows, q, status, from, to]);

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((k) => selected[Number(k)]).map(Number),
    [selected],
  );

  const allChecked =
    visibleRows.length > 0 && visibleRows.every((r) => Boolean(selected[r.id]));

  const toggleAll = (checked: boolean) => {
    setSelected((prev) => {
      const next = { ...prev };
      for (const r of visibleRows) {
        if (checked) next[r.id] = true;
        else delete next[r.id];
      }
      return next;
    });
  };

  const fetchExportDataFor = async (ids: number[]) => {
    const res = await fetch("/api/export/invoices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error("Failed to fetch export data");
    return (await res.json()) as {
      company: CompanySettingsPreview;
      invoices: InvoiceFormData[];
    };
  };

  const downloadZipPdfs = async () => {
    setBusy("zip");
    setProgress({ done: 0, total: selectedIds.length });
    try {
      const { company, invoices } = await fetchExportDataFor(selectedIds);
      const zip = new JSZip();

      for (let i = 0; i < invoices.length; i++) {
        const inv = invoices[i]!;
        const taxMode = getTaxMode(DEFAULT_COMPANY_STATE.stateCode, inv.client.stateCode);
        const totals = calculateTotals({
          items: inv.lineItems.map((li) => ({ qty: li.qty, rate: li.rate })),
          cgstRate: inv.cgstRate,
          sgstRate: inv.sgstRate,
          igstRate: inv.igstRate,
          taxMode,
        });

        const upiUrl =
          company.upiId && inv.invoiceNo
            ? buildUpiDeepLink({
                pa: company.upiId,
                pn: company.companyName,
                amount: totals.grandTotal,
                invoiceNo: inv.invoiceNo,
              })
            : "";
        const qrDataUrl = upiUrl ? await generateQrPngDataUrl(upiUrl, { width: 256 }) : null;

        const blob = await pdf(
          <InvoicePDF
            invoice={inv}
            company={company}
            copy="ORIGINAL"
            qrDataUrl={qrDataUrl}
          />,
        ).toBlob();

        const safe = (inv.invoiceNo || `invoice-${inv.id}`).replace(/[^\w.-]+/g, "_");
        zip.file(`${safe}-ORIGINAL.pdf`, await blob.arrayBuffer());
        setProgress({ done: i + 1, total: invoices.length });
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadBlob(zipBlob, `invoices-${new Date().toISOString().slice(0, 10)}.zip`);
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const downloadMergedXlsx = async () => {
    setBusy("xlsx");
    try {
      const { company, invoices } = await fetchExportDataFor(selectedIds);
      const wb = XLSX.utils.book_new();

      for (const inv of invoices) {
        const sheet = buildInvoiceSheet({ invoice: inv, company });
        const nameRaw = inv.invoiceNo || `INV-${inv.id}`;
        const name = nameRaw.replace(/[\\/*?:\\[\\]]/g, "-").slice(0, 31);
        XLSX.utils.book_append_sheet(wb, sheet, name);
      }

      const blob = workbookToBlob(wb);
      downloadBlob(blob, `invoices-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      setBusy(null);
    }
  };

  const downloadSinglePdf = async (invoiceId: number) => {
    try {
      const { company, invoices } = await fetchExportDataFor([invoiceId]);
      const inv = invoices[0];
      if (!inv) return;

      const taxMode = getTaxMode(DEFAULT_COMPANY_STATE.stateCode, inv.client.stateCode);
      const totals = calculateTotals({
        items: inv.lineItems.map((li) => ({ qty: li.qty, rate: li.rate })),
        cgstRate: inv.cgstRate,
        sgstRate: inv.sgstRate,
        igstRate: inv.igstRate,
        taxMode,
      });

      const upiUrl =
        company.upiId && inv.invoiceNo
          ? buildUpiDeepLink({
              pa: company.upiId,
              pn: company.companyName,
              amount: totals.grandTotal,
              invoiceNo: inv.invoiceNo,
            })
          : "";
      const qrDataUrl = upiUrl ? await generateQrPngDataUrl(upiUrl, { width: 256 }) : null;

      const blob = await pdf(
        <InvoicePDF invoice={inv} company={company} copy="ORIGINAL" qrDataUrl={qrDataUrl} />,
      ).toBlob();
      const safe = (inv.invoiceNo || `invoice-${inv.id}`).replace(/[^\w.-]+/g, "_");
      downloadBlob(blob, `${safe}-ORIGINAL.pdf`);
    } catch (e) {
      toast.error("Failed to download PDF");
      console.error(e);
    }
  };

  const downloadSingleXlsx = async (invoiceId: number) => {
    try {
      const { company, invoices } = await fetchExportDataFor([invoiceId]);
      const inv = invoices[0];
      if (!inv) return;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, buildInvoiceSheet({ invoice: inv, company }), "Invoice");
      const blob = workbookToBlob(wb);
      const safe = (inv.invoiceNo || `invoice-${inv.id}`).replace(/[^\w.-]+/g, "_");
      downloadBlob(blob, `${safe}.xlsx`);
    } catch (e) {
      toast.error("Failed to download XLSX");
      console.error(e);
    }
  };

  const removeInvoice = async (invoiceId: number) => {
    if (!confirm("Delete this invoice? This cannot be undone.")) return;
    try {
      await deleteInvoice(invoiceId);
      toast.success("Invoice deleted");
      router.refresh();
    } catch (e) {
      toast.error("Failed to delete invoice");
      console.error(e);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {selectedIds.length ? (
            <span className="font-medium text-foreground">
              {selectedIds.length} selected
            </span>
          ) : (
            "Select invoices for bulk export"
          )}
          {progress ? (
            <span className="ml-2">
              ({progress.done}/{progress.total})
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={downloadZipPdfs}
            disabled={!selectedIds.length || busy !== null}
          >
            <Package className="mr-2 h-4 w-4" />
            ZIP PDFs
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={downloadMergedXlsx}
            disabled={!selectedIds.length || busy !== null}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Merged XLSX
          </Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search invoice or client..."
            className="h-8 w-64"
          />
          <Select
            value={status}
            onValueChange={(v) => {
              const next =
                v === "ALL" || v === "DRAFT" || v === "SENT" || v === "PAID"
                  ? (v as "ALL" | InvoiceStatus)
                  : "ALL";
              setStatus(next);
            }}
          >
            <SelectTrigger className="h-8 w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="SENT">Sent</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>From</span>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-8 w-40"
            />
            <span>To</span>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-8 w-40"
            />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allChecked}
                  onCheckedChange={(v) => toggleAll(Boolean(v))}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Invoice No.</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.length ? (
              visibleRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Checkbox
                      checked={Boolean(selected[r.id])}
                      onCheckedChange={(v) =>
                        setSelected((prev) => ({ ...prev, [r.id]: Boolean(v) }))
                      }
                      aria-label={`Select ${r.invoiceNo}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{r.invoiceNo}</TableCell>
                  <TableCell className="max-w-[22rem] truncate">{r.clientName}</TableCell>
                  <TableCell>{r.invoiceDate}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatINR(r.amount)}
                  </TableCell>
                  <TableCell>{r.status}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/invoices/${r.id}`}
                        className={cn(
                          buttonVariants({ variant: "secondary", size: "sm" }),
                        )}
                      >
                        Open
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon" aria-label="Actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          {r.pdfName ? (
                            <DropdownMenuItem onSelect={() => window.open(`/api/invoices/${r.id}/download`, "_blank")}>
                              <Download className="h-4 w-4 mr-2" />
                              Download Cloud PDF
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed">
                              <Download className="h-4 w-4 mr-2" />
                              No Cloud PDF Stored
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onSelect={() => downloadSinglePdf(r.id)}>
                            <Download className="h-4 w-4 mr-2" />
                            Render & Download PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => downloadSingleXlsx(r.id)}>
                            <FileSpreadsheet className="h-4 w-4 mr-2" />
                            Download XLSX
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => removeInvoice(r.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center">
                  <div className="text-sm text-muted-foreground">No invoices found.</div>
                  <div className="mt-4">
                    <Link
                      href="/invoices/new"
                      className={cn(buttonVariants({ variant: "default" }))}
                    >
                      Create Invoice
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
