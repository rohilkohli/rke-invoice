"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  BookOpen,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Scale,
  Calendar,
  Receipt,
  Coins,
  Trash2,
  Filter,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createPayment, deletePayment } from "@/app/actions/ledger";
import { cn } from "@/lib/utils";

interface ClientItem {
  id: number;
  name: string;
  gstin: string;
}

interface LedgerEntry {
  id: string;
  date: string;
  type: "INVOICE" | "PAYMENT";
  docNo: string;
  clientName: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

interface LedgerClientProps {
  clients: ClientItem[];
  entries: LedgerEntry[];
  summary: {
    totalBilled: number;
    totalPaid: number;
    totalOutstanding: number;
  };
  initialClientId?: string;
}

export function LedgerClient({ clients, entries, summary, initialClientId }: LedgerClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedClient, setSelectedClient] = useState<string>(initialClientId || "all");
  const [isPending, startTransition] = useTransition();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formClientId, setFormClientId] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [refNo, setRefNo] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");

  const handleClientChange = (val: string | null) => {
    const finalVal = val || "all";
    setSelectedClient(finalVal);
    const params = new URLSearchParams(searchParams.toString());
    if (finalVal === "all") {
      params.delete("clientId");
    } else {
      params.set("clientId", finalVal);
    }
    router.push(`/ledger?${params.toString()}`);
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formClientId) {
      toast.error("Please select a client");
      return;
    }
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    startTransition(async () => {
      try {
        const res = await createPayment({
          clientId: parseInt(formClientId),
          date: paymentDate,
          amount: amt,
          referenceNo: refNo,
          description: remarks,
        });

        if (res.success) {
          toast.success("Payment recorded successfully");
          setIsModalOpen(false);
          setPaymentAmount("");
          setRefNo("");
          setRemarks("");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to record payment");
      }
    });
  };

  const handleDeletePayment = async (idStr: string) => {
    const numericId = parseInt(idStr.replace("pay-", ""));
    if (isNaN(numericId)) return;

    if (!confirm("Delete this payment record?")) return;

    try {
      const res = await deletePayment(numericId);
      if (res.success) {
        toast.success("Payment deleted");
      }
    } catch {
      toast.error("Failed to delete payment");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Client Ledger</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track billings, payments, and outstanding balances
          </p>
        </div>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger render={
            <Button className="shadow-md shadow-primary/20">
              <Plus className="mr-2 h-4 w-4" />
              Record Payment
            </Button>
          } />
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-primary" />
                Record Payment
              </DialogTitle>
              <DialogDescription>
                Enter payment details to update the ledger
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleAddPayment} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="pay-client">Client</Label>
                <Select value={formClientId} onValueChange={(val) => setFormClientId(val || "")}>
                  <SelectTrigger id="pay-client" className="w-full">
                    <SelectValue placeholder="Select Client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pay-date">Date</Label>
                  <Input
                    id="pay-date"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pay-amount">Amount</Label>
                  <Input
                    id="pay-amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pay-ref">Reference (UTR/UPI)</Label>
                <Input
                  id="pay-ref"
                  placeholder="e.g. UTR123456789"
                  value={refNo}
                  onChange={(e) => setRefNo(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pay-remarks">Remarks</Label>
                <Textarea
                  id="pay-remarks"
                  placeholder="Optional notes"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="h-20"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : "Save Payment"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Metrics */}
      <div className="grid gap-5 md:grid-cols-3">
        {[
          {
            label: "Total Billed",
            value: formatCurrency(summary.totalBilled),
            icon: ArrowUpRight,
            color: "text-rose-600 dark:text-rose-400",
            bg: "bg-rose-500/10",
          },
          {
            label: "Total Received",
            value: formatCurrency(summary.totalPaid),
            icon: ArrowDownLeft,
            color: "text-emerald-600 dark:text-emerald-400",
            bg: "bg-emerald-500/10",
          },
          {
            label: "Outstanding",
            value: formatCurrency(summary.totalOutstanding),
            icon: Scale,
            color: "text-amber-600 dark:text-amber-400",
            bg: "bg-amber-500/10",
          },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-xl border border-border bg-card p-6 shadow-sm"
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
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:max-w-sm">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={selectedClient} onValueChange={handleClientChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All Clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          As of {new Date().toLocaleDateString("en-IN")}
        </div>
      </div>

      {/* Ledger Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              Account Statement
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">{entries.length} transactions</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
          >
            Print
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-[100px] font-medium">Date</TableHead>
                <TableHead className="w-[140px] font-medium">Doc No / Ref</TableHead>
                {selectedClient === "all" && (
                  <TableHead className="font-medium">Client</TableHead>
                )}
                <TableHead className="font-medium">Description</TableHead>
                <TableHead className="w-[120px] text-right font-medium">Debit</TableHead>
                <TableHead className="w-[120px] text-right font-medium">Credit</TableHead>
                <TableHead className="w-[130px] text-right font-medium">Balance</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={selectedClient === "all" ? 8 : 7} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <span className="text-sm text-muted-foreground">No transactions found</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((r) => {
                  const isInvoice = r.type === "INVOICE";
                  return (
                    <TableRow key={r.id} className="group">
                      <TableCell className="text-sm tabular-nums">{r.date}</TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {isInvoice ? (
                          <button
                            type="button"
                            className="text-primary hover:underline font-medium cursor-pointer"
                            onClick={() => router.push(`/invoices/${r.id.replace("inv-", "")}`)}
                          >
                            {r.docNo}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">{r.docNo}</span>
                        )}
                      </TableCell>
                      {selectedClient === "all" && (
                        <TableCell className="max-w-[200px] truncate text-sm">
                          {r.clientName}
                        </TableCell>
                      )}
                      <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">
                        {r.description}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums text-rose-600 dark:text-rose-400">
                        {r.debit > 0 ? formatCurrency(r.debit) : "-"}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                        {r.credit > 0 ? formatCurrency(r.credit) : "-"}
                      </TableCell>
                      <TableCell className="text-right text-sm font-bold tabular-nums">
                        {formatCurrency(r.runningBalance)}
                      </TableCell>
                      <TableCell className="text-center">
                        {!isInvoice ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeletePayment(r.id)}
                            className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete payment"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
