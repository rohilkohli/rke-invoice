import "server-only";

import type { SavedClient } from "@/components/invoice/types";
import { clean, clientSnapshot, sameClient, type ClientInput } from "@/lib/clientIdentity";
import { prisma } from "@/lib/db";

/**
 * The client record an invoice is filed under, found by name and GSTIN (never by a hidden id
 * from the form, and never by rewriting an existing record). The record the invoice is already
 * filed under wins if it still matches; otherwise the matching client with the most invoices;
 * otherwise a new one is created from what was typed.
 */
export async function resolveClientId(
  userId: number,
  client: ClientInput,
  currentClientId?: number,
): Promise<number> {
  const identity = { name: clean(client.name), gstin: clean(client.gstin) };

  if (currentClientId) {
    const current = await prisma.client.findFirst({
      where: { id: currentClientId, userId },
      select: { id: true, name: true, gstin: true },
    });
    if (current && sameClient(current, identity)) return current.id;
  }

  const match = await prisma.client.findFirst({
    where: {
      userId,
      name: { equals: identity.name, mode: "insensitive" },
      gstin: { equals: identity.gstin, mode: "insensitive" },
    },
    orderBy: [{ invoices: { _count: "desc" } }, { id: "asc" }],
    select: { id: true },
  });
  if (match) return match.id;

  const snapshot = clientSnapshot(client);
  const created = await prisma.client.create({
    data: {
      userId,
      name: snapshot.clientName,
      address: snapshot.clientAddress,
      gstin: snapshot.clientGstin,
      state: snapshot.clientState,
      stateCode: snapshot.clientStateCode,
      shipToName: snapshot.shipToName,
      shipToAddress: snapshot.shipToAddress,
      shipToGstin: snapshot.shipToGstin,
      shipToState: snapshot.shipToState,
      shipToStateCode: snapshot.shipToStateCode,
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * Clients to offer in the picker. Only clients that have actually been billed are listed (so
 * the stray default clients the old "new invoice" page used to create stay out of the way), and
 * each shows its details from the most recent invoice, not from a record that may be stale.
 */
export async function getSavedClients(userId: number): Promise<SavedClient[]> {
  const rows = await prisma.client.findMany({
    where: { userId, invoices: { some: {} } },
    orderBy: { name: "asc" },
    include: {
      invoices: {
        orderBy: { id: "desc" },
        take: 1,
        select: {
          clientName: true,
          clientAddress: true,
          clientGstin: true,
          clientState: true,
          clientStateCode: true,
          shipToName: true,
          shipToAddress: true,
          shipToGstin: true,
          shipToState: true,
          shipToStateCode: true,
        },
      },
    },
  });

  return rows.map((row) => {
    const latest = row.invoices[0];
    const useLatest = latest?.clientName != null;
    return {
      id: row.id,
      name: useLatest ? latest.clientName! : row.name,
      address: useLatest ? (latest.clientAddress ?? "") : row.address,
      gstin: useLatest ? (latest.clientGstin ?? "") : row.gstin,
      state: useLatest ? (latest.clientState ?? "") : row.state,
      stateCode: useLatest ? (latest.clientStateCode ?? "") : row.stateCode,
      shipToName: (useLatest ? latest.shipToName : row.shipToName) ?? "",
      shipToAddress: (useLatest ? latest.shipToAddress : row.shipToAddress) ?? "",
      shipToGstin: (useLatest ? latest.shipToGstin : row.shipToGstin) ?? "",
      shipToState: (useLatest ? latest.shipToState : row.shipToState) ?? "",
      shipToStateCode: (useLatest ? latest.shipToStateCode : row.shipToStateCode) ?? "",
    };
  });
}
