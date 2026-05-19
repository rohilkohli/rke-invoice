"use client";

import { useEffect, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";

import { cn } from "@/lib/utils";

export function UPIQRCode(props: {
  value: string;
  size?: number;
  className?: string;
  onDataUrl?: (dataUrl: string) => void;
}) {
  const { value, className, onDataUrl } = props;
  const size = props.size ?? 128;
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!onDataUrl) return;
    const canvas = ref.current?.querySelector("canvas");
    if (!canvas) return;
    try {
      onDataUrl(canvas.toDataURL("image/png"));
    } catch {
      // ignore
    }
  }, [value, size, onDataUrl]);

  return (
    <div ref={ref} className={cn("inline-flex", className)}>
      <QRCodeCanvas value={value} size={size} includeMargin />
    </div>
  );
}
