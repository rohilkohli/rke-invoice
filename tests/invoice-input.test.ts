import assert from "node:assert/strict";
import test from "node:test";

import { findMissingDetail, firstIssue, invoiceSchema } from "../lib/invoiceInput";

const complete = {
  invoiceNo: "INV-1",
  invoiceDate: "2026-11-15",
  status: "SENT" as const,
  reverseCharge: false,
  cgstRate: 9,
  sgstRate: 9,
  igstRate: 18,
  client: {
    name: "Larsen & Toubro Limited",
    address: "Powai, Mumbai",
    gstin: "27AAACL0140PEZ6",
    state: "Maharashtra",
    stateCode: "27",
  },
  lineItems: [{ sno: 1, description: "Crane hire", unit: "Day", qty: "2", rate: "2,500", amount: 5000 }],
};

/** The smallest thing a draft may be saved as. */
const unfinished = {
  ...complete,
  status: "DRAFT" as const,
  client: { name: "Larsen & Toubro Limited", address: "", gstin: "", state: "", stateCode: "" },
  lineItems: [{ sno: 1, description: "", unit: "", qty: "", rate: "", amount: 0 }],
};

test("a draft with only a number, a date and the client's name can be saved", () => {
  const parsed = invoiceSchema.safeParse(unfinished);
  assert.equal(parsed.success, true);
  assert.equal(findMissingDetail(parsed.data!), null);
});

test("a draft still needs the invoice number and the client's name", () => {
  const noNumber = invoiceSchema.safeParse({ ...unfinished, invoiceNo: "  " });
  assert.equal(noNumber.success, false);
  assert.equal(firstIssue(noNumber.error!), "Enter an invoice number.");

  const noName = invoiceSchema.safeParse({ ...unfinished, client: { ...unfinished.client, name: " " } });
  assert.equal(noName.success, false);
  assert.equal(firstIssue(noName.error!), "Enter the client's name.");
});

test("any other status needs every detail, and says which one is missing", () => {
  for (const status of ["SENT", "PAID", "QUOTATION"] as const) {
    const parsed = invoiceSchema.parse({ ...unfinished, status });
    assert.equal(findMissingDetail(parsed), "Enter the client's GSTIN.", status);
  }

  const withGstin = invoiceSchema.parse({ ...unfinished, status: "SENT", client: { ...unfinished.client, gstin: "27AAACL0140PEZ6" } });
  assert.equal(findMissingDetail(withGstin), "Enter the client's address.");

  const withAddress = invoiceSchema.parse({ ...unfinished, status: "SENT", client: { ...withGstin.client, address: "Powai" } });
  assert.equal(findMissingDetail(withAddress), "Choose the client's state.");

  const withState = invoiceSchema.parse({ ...unfinished, status: "SENT", client: { ...withAddress.client, state: "Maharashtra", stateCode: "27" } });
  assert.equal(findMissingDetail(withState), "Line 1: enter a description.");

  assert.equal(findMissingDetail(invoiceSchema.parse(complete)), null);
});

test("moving a saved draft to Sent applies the full rules", () => {
  // The same unfinished invoice: fine as a draft, refused once it is called Sent.
  assert.equal(findMissingDetail(invoiceSchema.parse(unfinished)), null);
  assert.notEqual(findMissingDetail(invoiceSchema.parse({ ...unfinished, status: "SENT" })), null);
});

test("a draft is still held to the rules that protect the figures", () => {
  const negative = invoiceSchema.safeParse({ ...unfinished, lineItems: [{ ...unfinished.lineItems[0]!, amount: -5 }] });
  assert.equal(negative.success, false);

  const badRate = invoiceSchema.safeParse({ ...unfinished, igstRate: 180 });
  assert.equal(badRate.success, false);

  const noLines = invoiceSchema.safeParse({ ...unfinished, lineItems: [] });
  assert.equal(noLines.success, false);
  assert.equal(firstIssue(noLines.error!), "Add at least one line item.");
});
