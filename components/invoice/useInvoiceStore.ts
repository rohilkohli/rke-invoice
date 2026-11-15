"use client";

import { create } from "zustand";

import type { ClientForm, InvoiceFormData, LineItemForm, SignatureForm } from "./types";

type InvoiceState = {
  invoice: InvoiceFormData;
  setInvoice: (invoice: InvoiceFormData) => void;
  setField: <K extends keyof InvoiceFormData>(
    key: K,
    value: InvoiceFormData[K],
  ) => void;
  setClientField: <K extends keyof ClientForm>(
    key: K,
    value: ClientForm[K],
  ) => void;
  /** Fills the bill-to and ship-to from a saved client. */
  setClient: (client: ClientForm) => void;
  setLineItem: (index: number, next: Partial<LineItemForm>) => void;
  addLineItem: () => void;
  removeLineItem: (index: number) => void;
  resequence: () => void;
  setSignature: (signature: SignatureForm) => void;
};

function clampNumber(n: unknown) {
  const num = typeof n === "number" ? n : Number(n);
  return Number.isFinite(num) ? num : 0;
}

function normalizeLineItem(item: LineItemForm): LineItemForm {
  return {
    sno: Math.max(1, Math.trunc(clampNumber(item.sno))),
    description: item.description ?? "",
    hsnSac: item.hsnSac ?? "",
    // Kept exactly as typed — no clamping, no parsing, no link between them.
    unit: item.unit ?? "",
    qty: item.qty ?? "",
    rate: item.rate ?? "",
    amount: item.amount ?? "",
    // Meter readings are notes only and never drive qty.
    equipmentId: item.equipmentId ?? null,
    meterStart: item.meterStart ?? null,
    meterEnd: item.meterEnd ?? null,
  };
}

/** A new row starts empty: every line figure is typed in by the user. */
function blankLineItem(sno: number): LineItemForm {
  return { sno, description: "", hsnSac: "", unit: "", qty: "", rate: "", amount: "" };
}

export const useInvoiceStore = create<InvoiceState>((set) => ({
  invoice: {
    invoiceNo: "",
    invoiceDate: new Date().toISOString().slice(0, 10),
    poNo: "",
    billPeriodStart: "",
    billPeriodEnd: "",
    state: "",
    stateCode: "",
    transportMode: "",
    vehicleNo: "",
    placeOfSupply: "",
    status: "DRAFT",
    reverseCharge: false,
    cgstRate: 9,
    sgstRate: 9,
    igstRate: 18,
    client: {
      name: "",
      address: "",
      gstin: "",
      state: "",
      stateCode: "",
      shipToName: "",
      shipToAddress: "",
    },
    lineItems: [blankLineItem(1)],
    signature: null,
  },
  setInvoice: (invoice) => set({ invoice }),
  setField: (key, value) =>
    set((state) => ({
      invoice: { ...state.invoice, [key]: value },
    })),
  setClientField: (key, value) =>
    set((state) => ({
      invoice: {
        ...state.invoice,
        client: { ...state.invoice.client, [key]: value },
      },
    })),
  setClient: (client) =>
    set((state) => ({
      invoice: {
        ...state.invoice,
        client: { ...client },
        // "State of supply" follows the client until the user picks one themselves.
        state: state.invoice.state || client.state,
        stateCode: state.invoice.stateCode || client.stateCode,
      },
    })),
  setLineItem: (index, next) =>
    set((state) => {
      const lineItems = [...state.invoice.lineItems];
      const current = lineItems[index];
      if (!current) return state;
      lineItems[index] = normalizeLineItem({ ...current, ...next });
      return { invoice: { ...state.invoice, lineItems } };
    }),
  addLineItem: () =>
    set((state) => {
      const nextSno = state.invoice.lineItems.length + 1;
      return {
        invoice: {
          ...state.invoice,
          lineItems: [...state.invoice.lineItems, blankLineItem(nextSno)],
        },
      };
    }),
  removeLineItem: (index) =>
    set((state) => {
      const lineItems = state.invoice.lineItems.filter((_, i) => i !== index);
      return {
        invoice: {
          ...state.invoice,
          lineItems: lineItems.length ? lineItems : state.invoice.lineItems,
        },
      };
    }),
  resequence: () =>
    set((state) => ({
      invoice: {
        ...state.invoice,
        lineItems: state.invoice.lineItems.map((li, idx) => ({
          ...li,
          sno: idx + 1,
        })),
      },
    })),
  setSignature: (signature) =>
    set((state) => ({ invoice: { ...state.invoice, signature } })),
}));
