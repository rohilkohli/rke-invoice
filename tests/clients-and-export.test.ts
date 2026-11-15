import assert from "node:assert/strict";
import test from "node:test";

import * as XLSX from "xlsx";

import type { InvoiceFormData } from "../components/invoice/types";
import { findInvoiceProblem } from "../components/invoice/validation";
import { clientSnapshot, sameClient } from "../lib/clientIdentity";
import { buildInvoiceSheet, sanitizeSheetName } from "../lib/export";

test("clients are the same when name and GSTIN match, ignoring case and spacing", () => {
  const a = { name: "Larsen & Toubro Limited", gstin: "27AAACL0140PEZ6" };
  assert.equal(sameClient(a, { name: "  larsen & toubro limited ", gstin: "27aaacl0140pez6" }), true);
  assert.equal(sameClient(a, { name: "Larsen & Toubro Limited", gstin: "27AAACL0140PEZ7" }), false);
  assert.equal(sameClient(a, { name: "Someone Else", gstin: "27AAACL0140PEZ6" }), false);
});

test("the copy of the client kept on an invoice is tidied, and an empty ship-to is nothing", () => {
  const snapshot = clientSnapshot({
    name: " X Ltd ",
    address: "Mumbai ",
    gstin: " 27AAACL0140PEZ6",
    state: "Maharashtra",
    stateCode: "27",
    shipToName: "",
    shipToAddress: "  ",
    shipToGstin: null,
  });
  assert.equal(snapshot.clientName, "X Ltd");
  assert.equal(snapshot.clientGstin, "27AAACL0140PEZ6");
  assert.equal(snapshot.shipToName, null);
  assert.equal(snapshot.shipToAddress, null);
  assert.equal(snapshot.shipToGstin, null);
  assert.equal(snapshot.shipToState, null);
});

// ---------------------------------------------------------------------------
// Spreadsheet export (H10)
// ---------------------------------------------------------------------------

test("sheet names are always ones Excel accepts and never repeat", () => {
  const used = new Set<string>();
  assert.equal(sanitizeSheetName("RKE/26-27/003", used), "RKE-26-27-003");
  assert.equal(sanitizeSheetName("RKE/26-27/003", used), "RKE-26-27-003 (2)");
  assert.equal(sanitizeSheetName("rke-26-27-003", used), "rke-26-27-003 (3)");
  assert.equal(sanitizeSheetName("A[1]:B*C?D\\E", used), "A-1--B-C-D-E");
  assert.equal(sanitizeSheetName("", used), "Invoice");
  assert.equal(sanitizeSheetName("'quoted'", used), "quoted");
  const long = "X".repeat(40);
  const first = sanitizeSheetName(long, used);
  const second = sanitizeSheetName(long, used);
  assert.equal(first.length, 31);
  assert.equal(second.length, 31);
  assert.notEqual(first, second);
  for (const name of [first, second]) assert.doesNotThrow(() => XLSX.utils.book_append_sheet(XLSX.utils.book_new(), XLSX.utils.aoa_to_sheet([[1]]), name));
});

const invoice: InvoiceFormData = {
  invoiceNo: "INV-1",
  invoiceDate: "2026-11-14",
  state: "Maharashtra",
  stateCode: "27",
  status: "SENT",
  reverseCharge: false,
  cgstRate: 9,
  sgstRate: 9,
  igstRate: 18,
  client: {
    name: "Client X",
    address: "Bill address",
    gstin: "27AAAAA0000A1Z5",
    state: "Maharashtra",
    stateCode: "27",
    shipToName: "Site Y",
    shipToAddress: "Site address",
    shipToGstin: "24BBBBB1111B1Z5",
    shipToState: "Gujarat",
    shipToStateCode: "24",
  },
  lineItems: [{ sno: 1, description: "Crane rental", hsnSac: "997313", unit: "Days", qty: "26 Days", rate: "5,000 per day", amount: "1,30,000" }],
  signature: null,
};

const rowsOf = (company: { companyName: string; gstin: string; address: string; stateCode?: string; state?: string; tagline?: string }) =>
  XLSX.utils
    .sheet_to_json<unknown[]>(buildInvoiceSheet({ invoice, company }), { header: 1 })
    .map((row) => row.filter((cell) => cell !== "" && cell != null).join(" | "));

test("the sheet uses the company's own details, the ship-to, and says Only once", () => {
  const rows = rowsOf({ companyName: "Some Other Co", gstin: "27ZZZZZ0000Z1Z5", address: "Pune", stateCode: "27", state: "Maharashtra", tagline: "Fabrication works" });
  const all = rows.join("\n");
  assert.ok(all.includes("Fabrication works"), "company tagline");
  assert.ok(!all.includes("Rental Service of Heavy"), "no hard-coded tagline");
  assert.ok(all.includes("GSTIN: 24BBBBB1111B1Z5"), "ship-to GSTIN");
  assert.ok(all.includes("State: Gujarat (24)"), "ship-to state");
  assert.ok(all.includes("State: Maharashtra (27)"), "bill-to state");
  assert.ok(!/Only Only/.test(all), "Only appears twice");
  assert.ok(/Rupees One Lakh Fifty Three Thousand Four Hundred Only/.test(all));
  assert.ok(all.includes("26 Days | 5,000 per day | 130000"), "qty and rate as typed, amount typed");
});

test("same state as the company is CGST + SGST, a different one is IGST, using the company's own state", () => {
  const intra = rowsOf({ companyName: "Co", gstin: "g", address: "a", stateCode: "27", state: "Maharashtra" }).join("\n");
  assert.ok(intra.includes("CGST @ 9% | 11700"));
  assert.ok(intra.includes("SGST @ 9% | 11700"));
  assert.ok(!intra.includes("IGST"));

  const inter = rowsOf({ companyName: "Co", gstin: "g", address: "a", stateCode: "09", state: "Uttar Pradesh" }).join("\n");
  assert.ok(inter.includes("IGST @ 18% | 23400"));
  assert.ok(!inter.includes("CGST"));
});

// ---------------------------------------------------------------------------
// Saving needs everything, with a message for what is missing
// ---------------------------------------------------------------------------

test("the first problem is named", () => {
  assert.equal(findInvoiceProblem(invoice), null);
  assert.match(findInvoiceProblem({ ...invoice, invoiceNo: "  " }) ?? "", /invoice number/);
  assert.match(findInvoiceProblem({ ...invoice, client: { ...invoice.client, name: "" } }) ?? "", /client's name/);
  assert.match(findInvoiceProblem({ ...invoice, client: { ...invoice.client, stateCode: "" } }) ?? "", /state/);
  assert.match(findInvoiceProblem({ ...invoice, lineItems: [] }) ?? "", /at least one line/);
  assert.match(
    findInvoiceProblem({ ...invoice, lineItems: [{ ...invoice.lineItems[0]!, description: " " }] }) ?? "",
    /Line 1: enter a description/,
  );
  assert.match(
    findInvoiceProblem({ ...invoice, lineItems: [{ ...invoice.lineItems[0]!, amount: "" }] }) ?? "",
    /Line 1: type the amount/,
  );
});
