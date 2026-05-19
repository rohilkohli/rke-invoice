import { Metadata } from "next";
import { getLedgerData } from "@/app/actions/ledger";
import { LedgerClient } from "@/components/ledger/LedgerClient";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Client Ledger | RKE Invoice",
  description: "Track client billing invoices and received payment ledger statement",
};

interface LedgerPageProps {
  searchParams: Promise<{ clientId?: string }>;
}

export default async function LedgerPage(props: LedgerPageProps) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const { clientId } = await props.searchParams;
  const numericClientId = clientId ? parseInt(clientId) : undefined;

  const data = await getLedgerData(numericClientId);

  return (
    <main className="container mx-auto p-4 md:p-8 max-w-7xl animate-in fade-in duration-300">
      <LedgerClient
        clients={data.clients.map((c) => ({ id: c.id, name: c.name, gstin: c.gstin }))}
        entries={data.entries}
        summary={data.summary}
        initialClientId={clientId}
      />
    </main>
  );
}
