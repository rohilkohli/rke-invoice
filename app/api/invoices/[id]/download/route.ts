import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const invoiceId = Number(id);
  if (Number.isNaN(invoiceId)) {
    return new NextResponse("Invalid ID", { status: 400 });
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, userId: user.id },
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
