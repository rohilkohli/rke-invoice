import { getNextInvoiceNo, getOrCreateCompanySettings, getOrCreateDefaultClient } from "@/lib/bootstrap";
import type { InvoiceFormData } from "@/components/invoice/types";
import { InvoiceEditor } from "@/components/invoice/InvoiceEditor";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const [company, client, invoiceNo] = await Promise.all([
    getOrCreateCompanySettings(user.id),
    getOrCreateDefaultClient(user.id),
    getNextInvoiceNo(user.id),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  const initialInvoice: InvoiceFormData = {
    invoiceNo,
    invoiceDate: today,
    poNo: "",
    billPeriodStart: "",
    billPeriodEnd: "",
    state: client.state,
    stateCode: client.stateCode,
    transportMode: "",
    vehicleNo: "",
    placeOfSupply: client.state,
    status: "DRAFT",
    reverseCharge: false,
    cgstRate: Number(company.defaultCgstRate),
    sgstRate: Number(company.defaultSgstRate),
    igstRate: Number(company.defaultIgstRate),
    client: {
      id: client.id,
      name: client.name,
      address: client.address,
      gstin: client.gstin,
      state: client.state,
      stateCode: client.stateCode,
      shipToName: client.shipToName ?? "",
      shipToAddress: client.shipToAddress ?? "",
    },
    lineItems: [
      {
        sno: 1,
        description: "Rental service of heavy engineering equipments",
        hsnSac: "",
        unit: "Nos",
        qty: 1,
        rate: 0,
      },
    ],
    signature: null,
  };

  return (
    <InvoiceEditor
      initialInvoice={initialInvoice}
      company={{
        companyName: company.companyName,
        gstin: company.gstin,
        address: company.address,
        email: company.email,
        phone: company.phone,
        bankName: company.bankName,
        branch: company.branch,
        accountNo: company.accountNo,
        ifsc: company.ifsc,
        upiId: company.upiId,
        logoUrl: company.logoUrl,
        termsAndConditions: company.termsAndConditions,
      }}
    />
  );
}
