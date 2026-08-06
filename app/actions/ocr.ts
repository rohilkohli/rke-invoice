"use server";

import type { InvoiceFormData } from "@/components/invoice/types";
import { requireSessionUser } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Shared invoice extraction schema / prompt
// ---------------------------------------------------------------------------
const INVOICE_PROMPT = `Extract invoice data from this image and return ONLY a valid JSON object matching the schema. Rules:
- invoiceDate must be YYYY-MM-DD
- stateCode: 2-digit string (e.g. "09" UP, "07" Delhi, "06" Haryana, "27" Maharashtra, "29" Karnataka)
- unit defaults to "Nos" if missing
- reverseCharge is a boolean
- Do not include markdown, commentary, or extra keys`.trim();

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    invoiceNo: { type: "STRING", description: "The invoice number, e.g. RKE-2026-001" },
    invoiceDate: { type: "STRING", description: "The date of the invoice in YYYY-MM-DD format" },
    poNo: { type: "STRING", description: "The Purchase Order (PO) number if present" },
    billPeriodStart: { type: "STRING", description: "Bill period start date in YYYY-MM-DD format if present" },
    billPeriodEnd: { type: "STRING", description: "Bill period end date in YYYY-MM-DD format if present" },
    state: { type: "STRING", description: "The state of the receiver/client (e.g. Haryana, Delhi, Karnataka)" },
    stateCode: { type: "STRING", description: "The numeric state code of the receiver/client (e.g. 06 for Haryana, 07 for Delhi, 29 for Karnataka)" },
    transportMode: { type: "STRING", description: "Transport mode, e.g. Road, Rail, Air if present" },
    vehicleNo: { type: "STRING", description: "Vehicle number if present" },
    placeOfSupply: { type: "STRING", description: "Place of supply state if present" },
    reverseCharge: { type: "BOOLEAN", description: "Whether reverse charge is applicable (true or false)" },
    client: {
      type: "OBJECT",
      properties: {
        name: { type: "STRING", description: "Name of the client/receiver corporation" },
        address: { type: "STRING", description: "Full billing address of the client" },
        gstin: { type: "STRING", description: "15-character GSTIN of the client" },
        state: { type: "STRING", description: "State name of the client" },
        stateCode: { type: "STRING", description: "Numeric state code of the client (2 digits)" },
        shipToName: { type: "STRING", description: "Name of the consignee (ship to) if present" },
        shipToAddress: { type: "STRING", description: "Full shipping address of the consignee if present" }
      },
      required: ["name", "address", "gstin", "state", "stateCode"]
    },
    lineItems: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          sno: { type: "INTEGER", description: "Line item serial number starting from 1" },
          description: { type: "STRING", description: "Detailed description of the goods or services" },
          hsnSac: { type: "STRING", description: "HSN/SAC code of the item" },
          unit: { type: "STRING", description: "Unit of measurement, e.g. Nos, Kgs, Bags, Mtr (default to 'Nos')" },
          qty: { type: "NUMBER", description: "Quantity" },
          rate: { type: "NUMBER", description: "Rate/Price per unit in INR" }
        },
        required: ["sno", "description", "unit", "qty", "rate"]
      }
    }
  },
  required: ["invoiceNo", "invoiceDate", "state", "stateCode", "reverseCharge", "client", "lineItems"]
};

// ---------------------------------------------------------------------------
// Provider: Gemini (gemini-2.0-flash — 1,500 req/day free tier)
// ---------------------------------------------------------------------------
async function scanWithGemini(
  base64Clean: string,
  mimeType: string,
  apiKey: string
): Promise<{ success: boolean; data?: Partial<InvoiceFormData>; error?: string; quotaExceeded?: boolean }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: INVOICE_PROMPT },
          { inlineData: { mimeType, data: base64Clean } }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    if (response.status === 429) {
      return { success: false, error: "Gemini quota exceeded", quotaExceeded: true };
    }
    const errText = await response.text();
    return { success: false, error: `Gemini API error ${response.status}: ${errText}` };
  }

  const json = await response.json();
  const textResult = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textResult) {
    return { success: false, error: "Empty response from Gemini." };
  }

  return { success: true, data: JSON.parse(textResult) };
}

// ---------------------------------------------------------------------------
// Provider: OpenAI (gpt-4o-mini — requires paid credits, ~$0.001/scan)
// ---------------------------------------------------------------------------
async function scanWithOpenAI(
  base64Clean: string,
  mimeType: string,
  apiKey: string
): Promise<{ success: boolean; data?: Partial<InvoiceFormData>; error?: string }> {
  const dataUrl = `data:${mimeType};base64,${base64Clean}`;

  const payload = {
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: INVOICE_PROMPT + "\n\nReturn ONLY the raw JSON — no markdown fences." },
          { type: "image_url", image_url: { url: dataUrl } }
        ]
      }
    ],
    response_format: { type: "json_object" },
    max_tokens: 2000,
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    return { success: false, error: `OpenAI API error ${response.status}: ${errText}` };
  }

  const json = await response.json();
  const textResult = json.choices?.[0]?.message?.content;
  if (!textResult) {
    return { success: false, error: "Empty response from OpenAI." };
  }

  return { success: true, data: JSON.parse(textResult) };
}

// ---------------------------------------------------------------------------
// Provider: Mistral (pixtral-12b — FREE tier, no credit card required)
//   Sign up: https://console.mistral.ai → API Keys
// ---------------------------------------------------------------------------
async function scanWithMistral(
  base64Clean: string,
  mimeType: string,
  apiKey: string
): Promise<{ success: boolean; data?: Partial<InvoiceFormData>; error?: string }> {
  const dataUrl = `data:${mimeType};base64,${base64Clean}`;

  const payload = {
    model: "pixtral-12b-2409",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: INVOICE_PROMPT + "\n\nReturn ONLY the raw JSON object — no markdown fences, no extra text." },
          { type: "image_url", image_url: { url: dataUrl } }
        ]
      }
    ],
    response_format: { type: "json_object" },
    max_tokens: 2000,
  };

  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    return { success: false, error: `Mistral API error ${response.status}: ${errText}` };
  }

  const json = await response.json();
  const textResult = json.choices?.[0]?.message?.content;
  if (!textResult) {
    return { success: false, error: "Empty response from Mistral." };
  }

  return { success: true, data: JSON.parse(textResult) };
}

// ---------------------------------------------------------------------------
// Main server action — Gemini → OpenAI → Mistral (tries each in order)
// ---------------------------------------------------------------------------
export async function scanInvoiceAction(
  base64Data: string,
  mimeType: string,
  modelType: "flash" | "pro" = "flash"
): Promise<{ success: boolean; data?: Partial<InvoiceFormData>; error?: string }> {
  void modelType; // kept for API compatibility — provider selected by env key availability

  try {
    await requireSessionUser();

    // Strip out base64 header if present
    const base64Clean = base64Data
      .replace(/^data:image\/\w+;base64,/, "")
      .replace(/^data:application\/pdf;base64,/, "");

    const geminiKey  = process.env.GEMINI_API_KEY;
    const openaiKey  = process.env.OPENAI_API_KEY;
    const mistralKey = process.env.MISTRAL_API_KEY;

    if (!geminiKey && !openaiKey && !mistralKey) {
      return {
        success: false,
        error: "No AI API key configured. Set GEMINI_API_KEY, OPENAI_API_KEY, or MISTRAL_API_KEY."
      };
    }

    // 1️⃣ Try Gemini first (gemini-2.0-flash — 1,500 req/day free)
    if (geminiKey) {
      console.log("[OCR] Trying Gemini gemini-2.0-flash...");
      const result = await scanWithGemini(base64Clean, mimeType, geminiKey);
      if (result.success) { console.log("[OCR] Gemini succeeded."); return result; }
      console.warn("[OCR] Gemini failed:", result.error);
    }

    // 2️⃣ Fallback: OpenAI gpt-4o-mini (paid credits required)
    if (openaiKey) {
      console.log("[OCR] Trying OpenAI gpt-4o-mini...");
      const result = await scanWithOpenAI(base64Clean, mimeType, openaiKey);
      if (result.success) { console.log("[OCR] OpenAI succeeded."); return result; }
      console.warn("[OCR] OpenAI failed:", result.error);
    }

    // 3️⃣ Fallback: Mistral pixtral-12b (free tier — no credit card needed)
    if (mistralKey) {
      console.log("[OCR] Trying Mistral pixtral-12b...");
      const result = await scanWithMistral(base64Clean, mimeType, mistralKey);
      if (result.success) { console.log("[OCR] Mistral succeeded."); return result; }
      console.warn("[OCR] Mistral failed:", result.error);
      return result;
    }

    return {
      success: false,
      error: "All configured AI providers failed or quota is exhausted. Check Vercel logs for details."
    };

  } catch (err) {
    console.error("AI OCR parsing error:", err);
    const msg = err instanceof Error ? err.message : "An unexpected error occurred during AI scanning.";
    return { success: false, error: msg };
  }
}
