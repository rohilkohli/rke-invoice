export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "QUOTATION";
export type SignatureType = "DRAWN" | "UPLOADED" | "TYPED";

export type ClientForm = {
  name: string;
  address: string;
  gstin: string;
  state: string;
  stateCode: string;
  shipToName?: string;
  shipToAddress?: string;
  shipToGstin?: string;
  shipToState?: string;
  shipToStateCode?: string;
};

/** A client the user has billed before, as offered by the client picker. */
export type SavedClient = ClientForm & { id: number };

/** What the editor knows about Google Drive for the invoice on screen. */
export type DriveStatus = {
  enabled: boolean;
  syncedAt: string | null;
  error: string | null;
};

export type LineItemForm = {
  sno: number;
  description: string;
  hsnSac?: string;
  // Free text, printed exactly as typed. Nothing is ever calculated from these three.
  unit: string;
  qty: string;
  rate: string;
  // Typed by the user (e.g. "1,50,000"); the only line figure that feeds the totals.
  amount: string;

  equipmentId?: number | null;
  meterStart?: number | null;
  meterEnd?: number | null;
};

export type SignatureForm =
  | {
      dataUrl: string;
      type: SignatureType;
    }
  | null;

export type InvoiceFormData = {
  id?: number;
  invoiceNo: string;
  invoiceDate: string; // YYYY-MM-DD
  poNo?: string;
  referenceNo?: string;
  referenceDate?: string;
  buyerOrderNo?: string;
  paymentTerms?: string;
  termsOfDelivery?: string;
  billPeriodStart?: string; // YYYY-MM-DD
  billPeriodEnd?: string; // YYYY-MM-DD

  state: string;
  stateCode: string;
  transportMode?: string;
  vehicleNo?: string;
  placeOfSupply?: string;

  irn?: string;
  ewayBillNo?: string;

  status: InvoiceStatus;
  reverseCharge: boolean;

  cgstRate: number;
  sgstRate: number;
  igstRate: number;

  client: ClientForm;
  lineItems: LineItemForm[];
  signature: SignatureForm;
};
