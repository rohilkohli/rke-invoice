import { DEFAULT_COMPANY_STATE } from "@/lib/defaults";
import { normalizeStateCode, resolveStateCode } from "@/lib/states";

export type TaxMode = "INTRA_STATE" | "INTER_STATE";

type TypedAmount = number | string | null | undefined;
type StateLike = { stateCode?: string | null; state?: string | null } | null | undefined;

/**
 * A line reaches the totals only through the amount the user typed.
 * Unit, Qty and Rate are free text and are never part of any calculation.
 */
export type LineItemInput = {
  amount: TypedAmount;
};

// ---------------------------------------------------------------------------
// Exact money. Amounts are worked out in whole paise (integers) and a half-paisa is
// always rounded up, the way it is on paper. Binary floating point cannot do that:
// 26.50 x 9% is exactly 2.385, but in floating point it lands just under and rounds to 2.38.
// ---------------------------------------------------------------------------

const MAX_RUPEE_DIGITS = 13;

/** Plain decimal text for a finite number, never scientific notation. */
function numberToDecimalText(n: number): string {
  const text = String(n);
  if (!/e/i.test(text)) return text;
  return n.toFixed(12).replace(/\.?0+$/, "");
}

/** "1500.505" -> 150051 paise (half-up), or NaN when it is not plain decimal text. */
function decimalTextToPaise(text: string): number {
  const match = /^(\d*)(?:\.(\d*))?$/.exec(text);
  if (!match || (match[1] === "" && (match[2] ?? "") === "")) return Number.NaN;
  const whole = match[1] || "0";
  if (whole.replace(/^0+/, "").length > MAX_RUPEE_DIGITS) return Number.NaN;
  const fraction = match[2] ?? "";
  const paise = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  // Round half up: look at the third decimal digit only.
  return fraction.length > 2 && fraction.charCodeAt(2) >= 53 ? paise + 1 : paise;
}

/** Rounds to two decimals, half away from zero, using the number's shortest decimal form. */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const paise = decimalTextToPaise(numberToDecimalText(Math.abs(value)));
  if (Number.isNaN(paise)) return Math.round(value * 100) / 100;
  return (value < 0 ? -paise : paise) / 100;
}

/**
 * Reads an amount the way people type it, into whole paise: "150000", "1,50,000.50", "₹ 2,500".
 * Returns NaN for a blank box or anything that is not a plain non-negative number,
 * so callers can tell "nothing usable typed" apart from a real 0.
 */
export function parseAmountPaise(value: TypedAmount): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return Number.NaN;
    return decimalTextToPaise(numberToDecimalText(value));
  }
  return decimalTextToPaise(String(value ?? "").replace(/[₹,\s]/g, ""));
}

/** Same as parseAmountPaise, in rupees. */
export function parseAmount(value: TypedAmount): number {
  const paise = parseAmountPaise(value);
  return Number.isNaN(paise) ? Number.NaN : paise / 100;
}

/** What a line adds to the invoice: the typed amount rounded to paise, or 0 if it is not a number. */
export function lineAmount(value: TypedAmount): number {
  const paise = parseAmountPaise(value);
  return Number.isNaN(paise) ? 0 : paise / 100;
}

/** Tax on an amount in paise at a rate in percent (up to two decimals), in paise, half-up. */
export function taxOnPaise(basePaise: number, ratePercent: number): number {
  const basisPoints = Math.max(0, Math.round((Number(ratePercent) || 0) * 100));
  return Number((BigInt(basePaise) * BigInt(basisPoints) + BigInt(5000)) / BigInt(10000));
}

/**
 * Qty and Rate were DECIMAL(65,30) columns before they became free text, so rows saved
 * back then read as "250.000000000000000000000000000000". Only that exact shape is
 * tidied; anything a user typed is returned untouched. `money` keeps two decimals
 * when there is a fractional part ("1500.50", not "1500.5").
 */
export function legacyDecimalText(
  value: string | null | undefined,
  opts?: { money?: boolean },
): string {
  const text = value ?? "";
  if (!/^\d+\.\d{30}$/.test(text)) return text;
  const trimmed = text.replace(/\.?0+$/, "");
  if (!opts?.money) return trimmed;
  const [whole, fraction] = trimmed.split(".");
  return fraction ? `${whole}.${fraction.padEnd(2, "0")}` : whole;
}

/** Same state means CGST + SGST; a different or unknown state means IGST. "9" and "09" are the same. */
export function getTaxMode(
  companyStateCode: string | null | undefined,
  clientStateCode: string | null | undefined,
): TaxMode {
  const a = normalizeStateCode(companyStateCode);
  const b = normalizeStateCode(clientStateCode);
  return a && b && a === b ? "INTRA_STATE" : "INTER_STATE";
}

/**
 * The one place that decides CGST + SGST versus IGST, for the form, preview, PDF, spreadsheet
 * and the server alike. The company side comes from Settings (falling back to the default
 * state only when Settings has none); either side may give a code or just a state name.
 */
export function resolveTaxMode(company: StateLike, client: StateLike): TaxMode {
  const companyCode =
    resolveStateCode(company?.stateCode, company?.state) || DEFAULT_COMPANY_STATE.stateCode;
  return getTaxMode(companyCode, resolveStateCode(client?.stateCode, client?.state));
}

export function calculateTotals(params: {
  items: LineItemInput[];
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  taxMode: TaxMode;
}): {
  totalBeforeTax: number;
  cgst: number;
  sgst: number;
  igst: number;
  grandTotal: number;
} {
  let basePaise = 0;
  for (const item of params.items ?? []) {
    const paise = parseAmountPaise(item.amount);
    if (!Number.isNaN(paise)) basePaise += paise;
  }

  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  if (params.taxMode === "INTRA_STATE") {
    cgst = taxOnPaise(basePaise, params.cgstRate);
    sgst = taxOnPaise(basePaise, params.sgstRate);
  } else {
    igst = taxOnPaise(basePaise, params.igstRate);
  }

  return {
    totalBeforeTax: basePaise / 100,
    cgst: cgst / 100,
    sgst: sgst / 100,
    igst: igst / 100,
    grandTotal: (basePaise + cgst + sgst + igst) / 100,
  };
}

/** Everything an invoice shows about money, from its lines, rates, and the two states involved. */
export function calculateInvoiceTotals(params: {
  lineItems: LineItemInput[];
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  company: StateLike;
  client: StateLike;
}) {
  const taxMode = resolveTaxMode(params.company, params.client);
  const totals = calculateTotals({
    items: params.lineItems,
    cgstRate: params.cgstRate,
    sgstRate: params.sgstRate,
    igstRate: params.igstRate,
    taxMode,
  });
  return { taxMode, ...totals, amountInWords: amountInWordsINR(totals.grandTotal) };
}

const ONES: string[] = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS: string[] = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function twoDigitToWords(n: number): string {
  if (n < 20) return ONES[n] ?? "";
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${TENS[tens] ?? ""}${ones ? ` ${ONES[ones] ?? ""}` : ""}`.trim();
}

function threeDigitToWords(n: number): string {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (rest) parts.push(twoDigitToWords(rest));
  return parts.join(" ").trim();
}

function indianNumberToWords(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "Zero";
  if (n < 0) return `Minus ${indianNumberToWords(Math.abs(n))}`;

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const rest = n;

  const parts: string[] = [];
  if (crore) parts.push(`${indianNumberToWords(crore)} Crore`);
  if (lakh) parts.push(`${indianNumberToWords(lakh)} Lakh`);
  if (thousand) parts.push(`${indianNumberToWords(thousand)} Thousand`);
  if (rest) parts.push(threeDigitToWords(rest));

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function amountInWordsINR(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const rounded = roundMoney(safe);

  const totalPaise = Math.round(Math.abs(rounded) * 100);
  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;

  const rupeesWords = indianNumberToWords(rupees);
  const paiseWords = paise ? indianNumberToWords(paise) : "";

  const sign = rounded < 0 ? "Minus " : "";
  const suffix = paise ? ` and Paise ${paiseWords}` : "";
  return `${sign}Rupees ${rupeesWords}${suffix} Only`.replace(/\s+/g, " ").trim();
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function buildUpiDeepLink(params: {
  pa: string;
  pn: string;
  amount: number;
  invoiceNo: string;
}): string {
  const am = roundMoney(Number(params.amount) || 0).toFixed(2);
  const tn = `Invoice ${params.invoiceNo}`.trim();
  const enc = (v: string) => encodeURIComponent(v);
  return `upi://pay?pa=${enc(params.pa)}&pn=${enc(params.pn)}&am=${enc(am)}&cu=INR&tn=${enc(tn)}`;
}
