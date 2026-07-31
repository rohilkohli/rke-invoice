"use server";

import type { InvoiceFormData } from "@/components/invoice/types";
import { requireSessionUser } from "@/lib/auth";

export async function scanInvoiceAction(
  base64Data: string,
  mimeType: string,
  modelType: "flash" | "pro" = "flash"
): Promise<{ success: boolean; data?: Partial<InvoiceFormData>; error?: string }> {
  try {
    await requireSessionUser();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { success: false, error: "GEMINI_API_KEY environment variable is not configured." };
    }

    // Strip out base64 header if present
    const base64Clean = base64Data
      .replace(/^data:image\/\w+;base64,/, "")
      .replace(/^data:application\/pdf;base64,/, "");

    const modelName = modelType === "pro" ? "gemini-1.5-pro-latest" : "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const prompt = `Extract invoice data from this image and return ONLY a valid JSON object matching the schema. Rules:
- invoiceDate must be YYYY-MM-DD
- stateCode: 2-digit string (e.g. "09" UP, "07" Delhi, "06" Haryana, "27" Maharashtra, "29" Karnataka)
- unit defaults to "Nos" if missing
- reverseCharge is a boolean
- Do not include markdown, commentary, or extra keys`.trim();

    // Define response schema to enforce structural integrity
    const responseSchema = {
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
    const generationConfig = {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
    };

    const payload = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Clean
              }
            }
          ]
        }
      ],
      generationConfig: generationConfig
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `Gemini API returned error code ${response.status}: ${errText}` };
    }

    const json = await response.json();
    const textResult = json.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textResult) {
      return { success: false, error: "Empty or invalid response structure returned by Gemini." };
    }

    const parsedData = JSON.parse(textResult);
    return { success: true, data: parsedData };
  } catch (err) {
    console.error("AI OCR parsing error:", err);
    const msg = err instanceof Error ? err.message : "An unexpected error occurred during AI scanning.";
    return { success: false, error: msg };
  }
}
