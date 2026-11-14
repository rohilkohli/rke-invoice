import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateTotals,
  legacyDecimalText,
  lineAmount,
  parseAmount,
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
