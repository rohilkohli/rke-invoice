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
  Building
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  // Payment Form States
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
          toast.success("Payment receipt recorded successfully");
          setIsModalOpen(false);
          // Reset form
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

    if (!confirm("Are you sure you want to delete this payment record?")) return;

    try {
      const res = await deletePayment(numericId);
      if (res.success) {
        toast.success("Payment record deleted");
      }
    } catch {
      toast.error("Failed to delete payment");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Styled helper tokens
  const cardClass = "bg-white/80 dark:bg-neutral-900/50 backdrop-blur-md border border-neutral-200 dark:border-neutral-800/80 shadow-lg dark:shadow-xl rounded-xl overflow-hidden";
  const statHeaderClass = "text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-emerald-500" />
            Client Ledger & Payments
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Track billings, bank receipts, and client-wise accounts statement.
          </div>
        </div>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger render={
            <Button className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold shadow-md active:scale-95 transition-all duration-150 border-0">
              <Plus className="mr-2 h-4 w-4" />
              Add Bank Payment
            </Button>
          } />
          <DialogContent className="sm:max-w-[480px] bg-white dark:bg-neutral-900 border dark:border-neutral-800 shadow-2xl rounded-xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
                <Coins className="h-5 w-5 text-emerald-500" />
                Record Received Payment
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Enter payment details received in your bank account to update the client ledger statement.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleAddPayment} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="pay-client" className="text-xs font-bold">Client</Label>
                <Select value={formClientId} onValueChange={(val) => setFormClientId(val || "")}>
                  <SelectTrigger id="pay-client" className="w-full bg-neutral-50 dark:bg-neutral-900 border dark:border-neutral-800">
                    <SelectValue placeholder="Select Client" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-neutral-905 border dark:border-neutral-850">
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
                  <Label htmlFor="pay-date" className="text-xs font-bold">Date Received</Label>
                  <Input
                    id="pay-date"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="bg-neutral-50 dark:bg-neutral-900 border dark:border-neutral-800"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pay-amount" className="text-xs font-bold">Amount (₹)</Label>
                  <Input
                    id="pay-amount"
                    type="number"
                    step="0.01"
                    placeholder="Enter amount"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="bg-neutral-50 dark:bg-neutral-900 border dark:border-neutral-800"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pay-ref" className="text-xs font-bold">Ref No / UTR (UTR / UPI / Cash)</Label>
                <Input
                  id="pay-ref"
                  placeholder="e.g. UTR123456789 or UPI-1234"
                  value={refNo}
                  onChange={(e) => setRefNo(e.target.value)}
                  className="bg-neutral-50 dark:bg-neutral-900 border dark:border-neutral-800"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pay-remarks" className="text-xs font-bold">Remarks / Description</Label>
                <Textarea
                  id="pay-remarks"
                  placeholder="e.g. Received in IDFC bank / Part payment"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="bg-neutral-50 dark:bg-neutral-900 border dark:border-neutral-800 h-20"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsModalOpen(false)}
                  className="border dark:border-neutral-800"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isPending}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white border-0"
                >
                  {isPending ? "Recording..." : "Save Payment"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter and selector */}
      <div className={`${cardClass} p-4 flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div className="flex items-center gap-3 w-full md:max-w-md">
          <Label htmlFor="client-filter" className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 shrink-0 flex items-center gap-1.5">
            <Building className="h-4 w-4 text-emerald-500" />
            Client Filter:
          </Label>
          <Select value={selectedClient} onValueChange={handleClientChange}>
            <SelectTrigger id="client-filter" className="w-full bg-white dark:bg-neutral-950 border-neutral-300 dark:border-neutral-800">
              <SelectValue placeholder="All Clients" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-neutral-900 border dark:border-neutral-800">
              <SelectItem value="all">All Clients Ledger</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs text-muted-foreground italic flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-emerald-500" />
          Statement compiled as of {new Date().toLocaleDateString("en-IN")}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className={cardClass}>
          <CardHeader className="pb-2">
            <div className={statHeaderClass}>
              Total Billed
              <ArrowUpRight className="h-4 w-4 text-rose-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
              {formatCurrency(summary.totalBilled)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Total revenue generated from sent invoices</p>
          </CardContent>
        </Card>

        <Card className={cardClass}>
          <CardHeader className="pb-2">
            <div className={statHeaderClass}>
              Total Received (Bank)
              <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
              {formatCurrency(summary.totalPaid)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Total bank receipts uploaded and verified</p>
          </CardContent>
        </Card>

        <Card className={cardClass}>
          <CardHeader className="pb-2">
            <div className={statHeaderClass}>
              Total Outstanding
              <Scale className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-amber-500 dark:text-amber-400">
              {formatCurrency(summary.totalOutstanding)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Net pending dues across selected account filter</p>
          </CardContent>
        </Card>
      </div>

      {/* Ledger Entries Table */}
      <Card className={cardClass}>
        <CardHeader className="border-b border-neutral-200 dark:border-neutral-800/80 px-6 py-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-1.5">
              <Receipt className="h-4 w-4 text-emerald-500" />
              Ledger Account Statement
            </CardTitle>
            <div className="text-[10px] text-muted-foreground mt-0.5">Chronological record of billings and payments</div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="xs"
              onClick={() => window.print()}
              className="text-xs h-7 px-2.5 border dark:border-neutral-800"
            >
              Print Ledger
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-neutral-50/50 dark:bg-neutral-900/40">
                <TableRow className="border-b dark:border-neutral-800/80 hover:bg-transparent">
                  <TableHead className="w-[100px] text-neutral-850 dark:text-neutral-200 font-semibold text-xs">Date</TableHead>
                  <TableHead className="w-[150px] text-neutral-850 dark:text-neutral-200 font-semibold text-xs">Doc No / Ref</TableHead>
                  {selectedClient === "all" && (
                    <TableHead className="text-neutral-850 dark:text-neutral-200 font-semibold text-xs">Client Name</TableHead>
                  )}
                  <TableHead className="text-neutral-850 dark:text-neutral-200 font-semibold text-xs">Description</TableHead>
                  <TableHead className="w-[120px] text-right text-neutral-850 dark:text-neutral-200 font-semibold text-xs">Debit (+Billed)</TableHead>
                  <TableHead className="w-[120px] text-right text-neutral-850 dark:text-neutral-200 font-semibold text-xs">Credit (-Paid)</TableHead>
                  <TableHead className="w-[140px] text-right text-neutral-850 dark:text-neutral-200 font-semibold text-xs">Running Balance</TableHead>
                  <TableHead className="w-[60px] text-center text-neutral-850 dark:text-neutral-200 font-semibold text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={selectedClient === "all" ? 8 : 7} className="h-32 text-center text-muted-foreground text-xs">
                      No ledger transactions found for the selected client filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((r) => {
                    const isInvoice = r.type === "INVOICE";
                    return (
                      <TableRow key={r.id} className="border-b dark:border-neutral-800/50 hover:bg-neutral-50/20 dark:hover:bg-neutral-900/10">
                        <TableCell className="font-medium text-xs tabular-nums">{r.date}</TableCell>
                        <TableCell className="font-semibold text-xs tabular-nums text-emerald-500">
                          {isInvoice ? (
                            <span className="hover:underline cursor-pointer" onClick={() => router.push(`/invoices/${r.id.replace("inv-", "")}`)}>
                              {r.docNo}
                            </span>
                          ) : (
                            <span className="text-neutral-500">{r.docNo}</span>
                          )}
                        </TableCell>
                        {selectedClient === "all" && (
                          <TableCell className="max-w-[200px] truncate text-xs font-medium">
                            {r.clientName}
                          </TableCell>
                        )}
                        <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                          {r.description}
                        </TableCell>
                        <TableCell className="text-right text-rose-500 font-semibold text-xs tabular-nums">
                          {r.debit > 0 ? formatCurrency(r.debit) : "-"}
                        </TableCell>
                        <TableCell className="text-right text-emerald-500 font-semibold text-xs tabular-nums">
                          {r.credit > 0 ? formatCurrency(r.credit) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-bold text-xs tabular-nums text-neutral-900 dark:text-neutral-50">
                          {formatCurrency(r.runningBalance)}
                        </TableCell>
                        <TableCell className="text-center">
                          {!isInvoice ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeletePayment(r.id)}
                              className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 shrink-0 cursor-pointer"
                              title="Delete Payment Record"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
