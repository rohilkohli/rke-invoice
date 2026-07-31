export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "QUOTATION";
export type SignatureType = "DRAWN" | "UPLOADED" | "TYPED";

export type ClientForm = {
  id?: number;
  name: string;
  address: string;
  gstin: string;
  state: string;
  stateCode: string;
  shipToName?: string;
  shipToAddress?: string;
};

export type LineItemForm = {
  sno: number;
  description: string;
  hsnSac?: string;
  unit: string;
  qty: number;
  rate: number;

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

