"use client";

import { useMemo } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { ClientForm, SavedClient } from "./types";
import { useInvoiceStore } from "./useInvoiceStore";

const NEW_CLIENT = "__new__";

/**
 * Chooses a client that has been billed before. It only fills in the details below it:
 * what is on the form is what this invoice is saved with, and nothing already issued changes.
 */
export function ClientPicker({
  clients,
  onPick,
}: {
  clients: SavedClient[];
  /** Called with the details that were just filled in, so the form can adjust around them. */
  onPick?: (details: ClientForm) => void;
}) {
  const client = useInvoiceStore((s) => s.invoice.client);
  const setClient = useInvoiceStore((s) => s.setClient);

  // The picker shows whichever saved client the details currently match, so it stays right
  // after loading an invoice, picking, or typing the same name and GSTIN by hand.
  const matchedId = useMemo(() => {
    const name = client.name.trim().toLowerCase();
    const gstin = client.gstin.trim().toLowerCase();
    if (!name) return undefined;
    return clients.find(
      (c) => c.name.trim().toLowerCase() === name && c.gstin.trim().toLowerCase() === gstin,
    )?.id;
  }, [clients, client.name, client.gstin]);

  const items = useMemo<Record<string, string>>(
    () => ({
      [NEW_CLIENT]: "New client (type the details below)",
      ...Object.fromEntries(clients.map((c) => [String(c.id), `${c.name} · ${c.gstin}`])),
    }),
    [clients],
  );

  if (clients.length === 0) return null;

  return (
    <div className="space-y-2 md:col-span-2">
      <Label>Saved client</Label>
      <Select
        items={items}
        value={matchedId ? String(matchedId) : NEW_CLIENT}
        onValueChange={(value) => {
          if (value === NEW_CLIENT) {
            const blank: ClientForm = {
              name: "",
              address: "",
              gstin: "",
              state: "",
              stateCode: "",
              shipToName: "",
              shipToAddress: "",
              shipToGstin: "",
              shipToState: "",
              shipToStateCode: "",
            };
            setClient(blank);
            onPick?.(blank);
            return;
          }
          const found = clients.find((c) => String(c.id) === value);
          if (!found) return;
          const { id, ...details } = found;
          void id;
          setClient(details);
          onPick?.(details);
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Choose a client you have billed before" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NEW_CLIENT}>{items[NEW_CLIENT]}</SelectItem>
          {clients.map((c) => (
            <SelectItem key={c.id} value={String(c.id)}>
              {items[String(c.id)]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Picking a client fills in the details below. Changes you make here apply to this invoice only.
      </p>
    </div>
  );
}
