import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getOrCreateCompanySettings } from "@/lib/bootstrap";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const ids = Array.isArray(body?.ids) ? body.ids : [];
  const invoiceIds = ids
    .map((v: unknown) => Number(v))
    .filter((n: number) => Number.isFinite(n));

  if (!invoiceIds.length) {
    return NextResponse.json({ error: "No ids provided" }, { status: 400 });
  }

  const [company, invoices] = await Promise.all([
    getOrCreateCompanySettings(),
    prisma.invoice.findMany({
      where: { id: { in: invoiceIds } },
      include: {
        client: true,
        lineItems: { orderBy: { sno: "asc" } },
        signature: true,
      },
      orderBy: { id: "asc" },
    }),
  ]);

  return NextResponse.json({
    company: {
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
    },
    invoices: invoices.map((inv) => ({
      id: inv.id,
      invoiceNo: inv.invoiceNo,
      invoiceDate: inv.invoiceDate.toISOString().slice(0, 10),
      poNo: inv.poNo ?? "",
      billPeriodStart: inv.billPeriodStart
        ? inv.billPeriodStart.toISOString().slice(0, 10)
        : "",
      billPeriodEnd: inv.billPeriodEnd
        ? inv.billPeriodEnd.toISOString().slice(0, 10)
        : "",
      state: inv.state,
      stateCode: inv.stateCode,
      transportMode: inv.transportMode ?? "",
      vehicleNo: inv.vehicleNo ?? "",
      placeOfSupply: inv.placeOfSupply ?? "",
      status: inv.status,
      reverseCharge: inv.reverseCharge,
      cgstRate: Number(inv.cgstRate),
      sgstRate: Number(inv.sgstRate),
      igstRate: Number(inv.igstRate),
      client: {
        id: inv.client.id,
        name: inv.client.name,
        address: inv.client.address,
        gstin: inv.client.gstin,
        state: inv.client.state,
        stateCode: inv.client.stateCode,
        shipToName: inv.client.shipToName ?? "",
        shipToAddress: inv.client.shipToAddress ?? "",
      },
      lineItems: inv.lineItems.map((li) => ({
        sno: li.sno,
        description: li.description,
        hsnSac: li.hsnSac ?? "",
        unit: li.unit,
        qty: Number(li.qty),
        rate: Number(li.rate),
      })),
      signature: inv.signature
        ? { dataUrl: inv.signature.dataUrl, type: inv.signature.type }
        : null,
    })),
  });
}

