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
  const name = clean(client.name);
  const address = clean(client.address);
  const ship = {
    name: clean(client.shipToName),
    address: clean(client.shipToAddress),
    gstin: clean(client.shipToGstin),
    state: clean(client.shipToState),
    stateCode: clean(client.shipToStateCode),
  };
  // A ship-to that only repeats the bill-to is not a different consignee. It is saved as nothing,
  // so it can never go stale and the PDF simply uses the billed client.
  const separate =
    (!!ship.name && ship.name !== name) ||
    (!!ship.address && ship.address !== address) ||
    !!ship.gstin ||
    !!ship.state ||
    !!ship.stateCode;

  return {
    clientName: name,
    clientAddress: address,
    clientGstin: clean(client.gstin),
    clientState: clean(client.state),
    clientStateCode: clean(client.stateCode),
    shipToName: separate ? orNull(ship.name) : null,
    shipToAddress: separate ? orNull(ship.address) : null,
    shipToGstin: separate ? orNull(ship.gstin) : null,
    shipToState: separate ? orNull(ship.state) : null,
    shipToStateCode: separate ? orNull(ship.stateCode) : null,
  };
}
