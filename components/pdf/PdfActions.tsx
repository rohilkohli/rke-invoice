"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { pdf } from "@react-pdf/renderer";

import { Button } from "@/components/ui/button";
import type { InvoiceFormData } from "@/components/invoice/types";
import type { CompanySettingsPreview } from "@/components/invoice/InvoicePreview";
import { InvoicePDF, type InvoiceCopy } from "@/components/pdf/InvoicePDF";

import { saveInvoicePdf } from "@/app/actions/invoices";

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
      
      const filename = `${filenameBase}-${copy}.pdf`;

      // Upload generated PDF file to the backend cloud database
      if (props.invoice.id) {
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const base64Data = (reader.result as string).split(",")[1];
            if (base64Data && props.invoice.id) {
              await saveInvoicePdf(props.invoice.id, filename, base64Data);
            }
          } catch (e) {
            console.error("Failed to upload generated PDF to backend:", e);
          }
        };
        reader.readAsDataURL(blob);
      }

      downloadBlob(blob, filename);
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

