"use server";

import { requireSessionUser } from "@/lib/auth";
import { scanInvoiceImage, type ScanEnv, type ScannedInvoice } from "@/lib/ocr";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

// The host caps a request at about 4.5 MB, and base64 makes a file a third bigger.
const MAX_BASE64_CHARS = 4_200_000;

export async function scanInvoiceAction(
  base64Data: string,
  mimeType: string,
): Promise<{ success: boolean; data?: ScannedInvoice; error?: string }> {
  try {
    await requireSessionUser();

    if (!ALLOWED_TYPES.has(mimeType)) {
      return { success: false, error: "That file type cannot be scanned. Use a JPEG, PNG or WebP picture, or a PDF." };
    }

    const base64 = base64Data.replace(/^data:[^;,]+;base64,/, "");
    if (!base64 || base64.length > MAX_BASE64_CHARS || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
      return { success: false, error: "That file is too large or could not be read. Try a smaller picture." };
    }

    const env: ScanEnv = {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      MISTRAL_API_KEY: process.env.MISTRAL_API_KEY,
      GEMINI_MODEL: process.env.GEMINI_MODEL,
      OPENAI_MODEL: process.env.OPENAI_MODEL,
      MISTRAL_MODEL: process.env.MISTRAL_MODEL,
    };
    return await scanInvoiceImage({ base64, mimeType, env });
  } catch (err) {
    console.error("AI scan error:", err);
    if (err instanceof Error && err.message === "Unauthorized") {
      return { success: false, error: "Please sign in again." };
    }
    return { success: false, error: "The scan could not be completed. Please try again." };
  }
}
