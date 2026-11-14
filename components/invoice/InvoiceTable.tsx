"use client";

import { useEffect, useState } from "react";
import { Trash2, Plus } from "lucide-react";

import { parseAmount } from "@/lib/calculations";
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

function validateHsnSac(code: string): { valid: boolean; warning: string | null } {
  if (!code || code.trim() === "") return { valid: true, warning: null };
  const cleaned = code.trim();
  const isAllDigits = /^\d+$/.test(cleaned);
  if (!isAllDigits) return { valid: false, warning: "HSN/SAC must be numeric." };
  if (cleaned.length !== 6 && cleaned.length !== 8) {
    return { valid: false, warning: "HSN/SAC should be 6 or 8 digits." };
  }
  // SAC codes (services) start with 99; HSN codes (goods) don't
  // For a service invoice, warn if a goods HSN is used
  if (!cleaned.startsWith("99")) {
    return {
      valid: true,
      warning: "This looks like a goods HSN code. For services, use a SAC code starting with 99 (e.g. 998719).",
    };
  }
  return { valid: true, warning: null };
}

// Unit, Qty and Rate are free text: printed as typed and never used in a calculation.
const FREE_TEXT_MAX = 60;

/** Something is typed in the Amount box, but it is not a usable number. */
function amountIsInvalid(amount: string) {
  return amount.trim() !== "" && Number.isNaN(parseAmount(amount));
}

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing external prop to local state
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
        // Emptying the box clears the value instead of snapping back on blur.
        if (str.trim() === "") {
          onChange(0);
          return;
        }
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
            const amountInvalid = amountIsInvalid(li.amount);
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
                        onChange={(n) => setLineItem(idx, { meterStart: n || null })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Meter End</label>
                      <DecimalInput
                        value={li.meterEnd ?? 0}
                        onChange={(n) => setLineItem(idx, { meterEnd: n || null })}
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
                      className={validateHsnSac(li.hsnSac ?? "").warning ? "border-amber-400 focus-visible:ring-amber-400" : ""}
                    />
                    {(() => {
                      const { warning } = validateHsnSac(li.hsnSac ?? "");
                      return warning ? (
                        <p className="text-[10px] text-amber-500 mt-0.5 leading-tight">{warning}</p>
                      ) : null;
                    })()}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Unit</label>
                    <Input
                      value={li.unit}
                      placeholder="Unit"
                      maxLength={FREE_TEXT_MAX}
                      onChange={(e) => setLineItem(idx, { unit: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Qty</label>
                    <Input
                      value={li.qty}
                      maxLength={FREE_TEXT_MAX}
                      onChange={(e) => setLineItem(idx, { qty: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Rate</label>
                    <Input
                      value={li.rate}
                      maxLength={FREE_TEXT_MAX}
                      onChange={(e) => setLineItem(idx, { rate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5 border-t border-border pt-3">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Amount (₹)</label>
                  <Input
                    className="text-right font-semibold tabular-nums"
                    inputMode="decimal"
                    placeholder="Type the amount"
                    value={li.amount}
                    aria-invalid={amountInvalid}
                    onChange={(e) => setLineItem(idx, { amount: e.target.value })}
                  />
                  {amountInvalid ? (
                    <p className="text-[10px] text-destructive leading-tight">Amount must be a number.</p>
                  ) : null}
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
              <TableHead className="w-24 font-medium">HSN/SAC</TableHead>
              <TableHead className="w-20 font-medium">Unit</TableHead>
              <TableHead className="w-24 text-right font-medium">Qty</TableHead>
              <TableHead className="w-32 text-right font-medium">Rate</TableHead>
              <TableHead className="w-32 text-right font-medium">Amount (₹)</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineItems.map((li, idx) => {
              const amountInvalid = amountIsInvalid(li.amount);
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
                        className="h-8 px-1.5 text-xs placeholder:text-[10px]"
                        value={li.meterStart ?? 0}
                        onChange={(n) => setLineItem(idx, { meterStart: n || null })}
                        placeholder="Meter Start"
                      />
                      <DecimalInput
                        className="h-8 px-1.5 text-xs placeholder:text-[10px]"
                        value={li.meterEnd ?? 0}
                        onChange={(n) => setLineItem(idx, { meterEnd: n || null })}
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
                      className={validateHsnSac(li.hsnSac ?? "").warning ? "border-amber-400 focus-visible:ring-amber-400" : ""}
                    />
                    {(() => {
                      const { warning } = validateHsnSac(li.hsnSac ?? "");
                      return warning ? (
                        <p className="text-[10px] text-amber-500 mt-0.5 leading-tight">{warning}</p>
                      ) : null;
                    })()}
                  </TableCell>
                  <TableCell className="align-top pt-2">
                    <Input
                      value={li.unit}
                      placeholder="Unit"
                      maxLength={FREE_TEXT_MAX}
                      onChange={(e) => setLineItem(idx, { unit: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="align-top pt-2">
                    <Input
                      className="text-right"
                      value={li.qty}
                      maxLength={FREE_TEXT_MAX}
                      aria-label={`Quantity, line ${idx + 1}`}
                      onChange={(e) => setLineItem(idx, { qty: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="align-top pt-2">
                    <Input
                      className="text-right"
                      value={li.rate}
                      maxLength={FREE_TEXT_MAX}
                      aria-label={`Rate, line ${idx + 1}`}
                      onChange={(e) => setLineItem(idx, { rate: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="align-top pt-2">
                    <Input
                      className="text-right font-medium tabular-nums"
                      inputMode="decimal"
                      placeholder="Amount"
                      value={li.amount}
                      aria-label={`Amount, line ${idx + 1}`}
                      aria-invalid={amountInvalid}
                      onChange={(e) => setLineItem(idx, { amount: e.target.value })}
                    />
                    {amountInvalid ? (
                      <p className="text-[10px] text-destructive mt-0.5 leading-tight text-right">
                        Must be a number.
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="align-top pt-2 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-75 hover:opacity-100 transition-opacity"
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
