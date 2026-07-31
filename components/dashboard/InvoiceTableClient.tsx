"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import JSZip from "jszip";
import { pdf } from "@react-pdf/renderer";
import * as XLSX from "xlsx";
import { Download, FileSpreadsheet, MoreHorizontal, Package, Trash2, Search } from "lucide-react";
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

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const config = {
    DRAFT: { label: "Draft", className: "bg-muted text-muted-foreground" },
    SENT: { label: "Sent", className: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400" },
    PAID: { label: "Paid", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" },
    QUOTATION: { label: "Quotation", className: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400" },
  }[status] || { label: status, className: "bg-muted text-muted-foreground" };

  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", config.className)}>
      {config.label}
    </span>
  );
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
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search invoices..."
              className="h-9 w-64 pl-9"
            />
          </div>
          <Select
            value={status}
            onValueChange={(v) => {
              const next =
                v === "ALL" || v === "DRAFT" || v === "SENT" || v === "PAID" || v === "QUOTATION"
                  ? (v as "ALL" | InvoiceStatus)
                  : "ALL";
              setStatus(next);
            }}
          >
            <SelectTrigger className="h-9 w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="SENT">Sent</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="QUOTATION">Quotation</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 w-36"
            />
            <span className="text-xs">to</span>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 w-36"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <span className="text-xs font-medium text-primary mr-2">
              {selectedIds.length} selected
              {progress && ` (${progress.done}/${progress.total})`}
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={downloadZipPdfs}
            disabled={!selectedIds.length || busy !== null}
          >
            <Package className="mr-1.5 h-3.5 w-3.5" />
            ZIP
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={downloadMergedXlsx}
            disabled={!selectedIds.length || busy !== null}
          >
            <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
            XLSX
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-10">
                <Checkbox
                  checked={allChecked}
                  onCheckedChange={(v) => toggleAll(Boolean(v))}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead className="font-medium">Invoice</TableHead>
              <TableHead className="font-medium">Client</TableHead>
              <TableHead className="font-medium">Date</TableHead>
              <TableHead className="text-right font-medium">Amount</TableHead>
              <TableHead className="font-medium">Status</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.length ? (
              visibleRows.map((r) => (
                <TableRow key={r.id} className="group">
                  <TableCell>
                    <Checkbox
                      checked={Boolean(selected[r.id])}
                      onCheckedChange={(v) =>
                        setSelected((prev) => ({ ...prev, [r.id]: Boolean(v) }))
                      }
                      aria-label={`Select ${r.invoiceNo}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Link href={`/invoices/${r.id}`} className="font-medium text-primary hover:underline">
                      {r.invoiceNo}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[22rem] truncate text-sm">{r.clientName}</TableCell>
                  <TableCell className="text-sm tabular-nums text-muted-foreground">{r.invoiceDate}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatINR(r.amount)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Actions">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        }
                      />
                       <DropdownMenuContent align="end">
                        {r.pdfName ? (
                          <DropdownMenuItem onClick={() => window.open(`/api/invoices/${r.id}/download`, "_blank")}>
                            <Download className="h-4 w-4 mr-2" />
                            Download Saved PDF
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed">
                            <Download className="h-4 w-4 mr-2" />
                            No Saved PDF
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => downloadSinglePdf(r.id)}>
                          <Download className="h-4 w-4 mr-2" />
                          Render PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => downloadSingleXlsx(r.id)}>
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                          Download XLSX
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => removeInvoice(r.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                      <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="text-sm text-muted-foreground">No invoices found</div>
                    <Link
                      href="/invoices/new"
                      className={cn(buttonVariants({ variant: "default", size: "sm" }))}
                    >
                      Create your first invoice
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
