import { getOrCreateCompanySettings } from "@/lib/bootstrap";
import type { InvoiceFormData } from "@/components/invoice/types";
import { InvoiceEditor } from "@/components/invoice/InvoiceEditor";
import { getSavedClients } from "@/lib/clients";
import { toCompanyPreview } from "@/lib/serialize";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
// Saving starts the Google Drive sync after the reply; allow it the time it needs.
export const maxDuration = 60;

export default async function NewInvoicePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const [company, clients] = await Promise.all([
    getOrCreateCompanySettings(user.id),
    getSavedClients(user.id),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  const initialInvoice: InvoiceFormData = {
    // Left blank on purpose: the invoice number is always typed in by the user.
    invoiceNo: "",
    invoiceDate: today,
    poNo: "",
    referenceNo: "",
    referenceDate: "",
    buyerOrderNo: "",
    paymentTerms: "",
    termsOfDelivery: "",
    billPeriodStart: "",
    billPeriodEnd: "",
    state: "",
    stateCode: "",
    transportMode: "",
    vehicleNo: "",
    placeOfSupply: "",
    irn: "",
    ewayBillNo: "",
    status: "DRAFT",
    reverseCharge: false,
    cgstRate: Number(company.defaultCgstRate),
    sgstRate: Number(company.defaultSgstRate),
    igstRate: Number(company.defaultIgstRate),
    // No client is pre-selected: pick one that has been billed before, or type a new one.
    client: {
      name: "",
      address: "",
      gstin: "",
      state: "",
      stateCode: "",
      shipToName: "",
      shipToAddress: "",
      shipToGstin: "",
      shipToState: "",
      shipToStateCode: "",
    },
    lineItems: [
      {
        sno: 1,
        description: "Rental service of heavy engineering equipments",
        hsnSac: "",
        // Unit, Qty, Rate and Amount all start empty and are typed in by the user.
        unit: "",
        qty: "",
        rate: "",
        amount: "",
      },
    ],
    signature: null,
  };

  return (
    <InvoiceEditor
      initialInvoice={initialInvoice}
      company={toCompanyPreview(company)}
      clients={clients}
      drive={{ enabled: Boolean(company.gdriveWebhookUrl), syncedAt: null, error: null }}
    />
  );
}
