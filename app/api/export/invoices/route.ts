import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getOrCreateCompanySettings } from "@/lib/bootstrap";
import { getSessionUser } from "@/lib/auth";
import { hasAllRequestedIdsAuthorized } from "@/lib/authorization";
import { toCompanyPreview, toInvoiceFormData } from "@/lib/serialize";

const MAX_INVOICES = 500;

/** Invoices and company details in the same shape the editor uses, for building spreadsheets. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const ids = Array.isArray(body?.ids) ? body.ids : [];
  const invoiceIds = ids
    .map((v: unknown) => Number(v))
    .filter((n: number) => Number.isInteger(n));

  if (!invoiceIds.length) {
    return NextResponse.json({ error: "No ids provided" }, { status: 400 });
  }
  if (invoiceIds.length > MAX_INVOICES) {
    return NextResponse.json({ error: `Select at most ${MAX_INVOICES} invoices.` }, { status: 400 });
  }

  const [company, invoices] = await Promise.all([
    getOrCreateCompanySettings(user.id),
    prisma.invoice.findMany({
      where: { id: { in: invoiceIds }, userId: user.id },
      include: { client: true, lineItems: { orderBy: { sno: "asc" } } },
      orderBy: { id: "asc" },
    }),
  ]);

  if (!hasAllRequestedIdsAuthorized(invoiceIds, invoices.map((invoice) => invoice.id))) {
    return NextResponse.json(
      { error: "Some invoices are missing or not authorized" },
      { status: 403 },
    );
  }

  return NextResponse.json({
    // No logo: a spreadsheet does not need it and it is a large data URL.
    company: toCompanyPreview(company, { logo: false }),
    invoices: invoices.map(toInvoiceFormData),
  });
}
