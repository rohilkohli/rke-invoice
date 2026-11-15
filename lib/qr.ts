import QRCode from "qrcode";

export async function generateQrPngDataUrl(value: string, opts?: { width?: number }) {
  return QRCode.toDataURL(value, {
    margin: 1,
    width: opts?.width ?? 256,
    errorCorrectionLevel: "M",
  });
}

/**
 * What the "Scan for Details" QR on every invoice PDF says. One builder, so the editor,
 * the dashboard downloads and the copy sent to Google Drive all print the same code.
 */
export function buildInvoiceQrText(params: {
  companyName: string;
  gstin: string;
  invoiceNo: string;
  invoiceDate: string;
  billedTo: string;
  grandTotal: number;
}): string {
  return [
    `COMPANY: ${params.companyName}`,
    `GSTIN: ${params.gstin}`,
    `Invoice No: ${params.invoiceNo}`,
    `Date: ${params.invoiceDate}`,
    `Billed To: ${params.billedTo}`,
    `Total Amount: ₹${params.grandTotal.toFixed(2)}`,
  ].join("\n");
}
