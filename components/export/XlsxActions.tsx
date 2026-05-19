"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet } from "lucide-react";

import type { InvoiceFormData } from "@/components/invoice/types";
import type { CompanySettingsPreview } from "@/components/invoice/InvoicePreview";
import { buildInvoiceWorkbook, workbookToBlob } from "@/lib/export";
import { Button } from "@/components/ui/button";

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

export function XlsxActions(props: {
  invoice: InvoiceFormData;
  company: CompanySettingsPreview;
}) {
  const [loading, setLoading] = useState(false);

  const filename = useMemo(() => {
    const safe = (props.invoice.invoiceNo || "invoice").replace(/[^\w.-]+/g, "_");
    return `${safe}.xlsx`;
  }, [props.invoice.invoiceNo]);

  const download = async () => {
    setLoading(true);
    try {
      const wb = buildInvoiceWorkbook({ invoice: props.invoice, company: props.company });
      const blob = workbookToBlob(wb);
      downloadBlob(blob, filename);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button type="button" variant="secondary" onClick={download} disabled={loading}>
      <FileSpreadsheet className="mr-2 h-4 w-4" />
      {loading ? "Generating..." : "XLSX"}
    </Button>
  );
}

