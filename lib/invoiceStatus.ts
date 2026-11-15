import type { InvoiceStatus } from "@prisma/client";

/**
 * The statuses that count as billed: the dashboard's monthly total and the client ledger's
 * debits. A quotation is an offer, not a bill, so it never counts. Drafts do count, because
 * invoices are routinely sent while still marked Draft; to count only Sent and Paid invoices
 * instead, remove "DRAFT" here and both places follow.
 */
export const BILLED_STATUSES: InvoiceStatus[] = ["DRAFT", "SENT", "PAID"];
