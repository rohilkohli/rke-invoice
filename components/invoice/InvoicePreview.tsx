"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { pdf } from "@react-pdf/renderer";
import { Loader2, Minus, Plus } from "lucide-react";

import { InvoicePDF, type InvoiceCopy } from "@/components/pdf/InvoicePDF";
import { useInvoiceStore } from "./useInvoiceStore";

export type CompanySettingsPreview = {
  companyName: string;
  gstin: string;
  address: string;
  email?: string | null;
  phone?: string | null;
  bankName?: string | null;
  branch?: string | null;
  accountNo?: string | null;
  ifsc?: string | null;
  upiId?: string | null;
  logoUrl?: string | null;
  termsAndConditions?: string | null;
  tagline?: string | null;
  accountType?: string | null;
  stateCode?: string | null;
  state?: string | null;
  gdriveWebhookUrl?: string | null;
};

export function InvoicePreview(props: {
  company: CompanySettingsPreview;
  qrDataUrl?: string | null;
}) {
  const invoice = useInvoiceStore((s) => s.invoice);
  const [copy] = useState<InvoiceCopy>("ORIGINAL");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ left: 0, top: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(250, Math.round(prev * 1.15)));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(50, Math.round(prev / 1.15)));
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Reserved for future zoom reset button
  const handleResetZoom = useCallback(() => {
    setZoom(100);
  }, []);

  // Ctrl + Wheel Zoom Event Handler
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY;
        setZoom((prevZoom) => {
          const factor = delta > 0 ? 0.9 : 1.1;
          const next = Math.round(prevZoom * factor);
          return Math.min(250, Math.max(50, next));
        });
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // Drag to Pan Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const container = containerRef.current;
    if (!container) return;

    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setScrollStart({ left: container.scrollLeft, top: container.scrollTop });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const container = containerRef.current;
    if (!container) return;

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    container.scrollLeft = scrollStart.left - dx;
    container.scrollTop = scrollStart.top - dy;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Memoize PDF document element
  const pdfDocument = useMemo(() => {
    return (
      <InvoicePDF
        invoice={invoice}
        company={props.company}
        copy={copy}
        qrDataUrl={props.qrDataUrl}
      />
    );
  }, [invoice, props.company, copy, props.qrDataUrl]);

  useEffect(() => {
    let isCancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Loading state for async PDF generation
    setIsGenerating(true);

    const generatePdf = async () => {
      try {
        const blob = await pdf(pdfDocument).toBlob();

        if (!isCancelled) {
          const url = URL.createObjectURL(blob);
          setPdfUrl((prevUrl) => {
            if (prevUrl) {
              URL.revokeObjectURL(prevUrl);
            }
            return url;
          });
          setIsGenerating(false);
        }
      } catch (err) {
        console.error("Error generating PDF live preview:", err);
        if (!isCancelled) setIsGenerating(false);
      }
    };

    const timer = setTimeout(generatePdf, 300);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [pdfDocument]);

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  // Compute crisp native dimensions for A4 page ratio
  const nativeWidth = Math.round(615 * (zoom / 100));
  const nativeHeight = Math.round(870 * (zoom / 100));

  const iframeSrc = useMemo(() => {
    if (!pdfUrl) return "";
    return `${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`;
  }, [pdfUrl]);

  return (
    <div className="relative flex flex-col w-full h-full">
      {/* Floating Zoom Control Bar (Bottom Right) */}
      <div className="absolute bottom-4 right-4 z-30 flex items-center gap-1 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 shadow-lg text-xs select-none">
        <button
          type="button"
          onClick={handleZoomOut}
          disabled={zoom <= 50}
          className="p-1 text-neutral-700 hover:text-black dark:text-neutral-300 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full disabled:opacity-30 cursor-pointer transition-colors"
          title="Zoom Out"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>

        <span className="font-mono text-[11px] font-semibold text-neutral-700 dark:text-neutral-200 px-1 text-center select-none">
          {zoom}%
        </span>

        <button
          type="button"
          onClick={handleZoomIn}
          disabled={zoom >= 250}
          className="p-1 text-neutral-700 hover:text-black dark:text-neutral-300 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full disabled:opacity-30 cursor-pointer transition-colors"
          title="Zoom In"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Real PDF Viewport Container */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`relative w-full h-[calc(100vh-13rem)] min-h-[680px] rounded-xl border border-neutral-300 dark:border-neutral-800 bg-neutral-200/80 dark:bg-neutral-950 overflow-auto shadow-inner select-none ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        {!pdfUrl && isGenerating && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white dark:bg-neutral-950">
            <Loader2 className="h-7 w-7 animate-spin text-primary mb-2" />
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
              Generating High-Res PDF...
            </span>
          </div>
        )}

        <div className="w-max min-w-full min-h-full p-6 flex justify-start items-center my-auto mx-auto">
          {pdfUrl ? (
            <div
              className="relative shrink-0 transition-all duration-150 ease-out bg-white rounded-xl shadow-xl overflow-hidden mx-auto"
              style={{
                width: `${nativeWidth}px`,
                height: `${nativeHeight}px`,
              }}
            >
              {/* Transparent drag handle overlay so mouse panning works smoothly */}
              <div className="absolute inset-0 z-10 cursor-inherit" />
              <iframe
                src={iframeSrc}
                title="Real Invoice PDF Live Preview"
                className="w-full h-full border-0 rounded-xl bg-white pointer-events-none"
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
