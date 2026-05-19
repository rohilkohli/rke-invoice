"use client";

import { useMemo } from "react";

import {
  amountInWordsINR,
  calculateLineAmount,
  calculateTotals,
  formatINR,
  getTaxMode,
} from "@/lib/calculations";
import { DEFAULT_COMPANY_STATE } from "@/lib/defaults";
import { UPIQRCode } from "@/components/qr/UPIQRCode";

import { useInvoiceStore } from "./useInvoiceStore";
import { cn } from "@/lib/utils";

export type CompanySettingsPreview = {
  companyName: string;
  gstin: string;
  address: string;
  email?: string | null;
  phone?: string | null;
  bankName?: string | null;
  branch?: string | null;
  accountNo?: string | null;
  ifsc?: string | null;
  upiId?: string | null;
  logoUrl?: string | null;
  termsAndConditions?: string | null;
};

export function InvoicePreview(props: { company: CompanySettingsPreview }) {
  const invoice = useInvoiceStore((s) => s.invoice);
  const taxMode = getTaxMode(DEFAULT_COMPANY_STATE.stateCode, invoice.client.stateCode);
  const totals = calculateTotals({
    items: invoice.lineItems.map((li) => ({ qty: li.qty, rate: li.rate })),
    cgstRate: invoice.cgstRate,
    sgstRate: invoice.sgstRate,
    igstRate: invoice.igstRate,
    taxMode,
  });

  const amountInWords = amountInWordsINR(totals.grandTotal);
  const taxTotal = totals.cgst + totals.sgst + totals.igst;
  const taxInWords = amountInWordsINR(taxTotal);

  const qrPayload = useMemo(() => {
    const company = props.company.companyName || "M/S RADHA KISHAN ENTERPRISES";
    const gstin = props.company.gstin || "09ABCFR1989E1ZX";
    const invoiceNo = invoice.invoiceNo || "";
    const date = invoice.invoiceDate || "";
    const billedTo = invoice.client.name || "";
    const totalAmount = totals.grandTotal.toFixed(2);

    return `COMPANY: ${company}
GSTIN: ${gstin}
Invoice No: ${invoiceNo}
Date: ${date}
Billed To: ${billedTo}
Total Amount: ₹${totalAmount}`;
  }, [
    props.company.companyName,
    props.company.gstin,
    invoice.invoiceNo,
    invoice.invoiceDate,
    invoice.client.name,
    totals.grandTotal,
  ]);

  // Fill up table rows to minimum 5
  const lineItemsToDisplay = [...invoice.lineItems];
  while (lineItemsToDisplay.length < 5) {
    lineItemsToDisplay.push({
      sno: lineItemsToDisplay.length + 1,
      description: "",
      hsnSac: "",
      unit: "",
      qty: 0,
      rate: 0,
    });
  }

  // Calculate HSN/SAC Tax Breakdown
  const hsnMap: Record<
    string,
    {
      hsn: string;
      taxableValue: number;
      cgstAmt: number;
      sgstAmt: number;
      igstAmt: number;
      totalTax: number;
    }
  > = {};

  invoice.lineItems.forEach((item) => {
    const hsn = item.hsnSac || "998719";
    const taxableValue = item.qty * item.rate;

    let cgstAmt = 0;
    let sgstAmt = 0;
    let igstAmt = 0;

    if (taxMode === "INTRA_STATE") {
      cgstAmt = (taxableValue * invoice.cgstRate) / 100;
      sgstAmt = (taxableValue * invoice.sgstRate) / 100;
    } else {
      igstAmt = (taxableValue * invoice.igstRate) / 100;
    }

    const totalTax = cgstAmt + sgstAmt + igstAmt;

    if (!hsnMap[hsn]) {
      hsnMap[hsn] = { hsn, taxableValue: 0, cgstAmt: 0, sgstAmt: 0, igstAmt: 0, totalTax: 0 };
    }
    hsnMap[hsn].taxableValue += taxableValue;
    hsnMap[hsn].cgstAmt += cgstAmt;
    hsnMap[hsn].sgstAmt += sgstAmt;
    hsnMap[hsn].igstAmt += igstAmt;
    hsnMap[hsn].totalTax += totalTax;
  });

  const hsnRows = Object.values(hsnMap);

  return (
    <div className="w-[595px] min-h-[842px] bg-white border border-neutral-300 shadow-md p-6 text-[10px] text-black font-sans relative mx-auto select-none">
      {/* Watermark */}
      <div className="absolute top-[35%] left-0 right-0 text-center text-5xl text-neutral-200 font-extrabold uppercase select-none opacity-25 pointer-events-none rotate-[-25deg] z-0">
        ORIGINAL
      </div>

      <div className="relative z-10 space-y-2">
        {/* SECTION 1 — TOP HEADER BAR */}
        <div className="flex items-center justify-between border-b border-black pb-1.5">
          <span className="text-sm font-bold uppercase">Tax Invoice (ORIGINAL COPY)</span>
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-center">
              <div className="h-14 w-14 bg-white border border-black flex items-center justify-center p-0.5 overflow-hidden">
                <UPIQRCode value={qrPayload} size={52} />
              </div>
              <span className="text-[7px] font-bold mt-0.5">Scan for Details</span>
            </div>
          </div>
        </div>

        {/* SECTION 2 — SELLER INFO | INVOICE META TABLE */}
        <div className="flex border border-black">
          <div className="flex-[1.1] p-1.5 border-r border-black space-y-1">
            <div className="text-[11px] font-bold uppercase">
              {props.company.companyName || "M/S RADHA KISHAN ENTERPRISES"}
            </div>
            <div className="text-[9px] text-neutral-700 italic">
              Rental Service of Heavy Engineering Equipments
            </div>
            <div className="text-[8px] leading-tight space-y-0.5">
              <div>Address: {props.company.address || "-"}</div>
              <div>GSTIN/UIN: {props.company.gstin || "09ABCFR1989E1ZX"}</div>
              <div>State/Code: {DEFAULT_COMPANY_STATE.state} (Code: {DEFAULT_COMPANY_STATE.stateCode})</div>
              {props.company.phone && <div>Phone: {props.company.phone}</div>}
              {props.company.email && <div>Email: {props.company.email}</div>}
            </div>
          </div>

          <div className="flex-1 grid grid-cols-2 text-[8px] leading-tight">
            <div className="border-b border-r border-black p-1">
              <div className="text-neutral-500 uppercase text-[7px]">Invoice No.</div>
              <div className="font-bold text-[9px]">{invoice.invoiceNo || "-"}</div>
            </div>
            <div className="border-b border-black p-1">
              <div className="text-neutral-500 uppercase text-[7px]">Invoice Date</div>
              <div className="font-bold text-[9px]">{invoice.invoiceDate || "-"}</div>
            </div>
            <div className="border-b border-r border-black p-1">
              <div className="text-neutral-500 uppercase text-[7px]">PO No.</div>
              <div className="font-semibold">{invoice.poNo || "-"}</div>
            </div>
            <div className="border-b border-black p-1">
              <div className="text-neutral-500 uppercase text-[7px]">Bill Period</div>
              <div className="font-semibold">
                {invoice.billPeriodStart && invoice.billPeriodEnd
                  ? `${invoice.billPeriodStart} to ${invoice.billPeriodEnd}`
                  : "-"}
              </div>
            </div>
            <div className="border-b border-r border-black p-1">
              <div className="text-neutral-500 uppercase text-[7px]">Reference No. & Date</div>
              <div>-</div>
            </div>
            <div className="border-b border-black p-1">
              <div className="text-neutral-500 uppercase text-[7px]">Buyer's Order No.</div>
              <div>-</div>
            </div>
            <div className="border-b border-r border-black p-1">
              <div className="text-neutral-500 uppercase text-[7px]">Mode/Terms of Payment</div>
              <div>-</div>
            </div>
            <div className="border-b border-black p-1">
              <div className="text-neutral-500 uppercase text-[7px]">Dispatched Through</div>
              <div>{invoice.transportMode || "-"}</div>
            </div>
            <div className="border-r border-black p-1">
              <div className="text-neutral-500 uppercase text-[7px]">Destination</div>
              <div>{invoice.placeOfSupply || "-"}</div>
            </div>
            <div className="p-1">
              <div className="text-neutral-500 uppercase text-[7px]">Terms of Delivery</div>
              <div>-</div>
            </div>
          </div>
        </div>

        {/* SECTION 3 — CONSIGNEE (Ship To) LEFT | BUYER (Bill To) RIGHT */}
        <div className="flex border border-black">
          <div className="flex-1 p-1.5 border-r border-black space-y-1">
            <div className="text-[9px] font-bold uppercase border-b border-black pb-0.5 mb-1">
              Consignee (Ship To)
            </div>
            <div className="font-bold text-[9px]">
              {invoice.client.shipToName || invoice.client.name}
            </div>
            <div className="text-[8px] leading-tight">
              {invoice.client.shipToAddress || invoice.client.address}
            </div>
            <div className="text-[8px] font-semibold pt-1">
              GSTIN/UIN: {invoice.client.gstin || "-"}
            </div>
            <div className="text-[8px]">
              State: {invoice.client.state} (Code: {invoice.client.stateCode})
            </div>
            <div className="text-[8px]">
              Place of Supply: {invoice.placeOfSupply || invoice.client.state}
            </div>
          </div>

          <div className="flex-1 p-1.5 space-y-1">
            <div className="text-[9px] font-bold uppercase border-b border-black pb-0.5 mb-1">
              Buyer (Bill To)
            </div>
            <div className="font-bold text-[9px]">{invoice.client.name}</div>
            <div className="text-[8px] leading-tight">{invoice.client.address}</div>
            <div className="text-[8px] font-semibold pt-1">
              GSTIN/UIN: {invoice.client.gstin || "-"}
            </div>
            <div className="text-[8px]">
              State: {invoice.client.state} (Code: {invoice.client.stateCode})
            </div>
            <div className="text-[8px]">
              Place of Supply: {invoice.placeOfSupply || invoice.client.state}
            </div>
          </div>
        </div>

        {/* SECTION 4 — LINE ITEMS TABLE */}
        <div className="border border-black overflow-hidden">
          <div className="grid grid-cols-[30px_1fr_50px_45px_35px_40px_60px_65px] bg-neutral-100 font-bold border-b border-black text-center py-1">
            <div>Sl No.</div>
            <div>Particulars</div>
            <div>HSN/SAC</div>
            <div>GST Rate</div>
            <div>UOM</div>
            <div className="text-right pr-1">Qty</div>
            <div className="text-right pr-1">Rate (₹)</div>
            <div className="text-right pr-1">Amount (₹)</div>
          </div>

          <div className="divide-y divide-neutral-200">
            {lineItemsToDisplay.map((item, idx) => {
              const hasData = Boolean(item.description);
              const lineAmt = hasData ? calculateLineAmount(item.qty, item.rate) : 0;

              let itemGstRate = "-";
              if (hasData) {
                itemGstRate =
                  taxMode === "INTRA_STATE"
                    ? `${invoice.cgstRate + invoice.sgstRate}%`
                    : `${invoice.igstRate}%`;
              }

              return (
                <div
                  key={idx}
                  className="grid grid-cols-[30px_1fr_50px_45px_35px_40px_60px_65px] py-1 text-center items-center min-h-[18px]"
                >
                  <div className="text-neutral-500 font-semibold">{idx + 1}</div>
                  <div className="text-left pl-1 font-medium truncate">{item.description || ""}</div>
                  <div>{item.hsnSac || ""}</div>
                  <div>{itemGstRate}</div>
                  <div>{item.unit || ""}</div>
                  <div className="text-right pr-1 tabular-nums">{hasData ? item.qty : ""}</div>
                  <div className="text-right pr-1 tabular-nums">
                    {hasData ? formatINR(item.rate) : ""}
                  </div>
                  <div className="text-right pr-1 font-bold tabular-nums">
                    {hasData ? formatINR(lineAmt) : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 5 — AMOUNT SUMMARY ROW */}
        <div className="flex border border-black justify-between items-center py-1 px-2 font-bold text-[9px] bg-neutral-50">
          <div>
            <span>Amount Chargeable (in words): </span>
            <span className="font-normal normal-case italic">INR {amountInWords} Only</span>
          </div>
          <div className="text-[10px] text-right">
            ₹ {formatINR(totals.grandTotal)} E & O E
          </div>
        </div>

        {/* SECTION 6 — HSN/SAC TAX BREAKDOWN TABLE */}
        <div className="border border-black overflow-hidden text-[8px] leading-tight">
          <div className="grid grid-cols-[70px_1fr_100px_100px_100px] bg-neutral-100 font-bold border-b border-black text-center py-1">
            <div>HSN/SAC</div>
            <div>Taxable Value</div>
            {taxMode === "INTRA_STATE" ? (
              <>
                <div>CGST Rate & Amt</div>
                <div>SGST Rate & Amt</div>
              </>
            ) : (
              <div className="col-span-2">IGST Rate & Amt</div>
            )}
            <div>Total Tax Amount</div>
          </div>

          <div className="divide-y divide-neutral-200">
            {hsnRows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-[70px_1fr_100px_100px_100px] py-1 text-center">
                <div className="font-semibold">{row.hsn}</div>
                <div className="text-right pr-2 tabular-nums">{formatINR(row.taxableValue)}</div>
                {taxMode === "INTRA_STATE" ? (
                  <>
                    <div className="text-right pr-2 tabular-nums">
                      {invoice.cgstRate}%: {formatINR(row.cgstAmt)}
                    </div>
                    <div className="text-right pr-2 tabular-nums">
                      {invoice.sgstRate}%: {formatINR(row.sgstAmt)}
                    </div>
                  </>
                ) : (
                  <div className="col-span-2 text-right pr-2 tabular-nums">
                    {invoice.igstRate}%: {formatINR(row.igstAmt)}
                  </div>
                )}
                <div className="text-right pr-2 font-bold tabular-nums">{formatINR(row.totalTax)}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[70px_1fr_100px_100px_100px] bg-neutral-50 font-bold border-t border-black text-center py-1">
            <div>Total</div>
            <div className="text-right pr-2 tabular-nums">{formatINR(totals.totalBeforeTax)}</div>
            {taxMode === "INTRA_STATE" ? (
              <>
                <div className="text-right pr-2 tabular-nums">{formatINR(totals.cgst)}</div>
                <div className="text-right pr-2 tabular-nums">{formatINR(totals.sgst)}</div>
              </>
            ) : (
              <div className="col-span-2 text-right pr-2 tabular-nums">{formatINR(totals.igst)}</div>
            )}
            <div className="text-right pr-2 tabular-nums">{formatINR(taxTotal)}</div>
          </div>
        </div>

        {/* SECTION 7 — TAX AMOUNT IN WORDS */}
        <div className="border border-black p-1 text-[8px] bg-neutral-50">
          <span className="font-bold">Tax Amount (in words): </span>
          <span className="italic">INR {taxInWords} Only</span>
        </div>

        {/* SECTION 8 — FOOTER */}
        <div className="flex border border-black min-h-[90px] text-[7px] leading-snug">
          <div className="flex-[1.3] p-1.5 border-r border-black space-y-1">
            <div className="font-bold">Terms & Conditions / Declaration:</div>
            <div className="space-y-0.5 pl-1 leading-none text-[6.5px]">
              <div>1. Goods once sold will not be taken back or exchanged without approval.</div>
              <div>2. Subject to Agra Jurisdiction only.</div>
              <div>3. Our responsibility ceases when goods leave our godown.</div>
              <div>4. E.&.O.E.</div>
              <div>5. As per the rule, 100% GST for an enforcement agency is to be deposited by the service receiver.</div>
              <div>6. The MSMED Act 2006 specifies 45-day credit period for the recipient of goods/services to pay the MSME supplier.</div>
            </div>
            <div className="pt-0.5">
              <span className="font-bold">GST paid under Reverse Charge: </span>
              <span>{invoice.reverseCharge ? "Yes" : "No"}</span>
            </div>
          </div>

          <div className="flex-1 p-1.5 border-r border-black space-y-1">
            <div className="font-bold">Company's Bank Details:</div>
            <div className="space-y-0.5 text-[7.5px] leading-tight">
              <div><span className="font-bold">Bank Name: </span>{props.company.bankName || "-"}</div>
              <div><span className="font-bold">A/c No: </span>{props.company.accountNo || "-"}</div>
              <div><span className="font-bold">Branch & IFS Code: </span>{props.company.branch || "-"} & {props.company.ifsc || "-"}</div>
              <div><span className="font-bold">UPI ID: </span>{props.company.upiId || "-"}</div>
            </div>
          </div>

          <div className="flex-1 p-1.5 flex flex-col justify-between text-center">
            <div className="font-bold text-[7.5px]">For {props.company.companyName || "M/S RADHA KISHAN ENTERPRISES"}</div>
            <div className="h-9 flex items-center justify-center py-0.5">
              {invoice.signature?.dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={invoice.signature.dataUrl}
                  alt="Signature"
                  className="h-full object-contain dark:invert"
                />
              ) : (
                <div className="h-4" />
              )}
            </div>
            <div className="border-t border-black pt-0.5">
              <div className="font-bold text-[7.5px]">Authorised Signatory | Partner</div>
              <div className="text-[6px] text-neutral-500">This is a Computer Generated Invoice</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
