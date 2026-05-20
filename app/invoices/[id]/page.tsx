import { notFound } from "next/navigation";

import { InvoiceEditor } from "@/components/invoice/InvoiceEditor";
import type { InvoiceFormData } from "@/components/invoice/types";
import { getOrCreateCompanySettings } from "@/lib/bootstrap";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function InvoiceByIdPage(props: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await props.params;
  const invoiceId = Number(id);
  if (!Number.isFinite(invoiceId)) notFound();

  const [company, invoice] = await Promise.all([
    getOrCreateCompanySettings(user.id),
    prisma.invoice.findFirst({
      where: { id: invoiceId, userId: user.id },
      include: {
        client: true,
        lineItems: { orderBy: { sno: "asc" } },
        signature: true,
      },
    }),
  ]);

  if (!invoice) notFound();

  const initialInvoice: InvoiceFormData = {
    id: invoice.id,
    invoiceNo: invoice.invoiceNo,
    invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
    poNo: invoice.poNo ?? "",
    billPeriodStart: invoice.billPeriodStart
      ? invoice.billPeriodStart.toISOString().slice(0, 10)
      : "",
    billPeriodEnd: invoice.billPeriodEnd
      ? invoice.billPeriodEnd.toISOString().slice(0, 10)
      : "",
    state: invoice.state,
    stateCode: invoice.stateCode,
    transportMode: invoice.transportMode ?? "",
    vehicleNo: invoice.vehicleNo ?? "",
    placeOfSupply: invoice.placeOfSupply ?? "",
    status: invoice.status,
    reverseCharge: invoice.reverseCharge,
    cgstRate: Number(invoice.cgstRate),
    sgstRate: Number(invoice.sgstRate),
    igstRate: Number(invoice.igstRate),
    client: {
      id: invoice.client.id,
      name: invoice.client.name,
      address: invoice.client.address,
      gstin: invoice.client.gstin,
      state: invoice.client.state,
      stateCode: invoice.client.stateCode,
      shipToName: invoice.client.shipToName ?? "",
      shipToAddress: invoice.client.shipToAddress ?? "",
    },
    lineItems: invoice.lineItems.map((li) => ({
      sno: li.sno,
      description: li.description,
      hsnSac: li.hsnSac ?? "",
      unit: li.unit,
      qty: Number(li.qty),
      rate: Number(li.rate),
    })),
    signature: invoice.signature
      ? { dataUrl: invoice.signature.dataUrl, type: invoice.signature.type }
      : null,
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
