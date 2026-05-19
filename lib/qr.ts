import QRCode from "qrcode";

export async function generateQrPngDataUrl(value: string, opts?: { width?: number }) {
  return QRCode.toDataURL(value, {
    margin: 1,
    width: opts?.width ?? 256,
    errorCorrectionLevel: "M",
  });
}

