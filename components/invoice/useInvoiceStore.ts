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
    unit: item.unit ?? "",
    qty: Math.max(0, clampNumber(item.qty)),
    rate: Math.max(0, clampNumber(item.rate)),
  };
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
    lineItems: [
      {
        sno: 1,
        description: "",
        hsnSac: "",
        unit: "Nos",
        qty: 1,
        rate: 0,
      },
    ],
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
          lineItems: [
            ...state.invoice.lineItems,
            {
              sno: nextSno,
              description: "",
              hsnSac: "",
              unit: "Nos",
              qty: 1,
              rate: 0,
            },
          ],
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
