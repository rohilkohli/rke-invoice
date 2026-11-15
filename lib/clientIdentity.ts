/** Pure helpers for telling clients apart and for the copy of their details an invoice keeps. */

/** Client details as they arrive from a form: the ship-to parts may be missing or null. */
export type ClientInput = {
  name: string;
  address: string;
  gstin: string;
  state: string;
  stateCode: string;
  shipToName?: string | null;
  shipToAddress?: string | null;
  shipToGstin?: string | null;
  shipToState?: string | null;
  shipToStateCode?: string | null;
};

export const clean = (value: string | null | undefined) => (value ?? "").trim();

/** Two people are the same client when their name and GSTIN match, ignoring case and spacing. */
export function sameClient(
  a: { name: string; gstin: string },
  b: { name: string; gstin: string },
) {
  return (
    clean(a.name).toLowerCase() === clean(b.name).toLowerCase() &&
    clean(a.gstin).toLowerCase() === clean(b.gstin).toLowerCase()
  );
}

/** Empty or blank values are saved as nothing rather than as an empty string. */
const orNull = (value: string | null | undefined) => clean(value) || null;

/**
 * Bill-to and ship-to as saved on the invoice itself, so a later change to a client record,
 * or billing someone else under the same record, never alters an invoice already issued.
 */
export function clientSnapshot(client: ClientInput) {
  return {
    clientName: clean(client.name),
    clientAddress: clean(client.address),
    clientGstin: clean(client.gstin),
    clientState: clean(client.state),
    clientStateCode: clean(client.stateCode),
    shipToName: orNull(client.shipToName),
    shipToAddress: orNull(client.shipToAddress),
    shipToGstin: orNull(client.shipToGstin),
    shipToState: orNull(client.shipToState),
    shipToStateCode: orNull(client.shipToStateCode),
  };
}
