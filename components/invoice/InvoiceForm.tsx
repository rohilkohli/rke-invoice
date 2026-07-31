"use client";

import { useEffect, useState } from "react";
import { Save, ClipboardList, Building2, Truck, Percent, Sparkles, ChevronLeft, ChevronRight, Camera } from "lucide-react";
import { toast } from "sonner";
import { scanInvoiceAction } from "@/app/actions/ocr";

import {
  amountInWordsINR,
  calculateTotals,
  formatINR,
  getTaxMode,
} from "@/lib/calculations";
import { DEFAULT_COMPANY_STATE } from "@/lib/defaults";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { InvoiceTable } from "./InvoiceTable";
import { useInvoiceStore } from "./useInvoiceStore";
import type { InvoiceStatus } from "./types";
import { cn } from "@/lib/utils";
import { InvoicePreview, type CompanySettingsPreview } from "./InvoicePreview";

export function InvoiceForm(props: {
  onSave: () => void;
  saving?: boolean;
  company: CompanySettingsPreview;
}) {
  const invoice = useInvoiceStore((s) => s.invoice);
  const setField = useInvoiceStore((s) => s.setField);
  const setClientField = useInvoiceStore((s) => s.setClientField);
  const setInvoice = useInvoiceStore((s) => s.setInvoice);

  const [scanning, setScanning] = useState(false);
  const [scanMode, setScanMode] = useState<"flash" | "pro">("flash");
  const [differentShipping, setDifferentShipping] = useState(() => {
    const c = invoice.client;
    return !!c.shipToName || !!c.shipToAddress;
  });

  const [isMobile, setIsMobile] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const compressImage = (file: File): Promise<{ dataUrl: string; mimeType: string }> =>
    new Promise((resolve) => {
      if (file.type === "application/pdf") {
        const reader = new FileReader();
        reader.onload = () => resolve({ dataUrl: reader.result as string, mimeType: file.type });
        reader.readAsDataURL(file);
        return;
      }
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 2048;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width >= height) { height = Math.round((height / width) * MAX); width = MAX; }
          else { width = Math.round((width / height) * MAX); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
        resolve({ dataUrl: canvas.toDataURL("image/jpeg", 0.85), mimeType: "image/jpeg" });
      };
      img.onerror = () => {
        const reader = new FileReader();
        reader.onload = () => resolve({ dataUrl: reader.result as string, mimeType: file.type });
        reader.readAsDataURL(file);
      };
      img.src = url;
    });

  const handleScanInvoice = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    const modelLabel = scanMode === "pro" ? "Gemini Pro (High Accuracy)" : "Gemini Flash (Fast Mode)";
    const toastId = toast.loading(`Scanning with ${modelLabel}...`);

    try {
      const { dataUrl: base64Data, mimeType: compressedMime } = await compressImage(file);
      const result = await scanInvoiceAction(base64Data, compressedMime, scanMode);

        if (result.success && result.data) {
          const parsed = result.data;

          const updatedInvoice = {
            ...invoice,
            invoiceNo: parsed.invoiceNo ?? invoice.invoiceNo,
            invoiceDate: parsed.invoiceDate ?? invoice.invoiceDate,
            poNo: parsed.poNo ?? invoice.poNo,
            billPeriodStart: parsed.billPeriodStart ?? invoice.billPeriodStart,
            billPeriodEnd: parsed.billPeriodEnd ?? invoice.billPeriodEnd,
            state: parsed.state ?? invoice.state,
            stateCode: parsed.stateCode ?? invoice.stateCode,
            transportMode: parsed.transportMode ?? invoice.transportMode,
            vehicleNo: parsed.vehicleNo ?? invoice.vehicleNo,
            placeOfSupply: parsed.placeOfSupply ?? invoice.placeOfSupply,
            reverseCharge: parsed.reverseCharge ?? invoice.reverseCharge,
            client: {
              ...invoice.client,
              name: parsed.client?.name ?? invoice.client.name,
              address: parsed.client?.address ?? invoice.client.address,
              gstin: parsed.client?.gstin ?? invoice.client.gstin,
              state: parsed.client?.state ?? invoice.client.state,
              stateCode: parsed.client?.stateCode ?? invoice.client.stateCode,
              shipToName: parsed.client?.shipToName ?? parsed.client?.name ?? invoice.client.shipToName,
              shipToAddress: parsed.client?.shipToAddress ?? parsed.client?.address ?? invoice.client.shipToAddress,
            },
            lineItems: parsed.lineItems && parsed.lineItems.length > 0
              ? parsed.lineItems.map((li: { sno?: number; description?: string; hsnSac?: string; unit?: string; qty?: number; rate?: number }, idx: number) => ({
                  sno: li.sno ?? (idx + 1),
                  description: li.description ?? "",
                  hsnSac: li.hsnSac ?? "",
                  unit: li.unit ?? "Nos",
                  qty: Number(li.qty ?? 1),
                  rate: Number(li.rate ?? 0),
                }))
              : invoice.lineItems,
          };

          const different = !!parsed.client?.shipToName && parsed.client?.shipToName !== parsed.client?.name;
          setDifferentShipping(different);

          setInvoice(updatedInvoice);
          toast.success("Invoice details extracted successfully!", { id: toastId });
        } else {
          toast.error(result.error || "Failed to parse invoice. Please try again.", { id: toastId });
        }
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Error processing image file.";
      toast.error(msg, { id: toastId });
    } finally {
      setScanning(false);
      e.target.value = "";
    }
  };

  const handleShippingToggle = (checked: boolean) => {
    setDifferentShipping(checked);
    if (!checked) {
      setClientField("shipToName", invoice.client.name);
      setClientField("shipToAddress", invoice.client.address);
    }
  };

  useEffect(() => {
    if (!differentShipping) {
      if (invoice.client.shipToName !== invoice.client.name) {
        setClientField("shipToName", invoice.client.name);
      }
      if (invoice.client.shipToAddress !== invoice.client.address) {
        setClientField("shipToAddress", invoice.client.address);
      }
    }
  }, [
    differentShipping,
    invoice.client.name,
    invoice.client.address,
    invoice.client.shipToName,
    invoice.client.shipToAddress,
    setClientField,
  ]);

  const taxMode = getTaxMode(DEFAULT_COMPANY_STATE.stateCode, invoice.client.stateCode);
  const totals = calculateTotals({
    items: invoice.lineItems.map((li) => ({ qty: li.qty, rate: li.rate })),
    cgstRate: invoice.cgstRate,
    sgstRate: invoice.sgstRate,
    igstRate: invoice.igstRate,
    taxMode,
  });

  const amountInWords = amountInWordsINR(totals.grandTotal);

  const cardClass = "rounded-xl border border-border bg-card shadow-sm overflow-hidden";

  if (isMobile) {
    const steps = [
      { number: 1, label: "Details" },
      { number: 2, label: "Client" },
      { number: 3, label: "Items" },
      { number: 4, label: "Review" },
    ];

    return (
      <div className="space-y-6 pb-24">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Invoice</h1>
            <p className="text-sm text-muted-foreground">
              Create or edit GST tax invoice
            </p>
          </div>
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            id="ai-invoice-scan"
            onChange={handleScanInvoice}
          />
        </div>

        {/* Step Indicator */}
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between max-w-md mx-auto">
            {steps.map((s, idx) => (
              <div key={s.number} className="flex items-center flex-1 last:flex-initial">
                <button
                  type="button"
                  onClick={() => setCurrentStep(s.number)}
                  className="flex items-center gap-1.5 focus:outline-none"
                >
                  <div
                    className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200",
                      currentStep === s.number
                        ? "bg-primary text-primary-foreground ring-4 ring-primary/20 shadow-sm"
                        : currentStep > s.number
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {s.number}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium hidden xs:inline sm:inline transition-colors",
                      currentStep === s.number
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {s.label}
                  </span>
                </button>
                {idx < steps.length - 1 && (
                  <div
                    className={cn(
                      "h-[2px] flex-1 mx-2 rounded transition-colors",
                      currentStep > s.number
                        ? "bg-primary"
                        : "bg-border"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Core Details */}
        {currentStep === 1 && (
          <Card className={cardClass}>
            <CardHeader className="border-b border-border px-5 py-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" />
                Invoice Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-2">
                <Label>Invoice No.</Label>
                <Input
                  value={invoice.invoiceNo}
                  onChange={(e) => setField("invoiceNo", e.target.value)}
                  placeholder="RKE-2026-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Invoice Date</Label>
                <Input
                  type="date"
                  value={invoice.invoiceDate}
                  onChange={(e) => setField("invoiceDate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>PO / WO No.</Label>
                <Input
                  value={invoice.poNo ?? ""}
                  onChange={(e) => setField("poNo", e.target.value)}
                  placeholder="PO / WO No."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Bill Period Start</Label>
                  <Input
                    type="date"
                    value={invoice.billPeriodStart ?? ""}
                    onChange={(e) => setField("billPeriodStart", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bill Period End</Label>
                  <Input
                    type="date"
                    value={invoice.billPeriodEnd ?? ""}
                    onChange={(e) => setField("billPeriodEnd", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={invoice.status}
                  onValueChange={(v) => setField("status", v as InvoiceStatus)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="SENT">Sent</SelectItem>
                    <SelectItem value="PAID">Paid</SelectItem>
                    <SelectItem value="QUOTATION">Quotation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>E-Way Bill No.</Label>
                  <Input
                    value={invoice.ewayBillNo ?? ""}
                    onChange={(e) => setField("ewayBillNo", e.target.value)}
                    placeholder="E-Way Bill"
                  />
                </div>
                <div className="space-y-2">
                  <Label>IRN</Label>
                  <Input
                    value={invoice.irn ?? ""}
                    onChange={(e) => setField("irn", e.target.value)}
                    placeholder="Invoice Reference Number"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>State of Supply</Label>
                  <Input
                    value={invoice.state}
                    onChange={(e) => setField("state", e.target.value)}
                    placeholder="State"
                  />
                </div>
                <div className="space-y-2">
                  <Label>State Code</Label>
                  <Input
                    value={invoice.stateCode}
                    onChange={(e) => setField("stateCode", e.target.value)}
                    placeholder="e.g. 27"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Transport Mode</Label>
                  <Input
                    value={invoice.transportMode ?? ""}
                    onChange={(e) => setField("transportMode", e.target.value)}
                    placeholder="Road / Rail"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vehicle No.</Label>
                  <Input
                    value={invoice.vehicleNo ?? ""}
                    onChange={(e) => setField("vehicleNo", e.target.value)}
                    placeholder="MH-12-XX-XXXX"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Place of Supply</Label>
                <Input
                  value={invoice.placeOfSupply ?? ""}
                  onChange={(e) => setField("placeOfSupply", e.target.value)}
                  placeholder="Place of supply"
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-3">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Reverse Charge</div>
                  <div className="text-xs text-muted-foreground">GST on reverse charge</div>
                </div>
                <Switch
                  checked={invoice.reverseCharge}
                  onCheckedChange={(v) => setField("reverseCharge", v)}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Client Details */}
        {currentStep === 2 && (
          <Card className={cardClass}>
            <CardHeader className="border-b border-border px-5 py-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Billed & Shipped Consignee
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-2">
                <Label>Billing Name</Label>
                <Input
                  value={invoice.client.name}
                  onChange={(e) => setClientField("name", e.target.value)}
                  placeholder="Client name"
                />
              </div>
              <div className="space-y-2">
                <Label>Billing GSTIN</Label>
                <Input
                  value={invoice.client.gstin}
                  onChange={(e) => setClientField("gstin", e.target.value)}
                  placeholder="GSTIN"
                />
              </div>
              <div className="space-y-2">
                <Label>Billing Address</Label>
                <Textarea
                  value={invoice.client.address}
                  onChange={(e) => setClientField("address", e.target.value)}
                  placeholder="Full address"
                  className="min-h-20"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Billing State</Label>
                  <Input
                    value={invoice.client.state}
                    onChange={(e) => setClientField("state", e.target.value)}
                    placeholder="State"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Billing State Code</Label>
                  <Input
                    value={invoice.client.stateCode}
                    onChange={(e) => setClientField("stateCode", e.target.value)}
                    placeholder="e.g. 27"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Different Shipping Address</div>
                  <div className="text-xs text-muted-foreground">Consignee details differ from billing</div>
                </div>
                <Switch
                  checked={differentShipping}
                  onCheckedChange={handleShippingToggle}
                />
              </div>

              {differentShipping && (
                <div className="space-y-4 border-t border-border pt-4 mt-2">
                  <div className="text-sm font-semibold text-primary mb-2">Shipping Information</div>
                  <div className="space-y-2">
                    <Label>Consignee Name (Ship To)</Label>
                    <Input
                      value={invoice.client.shipToName ?? ""}
                      onChange={(e) => setClientField("shipToName", e.target.value)}
                      placeholder="Ship to name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Consignee Address (Ship To)</Label>
                    <Input
                      value={invoice.client.shipToAddress ?? ""}
                      onChange={(e) => setClientField("shipToAddress", e.target.value)}
                      placeholder="Ship to address"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Line Items & Totals */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <InvoiceTable />

            <Card className={cardClass}>
              <CardHeader className="border-b border-border px-5 py-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Percent className="h-4 w-4 text-primary" />
                  Tax & Totals
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">CGST %</Label>
                    <Input
                      inputMode="decimal"
                      value={String(invoice.cgstRate)}
                      onChange={(e) => setField("cgstRate", Number(e.target.value))}
                      disabled={taxMode !== "INTRA_STATE"}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">SGST %</Label>
                    <Input
                      inputMode="decimal"
                      value={String(invoice.sgstRate)}
                      onChange={(e) => setField("sgstRate", Number(e.target.value))}
                      disabled={taxMode !== "INTRA_STATE"}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">IGST %</Label>
                    <Input
                      inputMode="decimal"
                      value={String(invoice.igstRate)}
                      onChange={(e) => setField("igstRate", Number(e.target.value))}
                      disabled={taxMode !== "INTER_STATE"}
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Total Before Tax</span>
                    <span className="font-semibold tabular-nums">{formatINR(totals.totalBeforeTax)}</span>
                  </div>
                  {taxMode === "INTRA_STATE" ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs">CGST @ {invoice.cgstRate}%</span>
                        <span className="font-medium tabular-nums">{formatINR(totals.cgst)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs">SGST @ {invoice.sgstRate}%</span>
                        <span className="font-medium tabular-nums">{formatINR(totals.sgst)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">IGST @ {invoice.igstRate}%</span>
                      <span className="font-medium tabular-nums">{formatINR(totals.igst)}</span>
                    </div>
                  )}
                  <div className="h-px bg-border my-2" />
                  <div className="flex items-center justify-between">
                    <span className="font-bold">Grand Total</span>
                    <span className="font-bold tabular-nums text-primary text-lg">{formatINR(totals.grandTotal)}</span>
                  </div>
                  <div className="pt-2 text-xs border-t border-border">
                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Amount in words</div>
                    <div className="mt-0.5 italic text-muted-foreground">{amountInWords}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 4: Live Review */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="rounded-xl overflow-hidden border border-border shadow-sm">
              <div className="bg-muted/50 px-4 py-2.5 text-xs font-medium text-muted-foreground border-b border-border flex items-center justify-between">
                <span>Invoice Preview</span>
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] uppercase tracking-wider font-semibold">A4</span>
              </div>
              <div className="p-2 bg-muted/20 overflow-x-auto max-w-full">
                <InvoicePreview company={props.company} />
              </div>
            </div>
          </div>
        )}

        {/* Mobile Bottom Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border px-6 py-4 flex items-center justify-between shadow-[0_-2px_20px_rgba(0,0,0,0.08)]">
          <div className="w-20">
            {currentStep > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
            )}
          </div>

          <div className="relative flex flex-col items-center -mt-9">
            <div className="absolute -top-15 flex items-center rounded-full border border-border bg-card backdrop-blur pl-3.5 pr-2 py-1 shadow-md select-none gap-2 z-50">
              <Label htmlFor="mobile-scan-mode" className="text-xs font-medium text-muted-foreground cursor-pointer">
                Pro
              </Label>
              <Switch
                id="mobile-scan-mode"
                checked={scanMode === "pro"}
                onCheckedChange={(checked) => setScanMode(checked ? "pro" : "flash")}
              />
            </div>

            <button
              type="button"
              disabled={scanning}
              onClick={() => document.getElementById("ai-invoice-scan")?.click()}
              className={cn(
                "h-14 w-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/25 border-4 border-background transition-all duration-200 active:scale-95",
                scanning && "animate-pulse opacity-80 cursor-wait"
              )}
              aria-label="Scan invoice with AI"
            >
              {scanning ? (
                <Sparkles className="h-6 w-6 animate-spin" />
              ) : (
                <Camera className="h-6 w-6" />
              )}
            </button>
            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-primary uppercase tracking-widest whitespace-nowrap">
              AI Scan
            </span>
          </div>

          <div className="w-20 text-right">
            {currentStep < 4 ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setCurrentStep((s) => Math.min(4, s + 1))}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={props.onSave}
                disabled={props.saving}
              >
                {props.saving ? "..." : "Save"}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {invoice.id ? "Edit Invoice" : "New Invoice"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {invoice.invoiceNo || "GST tax invoice"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            id="ai-invoice-scan"
            onChange={handleScanInvoice}
          />
          {/* Scan Mode Toggle */}
          <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5 select-none text-xs">
            <button
              type="button"
              onClick={() => setScanMode("flash")}
              className={cn(
                "px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-all duration-150 cursor-pointer",
                scanMode === "flash"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Flash
            </button>
            <button
              type="button"
              onClick={() => setScanMode("pro")}
              className={cn(
                "px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-all duration-150 cursor-pointer",
                scanMode === "pro"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Pro
            </button>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => document.getElementById("ai-invoice-scan")?.click()}
            disabled={scanning}
          >
            <Sparkles className={cn("mr-2 h-4 w-4 text-primary", scanning && "animate-pulse")} />
            {scanning ? "Scanning..." : "AI Scan"}
          </Button>
          <Button
            onClick={props.onSave}
            disabled={props.saving}
            className="shadow-md shadow-primary/20"
          >
            <Save className="mr-2 h-4 w-4" />
            {props.saving ? "Saving..." : "Save Invoice"}
          </Button>
        </div>
      </div>

      {/* Accordion Panels */}
      <Accordion
        defaultValue={["core-meta", "consignee"]}
        className="space-y-4"
      >
        <AccordionItem value="core-meta" className={cardClass}>
          <AccordionTrigger className="px-5 py-4 font-semibold text-sm flex items-center gap-2 border-b border-border hover:no-underline">
            <ClipboardList className="h-4 w-4 text-primary" />
            Core Details
          </AccordionTrigger>
          <AccordionContent className="p-5 grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Invoice No.</Label>
              <Input
                value={invoice.invoiceNo}
                onChange={(e) => setField("invoiceNo", e.target.value)}
                placeholder="RKE-2026-001"
              />
            </div>
            <div className="space-y-2">
              <Label>Invoice Date</Label>
              <Input
                type="date"
                value={invoice.invoiceDate}
                onChange={(e) => setField("invoiceDate", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>PO / WO No.</Label>
              <Input
                value={invoice.poNo ?? ""}
                onChange={(e) => setField("poNo", e.target.value)}
                placeholder="PO / WO No."
              />
            </div>
            <div className="space-y-2">
              <Label>Bill Period Start</Label>
              <Input
                type="date"
                value={invoice.billPeriodStart ?? ""}
                onChange={(e) => setField("billPeriodStart", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Bill Period End</Label>
              <Input
                type="date"
                value={invoice.billPeriodEnd ?? ""}
                onChange={(e) => setField("billPeriodEnd", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={invoice.status}
                onValueChange={(v) => setField("status", v as InvoiceStatus)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="SENT">Sent</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="QUOTATION">Quotation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>E-Way Bill No.</Label>
              <Input
                value={invoice.ewayBillNo ?? ""}
                onChange={(e) => setField("ewayBillNo", e.target.value)}
                placeholder="E-Way Bill"
              />
            </div>
            <div className="space-y-2">
              <Label>IRN</Label>
              <Input
                value={invoice.irn ?? ""}
                onChange={(e) => setField("irn", e.target.value)}
                placeholder="Invoice Reference Number"
              />
            </div>
            <div className="space-y-2">
              <Label>State of Supply</Label>
              <Input
                value={invoice.state}
                onChange={(e) => setField("state", e.target.value)}
                placeholder="State"
              />
            </div>
            <div className="space-y-2">
              <Label>State Code</Label>
              <Input
                value={invoice.stateCode}
                onChange={(e) => setField("stateCode", e.target.value)}
                placeholder="e.g. 27"
              />
            </div>
            <div className="flex items-end justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-1.5 h-16">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Reverse Charge</div>
                <div className="text-[11px] text-muted-foreground">GST on reverse charge</div>
              </div>
              <Switch
                checked={invoice.reverseCharge}
                onCheckedChange={(v) => setField("reverseCharge", v)}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="consignee" className={cardClass}>
          <AccordionTrigger className="px-5 py-4 font-semibold text-sm flex items-center gap-2 border-b border-border hover:no-underline">
            <Building2 className="h-4 w-4 text-primary" />
            Billed & Shipped Consignee
          </AccordionTrigger>
          <AccordionContent className="p-5 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Billing Name</Label>
              <Input
                value={invoice.client.name}
                onChange={(e) => setClientField("name", e.target.value)}
                placeholder="Client name"
              />
            </div>
            <div className="space-y-2">
              <Label>Billing GSTIN</Label>
              <Input
                value={invoice.client.gstin}
                onChange={(e) => setClientField("gstin", e.target.value)}
                placeholder="GSTIN"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Billing Address</Label>
              <Textarea
                value={invoice.client.address}
                onChange={(e) => setClientField("address", e.target.value)}
                placeholder="Full address"
                className="min-h-20"
              />
            </div>
            <div className="space-y-2">
              <Label>Billing State</Label>
              <Input
                value={invoice.client.state}
                onChange={(e) => setClientField("state", e.target.value)}
                placeholder="State"
              />
            </div>
            <div className="space-y-2">
              <Label>Billing State Code</Label>
              <Input
                value={invoice.client.stateCode}
                onChange={(e) => setClientField("stateCode", e.target.value)}
                placeholder="e.g. 27"
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-3 md:col-span-2">
              <div className="space-y-1">
                <div className="text-sm font-medium">Different Shipping Address</div>
                <div className="text-xs text-muted-foreground">Consignee differs from billing</div>
              </div>
              <Switch
                checked={differentShipping}
                onCheckedChange={handleShippingToggle}
              />
            </div>

            {differentShipping && (
              <>
                <div className="space-y-2 md:col-span-2 border-t border-border pt-4 mt-2">
                  <div className="text-sm font-semibold text-primary mb-2">Shipping Information</div>
                </div>
                <div className="space-y-2">
                  <Label>Consignee Name (Ship To)</Label>
                  <Input
                    value={invoice.client.shipToName ?? ""}
                    onChange={(e) => setClientField("shipToName", e.target.value)}
                    placeholder="Ship to name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Consignee Address (Ship To)</Label>
                  <Input
                    value={invoice.client.shipToAddress ?? ""}
                    onChange={(e) => setClientField("shipToAddress", e.target.value)}
                    placeholder="Ship to address"
                  />
                </div>
              </>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="logistics" className={cardClass}>
          <AccordionTrigger className="px-5 py-4 font-semibold text-sm flex items-center gap-2 border-b border-border hover:no-underline">
            <Truck className="h-4 w-4 text-primary" />
            Logistics & Transport
          </AccordionTrigger>
          <AccordionContent className="p-5 grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Transport Mode</Label>
              <Input
                value={invoice.transportMode ?? ""}
                onChange={(e) => setField("transportMode", e.target.value)}
                placeholder="Road / Rail / Air"
              />
            </div>
            <div className="space-y-2">
              <Label>Vehicle No.</Label>
              <Input
                value={invoice.vehicleNo ?? ""}
                onChange={(e) => setField("vehicleNo", e.target.value)}
                placeholder="Vehicle number"
              />
            </div>
            <div className="space-y-2">
              <Label>Place of Supply</Label>
              <Input
                value={invoice.placeOfSupply ?? ""}
                onChange={(e) => setField("placeOfSupply", e.target.value)}
                placeholder="Place of supply"
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Line Items */}
      <InvoiceTable />

      {/* Tax & Totals */}
      <Card className={cardClass}>
        <CardHeader className="border-b border-border px-5 py-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Percent className="h-4 w-4 text-primary" />
            Tax & Totals
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 grid gap-4 md:grid-cols-2">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>CGST %</Label>
              <Input
                inputMode="decimal"
                value={String(invoice.cgstRate)}
                onChange={(e) => setField("cgstRate", Number(e.target.value))}
                disabled={taxMode !== "INTRA_STATE"}
              />
            </div>
            <div className="space-y-2">
              <Label>SGST %</Label>
              <Input
                inputMode="decimal"
                value={String(invoice.sgstRate)}
                onChange={(e) => setField("sgstRate", Number(e.target.value))}
                disabled={taxMode !== "INTRA_STATE"}
              />
            </div>
            <div className="space-y-2">
              <Label>IGST %</Label>
              <Input
                inputMode="decimal"
                value={String(invoice.igstRate)}
                onChange={(e) => setField("igstRate", Number(e.target.value))}
                disabled={taxMode !== "INTER_STATE"}
              />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Before Tax</span>
              <span className="font-medium tabular-nums">{formatINR(totals.totalBeforeTax)}</span>
            </div>
            {taxMode === "INTRA_STATE" ? (
              <>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-muted-foreground">CGST @ {invoice.cgstRate}%</span>
                  <span className="font-medium tabular-nums">{formatINR(totals.cgst)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-muted-foreground">SGST @ {invoice.sgstRate}%</span>
                  <span className="font-medium tabular-nums">{formatINR(totals.sgst)}</span>
                </div>
              </>
            ) : (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-muted-foreground">IGST @ {invoice.igstRate}%</span>
                <span className="font-medium tabular-nums">{formatINR(totals.igst)}</span>
              </div>
            )}
            <div className="my-3 h-px bg-border" />
            <div className="flex items-center justify-between">
              <span className="font-bold">Grand Total</span>
              <span className="font-bold tabular-nums text-primary text-lg">
                {formatINR(totals.grandTotal)}
              </span>
            </div>
            <div className="mt-3 text-xs text-muted-foreground border-t border-border pt-2">
              <div className="font-medium text-foreground">Amount in words</div>
              <div className="mt-0.5 italic">{amountInWords}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
