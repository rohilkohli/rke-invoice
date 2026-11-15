import { parseAmount } from "@/lib/calculations";

// ---------------------------------------------------------------------------
// What a scan returns
// ---------------------------------------------------------------------------

export type ScannedLineItem = {
  sno?: number;
  description?: string;
  hsnSac?: string;
  unit?: string;
  qty?: string;
  rate?: string;
  amount?: number;
};

export type ScannedInvoice = {
  invoiceNo?: string;
  invoiceDate?: string;
  poNo?: string;
  billPeriodStart?: string;
  billPeriodEnd?: string;
  state?: string;
  stateCode?: string;
  transportMode?: string;
  vehicleNo?: string;
  placeOfSupply?: string;
  reverseCharge?: boolean;
  client?: {
    name?: string;
    address?: string;
    gstin?: string;
    state?: string;
    stateCode?: string;
    shipToName?: string;
    shipToAddress?: string;
  };
  lineItems?: ScannedLineItem[];
};

export type ScanOutcome =
  | { success: true; data: ScannedInvoice }
  | { success: false; error: string };

/** Environment values the scan reads. Models can be changed without a code change. */
export type ScanEnv = {
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  MISTRAL_API_KEY?: string;
  GEMINI_MODEL?: string;
  OPENAI_MODEL?: string;
  MISTRAL_MODEL?: string;
};

/**
 * Starting points only. Providers retire models, so each can be overridden with GEMINI_MODEL,
 * OPENAI_MODEL or MISTRAL_MODEL, and a retired model produces an error that says so.
 */
export const DEFAULT_MODELS = {
  gemini: "gemini-flash-latest",
  openai: "gpt-5-mini",
  mistral: "ministral-14b-2512",
} as const;

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

// Used by Gemini (field names enforced via responseSchema — prompt is brief)
const INVOICE_PROMPT = `Extract invoice data from this image and return ONLY a valid JSON object matching the schema. Rules:
- invoiceDate must be YYYY-MM-DD
- stateCode: 2-digit string (e.g. "09" UP, "07" Delhi, "06" Haryana, "27" Maharashtra, "29" Karnataka)
- unit, qty and rate are copied exactly as printed (they may contain words, e.g. "26 Days"); use "" if not printed
- amount is the line amount exactly as printed; never calculate it
- reverseCharge is a boolean
- Do not include markdown, commentary, or extra keys`.trim();

// Used by OpenAI and Mistral — must spell out exact field names since no responseSchema
const CHAT_PROMPT = `You are an invoice data extraction assistant.
Extract data from this invoice image and return ONLY a raw JSON object — no markdown, no explanation.

Use EXACTLY these field names (camelCase):
{
  "invoiceNo": "string — the invoice number",
  "invoiceDate": "string — date in YYYY-MM-DD format",
  "poNo": "string or null — Purchase Order number if present",
  "billPeriodStart": "string or null — bill period start in YYYY-MM-DD",
  "billPeriodEnd": "string or null — bill period end in YYYY-MM-DD",
  "state": "string — state name of the receiver/client",
  "stateCode": "string — 2-digit numeric state code (e.g. '27' Maharashtra, '09' UP, '07' Delhi, '06' Haryana, '29' Karnataka)",
  "transportMode": "string or null — e.g. Road, Rail, Air",
  "vehicleNo": "string or null — vehicle number if present",
  "placeOfSupply": "string or null — place of supply state",
  "reverseCharge": "boolean — true or false",
  "client": {
    "name": "string — client company name",
    "address": "string — full billing address",
    "gstin": "string — 15-character GSTIN",
    "state": "string — client state name",
    "stateCode": "string — 2-digit client state code",
    "shipToName": "string or null — consignee name if different from client",
    "shipToAddress": "string or null — shipping address if different"
  },
  "lineItems": [
    {
      "sno": "integer — serial number starting from 1",
      "description": "string — item description",
      "hsnSac": "string or null — HSN/SAC code",
      "unit": "string — unit of measurement exactly as printed, or empty string",
      "qty": "string — quantity exactly as printed (may contain words, e.g. '26 Days'), or empty string",
      "rate": "string — rate exactly as printed, or empty string",
      "amount": "number or null — the line amount exactly as printed; never calculate it"
    }
  ]
}

Rules:
- ALL keys must use camelCase exactly as shown above
- invoiceDate, billPeriodStart, billPeriodEnd must be YYYY-MM-DD
- stateCode must be a 2-digit string like "27", not an integer
- reverseCharge must be a boolean (true/false), not a string
- Return null for fields not found in the invoice
- Do NOT include extra keys, markdown, or any surrounding text`.trim();

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
          unit: { type: "STRING", description: "Unit of measurement exactly as printed, e.g. Nos, Hrs, Month; empty string if not printed" },
          qty: { type: "STRING", description: "Quantity exactly as printed (may contain words, e.g. '26 Days'); empty string if not printed" },
          rate: { type: "STRING", description: "Rate exactly as printed; empty string if not printed" },
          amount: { type: "NUMBER", description: "Line amount in INR exactly as printed on the invoice. Never calculate it." }
        },
        required: ["sno", "description"]
      }
    }
  },
  required: ["invoiceNo", "invoiceDate", "state", "stateCode", "reverseCharge", "client", "lineItems"]
};

// ---------------------------------------------------------------------------
// Checking what the model sent back. It is untrusted text: only fields of the right shape
// and a sensible size get through, and everything else is dropped.
// ---------------------------------------------------------------------------

const text = (value: unknown, max = 500): string | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return undefined;
  return value.trim().slice(0, max) || undefined;
};

const isoDate = (value: unknown): string | undefined => {
  const t = text(value, 10);
  return t && /^\d{4}-\d{2}-\d{2}$/.test(t) && !Number.isNaN(new Date(t).getTime()) ? t : undefined;
};

const stateCode = (value: unknown): string | undefined => {
  const t = text(value, 4);
  return t && /^\d{1,2}$/.test(t) ? t.padStart(2, "0") : undefined;
};

const flag = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : value === "true" ? true : value === "false" ? false : undefined;

const money = (value: unknown): number | undefined => {
  const n = typeof value === "number" ? value : parseAmount(typeof value === "string" ? value : "");
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const MAX_LINES = 100;

/** The model's answer, reduced to what is safe to put in the form; null if it is not an invoice at all. */
export function normalizeScan(raw: unknown): ScannedInvoice | null {
  if (!isObject(raw)) return null;

  const lineItems: ScannedLineItem[] = [];
  if (Array.isArray(raw.lineItems)) {
    for (const entry of raw.lineItems.slice(0, MAX_LINES)) {
      if (!isObject(entry)) continue;
      const line: ScannedLineItem = {
        sno: typeof entry.sno === "number" && Number.isInteger(entry.sno) && entry.sno > 0 ? entry.sno : undefined,
        description: text(entry.description, 1000),
        hsnSac: text(entry.hsnSac, 20),
        unit: text(entry.unit, 60),
        qty: text(entry.qty, 60),
        rate: text(entry.rate, 60),
        amount: money(entry.amount),
      };
      if (line.description || line.amount !== undefined) lineItems.push(line);
    }
  }

  const c = isObject(raw.client) ? raw.client : null;
  const client = c
    ? {
        name: text(c.name),
        address: text(c.address, 1000),
        gstin: text(c.gstin, 20)?.toUpperCase(),
        state: text(c.state, 60),
        stateCode: stateCode(c.stateCode),
        shipToName: text(c.shipToName),
        shipToAddress: text(c.shipToAddress, 1000),
      }
    : undefined;

  const data: ScannedInvoice = {
    invoiceNo: text(raw.invoiceNo, 60),
    invoiceDate: isoDate(raw.invoiceDate),
    poNo: text(raw.poNo, 100),
    billPeriodStart: isoDate(raw.billPeriodStart),
    billPeriodEnd: isoDate(raw.billPeriodEnd),
    state: text(raw.state, 60),
    stateCode: stateCode(raw.stateCode),
    transportMode: text(raw.transportMode, 60),
    vehicleNo: text(raw.vehicleNo, 30),
    placeOfSupply: text(raw.placeOfSupply, 100),
    reverseCharge: flag(raw.reverseCharge),
    client,
    lineItems: lineItems.length ? lineItems : undefined,
  };

  // Nothing usable at all means the model did not read an invoice.
  const hasAnything =
    Object.entries(data).some(([key, value]) => key !== "client" && value !== undefined) ||
    (client && Object.values(client).some((value) => value !== undefined));
  return hasAnything ? data : null;
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

type ProviderResult = { ok: true; data: ScannedInvoice } | { ok: false; error: string };
type Fetch = typeof fetch;

const REQUEST_TIMEOUT_MS = 45_000;

/** A message a person can act on, from an HTTP failure. */
function describeFailure(provider: string, status: number, body: string, modelEnv: string, model: string): string {
  if (status === 429) return `${provider}: usage limit reached.`;
  if (status === 404) {
    return `${provider}: the model "${model}" is no longer available. Set ${modelEnv} to a current model.`;
  }
  if (status === 401 || status === 403) return `${provider}: the API key was rejected (HTTP ${status}).`;
  let detail = "";
  try {
    const message = JSON.parse(body)?.error?.message;
    if (typeof message === "string") detail = ` ${message.slice(0, 200)}`;
  } catch {
    // not JSON: leave it out
  }
  return `${provider}: the request failed (HTTP ${status}).${detail}`;
}

function parseModelJson(provider: string, textResult: unknown): ProviderResult {
  if (typeof textResult !== "string" || !textResult.trim()) {
    return { ok: false, error: `${provider}: empty reply.` };
  }
  try {
    const data = normalizeScan(JSON.parse(textResult));
    return data
      ? { ok: true, data }
      : { ok: false, error: `${provider}: the reply did not contain an invoice.` };
  } catch {
    return { ok: false, error: `${provider}: the reply was not readable.` };
  }
}

async function scanWithGemini(
  base64: string,
  mimeType: string,
  apiKey: string,
  model: string,
  fetchImpl: Fetch,
): Promise<ProviderResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const payload = {
    contents: [{ parts: [{ text: INVOICE_PROMPT }, { inlineData: { mimeType, data: base64 } }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
  };

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      // The key goes in a header, not the address, so it cannot end up in logs or error messages.
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      return { ok: false, error: describeFailure("Gemini", response.status, await response.text(), "GEMINI_MODEL", model) };
    }
    const json = await response.json();
    const parts: unknown[] = json?.candidates?.[0]?.content?.parts ?? [];
    const textResult = parts.map((p) => (isObject(p) && typeof p.text === "string" ? p.text : "")).join("");
    return parseModelJson("Gemini", textResult);
  } catch (err) {
    return { ok: false, error: `Gemini: ${err instanceof Error ? err.message : "the request failed"}.` };
  }
}

async function scanWithChat(options: {
  provider: string;
  url: string;
  apiKey: string;
  model: string;
  modelEnv: string;
  base64: string;
  mimeType: string;
  fetchImpl: Fetch;
}): Promise<ProviderResult> {
  const { provider, model } = options;
  const payload = {
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: CHAT_PROMPT },
          { type: "image_url", image_url: { url: `data:${options.mimeType};base64,${options.base64}` } },
        ],
      },
    ],
    response_format: { type: "json_object" },
  };

  try {
    const response = await options.fetchImpl(options.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${options.apiKey}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      return { ok: false, error: describeFailure(provider, response.status, await response.text(), options.modelEnv, model) };
    }
    const json = await response.json();
    return parseModelJson(provider, json?.choices?.[0]?.message?.content);
  } catch (err) {
    return { ok: false, error: `${provider}: ${err instanceof Error ? err.message : "the request failed"}.` };
  }
}

// ---------------------------------------------------------------------------
// The scan: Gemini, then OpenAI, then Mistral, with a reason for every one that failed
// ---------------------------------------------------------------------------

export async function scanInvoiceImage(params: {
  base64: string;
  mimeType: string;
  env: ScanEnv;
  fetchImpl?: Fetch;
}): Promise<ScanOutcome> {
  const { base64, mimeType, env } = params;
  const fetchImpl = params.fetchImpl ?? fetch;

  const geminiKey = env.GEMINI_API_KEY?.trim();
  const openaiKey = env.OPENAI_API_KEY?.trim();
  const mistralKey = env.MISTRAL_API_KEY?.trim();

  if (!geminiKey && !openaiKey && !mistralKey) {
    return {
      success: false,
      error:
        "AI scan is not set up. Add GEMINI_API_KEY (or OPENAI_API_KEY / MISTRAL_API_KEY) to the " +
        "environment settings of your hosting.",
    };
  }

  const geminiModel = env.GEMINI_MODEL?.trim() || DEFAULT_MODELS.gemini;

  // Only Gemini reads PDFs; the others accept pictures only.
  if (mimeType === "application/pdf") {
    if (!geminiKey) {
      return {
        success: false,
        error:
          "Scanning a PDF needs a Gemini API key (GEMINI_API_KEY); the other providers read pictures only. " +
          "Upload a photo or screenshot of the invoice instead.",
      };
    }
    const result = await scanWithGemini(base64, mimeType, geminiKey, geminiModel, fetchImpl);
    return result.ok
      ? { success: true, data: result.data }
      : { success: false, error: `${result.error} You can also upload a photo or screenshot of the invoice instead.` };
  }

  const failures: string[] = [];

  if (geminiKey) {
    const result = await scanWithGemini(base64, mimeType, geminiKey, geminiModel, fetchImpl);
    if (result.ok) return { success: true, data: result.data };
    failures.push(result.error);
  }
  if (openaiKey) {
    const result = await scanWithChat({
      provider: "OpenAI",
      url: "https://api.openai.com/v1/chat/completions",
      apiKey: openaiKey,
      model: env.OPENAI_MODEL?.trim() || DEFAULT_MODELS.openai,
      modelEnv: "OPENAI_MODEL",
      base64,
      mimeType,
      fetchImpl,
    });
    if (result.ok) return { success: true, data: result.data };
    failures.push(result.error);
  }
  if (mistralKey) {
    const result = await scanWithChat({
      provider: "Mistral",
      url: "https://api.mistral.ai/v1/chat/completions",
      apiKey: mistralKey,
      model: env.MISTRAL_MODEL?.trim() || DEFAULT_MODELS.mistral,
      modelEnv: "MISTRAL_MODEL",
      base64,
      mimeType,
      fetchImpl,
    });
    if (result.ok) return { success: true, data: result.data };
    failures.push(result.error);
  }

  return { success: false, error: `The scan did not work. ${failures.join(" ")}` };
}
