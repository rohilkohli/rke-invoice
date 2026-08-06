import {
  Document,
  Font,
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

// Register font with full Unicode support including Rupee symbol (₹) and all font styles
Font.register({
  family: "Arimo",
  fonts: [
    {
      src: "https://raw.githubusercontent.com/google/fonts/main/ofl/arimo/Arimo%5Bwght%5D.ttf",
      fontWeight: "normal",
      fontStyle: "normal",
    },
    {
      src: "https://raw.githubusercontent.com/google/fonts/main/ofl/arimo/Arimo%5Bwght%5D.ttf",
      fontWeight: "bold",
      fontStyle: "normal",
    },
    {
      src: "https://raw.githubusercontent.com/google/fonts/main/ofl/arimo/Arimo-Italic%5Bwght%5D.ttf",
      fontWeight: "normal",
      fontStyle: "italic",
    },
    {
      src: "https://raw.githubusercontent.com/google/fonts/main/ofl/arimo/Arimo-Italic%5Bwght%5D.ttf",
      fontWeight: "bold",
      fontStyle: "italic",
    },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontSize: 8,
    fontFamily: "Arimo",
    color: "#000",
  },
  watermarkContainer: {
    position: "absolute",
    top: "40%",
    left: 0,
    right: 0,
    textAlign: "center",
    alignItems: "center",
    justifyContent: "center",
    zIndex: -1,
  },
  watermarkText: {
    fontSize: 68,
    color: "#CCCCCC",
    opacity: 0.22,
    transform: "rotate(-35deg)",
    letterSpacing: 16,
    fontFamily: "Arimo",
    fontWeight: "bold",
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
    fontSize: 14.5,
    fontFamily: "Arimo",
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  titleRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  qrContainer: {
    alignItems: "flex-start",
  },
  qrImage: {
    width: 62,
    height: 62,
  },
  qrLabel: {
    fontSize: 6.2,
    fontFamily: "Arimo",
    fontWeight: "bold",
    marginTop: 2,
    textAlign: "left",
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
    fontSize: 10.5,
    fontFamily: "Arimo",
    fontWeight: "bold",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  sellerTagline: {
    fontSize: 7.5,
    color: "#444",
    marginBottom: 4,
    fontStyle: "italic",
  },
  sellerDetail: {
    lineHeight: 1.25,
    fontSize: 7.8,
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
    fontSize: 6.2,
    color: "#555",
    textTransform: "uppercase",
  },
  metaValue: {
    fontSize: 7.8,
    fontFamily: "Arimo",
    fontWeight: "bold",
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
    fontSize: 8.8,
    fontFamily: "Arimo",
    fontWeight: "bold",
    textTransform: "uppercase",
    marginBottom: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: "#000",
    paddingBottom: 1,
  },
  addressLine: {
    lineHeight: 1.25,
    fontSize: 7.8,
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
    fontFamily: "Arimo",
    fontWeight: "bold",
    minHeight: 16,
    alignItems: "stretch",
  },
  td: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#000",
    minHeight: 16,
    alignItems: "stretch",
  },
  tdLast: {
    flexDirection: "row",
    minHeight: 16,
    alignItems: "stretch",
  },
  colNo: {
    flex: 0.35,
    textAlign: "center",
    borderRightWidth: 0.5,
    borderRightColor: "#000",
    justifyContent: "center",
  },
  colDesc: {
    flex: 3.5,
    paddingHorizontal: 4,
    borderRightWidth: 0.5,
    borderRightColor: "#000",
    justifyContent: "center",
  },
  colHsn: {
    flex: 0.7,
    textAlign: "center",
    borderRightWidth: 0.5,
    borderRightColor: "#000",
    justifyContent: "center",
  },
  colGst: {
    flex: 0.55,
    textAlign: "center",
    borderRightWidth: 0.5,
    borderRightColor: "#000",
    justifyContent: "center",
  },
  colUom: {
    flex: 0.45,
    textAlign: "center",
    borderRightWidth: 0.5,
    borderRightColor: "#000",
    justifyContent: "center",
  },
  colQty: {
    flex: 0.5,
    textAlign: "right",
    paddingRight: 4,
    borderRightWidth: 0.5,
    borderRightColor: "#000",
    justifyContent: "center",
  },
  colRate: {
    flex: 0.9,
    textAlign: "right",
    paddingRight: 4,
    borderRightWidth: 0.5,
    borderRightColor: "#000",
    justifyContent: "center",
  },
  colAmt: {
    flex: 1.1,
    textAlign: "right",
    paddingRight: 4,
    justifyContent: "center",
  },
  summaryRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#000",
    marginBottom: 6,
    minHeight: 18,
    alignItems: "stretch",
  },
  summaryLeft: {
    flex: 1,
    paddingHorizontal: 5,
    borderRightWidth: 0.5,
    borderRightColor: "#000",
    justifyContent: "center",
  },
  summaryRight: {
    width: 150,
    textAlign: "right",
    paddingRight: 6,
    fontFamily: "Arimo",
    fontWeight: "bold",
    fontSize: 9.5,
    justifyContent: "center",
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
    fontFamily: "Arimo",
    fontWeight: "bold",
    minHeight: 15,
    alignItems: "stretch",
  },
  breakdownTd: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#000",
    minHeight: 15,
    alignItems: "stretch",
  },
  breakdownTotal: {
    flexDirection: "row",
    backgroundColor: "#F5F5F5",
    borderTopWidth: 0.5,
    borderTopColor: "#000",
    fontFamily: "Arimo",
    fontWeight: "bold",
    minHeight: 15,
    alignItems: "stretch",
  },
  bdColHsn: {
    flex: 0.8,
    textAlign: "center",
    borderRightWidth: 0.5,
    borderRightColor: "#000",
    justifyContent: "center",
  },
  bdColTaxable: {
    flex: 1.3,
    textAlign: "right",
    paddingRight: 6,
    borderRightWidth: 0.5,
    borderRightColor: "#000",
    justifyContent: "center",
  },
  bdColRateAmt: {
    flex: 1,
    textAlign: "right",
    paddingRight: 6,
    borderRightWidth: 0.5,
    borderRightColor: "#000",
    justifyContent: "center",
  },
  bdColRateAmtIgst: {
    flex: 2,
    textAlign: "right",
    paddingRight: 6,
    borderRightWidth: 0.5,
    borderRightColor: "#000",
    justifyContent: "center",
  },
  bdColTotal: {
    flex: 1.3,
    textAlign: "right",
    paddingRight: 6,
    justifyContent: "center",
  },
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
    marginTop: 3,
  },
  bulletItem: {
    fontSize: 6.8,
    lineHeight: 1.25,
    marginBottom: 2.5,
    color: "#000",
  },
  bankLine: {
    fontSize: 7.2,
    lineHeight: 1.35,
  },
  signTitle: {
    fontSize: 7.2,
    fontFamily: "Arimo",
    fontWeight: "bold",
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
    fontSize: 6,
    textAlign: "center",
    color: "#444",
  },
  bold: {
    fontFamily: "Arimo",
    fontWeight: "bold",
  },
});

function inr(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

/** Resolve logo: prefer provided logoUrl, fall back to public/RKE logo.png as absolute URL */
function resolveLogoSrc(logoUrl: string | null | undefined): string | null {
  if (logoUrl && (logoUrl.startsWith("data:") || logoUrl.startsWith("http"))) {
    return logoUrl;
  }
  // For server-side rendering, the logo is resolved in generatePdfServer.ts
  // For client-side, use absolute path which @react-pdf/renderer can fetch
  if (logoUrl) {
    return logoUrl;
  }
  return null;
}

export function InvoicePDF(props: {
  invoice: InvoiceFormData;
  company: CompanySettingsPreview;
  copy: InvoiceCopy;
  qrDataUrl?: string | null;
}) {
  const companyStateCode = props.company.stateCode ?? DEFAULT_COMPANY_STATE.stateCode;
  const taxMode = getTaxMode(companyStateCode, props.invoice.client.stateCode);
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

  const logoSrc = resolveLogoSrc(props.company.logoUrl);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Background Watermark */}
        <View style={styles.watermarkContainer} fixed>
          <Text style={styles.watermarkText}>{props.copy}</Text>
        </View>

        {/* SECTION 1 — TOP HEADER BAR */}
        <View style={styles.titleBar}>
          <Text style={styles.titleLeft}>
            {props.invoice.status === "QUOTATION" ? "Quotation" : `Tax Invoice (${props.copy} COPY)`}
          </Text>
        </View>

        {/* SECTION 2 — SELLER INFO | INVOICE META TABLE */}
        <View style={styles.section2}>
          <View style={styles.sellerBlock}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
              {logoSrc ? (
                <PdfImage
                  src={logoSrc}
                  style={{ width: 64, height: 64, objectFit: "contain", marginTop: 2, marginRight: 2 }}
                />
              ) : null}
              <View style={{ flex: 1 }}>
                <Text style={styles.sellerName}>{props.company.companyName || "M/S RADHA KISHAN ENTERPRISES"}</Text>
                {props.company.tagline ? (
                  <Text style={styles.sellerTagline}>{props.company.tagline}</Text>
                ) : null}
                <Text style={styles.sellerDetail}>Address: {props.company.address || "-"}</Text>
                <Text style={styles.sellerDetail}>GSTIN: {props.company.gstin || "09ABCFR1989E1ZX"}</Text>
                <Text style={styles.sellerDetail}>State: {props.company.state || DEFAULT_COMPANY_STATE.state}</Text>
                <Text style={styles.sellerDetail}>Code: {props.company.stateCode || DEFAULT_COMPANY_STATE.stateCode}</Text>
                {props.company.phone ? <Text style={styles.sellerDetail}>Phone: {props.company.phone}</Text> : null}
                {props.company.email ? <Text style={styles.sellerDetail}>Email: {props.company.email}</Text> : null}
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
                <Text style={styles.metaValue}>
                  {props.invoice.referenceNo
                    ? `${props.invoice.referenceNo}${props.invoice.referenceDate ? ` / ${props.invoice.referenceDate}` : ""}`
                    : "-"}
                </Text>
              </View>
              <View style={styles.metaCellLast}>
                <Text style={styles.metaLabel}>Buyer&apos;s Order No.</Text>
                <Text style={styles.metaValue}>-</Text>
              </View>
            </View>
            <View style={styles.metaRow}>
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>Mode/Terms of Payment</Text>
                <Text style={styles.metaValue}>{props.invoice.paymentTerms || "-"}</Text>
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
                <Text style={styles.metaValue}>{props.invoice.termsOfDelivery || "-"}</Text>
              </View>
            </View>
            {(props.invoice.irn || props.invoice.ewayBillNo) && (
              <View style={styles.metaRowLast}>
                <View style={styles.metaCell}>
                  <Text style={styles.metaLabel}>IRN</Text>
                  <Text style={[styles.metaValue, { fontSize: 5.5 }]}>{props.invoice.irn || "-"}</Text>
                </View>
                <View style={styles.metaCellLast}>
                  <Text style={styles.metaLabel}>E-Way Bill No.</Text>
                  <Text style={styles.metaValue}>{props.invoice.ewayBillNo || "-"}</Text>
                </View>
              </View>
            )}
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
              GSTIN: {props.invoice.client.shipToGstin || props.invoice.client.gstin || "-"}
            </Text>
            <Text style={styles.addressLine}>
              State: {props.invoice.client.shipToState || props.invoice.client.state || "-"}
            </Text>
            <Text style={styles.addressLine}>
              Code: {props.invoice.client.shipToStateCode || props.invoice.client.stateCode || "-"}
            </Text>
            <Text style={styles.addressLine}>
              Place of Supply: {props.invoice.placeOfSupply || props.invoice.client.state}
            </Text>
          </View>

          <View style={styles.addressBlockRight}>
            <Text style={styles.sectionTitle}>Buyer (Bill To)</Text>
            <Text style={[styles.addressLine, styles.bold]}>{props.invoice.client.name}</Text>
            <Text style={styles.addressLine}>{props.invoice.client.address}</Text>
            <Text style={styles.addressLine}>GSTIN: {props.invoice.client.gstin || "-"}</Text>
            <Text style={styles.addressLine}>
              State: {props.invoice.client.state}
            </Text>
            <Text style={styles.addressLine}>
              Code: {props.invoice.client.stateCode || "-"}
            </Text>
            <Text style={styles.addressLine}>
              Place of Supply: {props.invoice.placeOfSupply || props.invoice.client.state}
            </Text>
          </View>
        </View>

        {/* SECTION 4 — LINE ITEMS TABLE */}
        <View style={styles.table}>
          <View style={styles.th}>
            <View style={styles.colNo}><Text>S.No.</Text></View>
            <View style={styles.colDesc}><Text>Particulars</Text></View>
            <View style={styles.colHsn}><Text>HSN/SAC</Text></View>
            <View style={styles.colGst}><Text>GST Rate</Text></View>
            <View style={styles.colUom}><Text>UOM</Text></View>
            <View style={styles.colQty}><Text>Qty</Text></View>
            <View style={styles.colRate}><Text>Rate (₹)</Text></View>
            <View style={styles.colAmt}><Text>Amount (₹)</Text></View>
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
                <View style={styles.colNo}><Text>{hasData ? idx + 1 : ""}</Text></View>
                <View style={styles.colDesc}>
                  <Text>{item.description || ""}</Text>
                  {(item.meterStart != null || item.meterEnd != null) && (
                    <Text style={{ fontSize: 5.5, color: "#444", marginTop: 1 }}>
                      [Meter Start: {item.meterStart ?? 0} | End: {item.meterEnd ?? 0}]
                    </Text>
                  )}
                </View>
                <View style={styles.colHsn}><Text>{item.hsnSac || (hasData ? "998719" : "")}</Text></View>
                <View style={styles.colGst}><Text>{itemGstRate}</Text></View>
                <View style={styles.colUom}><Text>{item.unit || ""}</Text></View>
                <View style={styles.colQty}><Text>{hasData ? item.qty : ""}</Text></View>
                <View style={styles.colRate}><Text>{hasData ? inr(item.rate) : ""}</Text></View>
                <View style={styles.colAmt}><Text>{hasData ? inr(lineAmt) : ""}</Text></View>
              </View>
            );
          })}
        </View>

        {/* SECTION 5 — AMOUNT SUMMARY ROW */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryLeft}>
            <Text style={{ fontSize: 6.8 }}>
              <Text style={styles.bold}>Amount Chargeable (in words): </Text>
              INR {amountInWords}
            </Text>
          </View>
          <View style={styles.summaryRight}>
            <Text>₹ {inr(totals.grandTotal)} E & O E</Text>
          </View>
        </View>

        {/* SECTION 6 — HSN/SAC TAX BREAKDOWN TABLE */}
        <View style={styles.breakdownTable}>
          <View style={styles.breakdownTh}>
            <View style={styles.bdColHsn}><Text>HSN/SAC</Text></View>
            <View style={styles.bdColTaxable}><Text>Taxable Value</Text></View>
            {taxMode === "INTRA_STATE" ? (
              <>
                <View style={styles.bdColRateAmt}><Text>CGST Rate & Amt</Text></View>
                <View style={styles.bdColRateAmt}><Text>SGST Rate & Amt</Text></View>
              </>
            ) : (
              <View style={styles.bdColRateAmtIgst}><Text>IGST Rate & Amt</Text></View>
            )}
            <View style={styles.bdColTotal}><Text>Total Tax Amount</Text></View>
          </View>

          {hsnRows.map((row, idx) => {
            return (
              <View key={idx} style={styles.breakdownTd}>
                <View style={styles.bdColHsn}><Text>{row.hsn}</Text></View>
                <View style={styles.bdColTaxable}><Text>{inr(row.taxableValue)}</Text></View>
                {taxMode === "INTRA_STATE" ? (
                  <>
                    <View style={styles.bdColRateAmt}>
                      <Text>{props.invoice.cgstRate}%: {inr(row.cgstAmt)}</Text>
                    </View>
                    <View style={styles.bdColRateAmt}>
                      <Text>{props.invoice.sgstRate}%: {inr(row.sgstAmt)}</Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.bdColRateAmtIgst}>
                    <Text>{props.invoice.igstRate}%: {inr(row.igstAmt)}</Text>
                  </View>
                )}
                <View style={styles.bdColTotal}><Text>{inr(row.totalTax)}</Text></View>
              </View>
            );
          })}

          <View style={styles.breakdownTotal}>
            <View style={styles.bdColHsn}><Text>Total</Text></View>
            <View style={styles.bdColTaxable}><Text>{inr(totals.totalBeforeTax)}</Text></View>
            {taxMode === "INTRA_STATE" ? (
              <>
                <View style={styles.bdColRateAmt}><Text>{inr(totals.cgst)}</Text></View>
                <View style={styles.bdColRateAmt}><Text>{inr(totals.sgst)}</Text></View>
              </>
            ) : (
              <View style={styles.bdColRateAmtIgst}><Text>{inr(totals.igst)}</Text></View>
            )}
            <View style={styles.bdColTotal}><Text>{inr(taxTotal)}</Text></View>
          </View>
        </View>

        {/* SECTION 7 — TAX AMOUNT IN WORDS */}
        <View style={styles.taxWordsRow}>
          <Text style={{ fontSize: 6.8 }}>
            <Text style={styles.bold}>Tax Amount (in words): </Text>
            INR {taxInWords}
          </Text>
        </View>

        {/* SECTION 8 — FOOTER */}
        <View style={styles.footer}>
          <View style={styles.footerCol1}>
            <Text style={styles.bold}>Terms & Conditions / Declaration:</Text>
            <View style={styles.bulletList}>
              {(() => {
                const defaultTerms = [
                  "1. Goods once sold will not be taken back or exchanged without approval.",
                  "2. Subject to Agra Jurisdiction only.",
                  "3. Our responsibility ceases when goods leave our godown.",
                  "4. E.&O.E.",
                  "5. As per the rule, 100% GST for an enforcement agency is to be deposited by the service receiver.",
                  "6. The MSMED Act 2006 specifies 45-day credit period for the recipient of goods/services to pay the MSME supplier.",
                ];
                const terms =
                  props.company.termsAndConditions?.trim()
                    ? props.company.termsAndConditions.split("\n").filter((l) => l.trim())
                    : defaultTerms;
                return terms.map((line, idx) => (
                  <Text key={idx} style={styles.bulletItem}>{line}</Text>
                ));
              })()}
            </View>
            <View style={{ marginTop: 4, paddingTop: 3, borderTopWidth: 0.5, borderTopColor: "#CCCCCC" }}>
              <Text style={{ fontSize: 6.5 }}>
                <Text style={styles.bold}>GST paid under Reverse Charge: </Text>
                {props.invoice.reverseCharge ? "Yes" : "No"}
              </Text>
            </View>
          </View>

          {/* Company Bank Details & QR Code */}
          <View style={styles.footerCol2}>
            <Text style={styles.bold}>Company&apos;s Bank Account Details -</Text>
            <View style={{ marginTop: 2 }}>
              <Text style={styles.bankLine}>
                <Text style={styles.bold}>Name - </Text>{props.company.companyName || "M/S RADHA KISHAN ENTERPRISES"}
              </Text>
              <Text style={styles.bankLine}>
                <Text style={styles.bold}>A/C Number - </Text>{props.company.accountNo || "-"}
              </Text>
              <Text style={styles.bankLine}>
                <Text style={styles.bold}>Bank - </Text>{props.company.bankName || "-"}
              </Text>
              <Text style={styles.bankLine}>
                <Text style={styles.bold}>IFSC - </Text>{props.company.ifsc || "-"}
              </Text>
              <Text style={styles.bankLine}>
                <Text style={styles.bold}>Branch - </Text>{props.company.branch || "-"}
              </Text>
              <Text style={styles.bankLine}>
                <Text style={styles.bold}>A/C Type - </Text>{props.company.accountType || "Current"}
              </Text>
            </View>
            {/* QR Code */}
            <View style={[styles.qrContainer, { marginTop: 4 }]}>
              {props.qrDataUrl ? (
                <PdfImage src={props.qrDataUrl} style={{ width: 62, height: 62 }} />
              ) : (
                <View style={{ width: 62, height: 62, borderWidth: 0.5, borderColor: "#000" }} />
              )}
              <Text style={styles.qrLabel}>Scan for Details</Text>
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
