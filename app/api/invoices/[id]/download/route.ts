import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const invoiceId = Number(id);
  if (Number.isNaN(invoiceId)) {
    return new NextResponse("Invalid ID", { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { pdfName: true, pdfData: true },
  });

  if (!invoice || !invoice.pdfData) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const buffer = Buffer.from(invoice.pdfData, "base64");
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.pdfName || `invoice-${invoiceId}.pdf`}"`,
    },
  });
}
