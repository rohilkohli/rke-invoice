import Link from "next/link";

import { prisma } from "@/lib/db";
import { getOrCreateCompanySettings } from "@/lib/bootstrap";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { InvoiceTableClient } from "@/components/dashboard/InvoiceTableClient";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const [company, invoices] = await Promise.all([
    getOrCreateCompanySettings(),
    prisma.invoice.findMany({
      where: { userId: user.id },
      include: { client: true },
      orderBy: [{ invoiceDate: "desc" }, { id: "desc" }],
      take: 100,
    }),
  ]);

  const now = new Date();
  const monthStart = startOfMonth(now);

  const thisMonth = invoices.filter((i) => i.invoiceDate >= monthStart);
  const totalInvoiced = thisMonth.reduce(
    (sum, i) => sum + Number(i.grandTotal),
    0,
  );
  const totalPaid = thisMonth
    .filter((i) => i.status === "PAID")
    .reduce((sum, i) => sum + Number(i.grandTotal), 0);
  const pending = totalInvoiced - totalPaid;

  const format = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(n);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold tracking-tight">Dashboard</div>
          <div className="text-sm text-muted-foreground">
            Invoices overview and quick actions
          </div>
        </div>
        <Link
          href="/invoices/new"
          className={cn(buttonVariants({ variant: "default" }))}
        >
          Create Invoice
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Total Invoiced (This Month)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {format(totalInvoiced)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Total Paid (This Month)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {format(totalPaid)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Pending (This Month)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {format(pending)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Invoices</CardTitle>
          <div className="text-sm text-muted-foreground">{invoices.length} total</div>
        </CardHeader>
        <CardContent>
          <InvoiceTableClient
            rows={invoices.map((inv) => ({
              id: inv.id,
              invoiceNo: inv.invoiceNo,
              clientName: inv.client.name,
              invoiceDate: inv.invoiceDate.toISOString().slice(0, 10),
              amount: Number(inv.grandTotal),
              status: inv.status,
              pdfName: inv.pdfName,
            }))}
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
        </CardContent>
      </Card>
    </div>
  );
}
