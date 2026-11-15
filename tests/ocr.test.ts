import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_MODELS, normalizeScan, scanInvoiceImage } from "../lib/ocr";

type Call = { url: string; init: RequestInit };

/** A stand-in for fetch that answers from a list, in order, and remembers what it was asked. */
function fakeFetch(answers: Array<() => Response>) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = answers.shift();
    if (!next) throw new Error("unexpected extra request");
    return next();
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const json = (status: number, body: unknown) => () =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
const geminiReply = (obj: unknown) =>
  json(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] });
const chatReply = (obj: unknown) => json(200, { choices: [{ message: { content: JSON.stringify(obj) } }] });

const scanned = {
  invoiceNo: "A-1",
  invoiceDate: "2026-11-01",
  client: { name: "X Ltd", gstin: "27aaacl0140pez6", stateCode: "27" },
  lineItems: [{ description: "Crane", qty: "26 Days", rate: "5,000 per day", amount: 130000 }],
};

// ---------------------------------------------------------------------------
// Checking what the model sent back
// ---------------------------------------------------------------------------

test("anything that is not an invoice-shaped object is refused", () => {
  for (const bad of [null, undefined, "text", 42, [], {}, { client: {} }, { lineItems: "x" }, { lineItems: [null, 5] }]) {
    assert.equal(normalizeScan(bad), null, JSON.stringify(bad));
  }
});

test("keeps what is usable and tidies it", () => {
  const data = normalizeScan({
    invoiceNo: 1042,
    invoiceDate: "2026-11-01",
    billPeriodStart: "01/11/2026",
    stateCode: "9",
    reverseCharge: "false",
    client: { name: "  X Ltd ", gstin: "27aaacl0140pez6", stateCode: "27", address: "Mumbai" },
    lineItems: [
      { sno: 1, description: "Crane", unit: "Days", qty: "26 Days", rate: "5,000 per day", amount: "1,30,000" },
      { description: "Fuel", amount: -5 },
      "junk",
      { amount: 500 },
    ],
  });
  assert.ok(data);
  assert.equal(data.invoiceNo, "1042");
  assert.equal(data.invoiceDate, "2026-11-01");
  assert.equal(data.billPeriodStart, undefined);
  assert.equal(data.stateCode, "09");
  assert.equal(data.reverseCharge, false);
  assert.equal(data.client?.name, "X Ltd");
  assert.equal(data.client?.gstin, "27AAACL0140PEZ6");
  assert.deepEqual(data.lineItems?.map((l) => [l.description, l.qty, l.rate, l.amount]), [
    ["Crane", "26 Days", "5,000 per day", 130000],
    ["Fuel", undefined, undefined, undefined],
    [undefined, undefined, undefined, 500],
  ]);
});

test("an enormous reply is cut down", () => {
  const data = normalizeScan({
    invoiceNo: "x".repeat(5000),
    lineItems: Array.from({ length: 500 }, (_, i) => ({ description: `item ${i}`, amount: 1 })),
  });
  assert.equal(data?.invoiceNo?.length, 60);
  assert.equal(data?.lineItems?.length, 100);
});

// ---------------------------------------------------------------------------
// The providers
// ---------------------------------------------------------------------------

test("with no key at all it says what to set", async () => {
  const result = await scanInvoiceImage({ base64: "AAAA", mimeType: "image/jpeg", env: {} });
  assert.equal(result.success, false);
  assert.match(!result.success ? result.error : "", /GEMINI_API_KEY/);
});

test("Gemini: the key is sent in a header and never in the address, and the model comes from the environment", async () => {
  const { fetchImpl, calls } = fakeFetch([geminiReply(scanned)]);
  const result = await scanInvoiceImage({
    base64: "AAAA",
    mimeType: "image/jpeg",
    env: { GEMINI_API_KEY: "secret-gemini-key", GEMINI_MODEL: "gemini-custom" },
    fetchImpl,
  });
  assert.equal(result.success, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /models\/gemini-custom:generateContent$/);
  assert.ok(!calls[0].url.includes("secret-gemini-key"));
  assert.equal((calls[0].init.headers as Record<string, string>)["x-goog-api-key"], "secret-gemini-key");
});

test("Gemini is the default model unless one is set", async () => {
  const { fetchImpl, calls } = fakeFetch([geminiReply(scanned)]);
  await scanInvoiceImage({ base64: "AAAA", mimeType: "image/png", env: { GEMINI_API_KEY: "k" }, fetchImpl });
  assert.ok(calls[0].url.includes(DEFAULT_MODELS.gemini));
});

test("a quota failure falls through to the next provider", async () => {
  const { fetchImpl, calls } = fakeFetch([json(429, "slow down"), chatReply(scanned)]);
  const result = await scanInvoiceImage({
    base64: "AAAA",
    mimeType: "image/jpeg",
    env: { GEMINI_API_KEY: "g", OPENAI_API_KEY: "o" },
    fetchImpl,
  });
  assert.equal(result.success, true);
  assert.equal(calls.length, 2);
  assert.ok(calls[1].url.startsWith("https://api.openai.com/"));
  assert.equal((calls[1].init.headers as Record<string, string>).Authorization, "Bearer o");
});

test("a retired model says which setting to change", async () => {
  const { fetchImpl } = fakeFetch([json(404, { error: { message: "models/old is not found" } })]);
  const result = await scanInvoiceImage({
    base64: "AAAA",
    mimeType: "image/jpeg",
    env: { GEMINI_API_KEY: "g", GEMINI_MODEL: "old" },
    fetchImpl,
  });
  assert.equal(result.success, false);
  const error = !result.success ? result.error : "";
  assert.match(error, /"old" is no longer available/);
  assert.match(error, /GEMINI_MODEL/);
});

test("when every provider fails, each reason is given", async () => {
  const { fetchImpl } = fakeFetch([json(429, ""), json(401, ""), json(500, "")]);
  const result = await scanInvoiceImage({
    base64: "AAAA",
    mimeType: "image/jpeg",
    env: { GEMINI_API_KEY: "g", OPENAI_API_KEY: "o", MISTRAL_API_KEY: "m" },
    fetchImpl,
  });
  const error = !result.success ? result.error : "";
  assert.match(error, /Gemini: usage limit reached/);
  assert.match(error, /OpenAI: the API key was rejected/);
  assert.match(error, /Mistral: the request failed \(HTTP 500\)/);
});

test("a reply that is not an invoice is a failure, not a blank form", async () => {
  const { fetchImpl } = fakeFetch([json(200, { candidates: [{ content: { parts: [{ text: "I cannot read this." }] } }] })]);
  const result = await scanInvoiceImage({ base64: "AAAA", mimeType: "image/jpeg", env: { GEMINI_API_KEY: "g" }, fetchImpl });
  assert.equal(result.success, false);
  assert.match(!result.success ? result.error : "", /not readable/);
});

test("a PDF is only sent to Gemini", async () => {
  const noGemini = await scanInvoiceImage({
    base64: "AAAA",
    mimeType: "application/pdf",
    env: { OPENAI_API_KEY: "o" },
    fetchImpl: fakeFetch([]).fetchImpl,
  });
  assert.equal(noGemini.success, false);
  assert.match(!noGemini.success ? noGemini.error : "", /needs a Gemini API key/);

  const { fetchImpl, calls } = fakeFetch([json(429, "")]);
  const failed = await scanInvoiceImage({
    base64: "AAAA",
    mimeType: "application/pdf",
    env: { GEMINI_API_KEY: "g", OPENAI_API_KEY: "o" },
    fetchImpl,
  });
  assert.equal(calls.length, 1, "no fallback for a PDF");
  assert.equal(failed.success, false);
  assert.match(!failed.success ? failed.error : "", /photo or screenshot/);
});
