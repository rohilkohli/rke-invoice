import * as XLSX from "xlsx";

import type { InvoiceFormData } from "@/components/invoice/types";
import type { CompanySettingsPreview } from "@/components/invoice/InvoicePreview";
import { amountInWordsINR, calculateTotals, getTaxMode, roundMoney } from "@/lib/calculations";
import { DEFAULT_COMPANY_STATE } from "@/lib/defaults";

export function buildInvoiceWorkbook(params: {
  invoice: InvoiceFormData;
  company: CompanySettingsPreview;
}) {
  const sheet = buildInvoiceSheet(params);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Invoice");
  return wb;
}

export function buildInvoiceSheet(params: {
  invoice: InvoiceFormData;
  company: CompanySettingsPreview;
}) {
  const { invoice, company } = params;
  const taxMode = getTaxMode(DEFAULT_COMPANY_STATE.stateCode, invoice.client.stateCode);
  const totals = calculateTotals({
    items: invoice.lineItems.map((li) => ({ qty: li.qty, rate: li.rate })),
    cgstRate: invoice.cgstRate,
    sgstRate: invoice.sgstRate,
    igstRate: invoice.igstRate,
    taxMode,
  });

  const amountInWords = amountInWordsINR(totals.grandTotal);
  const gstPaidReverse = invoice.reverseCharge ? "Yes" : "No";

  const billPeriod = invoice.billPeriodStart && invoice.billPeriodEnd
    ? `${invoice.billPeriodStart} to ${invoice.billPeriodEnd}`
    : "-";

  const aoa: (string | number)[][] = [];

  // Row 1: Original for Recipient
  aoa.push(["", "", "", "Original for Recipient"]);

  // Row 2: TAX INVOICE
  aoa.push(["TAX INVOICE"]);

  // Row 3: Blank
  aoa.push([]);

  // Row 4-7: Company details on left, Meta details on right
  const vendorName = company.companyName || "M/S RADHA KISHAN ENTERPRISES";
  const tagline = "Rental Service of Heavy Engineering Equipments";
  const address = company.address || "";
  const companyGstin = `GSTIN: ${company.gstin || "09ABCFR1989E1ZX"}`;

  aoa.push([vendorName, "", "Invoice No", invoice.invoiceNo]);
  aoa.push([tagline, "", "Invoice Date", invoice.invoiceDate]);
  aoa.push([address, "", "PO No", invoice.poNo || "-"]);
  aoa.push([companyGstin, "", "Bill Period", billPeriod]);

  // Row 8: Blank
  aoa.push([]);

  // Row 9: BILL TO / SHIP TO
  aoa.push(["BILL TO", "", "", "SHIP TO"]);

  // Rows 10-13: Client & Ship To Details
  const clientName = invoice.client.name;
  const shipToName = invoice.client.shipToName || clientName;
  const clientAddress = invoice.client.address;
  const shipToAddress = invoice.client.shipToAddress || clientAddress;
  const clientGstin = `GSTIN: ${invoice.client.gstin || "-"}`;
  const shipToGstin = `GSTIN: ${invoice.client.gstin || "-"}`;
  const clientState = `State: ${invoice.client.state} (${invoice.client.stateCode})`;
  const shipToState = `State: ${invoice.client.state} (${invoice.client.stateCode})`;

  aoa.push([clientName, "", "", shipToName]);
  aoa.push([clientAddress, "", "", shipToAddress]);
  aoa.push([clientGstin, "", "", shipToGstin]);
  aoa.push([clientState, "", "", shipToState]);

  // Row 14: Blank row
  aoa.push([]);

  // Row 15: Header row
  aoa.push([
    "S.No.",
    "Description",
    "HSN/SAC",
    "UOM",
    "QTY",
    "UNIT PRICE",
    "TOTAL",
    "GST Rate",
  ]);

  // Data rows
  invoice.lineItems.forEach((li, idx) => {
    const totalAmt = roundMoney((Number(li.qty) || 0) * (Number(li.rate) || 0));
    const gstRate = taxMode === "INTRA_STATE"
      ? `${invoice.cgstRate + invoice.sgstRate}%`
      : `${invoice.igstRate}%`;

    aoa.push([
      idx + 1,
      li.description,
      li.hsnSac || "-",
      li.unit || "-",
      li.qty,
      li.rate,
      totalAmt,
      gstRate,
    ]);
  });

  // Blank row
  aoa.push([]);

  // Summary section
  const subtotal = totals.totalBeforeTax;
  aoa.push(["Amount In Words:", `${amountInWords} Only`, "", "", "SUBTOTAL", subtotal]);

  if (taxMode === "INTRA_STATE") {
    aoa.push(["", "", "", "", `CGST @ ${invoice.cgstRate}%`, totals.cgst]);
    aoa.push(["", "", "", "", `SGST @ ${invoice.sgstRate}%`, totals.sgst]);
  } else {
    aoa.push(["", "", "", "", `IGST @ ${invoice.igstRate}%`, totals.igst]);
  }

  aoa.push(["", "", "", "", "GRAND TOTAL", totals.grandTotal]);

  // Blank row
  aoa.push([]);

  // Reverse charge
  aoa.push([`GST On Reverse Charge: ${gstPaidReverse}`]);

  // Blank row
  aoa.push([]);

  // Bank details
  aoa.push(["Company's Bank Details:"]);
  const bankName = company.bankName || "-";
  const accNo = company.accountNo || "-";
  const ifscCode = company.ifsc || "-";
  aoa.push([`Bank: ${bankName} | A/c: ${accNo} | IFSC: ${ifscCode}`]);

  const sheet = XLSX.utils.aoa_to_sheet(aoa);

  // Apply column widths
  sheet["!cols"] = [
    { wch: 8 },  // S.No.
    { wch: 40 }, // Description
    { wch: 12 }, // HSN/SAC
    { wch: 10 }, // UOM
    { wch: 10 }, // QTY
    { wch: 12 }, // UNIT PRICE
    { wch: 15 }, // TOTAL
    { wch: 12 }, // GST Rate
  ];

  // Merge headers for TAX INVOICE row
  sheet["!merges"] = [
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
  ];

  return sheet;
}

export function workbookToBlob(wb: XLSX.WorkBook): Blob {
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
