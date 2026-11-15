import { notFound } from "next/navigation";

import { InvoiceEditor } from "@/components/invoice/InvoiceEditor";
import { getOrCreateCompanySettings } from "@/lib/bootstrap";
import { getSavedClients } from "@/lib/clients";
import { toCompanyPreview, toInvoiceFormData } from "@/lib/serialize";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
// Saving starts the Google Drive sync after the reply; allow it the time it needs.
export const maxDuration = 60;

export default async function InvoiceByIdPage(props: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await props.params;
  const invoiceId = Number(id);
  if (!Number.isInteger(invoiceId)) notFound();

  const [company, invoice, clients] = await Promise.all([
    getOrCreateCompanySettings(user.id),
    prisma.invoice.findFirst({
      where: { id: invoiceId, userId: user.id },
      include: {
        client: true,
        lineItems: { orderBy: { sno: "asc" } },
        signature: true,
      },
    }),
    getSavedClients(user.id),
  ]);

  if (!invoice) notFound();

  return (
    <InvoiceEditor
      initialInvoice={toInvoiceFormData(invoice)}
      company={toCompanyPreview(company)}
      clients={clients}
      drive={{
        enabled: Boolean(company.gdriveWebhookUrl),
        syncedAt: invoice.driveSyncedAt?.toISOString() ?? null,
        error: invoice.driveSyncError,
      }}
    />
  );
}
