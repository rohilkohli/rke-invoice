"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { InvoiceFormData } from "@/components/invoice/types";
import type { CompanySettingsPreview } from "@/components/invoice/InvoicePreview";
import { InvoicePDF, type InvoiceCopy } from "@/components/pdf/InvoicePDF";

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

/**
 * Downloads the invoice as it is on screen, including edits not yet saved. Nothing is stored:
 * the copy that goes to Google Drive is always made fresh from the saved invoice.
 */
export function PdfActions(props: {
  invoice: InvoiceFormData;
  company: CompanySettingsPreview;
  qrDataUrl?: string | null;
}) {
  const [loading, setLoading] = useState<InvoiceCopy | null>(null);

  const filenameBase = useMemo(() => {
    const safe = (props.invoice.invoiceNo || "invoice").replace(/[^\w.-]+/g, "_");
    return safe;
  }, [props.invoice.invoiceNo]);

  const download = async (copy: InvoiceCopy) => {
    setLoading(copy);
    try {
      const blob = await pdf(
        <InvoicePDF
          invoice={props.invoice}
          company={props.company}
          copy={copy}
          qrDataUrl={props.qrDataUrl}
        />,
      ).toBlob();
      downloadBlob(blob, `${filenameBase}-${copy}.pdf`);
    } catch (e) {
      toast.error("Could not make the PDF. Please try again.");
      console.error(e);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="secondary"
        onClick={() => download("ORIGINAL")}
        disabled={Boolean(loading)}
      >
        <Download className="mr-2 h-4 w-4" />
        {loading === "ORIGINAL" ? "Generating..." : "Original"}
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={() => download("DUPLICATE")}
        disabled={Boolean(loading)}
      >
        <Download className="mr-2 h-4 w-4" />
        {loading === "DUPLICATE" ? "Generating..." : "Duplicate"}
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={() => download("TRIPLICATE")}
        disabled={Boolean(loading)}
      >
        <Download className="mr-2 h-4 w-4" />
        {loading === "TRIPLICATE" ? "Generating..." : "Triplicate"}
      </Button>
    </div>
  );
}
