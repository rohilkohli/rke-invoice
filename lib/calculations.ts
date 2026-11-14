export type TaxMode = "INTRA_STATE" | "INTER_STATE";

type TypedAmount = number | string | null | undefined;

/**
 * A line reaches the totals only through the amount the user typed.
 * Unit, Qty and Rate are free text and are never part of any calculation.
 */
export type LineItemInput = {
  amount: TypedAmount;
};

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Reads an amount the way people type it: "150000", "1,50,000.50", "₹ 2,500".
 * Returns NaN for a blank box or anything that is not a plain non-negative number,
 * so callers can tell "nothing usable typed" apart from a real 0.
 */
export function parseAmount(value: TypedAmount): number {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : Number.NaN;
  }
  const cleaned = String(value ?? "").replace(/[₹,\s]/g, "");
  return /^(\d+\.?\d*|\.\d+)$/.test(cleaned) ? Number(cleaned) : Number.NaN;
}

/** What a line adds to the invoice: the typed amount rounded to paise, or 0 if it is not a number. */
export function lineAmount(value: TypedAmount): number {
  const amount = parseAmount(value);
  return Number.isNaN(amount) ? 0 : roundMoney(amount);
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

export function getTaxMode(
  companyStateCode: string,
  clientStateCode: string,
): TaxMode {
  const a = (companyStateCode ?? "").trim();
  const b = (clientStateCode ?? "").trim();
  return a && b && a === b ? "INTRA_STATE" : "INTER_STATE";
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
  const totalBeforeTax = roundMoney(
    (params.items ?? []).reduce((sum, item) => sum + lineAmount(item.amount), 0),
  );

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (params.taxMode === "INTRA_STATE") {
    cgst = roundMoney((totalBeforeTax * (Number(params.cgstRate) || 0)) / 100);
    sgst = roundMoney((totalBeforeTax * (Number(params.sgstRate) || 0)) / 100);
  } else {
    igst = roundMoney((totalBeforeTax * (Number(params.igstRate) || 0)) / 100);
  }

  const grandTotal = roundMoney(totalBeforeTax + cgst + sgst + igst);
  return { totalBeforeTax, cgst, sgst, igst, grandTotal };
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

  const rupees = Math.floor(Math.abs(rounded));
  const paise = Math.round((Math.abs(rounded) - rupees) * 100);

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
