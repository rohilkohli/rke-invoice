import Link from "next/link";
import { TrendingUp, CreditCard, Clock, Plus } from "lucide-react";

import { prisma } from "@/lib/db";
import { getOrCreateCompanySettings } from "@/lib/bootstrap";
import { resolveLogoDataUrl } from "@/lib/resolveLogoUrl";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InvoiceTableClient } from "@/components/dashboard/InvoiceTableClient";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const now = new Date();
  const monthStart = startOfMonth(now);

  const [company, monthlyInvoices, invoices] = await Promise.all([
    getOrCreateCompanySettings(user.id),
    // Metrics query: only current-month invoices, no take limit, lightweight select
    prisma.invoice.findMany({
      where: {
        userId: user.id,
        invoiceDate: { gte: monthStart },
      },
      select: { grandTotal: true, status: true },
    }),
    // Table query: most recent 100 invoices for display
    prisma.invoice.findMany({
      where: { userId: user.id },
      include: { client: true },
      orderBy: [{ invoiceDate: "desc" }, { id: "desc" }],
      take: 100,
    }),
  ]);

  const totalInvoiced = monthlyInvoices.reduce(
    (sum, i) => sum + Number(i.grandTotal),
    0,
  );
  const totalPaid = monthlyInvoices
    .filter((i) => i.status === "PAID")
    .reduce((sum, i) => sum + Number(i.grandTotal), 0);
  const pending = totalInvoiced - totalPaid;

  const format = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n);

  const metrics = [
    {
      label: "Total Invoiced",
      value: format(totalInvoiced),
      subtext: "This month",
      icon: TrendingUp,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/50 dark:border-blue-500/40",
    },
    {
      label: "Paid",
      value: format(totalPaid),
      subtext: "This month",
      icon: CreditCard,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/50 dark:border-emerald-500/40",
    },
    {
      label: "Pending",
      value: format(pending),
      subtext: "Outstanding",
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/60 dark:border-amber-500/40",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of your invoicing activity
          </p>
        </div>
        <Link
          href="/invoices/new"
          className={cn(
            buttonVariants({ variant: "default" }),
            "shadow-md shadow-primary/20"
          )}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Invoice
        </Link>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-5 md:grid-cols-3">
        {metrics.map((m) => (
          <div
            key={m.label}
            className={cn(
              "rounded-xl border bg-card p-6 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 ease-out",
              m.border
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">{m.label}</span>
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", m.bg)}>
                <m.icon className={cn("h-[18px] w-[18px]", m.color)} />
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold tabular-nums tracking-tight">
              {m.value}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{m.subtext}</p>
          </div>
        ))}
      </div>

      {/* Invoices Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-base font-semibold">Recent Invoices</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{invoices.length} invoices total</p>
          </div>
        </div>
        <div className="p-5">
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
              logoUrl: resolveLogoDataUrl(company.logoUrl),
              termsAndConditions: company.termsAndConditions,
              tagline: company.tagline,
              accountType: company.accountType,
              stateCode: company.stateCode,
              state: company.state,
              gdriveWebhookUrl: company.gdriveWebhookUrl,
            }}
          />
        </div>
      </div>
    </div>
  );
}
