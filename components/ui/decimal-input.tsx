"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";

type DecimalInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "type" | "inputMode"
> & {
  value: number | null | undefined;
  /** A number whenever the text is a valid number; null when the box is emptied. */
  onChange: (value: number | null) => void;
};

const format = (value: number | null | undefined) => (value == null ? "" : String(value));
const toNumber = (raw: string) => {
  const n = parseFloat(raw);
  return Number.isNaN(n) ? null : n;
};
// An empty box and a zero are the same number as far as keeping the text in step is concerned,
// so emptying a box that the parent stores as 0 does not snap a "0" back in while typing.
const same = (a: number | null | undefined, b: number | null | undefined) => (a ?? 0) === (b ?? 0);

/**
 * A number box that keeps exactly what is typed ("2." and "2.5" survive the keystroke between
 * them) and only reports the parsed number upward. Letters are ignored.
 */
export function DecimalInput({ value, onChange, onBlur, ...props }: DecimalInputProps) {
  const [raw, setRaw] = React.useState(() => format(value));
  const [seen, setSeen] = React.useState<number | null>(value ?? null);

  // The parent changed the number from outside (a scan, a picked client): show it, unless the
  // text already says the same thing.
  if ((value ?? null) !== seen) {
    setSeen(value ?? null);
    if (!same(toNumber(raw), value)) setRaw(format(value));
  }

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      value={raw}
      onChange={(e) => {
        const text = e.target.value;
        if (!/^\d*\.?\d*$/.test(text)) return;
        setRaw(text);
        if (text === "") {
          onChange(null);
          return;
        }
        const n = toNumber(text);
        if (n !== null) onChange(n);
      }}
      onBlur={(e) => {
        setRaw(format(value));
        onBlur?.(e);
      }}
    />
  );
}
