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

function DecimalInput({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  placeholder?: string;
}) {
  const [raw, setRaw] = useState(value === 0 ? "" : String(value));

  useEffect(() => {
    const parsed = parseFloat(raw);
    if (parsed !== value) setRaw(value === 0 ? "" : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Input
      inputMode="decimal"
      className={className}
      placeholder={placeholder}
      value={raw}
      onChange={(e) => {
        const str = e.target.value;
        setRaw(str);
        const num = parseFloat(str);
        if (!isNaN(num)) onChange(num);
      }}
      onBlur={() => {
        const num = parseFloat(raw);
        if (!isNaN(num)) {
          onChange(num);
          setRaw(String(num));
        } else {
          setRaw(value === 0 ? "" : String(value));
        }
      }}
    />
  );
}

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

  if (isMobile) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Line Items ({lineItems.length})</div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              addLineItem();
              resequence();
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Item
          </Button>
        </div>

        <div className="space-y-3">
          {lineItems.map((li, idx) => {
            const amount = calculateLineAmount(li.qty, li.rate);
            return (
              <div
                key={`${li.sno}-${idx}`}
                className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="text-xs font-semibold text-primary">#{idx + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      removeLineItem(idx);
                      resequence();
                    }}
                    disabled={lineItems.length <= 1}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Description</label>
                  <Textarea
                    value={li.description}
                    placeholder="Service/product description"
                    onChange={(e) => setLineItem(idx, { description: e.target.value })}
                    className="min-h-[60px] resize-y"
                    rows={2}
                  />
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Meter Start</label>
                      <DecimalInput
                        value={li.meterStart ?? 0}
                        onChange={(n) => {
                          const mStart = n || null;
                          const qty = (li.meterEnd ?? 0) - (mStart ?? 0);
                          setLineItem(idx, { meterStart: mStart, qty: qty > 0 ? qty : li.qty });
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Meter End</label>
                      <DecimalInput
                        value={li.meterEnd ?? 0}
                        onChange={(n) => {
                          const mEnd = n || null;
                          const qty = (mEnd ?? 0) - (li.meterStart ?? 0);
                          setLineItem(idx, { meterEnd: mEnd, qty: qty > 0 ? qty : li.qty });
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">HSN/SAC</label>
                    <Input
                      value={li.hsnSac ?? ""}
                      placeholder="HSN/SAC"
                      onChange={(e) => setLineItem(idx, { hsnSac: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Unit</label>
                    <Input
                      value={li.unit}
                      placeholder="Unit"
                      onChange={(e) => setLineItem(idx, { unit: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Qty</label>
                    <DecimalInput
                      value={li.qty}
                      onChange={(n) => setLineItem(idx, { qty: n })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Rate</label>
                    <DecimalInput
                      value={li.rate}
                      onChange={(n) => setLineItem(idx, { rate: n })}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
                  <span className="text-muted-foreground">Line Total</span>
                  <span className="font-semibold tabular-nums">{formatINR(amount)}</span>
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
        <div className="text-sm font-semibold">Line Items</div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            addLineItem();
            resequence();
          }}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Row
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-14 font-medium">#</TableHead>
              <TableHead className="font-medium">Description</TableHead>
              <TableHead className="w-28 font-medium">HSN/SAC</TableHead>
              <TableHead className="w-20 font-medium">Unit</TableHead>
              <TableHead className="w-24 text-right font-medium">Qty</TableHead>
              <TableHead className="w-28 text-right font-medium">Rate</TableHead>
              <TableHead className="w-32 text-right font-medium">Amount</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineItems.map((li, idx) => {
              const amount = calculateLineAmount(li.qty, li.rate);
              return (
                <TableRow key={`${li.sno}-${idx}`} className="group">
                  <TableCell className="align-top pt-3.5 font-medium text-muted-foreground">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="align-top pt-2">
                    <Textarea
                      value={li.description}
                      placeholder="Service description"
                      onChange={(e) =>
                        setLineItem(idx, { description: e.target.value })
                      }
                      className="min-h-[60px] resize-y mb-2"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <DecimalInput
                        className="h-8 text-xs placeholder:text-[10px]"
                        value={li.meterStart ?? 0}
                        onChange={(n) => {
                          const mStart = n || null;
                          const qty = (li.meterEnd ?? 0) - (mStart ?? 0);
                          setLineItem(idx, { meterStart: mStart, qty: qty > 0 ? qty : li.qty });
                        }}
                        placeholder="Meter Start"
                      />
                      <DecimalInput
                        className="h-8 text-xs placeholder:text-[10px]"
                        value={li.meterEnd ?? 0}
                        onChange={(n) => {
                          const mEnd = n || null;
                          const qty = (mEnd ?? 0) - (li.meterStart ?? 0);
                          setLineItem(idx, { meterEnd: mEnd, qty: qty > 0 ? qty : li.qty });
                        }}
                        placeholder="Meter End"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="align-top pt-2">
                    <Input
                      value={li.hsnSac ?? ""}
                      placeholder="HSN/SAC"
                      onChange={(e) =>
                        setLineItem(idx, { hsnSac: e.target.value })
                      }
                    />
                  </TableCell>
                  <TableCell className="align-top pt-2">
                    <Input
                      value={li.unit}
                      placeholder="Unit"
                      onChange={(e) => setLineItem(idx, { unit: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="align-top pt-2">
                    <DecimalInput
                      className="text-right"
                      value={li.qty}
                      onChange={(n) => setLineItem(idx, { qty: n })}
                    />
                  </TableCell>
                  <TableCell className="align-top pt-2">
                    <DecimalInput
                      className="text-right"
                      value={li.rate}
                      onChange={(n) => setLineItem(idx, { rate: n })}
                    />
                  </TableCell>
                  <TableCell className="align-top pt-3.5 text-right font-medium tabular-nums">
                    {formatINR(amount)}
                  </TableCell>
                  <TableCell className="align-top pt-2 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
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
