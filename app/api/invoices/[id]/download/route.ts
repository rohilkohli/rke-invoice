import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getOrCreateCompanySettings } from "@/lib/bootstrap";
import { driveFileName } from "@/lib/gdriveCore";
import { generateInvoicePdfBuffer } from "@/lib/generatePdfServer";

export const maxDuration = 60;

/** The invoice as a PDF, made from what is saved right now. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const invoiceId = Number(id);
  if (!Number.isInteger(invoiceId)) {
    return new NextResponse("Invalid ID", { status: 400 });
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, userId: user.id },
    include: { client: true, lineItems: { orderBy: { sno: "asc" } }, signature: true },
  });
  if (!invoice) {
    return new NextResponse("Not Found", { status: 404 });
  }

  try {
    const company = await getOrCreateCompanySettings(user.id);
    const buffer = await generateInvoicePdfBuffer(invoice, company);
    const filename = `${driveFileName(invoice.invoiceNo).replace(/\.pdf$/, "")}-ORIGINAL.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("PDF download failed:", err);
    return new NextResponse("The PDF could not be made. Please try again.", { status: 500 });
  }
}
