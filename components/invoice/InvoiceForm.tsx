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

  /**
   * Compress & resize an image file to max 2048px on the longer side at JPEG 85% to preserve OCR accuracy.
   * Returns a base64 data-URL string. Falls back to the original data URL if canvas fails.
   */
  const compressImage = (file: File): Promise<{ dataUrl: string; mimeType: string }> =>
    new Promise((resolve) => {
      // PDFs can't be compressed via canvas — pass through unchanged
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
        // If image load fails, fall back to raw file
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
    const toastId = toast.loading(`Compressing & scanning invoice with ${modelLabel}...`);

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
          toast.success("Invoice details successfully extracted & populated!", { id: toastId });
        } else {
          toast.error(result.error || "Failed to parse the invoice. Please try again.", { id: toastId });
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

  // Reactively mirror Billing Details to Shipping Details if "Different Shipping Address" is toggled off
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

  // Common Premium Styling Tokens (Pillar 2)
  const inputClass = "bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700/60 shadow-sm focus-visible:ring-emerald-500/20 text-neutral-900 dark:text-neutral-50";
  const cardClass = "bg-white/80 dark:bg-neutral-900/50 backdrop-blur-md border border-neutral-200 dark:border-neutral-800/80 shadow-lg dark:shadow-xl rounded-xl overflow-hidden";

  if (isMobile) {
    const steps = [
      { number: 1, label: "Details" },
      { number: 2, label: "Client" },
      { number: 3, label: "Items" },
      { number: 4, label: "Review" },
    ];

    return (
      <div className="space-y-6 pb-24">
        {/* Header Container */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold tracking-tight">Invoice</div>
            <div className="text-sm text-muted-foreground">
              Create or edit GST tax invoice
            </div>
          </div>
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            id="ai-invoice-scan"
            onChange={handleScanInvoice}
          />
        </div>

        {/* Step Indicator / Stepper */}
        <div className="bg-neutral-50/80 dark:bg-neutral-900/40 backdrop-blur-md border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 shadow-sm">
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
                      "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300",
                      currentStep === s.number
                        ? "bg-emerald-500 text-white ring-4 ring-emerald-500/20 shadow-md shadow-emerald-500/10"
                        : currentStep > s.number
                        ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400"
                        : "bg-neutral-100 dark:bg-neutral-850 text-muted-foreground"
                    )}
                  >
                    {s.number}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-semibold hidden xs:inline sm:inline transition-all duration-300",
                      currentStep === s.number
                        ? "text-neutral-900 dark:text-neutral-50"
                        : "text-muted-foreground"
                    )}
                  >
                    {s.label}
                  </span>
                </button>
                {idx < steps.length - 1 && (
                  <div
                    className={cn(
                      "h-[2px] flex-1 mx-2 rounded transition-all duration-300",
                      currentStep > s.number
                        ? "bg-emerald-500"
                        : "bg-neutral-200 dark:bg-neutral-800"
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
            <CardHeader className="border-b border-neutral-200 dark:border-neutral-800/80 px-5 py-4">
              <CardTitle className="text-base flex items-center gap-2 text-foreground">
                <ClipboardList className="h-5 w-5 text-emerald-500 shrink-0" />
                <span>Invoice Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-2">
                <Label>Invoice No.</Label>
                <Input
                  value={invoice.invoiceNo}
                  onChange={(e) => setField("invoiceNo", e.target.value)}
                  placeholder="RKE-2026-001"
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label>Invoice Date</Label>
                <Input
                  type="date"
                  value={invoice.invoiceDate}
                  onChange={(e) => setField("invoiceDate", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label>PO / WO No.</Label>
                <Input
                  value={invoice.poNo ?? ""}
                  onChange={(e) => setField("poNo", e.target.value)}
                  placeholder="PO / WO No."
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Bill Period Start</Label>
                  <Input
                    type="date"
                    value={invoice.billPeriodStart ?? ""}
                    onChange={(e) => setField("billPeriodStart", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bill Period End</Label>
                  <Input
                    type="date"
                    value={invoice.billPeriodEnd ?? ""}
                    onChange={(e) => setField("billPeriodEnd", e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={invoice.status}
                  onValueChange={(v) => setField("status", v as InvoiceStatus)}
                >
                  <SelectTrigger className={cn("w-full justify-between pr-2 pl-2.5", inputClass)}>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="SENT">Sent</SelectItem>
                    <SelectItem value="PAID">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>State of Supply</Label>
                  <Input
                    value={invoice.state}
                    onChange={(e) => setField("state", e.target.value)}
                    placeholder="State"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label>State Code</Label>
                  <Input
                    value={invoice.stateCode}
                    onChange={(e) => setField("stateCode", e.target.value)}
                    placeholder="e.g. 27"
                    className={inputClass}
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
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vehicle No.</Label>
                  <Input
                    value={invoice.vehicleNo ?? ""}
                    onChange={(e) => setField("vehicleNo", e.target.value)}
                    placeholder="MH-12-XX-XXXX"
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Place of Supply</Label>
                <Input
                  value={invoice.placeOfSupply ?? ""}
                  onChange={(e) => setField("placeOfSupply", e.target.value)}
                  placeholder="Place of supply"
                  className={inputClass}
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/20 px-3 py-3">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Reverse Charge</div>
                  <div className="text-[0.7rem] text-muted-foreground font-medium">GST on reverse charge</div>
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
            <CardHeader className="border-b border-neutral-200 dark:border-neutral-800/80 px-5 py-4">
              <CardTitle className="text-base flex items-center gap-2 text-foreground">
                <Building2 className="h-5 w-5 text-emerald-500 shrink-0" />
                <span>Billed & Shipped Consignee</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-2">
                <Label>Billing Name</Label>
                <Input
                  value={invoice.client.name}
                  onChange={(e) => setClientField("name", e.target.value)}
                  placeholder="Client name"
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label>Billing GSTIN</Label>
                <Input
                  value={invoice.client.gstin}
                  onChange={(e) => setClientField("gstin", e.target.value)}
                  placeholder="GSTIN"
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label>Billing Address</Label>
                <Textarea
                  value={invoice.client.address}
                  onChange={(e) => setClientField("address", e.target.value)}
                  placeholder="Full address"
                  className={cn("min-h-20", inputClass)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Billing State</Label>
                  <Input
                    value={invoice.client.state}
                    onChange={(e) => setClientField("state", e.target.value)}
                    placeholder="State"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Billing State Code</Label>
                  <Input
                    value={invoice.client.stateCode}
                    onChange={(e) => setClientField("stateCode", e.target.value)}
                    placeholder="e.g. 27"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/20 px-3 py-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Different Shipping Address</div>
                  <div className="text-xs text-muted-foreground font-medium">Deliver consignee details differ</div>
                </div>
                <Switch
                  checked={differentShipping}
                  onCheckedChange={handleShippingToggle}
                />
              </div>

              {differentShipping && (
                <div className="space-y-4 border-t border-neutral-200 dark:border-neutral-800/80 pt-4 mt-2">
                  <div className="text-sm font-semibold text-emerald-500 mb-2">Shipping Information</div>
                  <div className="space-y-2">
                    <Label>Consignee Name (Ship To)</Label>
                    <Input
                      value={invoice.client.shipToName ?? ""}
                      onChange={(e) => setClientField("shipToName", e.target.value)}
                      placeholder="Ship to name"
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Consignee Address (Ship To)</Label>
                    <Input
                      value={invoice.client.shipToAddress ?? ""}
                      onChange={(e) => setClientField("shipToAddress", e.target.value)}
                      placeholder="Ship to address"
                      className={inputClass}
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
              <CardHeader className="border-b border-neutral-200 dark:border-neutral-800/80">
                <CardTitle className="text-base flex items-center gap-2 text-foreground">
                  <Percent className="h-5 w-5 text-emerald-500 shrink-0" />
                  <span>Tax & Totals</span>
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
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">SGST %</Label>
                    <Input
                      inputMode="decimal"
                      value={String(invoice.sgstRate)}
                      onChange={(e) => setField("sgstRate", Number(e.target.value))}
                      disabled={taxMode !== "INTRA_STATE"}
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">IGST %</Label>
                    <Input
                      inputMode="decimal"
                      value={String(invoice.igstRate)}
                      onChange={(e) => setField("igstRate", Number(e.target.value))}
                      disabled={taxMode !== "INTER_STATE"}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/30 p-4 text-sm shadow-inner space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Total Before Tax</span>
                    <span className="font-semibold tabular-nums text-foreground">{formatINR(totals.totalBeforeTax)}</span>
                  </div>
                  {taxMode === "INTRA_STATE" ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs">CGST @ {invoice.cgstRate}%</span>
                        <span className="font-medium tabular-nums text-foreground">{formatINR(totals.cgst)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs">SGST @ {invoice.sgstRate}%</span>
                        <span className="font-medium tabular-nums text-foreground">{formatINR(totals.sgst)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">IGST @ {invoice.igstRate}%</span>
                      <span className="font-medium tabular-nums text-foreground">{formatINR(totals.igst)}</span>
                    </div>
                  )}
                  <div className="h-px bg-neutral-200 dark:bg-neutral-800/80 my-2" />
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">Grand Total</span>
                    <span className="font-bold tabular-nums text-emerald-500 text-base">{formatINR(totals.grandTotal)}</span>
                  </div>
                  <div className="pt-2 text-xs border-t border-neutral-100 dark:border-neutral-800/40">
                    <div className="font-bold text-foreground uppercase tracking-wider text-[9px] text-muted-foreground">Amount in words</div>
                    <div className="mt-0.5 italic leading-tight text-neutral-600 dark:text-neutral-400 font-semibold">{amountInWords}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 4: Live Review & Sign */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-md">
              <div className="bg-neutral-100 dark:bg-neutral-900 px-4 py-2.5 text-xs font-bold text-muted-foreground border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <span>Visual Invoice Review</span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-[9px] uppercase tracking-wider font-bold">A4 Preview</span>
              </div>
              <div className="p-2 bg-neutral-100/30 dark:bg-neutral-950/10 overflow-x-auto max-w-full">
                <InvoicePreview company={props.company} />
              </div>
            </div>
          </div>
        )}

        {/* Mobile Sticky Bottom panel */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-lg border-t border-neutral-200 dark:border-neutral-800 px-6 py-4 flex items-center justify-between shadow-[0_-4px_25px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom duration-300">
          <div className="w-20">
            {currentStep > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
                className="text-neutral-700 dark:text-neutral-300 font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
            )}
          </div>

          <div className="relative flex flex-col items-center -mt-9">
            {/* Model Selector in the middle above the mobile button */}
            <div className="absolute -top-15 flex items-center rounded-full border border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur pl-3.5 pr-2 py-1 shadow-md select-none gap-2 z-50">
              <Label htmlFor="mobile-scan-mode" className="text-xs font-bold text-muted-foreground cursor-pointer">
                Pro Mode
              </Label>
              <Switch
                id="mobile-scan-mode"
                checked={scanMode === "pro"}
                onCheckedChange={(checked) => setScanMode(checked ? "pro" : "flash")}
                className="cursor-pointer data-[state=checked]:bg-emerald-500"
              />
            </div>

            <button
              type="button"
              disabled={scanning}
              onClick={() => document.getElementById("ai-invoice-scan")?.click()}
              className={cn(
                "h-14 w-14 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 dark:from-emerald-400 dark:to-teal-500 hover:scale-105 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 border-4 border-white dark:border-neutral-900 transition-all duration-200",
                scanning && "animate-pulse brightness-90 cursor-wait"
              )}
              aria-label="Scan manual invoice with AI camera"
            >
              {scanning ? (
                <Sparkles className="h-6 w-6 animate-spin text-white" />
              ) : (
                <Camera className="h-6 w-6 text-white" />
              )}
            </button>
            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest whitespace-nowrap">
              AI Scan
            </span>
          </div>

          <div className="w-20 text-right">
            {currentStep < 4 ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setCurrentStep((s) => Math.min(4, s + 1))}
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow-md shadow-emerald-500/10"
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
                className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/20"
              >
                {props.saving ? "Saving..." : "Save"}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Container */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold tracking-tight">Invoice</div>
          <div className="text-sm text-muted-foreground">
            Create or edit GST tax invoice
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            id="ai-invoice-scan"
            onChange={handleScanInvoice}
          />
          {/* Scan Mode Segmented Switch */}
          <div className="flex items-center rounded-lg border border-neutral-300 dark:border-neutral-700/80 bg-neutral-50/50 dark:bg-neutral-900/50 p-1 select-none text-xs">
            <button
              type="button"
              onClick={() => setScanMode("flash")}
              className={cn(
                "px-2.5 py-1 text-[11px] font-bold rounded transition-all duration-150 cursor-pointer",
                scanMode === "flash"
                  ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 shadow-sm border border-neutral-200/50 dark:border-neutral-700/50"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Fast (Flash)
            </button>
            <button
              type="button"
              onClick={() => setScanMode("pro")}
              className={cn(
                "px-2.5 py-1 text-[11px] font-bold rounded transition-all duration-150 cursor-pointer",
                scanMode === "pro"
                  ? "bg-gradient-to-tr from-emerald-500 to-teal-500 text-white shadow-sm border-0"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Pro (Accurate)
            </button>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => document.getElementById("ai-invoice-scan")?.click()}
            disabled={scanning}
            className="border-neutral-300 dark:border-neutral-700/80 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 active:scale-[0.98] transition-all duration-150 shadow-sm"
          >
            <Sparkles className={cn("mr-2 h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0", scanning && "animate-pulse")} />
            {scanning ? "Scanning..." : "Scan Manual Invoice (AI)"}
          </Button>
          <Button
            onClick={props.onSave}
            disabled={props.saving}
            className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-[0_4px_20px_rgba(16,185,129,0.15)] active:scale-[0.98] transition-all duration-150 border-0"
          >
            <Save className="mr-2 h-4 w-4" />
            {props.saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Accordion Panels (Pillar 1) */}
      <Accordion
        defaultValue={["core-meta", "consignee"]}
        className="space-y-4"
      >
        {/* Panel 1: Core Meta */}
        <AccordionItem
          value="core-meta"
          className={cardClass}
        >
          <AccordionTrigger className="px-5 py-4 font-semibold text-base flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800/80 hover:no-underline text-foreground">
            <ClipboardList className="h-5 w-5 text-emerald-500 shrink-0" />
            <span>Core Meta</span>
          </AccordionTrigger>
          <AccordionContent className="p-5 grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Invoice No.</Label>
              <Input
                value={invoice.invoiceNo}
                onChange={(e) => setField("invoiceNo", e.target.value)}
                placeholder="RKE-2026-001"
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <Label>Invoice Date</Label>
              <Input
                type="date"
                value={invoice.invoiceDate}
                onChange={(e) => setField("invoiceDate", e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <Label>PO / WO No.</Label>
              <Input
                value={invoice.poNo ?? ""}
                onChange={(e) => setField("poNo", e.target.value)}
                placeholder="PO / WO No."
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <Label>Bill Period Start</Label>
              <Input
                type="date"
                value={invoice.billPeriodStart ?? ""}
                onChange={(e) => setField("billPeriodStart", e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <Label>Bill Period End</Label>
              <Input
                type="date"
                value={invoice.billPeriodEnd ?? ""}
                onChange={(e) => setField("billPeriodEnd", e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={invoice.status}
                onValueChange={(v) => setField("status", v as InvoiceStatus)}
              >
                <SelectTrigger className={cn("w-full justify-between pr-2 pl-2.5", inputClass)}>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="SENT">Sent</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>State of Supply</Label>
              <Input
                value={invoice.state}
                onChange={(e) => setField("state", e.target.value)}
                placeholder="State"
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <Label>State Code</Label>
              <Input
                value={invoice.stateCode}
                onChange={(e) => setField("stateCode", e.target.value)}
                placeholder="e.g. 27"
                className={inputClass}
              />
            </div>
            <div className="flex items-end justify-between gap-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/20 px-3 py-1.5 h-16">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Reverse Charge</div>
                <div className="text-[0.7rem] text-muted-foreground">GST on reverse charge</div>
              </div>
              <Switch
                checked={invoice.reverseCharge}
                onCheckedChange={(v) => setField("reverseCharge", v)}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Panel 2: Billed & Shipped Consignee */}
        <AccordionItem
          value="consignee"
          className={cardClass}
        >
          <AccordionTrigger className="px-5 py-4 font-semibold text-base flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800/80 hover:no-underline text-foreground">
            <Building2 className="h-5 w-5 text-emerald-500 shrink-0" />
            <span>Billed & Shipped Consignee</span>
          </AccordionTrigger>
          <AccordionContent className="p-5 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Billing Name</Label>
              <Input
                value={invoice.client.name}
                onChange={(e) => setClientField("name", e.target.value)}
                placeholder="Client name"
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <Label>Billing GSTIN</Label>
              <Input
                value={invoice.client.gstin}
                onChange={(e) => setClientField("gstin", e.target.value)}
                placeholder="GSTIN"
                className={inputClass}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Billing Address</Label>
              <Textarea
                value={invoice.client.address}
                onChange={(e) => setClientField("address", e.target.value)}
                placeholder="Full address"
                className={cn("min-h-20", inputClass)}
              />
            </div>
            <div className="space-y-2">
              <Label>Billing State</Label>
              <Input
                value={invoice.client.state}
                onChange={(e) => setClientField("state", e.target.value)}
                placeholder="State"
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <Label>Billing State Code</Label>
              <Input
                value={invoice.client.stateCode}
                onChange={(e) => setClientField("stateCode", e.target.value)}
                placeholder="e.g. 27"
                className={inputClass}
              />
            </div>

            {/* Pillar 1: Different Shipping Address switch */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/20 px-3 py-3 md:col-span-2">
              <div className="space-y-1">
                <div className="text-sm font-medium">Different Shipping Address</div>
                <div className="text-xs text-muted-foreground">Deliver consignee details differ from billing address</div>
              </div>
              <Switch
                checked={differentShipping}
                onCheckedChange={handleShippingToggle}
              />
            </div>

            {/* Conditionally Rendered Shipping Details */}
            {differentShipping && (
              <>
                <div className="space-y-2 md:col-span-2 border-t border-neutral-200 dark:border-neutral-800/80 pt-4 mt-2">
                  <div className="text-sm font-semibold text-emerald-500 mb-2">Shipping Information</div>
                </div>
                <div className="space-y-2">
                  <Label>Consignee Name (Ship To)</Label>
                  <Input
                    value={invoice.client.shipToName ?? ""}
                    onChange={(e) => setClientField("shipToName", e.target.value)}
                    placeholder="Ship to name"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Consignee Address (Ship To)</Label>
                  <Input
                    value={invoice.client.shipToAddress ?? ""}
                    onChange={(e) => setClientField("shipToAddress", e.target.value)}
                    placeholder="Ship to address"
                    className={inputClass}
                  />
                </div>
              </>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Panel 3: Logistics & Transport */}
        <AccordionItem
          value="logistics"
          className={cardClass}
        >
          <AccordionTrigger className="px-5 py-4 font-semibold text-base flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800/80 hover:no-underline text-foreground">
            <Truck className="h-5 w-5 text-emerald-500 shrink-0" />
            <span>Logistics & Transport</span>
          </AccordionTrigger>
          <AccordionContent className="p-5 grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Transport Mode</Label>
              <Input
                value={invoice.transportMode ?? ""}
                onChange={(e) => setField("transportMode", e.target.value)}
                placeholder="Road / Rail / Air"
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <Label>Vehicle No.</Label>
              <Input
                value={invoice.vehicleNo ?? ""}
                onChange={(e) => setField("vehicleNo", e.target.value)}
                placeholder="Vehicle number"
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <Label>Place of Supply</Label>
              <Input
                value={invoice.placeOfSupply ?? ""}
                onChange={(e) => setField("placeOfSupply", e.target.value)}
                placeholder="Place of supply"
                className={inputClass}
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Invoice Table Section */}
      <InvoiceTable />

      {/* Tax & Totals Section */}
      <Card className={cardClass}>
        <CardHeader className="border-b border-neutral-200 dark:border-neutral-800/80">
          <CardTitle className="text-base flex items-center gap-2 text-foreground">
            <Percent className="h-5 w-5 text-emerald-500" />
            <span>Tax & Totals</span>
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
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <Label>SGST %</Label>
              <Input
                inputMode="decimal"
                value={String(invoice.sgstRate)}
                onChange={(e) => setField("sgstRate", Number(e.target.value))}
                disabled={taxMode !== "INTRA_STATE"}
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <Label>IGST %</Label>
              <Input
                inputMode="decimal"
                value={String(invoice.igstRate)}
                onChange={(e) => setField("igstRate", Number(e.target.value))}
                disabled={taxMode !== "INTER_STATE"}
                className={inputClass}
              />
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/30 p-4 text-sm shadow-inner">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Before Tax</span>
              <span className="font-medium tabular-nums text-foreground">
                {formatINR(totals.totalBeforeTax)}
              </span>
            </div>
            {taxMode === "INTRA_STATE" ? (
              <>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-muted-foreground">
                    CGST @ {invoice.cgstRate}%
                  </span>
                  <span className="font-medium tabular-nums text-foreground">
                    {formatINR(totals.cgst)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-muted-foreground">
                    SGST @ {invoice.sgstRate}%
                  </span>
                  <span className="font-medium tabular-nums text-foreground">
                    {formatINR(totals.sgst)}
                  </span>
                </div>
              </>
            ) : (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-muted-foreground">
                  IGST @ {invoice.igstRate}%
                </span>
                <span className="font-medium tabular-nums text-foreground">
                  {formatINR(totals.igst)}
                </span>
              </div>
            )}
            <div className="my-3 h-px bg-neutral-200 dark:bg-neutral-800/80" />
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">Grand Total</span>
              <span className="font-semibold tabular-nums text-emerald-400 text-base">
                {formatINR(totals.grandTotal)}
              </span>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              <div className="font-medium text-foreground">Amount in words</div>
              <div className="mt-1 italic">{amountInWords}</div>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
