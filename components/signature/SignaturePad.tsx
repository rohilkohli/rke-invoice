"use client";

import { useMemo, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Eraser, Upload, Type, PenLine, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { useInvoiceStore } from "@/components/invoice/useInvoiceStore";

function textToDataUrl(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 220;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "transparent";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "64px cursive";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  return canvas.toDataURL("image/png");
}

export function SignaturePad(props: { className?: string }) {
  const signature = useInvoiceStore((s) => s.invoice.signature);
  const setSignature = useInvoiceStore((s) => s.setSignature);
  const sigRef = useRef<SignatureCanvas | null>(null);
  const [typed, setTyped] = useState("");
  const [activeTab, setActiveTab] = useState<"draw" | "upload" | "type">("draw");

  const hasSignature = Boolean(signature?.dataUrl);
  const currentType = signature?.type ?? null;

  const typedDisabled = useMemo(() => typed.trim().length < 2, [typed]);

  return (
    <div className={cn("space-y-3", props.className)}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Digital Signature</div>
          <div className="text-xs text-muted-foreground">
            Draw, upload, or type a signature (saved for new invoices)
          </div>
        </div>
        {hasSignature ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSignature(null)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remove
          </Button>
        ) : null}
      </div>

      {hasSignature ? (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div>Current signature type: <span className="font-semibold text-foreground">{currentType}</span></div>
          </div>
          <div className="mt-3 h-24 rounded-lg bg-neutral-100 dark:bg-neutral-950 flex items-center justify-center overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={signature!.dataUrl}
              alt="Signature"
              className="h-full w-full object-contain dark:invert"
            />
          </div>
        </div>
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          const next = v === "draw" || v === "upload" || v === "type" ? v : "draw";
          setActiveTab(next);
        }}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="draw">
            <PenLine className="mr-2 h-4 w-4" />
            Draw
          </TabsTrigger>
          <TabsTrigger value="upload">
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="type">
            <Type className="mr-2 h-4 w-4" />
            Type
          </TabsTrigger>
        </TabsList>

        <TabsContent value="draw" className="mt-3 space-y-3">
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-2 shadow-inner overflow-hidden dark:invert dark:hue-rotate-180 transition-all duration-150">
            <SignatureCanvas
              ref={(r) => {
                sigRef.current = r;
              }}
              penColor="#111"
              canvasProps={{
                className: "h-36 w-full cursor-crosshair",
              }}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => sigRef.current?.clear()}
            >
              <Eraser className="mr-2 h-4 w-4" />
              Clear
            </Button>
            <Button
              type="button"
              onClick={() => {
                const dataUrl = sigRef.current?.toDataURL("image/png");
                if (!dataUrl) return;
                setSignature({ dataUrl, type: "DRAWN" });
              }}
            >
              Apply
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="upload" className="mt-3 space-y-3">
          <Input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = () => reject(new Error("Failed to read file"));
                reader.readAsDataURL(file);
              });
              setSignature({ dataUrl, type: "UPLOADED" });
            }}
          />
          <div className="text-xs text-muted-foreground">
            Tip: use a transparent PNG for best results.
          </div>
        </TabsContent>

        <TabsContent value="type" className="mt-3 space-y-3">
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Type your name"
          />
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 text-center shadow-inner">
            <div className="text-4xl font-[cursive] tracking-wide text-neutral-900 dark:text-neutral-50">{typed || "…"}</div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setTyped("")}
            >
              Clear
            </Button>
            <Button
              type="button"
              disabled={typedDisabled}
              onClick={() => {
                const dataUrl = textToDataUrl(typed.trim());
                if (!dataUrl) return;
                setSignature({ dataUrl, type: "TYPED" });
              }}
            >
              Apply
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
