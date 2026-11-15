import assert from "node:assert/strict";
import test from "node:test";

import {
  amountInWordsINR,
  calculateTotals,
  getTaxMode,
  legacyDecimalText,
  lineAmount,
  parseAmount,
  parseAmountPaise,
  resolveTaxMode,
  roundMoney,
  taxOnPaise,
} from "../lib/calculations";

test("reads amounts the way people type them", () => {
  assert.equal(parseAmount("150000"), 150000);
  assert.equal(parseAmount("1,50,000.50"), 150000.5);
  assert.equal(parseAmount(" ₹ 2,500 "), 2500);
  assert.equal(parseAmount(".5"), 0.5);
  assert.equal(parseAmount("0"), 0);
  assert.equal(parseAmount(1234.5), 1234.5);
});

test("a blank or non-numeric amount is NaN, not a silent zero", () => {
  for (const bad of ["", "   ", "abc", "12 per day", "-500", "1e5", "1.2.3", null, undefined, Number.NaN, -1]) {
    assert.ok(Number.isNaN(parseAmount(bad)), `expected NaN for ${JSON.stringify(bad)}`);
  }
});

test("a line adds its typed amount rounded to paise, or nothing if it is not a number", () => {
  assert.equal(lineAmount("1,30,000"), 130000);
  assert.equal(lineAmount("99.999"), 100);
  assert.equal(lineAmount("26 Days"), 0);
  assert.equal(lineAmount(""), 0);
});

test("totals come only from typed amounts", () => {
  const items = [{ amount: "1,30,000" }, { amount: "20000.50" }, { amount: "" }];

  assert.deepEqual(
    calculateTotals({ items, cgstRate: 9, sgstRate: 9, igstRate: 18, taxMode: "INTER_STATE" }),
    { totalBeforeTax: 150000.5, cgst: 0, sgst: 0, igst: 27000.09, grandTotal: 177000.59 },
  );
  assert.deepEqual(
    calculateTotals({ items, cgstRate: 9, sgstRate: 9, igstRate: 18, taxMode: "INTRA_STATE" }),
    { totalBeforeTax: 150000.5, cgst: 13500.05, sgst: 13500.05, igst: 0, grandTotal: 177000.6 },
  );
});

test("tidies only values left over from the old numeric Qty and Rate columns", () => {
  assert.equal(legacyDecimalText("250.000000000000000000000000000000"), "250");
  assert.equal(legacyDecimalText("1.500000000000000000000000000000"), "1.5");
  assert.equal(legacyDecimalText("0.000000000000000000000000000000"), "0");
  assert.equal(legacyDecimalText("1500.500000000000000000000000000000", { money: true }), "1500.50");
  assert.equal(legacyDecimalText("2000.000000000000000000000000000000", { money: true }), "2000");
});

test("leaves anything the user typed untouched", () => {
  for (const typed of ["26 Days", "5,000 per day", "1.50", "100.0", "", "1 Month"]) {
    assert.equal(legacyDecimalText(typed), typed);
    assert.equal(legacyDecimalText(typed, { money: true }), typed);
  }
  assert.equal(legacyDecimalText(null), "");
});

// ---------------------------------------------------------------------------
// Exact rounding (H8)
// ---------------------------------------------------------------------------

/** Reference answer using only integers: tax in paise, half-up. */
function referenceTaxPaise(basePaise: number, rateBasisPoints: number) {
  const num = BigInt(basePaise) * BigInt(rateBasisPoints);
  const q = num / BigInt(10000);
  const r = num % BigInt(10000);
  return Number(r * BigInt(2) >= BigInt(10000) ? q + BigInt(1) : q);
}

test("tax is exact in paise for every amount, including exact half-paise", () => {
  const rates: Array<[number, number]> = [[9, 900], [18, 1800], [2.5, 250], [6, 600], [14, 1400], [0.25, 25]];
  for (const [rate, basisPoints] of rates) {
    for (let paise = 1; paise <= 60_000; paise++) {
      assert.equal(
        taxOnPaise(paise, rate),
        referenceTaxPaise(paise, basisPoints),
        `${paise / 100} at ${rate}%`,
      );
    }
  }
});

test("the cases the old floating-point rounding got one paisa wrong", () => {
  const igst = (amount: string, rate: number) =>
    calculateTotals({ items: [{ amount }], cgstRate: 0, sgstRate: 0, igstRate: rate, taxMode: "INTER_STATE" }).igst;
  assert.equal(igst("26.50", 9), 2.39);
  assert.equal(igst("13.25", 18), 2.39);
  assert.equal(igst("85.40", 2.5), 2.14);
  assert.equal(igst("46.50", 9), 4.19);
});

test("rounds money half up on the number as it is written", () => {
  assert.equal(roundMoney(1.005), 1.01);
  assert.equal(roundMoney(2.385), 2.39);
  assert.equal(roundMoney(-2.385), -2.39);
  assert.equal(roundMoney(0.004), 0);
  assert.equal(roundMoney(Number.NaN), 0);
  assert.equal(parseAmountPaise("99.999"), 10000);
  assert.equal(parseAmountPaise("0.005"), 1);
  assert.equal(parseAmountPaise(1.005), 101);
});

test("a 0% rate stays 0% and an invoice with no amounts totals zero", () => {
  const zero = calculateTotals({ items: [{ amount: "1000" }], cgstRate: 0, sgstRate: 0, igstRate: 0, taxMode: "INTRA_STATE" });
  assert.deepEqual(zero, { totalBeforeTax: 1000, cgst: 0, sgst: 0, igst: 0, grandTotal: 1000 });
  const empty = calculateTotals({ items: [{ amount: "" }], cgstRate: 9, sgstRate: 9, igstRate: 18, taxMode: "INTRA_STATE" });
  assert.deepEqual(empty, { totalBeforeTax: 0, cgst: 0, sgst: 0, igst: 0, grandTotal: 0 });
});

test("amount in words uses exact paise", () => {
  assert.equal(amountInWordsINR(1770.59), "Rupees One Thousand Seven Hundred Seventy and Paise Fifty Nine Only");
  assert.equal(amountInWordsINR(100000), "Rupees One Lakh Only");
  assert.equal(amountInWordsINR(0.5), "Rupees Zero and Paise Fifty Only");
});

// ---------------------------------------------------------------------------
// One tax-mode rule (H7)
// ---------------------------------------------------------------------------

test("9 and 09 are the same state; blank or different is IGST", () => {
  assert.equal(getTaxMode("09", "09"), "INTRA_STATE");
  assert.equal(getTaxMode("09", "9"), "INTRA_STATE");
  assert.equal(getTaxMode(" 09 ", "09"), "INTRA_STATE");
  assert.equal(getTaxMode("09", "27"), "INTER_STATE");
  assert.equal(getTaxMode("09", ""), "INTER_STATE");
  assert.equal(getTaxMode(null, "09"), "INTER_STATE");
});

test("the company side comes from Settings, a state name is enough, and UP is only the last resort", () => {
  // Company in Maharashtra (27): a Maharashtra client is the same state, a UP client is not.
  assert.equal(resolveTaxMode({ stateCode: "27", state: "Maharashtra" }, { stateCode: "27" }), "INTRA_STATE");
  assert.equal(resolveTaxMode({ stateCode: "27", state: "Maharashtra" }, { stateCode: "09" }), "INTER_STATE");
  // Code missing but name given, on either side.
  assert.equal(resolveTaxMode({ stateCode: null, state: "Uttar Pradesh" }, { stateCode: "9" }), "INTRA_STATE");
  assert.equal(resolveTaxMode({ stateCode: "09" }, { state: "Uttar Pradesh" }), "INTRA_STATE");
  assert.equal(resolveTaxMode({ stateCode: "09" }, { state: "Maharashtra" }), "INTER_STATE");
  // Nothing in Settings: treated as Uttar Pradesh. Nothing on the client: IGST.
  assert.equal(resolveTaxMode({}, { stateCode: "09" }), "INTRA_STATE");
  assert.equal(resolveTaxMode({ stateCode: "09" }, {}), "INTER_STATE");
  assert.equal(resolveTaxMode(null, null), "INTER_STATE");
});
