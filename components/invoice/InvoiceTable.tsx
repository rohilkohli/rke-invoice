"use client";

import { useEffect, useState } from "react";
import { Trash2, Plus } from "lucide-react";

import { calculateLineAmount, formatINR } from "@/lib/calculations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useInvoiceStore } from "./useInvoiceStore";
import { cn } from "@/lib/utils";

export function InvoiceTable() {
  const lineItems = useInvoiceStore((s) => s.invoice.lineItems);
  const setLineItem = useInvoiceStore((s) => s.setLineItem);
  const addLineItem = useInvoiceStore((s) => s.addLineItem);
  const removeLineItem = useInvoiceStore((s) => s.removeLineItem);
  const resequence = useInvoiceStore((s) => s.resequence);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Common Premium Styling Tokens
  const inputClass = "bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700/60 shadow-sm focus-visible:ring-emerald-500/20 text-neutral-900 dark:text-neutral-50";

  if (isMobile) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-foreground">Line Items ({lineItems.length})</div>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              addLineItem();
              resequence();
            }}
            className="bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 border border-neutral-300 dark:border-neutral-700 text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white active:scale-[0.98] transition-all duration-150"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </div>

        <div className="space-y-3">
          {lineItems.map((li, idx) => {
            const amount = calculateLineAmount(li.qty, li.rate);
            return (
              <div
                key={`${li.sno}-${idx}`}
                className="rounded-xl border border-neutral-200 dark:border-neutral-800/80 bg-white/70 dark:bg-neutral-900/40 backdrop-blur-md p-4 shadow-sm space-y-3 relative"
              >
                <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800/60 pb-2">
                  <span className="text-xs font-semibold text-emerald-500">Item #{idx + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                    onClick={() => {
                      removeLineItem(idx);
                      resequence();
                    }}
                    disabled={lineItems.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">Description</label>
                  <Textarea
                    value={li.description}
                    placeholder="Service/product description"
                    onChange={(e) => setLineItem(idx, { description: e.target.value })}
                    className={cn("min-h-[60px] resize-y py-1.5", inputClass)}
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase">HSN/SAC</label>
                    <Input
                      value={li.hsnSac ?? ""}
                      placeholder="HSN/SAC"
                      onChange={(e) => setLineItem(idx, { hsnSac: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase">Unit</label>
                    <Input
                      value={li.unit}
                      placeholder="Unit"
                      onChange={(e) => setLineItem(idx, { unit: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase">Qty</label>
                    <Input
                      inputMode="decimal"
                      type="number"
                      className={inputClass}
                      value={String(li.qty)}
                      onChange={(e) => setLineItem(idx, { qty: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase">Rate (₹)</label>
                    <Input
                      inputMode="decimal"
                      type="number"
                      className={inputClass}
                      value={String(li.rate)}
                      onChange={(e) => setLineItem(idx, { rate: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-neutral-100 dark:border-neutral-800/60 pt-2 text-xs">
                  <span className="text-muted-foreground">Line Total</span>
                  <span className="font-semibold text-foreground tabular-nums">{formatINR(amount)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-foreground">Line Items</div>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            addLineItem();
            resequence();
          }}
          className="bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 border border-neutral-300 dark:border-neutral-700 text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white active:scale-[0.98] transition-all duration-150"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Row
        </Button>
      </div>

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800/80 bg-white/50 dark:bg-neutral-900/30 backdrop-blur-md shadow-lg dark:shadow-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-neutral-50 dark:bg-neutral-900/60 border-b border-neutral-200 dark:border-neutral-800/80">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-14 font-medium text-muted-foreground">S.No.</TableHead>
              <TableHead className="font-medium text-muted-foreground">Name of Product/Service</TableHead>
              <TableHead className="w-32 font-medium text-muted-foreground">HSN/SAC</TableHead>
              <TableHead className="w-24 font-medium text-muted-foreground">Unit</TableHead>
              <TableHead className="w-24 text-right font-medium text-muted-foreground">Qty</TableHead>
              <TableHead className="w-28 text-right font-medium text-muted-foreground">Rate</TableHead>
              <TableHead className="w-32 text-right font-medium text-muted-foreground">Amount</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineItems.map((li, idx) => {
              const amount = calculateLineAmount(li.qty, li.rate);
              return (
                <TableRow key={`${li.sno}-${idx}`} className="border-b border-neutral-200 dark:border-neutral-800/50 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/10">
                  <TableCell className="align-top pt-3.5 font-medium text-foreground">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="align-top pt-2">
                    <Textarea
                      value={li.description}
                      placeholder="Service description"
                      onChange={(e) =>
                        setLineItem(idx, { description: e.target.value })
                      }
                      className={cn("min-h-[60px] resize-y py-1.5", inputClass)}
                      rows={2}
                    />
                  </TableCell>
                  <TableCell className="align-top pt-2">
                    <Input
                      value={li.hsnSac ?? ""}
                      placeholder="HSN/SAC"
                      onChange={(e) =>
                        setLineItem(idx, { hsnSac: e.target.value })
                      }
                      className={inputClass}
                    />
                  </TableCell>
                  <TableCell className="align-top pt-2">
                    <Input
                      value={li.unit}
                      placeholder="Unit"
                      onChange={(e) => setLineItem(idx, { unit: e.target.value })}
                      className={inputClass}
                    />
                  </TableCell>
                  <TableCell className="align-top pt-2">
                    <Input
                      inputMode="decimal"
                      className={cn("text-right", inputClass)}
                      value={String(li.qty)}
                      onChange={(e) =>
                        setLineItem(idx, { qty: Number(e.target.value) })
                      }
                    />
                  </TableCell>
                  <TableCell className="align-top pt-2">
                    <Input
                      inputMode="decimal"
                      className={cn("text-right", inputClass)}
                      value={String(li.rate)}
                      onChange={(e) =>
                        setLineItem(idx, { rate: Number(e.target.value) })
                      }
                    />
                  </TableCell>
                  <TableCell className="align-top pt-3.5 text-right font-medium text-foreground tabular-nums">
                    {formatINR(amount)}
                  </TableCell>
                  <TableCell className="align-top pt-2 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      onClick={() => {
                        removeLineItem(idx);
                        resequence();
                      }}
                      disabled={lineItems.length <= 1}
                      aria-label="Remove line item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
