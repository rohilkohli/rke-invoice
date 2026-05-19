import {
  Document,
  Image as PdfImage,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type { InvoiceFormData } from "@/components/invoice/types";
import type { CompanySettingsPreview } from "@/components/invoice/InvoicePreview";
import {
  amountInWordsINR,
  calculateLineAmount,
  calculateTotals,
  getTaxMode,
} from "@/lib/calculations";
import { DEFAULT_COMPANY_STATE } from "@/lib/defaults";

export type InvoiceCopy = "ORIGINAL" | "DUPLICATE" | "TRIPLICATE";

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontSize: 7.5,
    fontFamily: "Helvetica",
    color: "#000",
  },
  watermark: {
    position: "absolute",
    top: "35%",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 70,
    color: "#DDD",
    opacity: 0.15,
    transform: "rotate(-25deg)",
    zIndex: -1,
  },
  titleBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1.5,
    borderBottomColor: "#000",
    paddingBottom: 4,
    marginBottom: 6,
  },
  titleLeft: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  titleRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  qrContainer: {
    alignItems: "center",
  },
  qrImage: {
    width: 44,
    height: 44,
  },
  qrLabel: {
    fontSize: 5.5,
    fontFamily: "Helvetica-Bold",
    marginTop: 1,
    textAlign: "center",
  },
  section2: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#000",
    marginBottom: 6,
  },
  sellerBlock: {
    flex: 1.1,
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  sellerName: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  sellerTagline: {
    fontSize: 7,
    color: "#444",
    marginBottom: 4,
    fontStyle: "italic",
  },
  sellerDetail: {
    lineHeight: 1.2,
    fontSize: 7,
  },
  metaTable: {
    flex: 1,
  },
  metaRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    minHeight: 16,
  },
  metaRowLast: {
    flexDirection: "row",
    minHeight: 16,
  },
  metaCell: {
    flex: 1,
    padding: 3,
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  metaCellLast: {
    flex: 1,
    padding: 3,
  },
  metaLabel: {
    fontSize: 5.5,
    color: "#555",
    textTransform: "uppercase",
  },
  metaValue: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    marginTop: 1,
  },
  section3: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#000",
    marginBottom: 6,
  },
  addressBlockLeft: {
    flex: 1,
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  addressBlockRight: {
    flex: 1,
    padding: 5,
  },
  sectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    marginBottom: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: "#000",
    paddingBottom: 1,
  },
  addressLine: {
    lineHeight: 1.25,
    fontSize: 7,
  },
  table: {
    borderWidth: 1,
    borderColor: "#000",
    marginBottom: 6,
  },
  th: {
    flexDirection: "row",
    backgroundColor: "#F0F0F0",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    fontFamily: "Helvetica-Bold",
    minHeight: 15,
    alignItems: "center",
  },
  td: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#000",
    minHeight: 16,
    alignItems: "center",
  },
  tdLast: {
    flexDirection: "row",
    minHeight: 16,
    alignItems: "center",
  },
  colNo: { width: 25, textAlign: "center" },
  colDesc: { flex: 1, paddingHorizontal: 4 },
  colHsn: { width: 45, textAlign: "center" },
  colGst: { width: 35, textAlign: "center" },
  colUom: { width: 30, textAlign: "center" },
  colQty: { width: 35, textAlign: "right", paddingRight: 4 },
  colRate: { width: 55, textAlign: "right", paddingRight: 4 },
  colAmt: { width: 65, textAlign: "right", paddingRight: 4 },
  summaryRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#000",
    marginBottom: 6,
    minHeight: 18,
    alignItems: "center",
  },
  summaryLeft: {
    flex: 1,
    paddingHorizontal: 5,
  },
  summaryRight: {
    width: 150,
    textAlign: "right",
    paddingRight: 6,
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
  },
  breakdownTable: {
    borderWidth: 1,
    borderColor: "#000",
    marginBottom: 6,
  },
  breakdownTh: {
    flexDirection: "row",
    backgroundColor: "#F0F0F0",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    fontFamily: "Helvetica-Bold",
    minHeight: 15,
    alignItems: "center",
  },
  breakdownTd: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#000",
    minHeight: 15,
    alignItems: "center",
  },
  breakdownTotal: {
    flexDirection: "row",
    backgroundColor: "#F5F5F5",
    borderTopWidth: 0.5,
    borderTopColor: "#000",
    fontFamily: "Helvetica-Bold",
    minHeight: 15,
    alignItems: "center",
  },
  bdColHsn: { width: 65, textAlign: "center" },
  bdColTaxable: { flex: 1.1, textAlign: "right", paddingRight: 6 },
  bdColRateAmt: { flex: 1, textAlign: "right", paddingRight: 6 },
  bdColTotal: { width: 85, textAlign: "right", paddingRight: 6 },
  taxWordsRow: {
    borderWidth: 1,
    borderColor: "#000",
    padding: 4,
    marginBottom: 6,
  },
  footer: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#000",
    minHeight: 100,
  },
  footerCol1: {
    flex: 1.3,
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  footerCol2: {
    flex: 1,
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  footerCol3: {
    flex: 1,
    padding: 5,
    justifyContent: "space-between",
  },
  bulletList: {
    marginTop: 1,
    lineHeight: 0.95,
  },
  bulletItem: {
    fontSize: 5.8,
    color: "#000",
  },
  bankLine: {
    fontSize: 6.5,
    lineHeight: 1.3,
  },
  signTitle: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  signBox: {
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 2,
  },
  signImage: {
    height: "100%",
    objectFit: "contain",
  },
  signLine: {
    borderTopWidth: 0.5,
    borderTopColor: "#000",
    paddingTop: 2,
    marginTop: 2,
  },
  signFooter: {
    fontSize: 5.5,
    textAlign: "center",
    color: "#444",
  },
  bold: {
    fontFamily: "Helvetica-Bold",
  },
});

function inr(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function InvoicePDF(props: {
  invoice: InvoiceFormData;
  company: CompanySettingsPreview;
  copy: InvoiceCopy;
  qrDataUrl?: string | null;
}) {
  const taxMode = getTaxMode(DEFAULT_COMPANY_STATE.stateCode, props.invoice.client.stateCode);
  const totals = calculateTotals({
    items: props.invoice.lineItems.map((li) => ({ qty: li.qty, rate: li.rate })),
    cgstRate: props.invoice.cgstRate,
    sgstRate: props.invoice.sgstRate,
    igstRate: props.invoice.igstRate,
    taxMode,
  });

  const amountInWords = amountInWordsINR(totals.grandTotal);
  const taxTotal = totals.cgst + totals.sgst + totals.igst;
  const taxInWords = amountInWordsINR(taxTotal);

  // Fill up table rows to minimum 5
  const lineItemsToDisplay = [...props.invoice.lineItems];
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

  props.invoice.lineItems.forEach((item) => {
    const hsn = item.hsnSac || "998719";
    const taxableValue = item.qty * item.rate;

    let cgstAmt = 0;
    let sgstAmt = 0;
    let igstAmt = 0;

    if (taxMode === "INTRA_STATE") {
      cgstAmt = (taxableValue * props.invoice.cgstRate) / 100;
      sgstAmt = (taxableValue * props.invoice.sgstRate) / 100;
    } else {
      igstAmt = (taxableValue * props.invoice.igstRate) / 100;
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
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.watermark}>{props.copy}</Text>

        {/* SECTION 1 — TOP HEADER BAR */}
        <View style={styles.titleBar}>
          <Text style={styles.titleLeft}>Tax Invoice ({props.copy} COPY)</Text>
          <View style={styles.titleRight}>
            <View style={styles.qrContainer}>
              {props.qrDataUrl ? (
                <PdfImage src={props.qrDataUrl} style={styles.qrImage} />
              ) : (
                <View style={[styles.qrImage, { borderWidth: 0.5, borderColor: "#000" }]} />
              )}
              <Text style={styles.qrLabel}>Scan for Details</Text>
            </View>
          </View>
        </View>

        {/* SECTION 2 — SELLER INFO | INVOICE META TABLE */}
        <View style={styles.section2}>
          <View style={styles.sellerBlock}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1, marginRight: 5 }}>
                <Text style={styles.sellerName}>{props.company.companyName || "M/S RADHA KISHAN ENTERPRISES"}</Text>
                <Text style={styles.sellerTagline}>Rental Service of Heavy Engineering Equipments</Text>
                <Text style={styles.sellerDetail}>Address: {props.company.address || "-"}</Text>
                <Text style={styles.sellerDetail}>GSTIN/UIN: {props.company.gstin || "09ABCFR1989E1ZX"}</Text>
                <Text style={styles.sellerDetail}>State/Code: {DEFAULT_COMPANY_STATE.state} (Code: {DEFAULT_COMPANY_STATE.stateCode})</Text>
                {props.company.phone ? <Text style={styles.sellerDetail}>Phone: {props.company.phone}</Text> : null}
                {props.company.email ? <Text style={styles.sellerDetail}>Email: {props.company.email}</Text> : null}
              </View>
              <View style={{ width: 42, height: 42, borderWidth: 0.5, borderColor: "#ccc", padding: 1, backgroundColor: "#fff", flexShrink: 0, marginTop: 2 }}>
                <PdfImage
                  src={props.company.logoUrl || "/RKE logo.png"}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              </View>
            </View>
          </View>

          <View style={styles.metaTable}>
            <View style={styles.metaRow}>
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>Invoice No.</Text>
                <Text style={styles.metaValue}>{props.invoice.invoiceNo}</Text>
              </View>
              <View style={styles.metaCellLast}>
                <Text style={styles.metaLabel}>Invoice Date</Text>
                <Text style={styles.metaValue}>{props.invoice.invoiceDate}</Text>
              </View>
            </View>
            <View style={styles.metaRow}>
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>PO No.</Text>
                <Text style={styles.metaValue}>{props.invoice.poNo || "-"}</Text>
              </View>
              <View style={styles.metaCellLast}>
                <Text style={styles.metaLabel}>Bill Period</Text>
                <Text style={styles.metaValue}>
                  {props.invoice.billPeriodStart && props.invoice.billPeriodEnd
                    ? `${props.invoice.billPeriodStart} to ${props.invoice.billPeriodEnd}`
                    : "-"}
                </Text>
              </View>
            </View>
            <View style={styles.metaRow}>
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>Reference No. & Date</Text>
                <Text style={styles.metaValue}>-</Text>
              </View>
              <View style={styles.metaCellLast}>
                <Text style={styles.metaLabel}>Buyer's Order No.</Text>
                <Text style={styles.metaValue}>-</Text>
              </View>
            </View>
            <View style={styles.metaRow}>
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>Mode/Terms of Payment</Text>
                <Text style={styles.metaValue}>-</Text>
              </View>
              <View style={styles.metaCellLast}>
                <Text style={styles.metaLabel}>Dispatched Through</Text>
                <Text style={styles.metaValue}>{props.invoice.transportMode || "-"}</Text>
              </View>
            </View>
            <View style={styles.metaRowLast}>
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>Destination</Text>
                <Text style={styles.metaValue}>{props.invoice.placeOfSupply || "-"}</Text>
              </View>
              <View style={styles.metaCellLast}>
                <Text style={styles.metaLabel}>Terms of Delivery</Text>
                <Text style={styles.metaValue}>-</Text>
              </View>
            </View>
          </View>
        </View>

        {/* SECTION 3 — CONSIGNEE (Ship To) LEFT | BUYER (Bill To) RIGHT */}
        <View style={styles.section3}>
          <View style={styles.addressBlockLeft}>
            <Text style={styles.sectionTitle}>Consignee (Ship To)</Text>
            <Text style={[styles.addressLine, styles.bold]}>
              {props.invoice.client.shipToName || props.invoice.client.name}
            </Text>
            <Text style={styles.addressLine}>
              {props.invoice.client.shipToAddress || props.invoice.client.address}
            </Text>
            <Text style={styles.addressLine}>
              GSTIN/UIN: {props.invoice.client.gstin || "-"}
            </Text>
            <Text style={styles.addressLine}>
              State: {props.invoice.client.state} (Code: {props.invoice.client.stateCode})
            </Text>
            <Text style={styles.addressLine}>
              Place of Supply: {props.invoice.placeOfSupply || props.invoice.client.state}
            </Text>
          </View>

          <View style={styles.addressBlockRight}>
            <Text style={styles.sectionTitle}>Buyer (Bill To)</Text>
            <Text style={[styles.addressLine, styles.bold]}>{props.invoice.client.name}</Text>
            <Text style={styles.addressLine}>{props.invoice.client.address}</Text>
            <Text style={styles.addressLine}>GSTIN/UIN: {props.invoice.client.gstin || "-"}</Text>
            <Text style={styles.addressLine}>
              State: {props.invoice.client.state} (Code: {props.invoice.client.stateCode})
            </Text>
            <Text style={styles.addressLine}>
              Place of Supply: {props.invoice.placeOfSupply || props.invoice.client.state}
            </Text>
          </View>
        </View>

        {/* SECTION 4 — LINE ITEMS TABLE */}
        <View style={styles.table}>
          <View style={styles.th}>
            <Text style={styles.colNo}>Sl No.</Text>
            <Text style={styles.colDesc}>Particulars</Text>
            <Text style={styles.colHsn}>HSN/SAC</Text>
            <Text style={styles.colGst}>GST Rate</Text>
            <Text style={styles.colUom}>UOM</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colRate}>Rate (₹)</Text>
            <Text style={styles.colAmt}>Amount (₹)</Text>
          </View>

          {lineItemsToDisplay.map((item, idx) => {
            const hasData = Boolean(item.description);
            const lineAmt = hasData ? calculateLineAmount(item.qty, item.rate) : 0;
            const isLast = idx === lineItemsToDisplay.length - 1;

            let itemGstRate = "-";
            if (hasData) {
              itemGstRate =
                taxMode === "INTRA_STATE"
                  ? `${props.invoice.cgstRate + props.invoice.sgstRate}%`
                  : `${props.invoice.igstRate}%`;
            }

            return (
              <View key={idx} style={isLast ? styles.tdLast : styles.td}>
                <Text style={styles.colNo}>{idx + 1}</Text>
                <Text style={styles.colDesc}>{item.description || ""}</Text>
                <Text style={styles.colHsn}>{item.hsnSac || ""}</Text>
                <Text style={styles.colGst}>{itemGstRate}</Text>
                <Text style={styles.colUom}>{item.unit || ""}</Text>
                <Text style={styles.colQty}>{hasData ? item.qty : ""}</Text>
                <Text style={styles.colRate}>{hasData ? inr(item.rate) : ""}</Text>
                <Text style={styles.colAmt}>{hasData ? inr(lineAmt) : ""}</Text>
              </View>
            );
          })}
        </View>

        {/* SECTION 5 — AMOUNT SUMMARY ROW */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryLeft}>
            <Text style={{ fontSize: 6.8 }}>
              <Text style={styles.bold}>Amount Chargeable (in words): </Text>
              INR {amountInWords} Only
            </Text>
          </View>
          <Text style={styles.summaryRight}>₹ {inr(totals.grandTotal)} E & O E</Text>
        </View>

        {/* SECTION 6 — HSN/SAC TAX BREAKDOWN TABLE */}
        <View style={styles.breakdownTable}>
          <View style={styles.breakdownTh}>
            <Text style={styles.bdColHsn}>HSN/SAC</Text>
            <Text style={styles.bdColTaxable}>Taxable Value</Text>
            {taxMode === "INTRA_STATE" ? (
              <>
                <Text style={styles.bdColRateAmt}>CGST Rate & Amt</Text>
                <Text style={styles.bdColRateAmt}>SGST Rate & Amt</Text>
              </>
            ) : (
              <Text style={styles.bdColRateAmt}>IGST Rate & Amt</Text>
            )}
            <Text style={styles.bdColTotal}>Total Tax Amount</Text>
          </View>

          {hsnRows.map((row, idx) => {
            return (
              <View key={idx} style={styles.breakdownTd}>
                <Text style={styles.bdColHsn}>{row.hsn}</Text>
                <Text style={styles.bdColTaxable}>{inr(row.taxableValue)}</Text>
                {taxMode === "INTRA_STATE" ? (
                  <>
                    <Text style={styles.bdColRateAmt}>
                      {props.invoice.cgstRate}%: {inr(row.cgstAmt)}
                    </Text>
                    <Text style={styles.bdColRateAmt}>
                      {props.invoice.sgstRate}%: {inr(row.sgstAmt)}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.bdColRateAmt}>
                    {props.invoice.igstRate}%: {inr(row.igstAmt)}
                  </Text>
                )}
                <Text style={styles.bdColTotal}>{inr(row.totalTax)}</Text>
              </View>
            );
          })}

          <View style={styles.breakdownTotal}>
            <Text style={styles.bdColHsn}>Total</Text>
            <Text style={styles.bdColTaxable}>{inr(totals.totalBeforeTax)}</Text>
            {taxMode === "INTRA_STATE" ? (
              <>
                <Text style={styles.bdColRateAmt}>{inr(totals.cgst)}</Text>
                <Text style={styles.bdColRateAmt}>{inr(totals.sgst)}</Text>
              </>
            ) : (
              <Text style={styles.bdColRateAmt}>{inr(totals.igst)}</Text>
            )}
            <Text style={styles.bdColTotal}>{inr(taxTotal)}</Text>
          </View>
        </View>

        {/* SECTION 7 — TAX AMOUNT IN WORDS */}
        <View style={styles.taxWordsRow}>
          <Text style={{ fontSize: 6.8 }}>
            <Text style={styles.bold}>Tax Amount (in words): </Text>
            INR {taxInWords} Only
          </Text>
        </View>

        {/* SECTION 8 — FOOTER */}
        <View style={styles.footer}>
          <View style={styles.footerCol1}>
            <Text style={styles.bold}>Terms & Conditions / Declaration:</Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>1. Goods once sold will not be taken back or exchanged without approval.</Text>
              <Text style={styles.bulletItem}>2. Subject to Agra Jurisdiction only.</Text>
              <Text style={styles.bulletItem}>3. Our responsibility ceases when goods leave our godown.</Text>
              <Text style={styles.bulletItem}>4. E.&.O.E.</Text>
              <Text style={styles.bulletItem}>5. As per the rule, 100% GST for an enforcement agency is to be deposited by the service receiver.</Text>
              <Text style={styles.bulletItem}>6. The MSMED Act 2006 specifies 45-day credit period for the recipient of goods/services to pay the MSME supplier.</Text>
            </View>
            <View style={{ marginTop: 4 }}>
              <Text style={{ fontSize: 6.2 }}>
                <Text style={styles.bold}>GST paid under Reverse Charge: </Text>
                {props.invoice.reverseCharge ? "Yes" : "No"}
              </Text>
            </View>
          </View>

          <View style={styles.footerCol2}>
            <Text style={styles.bold}>Company&apos;s Bank Details:</Text>
            <View style={{ marginTop: 2 }}>
              <Text style={styles.bankLine}><Text style={styles.bold}>Bank Name: </Text>{props.company.bankName || "-"}</Text>
              <Text style={styles.bankLine}><Text style={styles.bold}>A/c No: </Text>{props.company.accountNo || "-"}</Text>
              <Text style={styles.bankLine}><Text style={styles.bold}>Branch & IFS Code: </Text>{props.company.branch || "-"} & {props.company.ifsc || "-"}</Text>
              <Text style={styles.bankLine}><Text style={styles.bold}>UPI ID: </Text>{props.company.upiId || "-"}</Text>
            </View>
          </View>

          <View style={styles.footerCol3}>
            <Text style={styles.signTitle}>For {props.company.companyName || "M/S RADHA KISHAN ENTERPRISES"}</Text>
            <View style={styles.signBox}>
              {props.invoice.signature?.dataUrl ? (
                <PdfImage src={props.invoice.signature.dataUrl} style={styles.signImage} />
              ) : (
                <View style={{ height: 20 }} />
              )}
            </View>
            <View style={styles.signLine}>
              <Text style={[styles.bold, { fontSize: 6, textAlign: "center" }]}>Authorised Signatory | Partner</Text>
            </View>
            <Text style={styles.signFooter}>This is a Computer Generated Invoice</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
