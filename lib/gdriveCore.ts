/**
 * Pure helpers for the Google Drive sync: no database, no network. Kept apart from
 * lib/gdrive.ts so they can be tested on their own.
 */

/** The version of the Apps Script this app expects. Older scripts still work but are warned about. */
export const REQUIRED_SCRIPT_VERSION = 2;

/**
 * Only a deployed Google Apps Script web app may be called. The server makes the request, so
 * an address typed into Settings must never be able to point at anything else.
 */
export function isAllowedWebhookUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    const url = new URL(raw.trim());
    return (
      url.protocol === "https:" &&
      url.hostname === "script.google.com" &&
      url.port === "" &&
      !url.username &&
      !url.password &&
      url.pathname.includes("/macros/")
    );
  } catch {
    return false;
  }
}

/** The name an invoice's PDF has in Drive: always derived from the invoice number. */
export function driveFileName(invoiceNo: string): string {
  const safe = invoiceNo
    .trim()
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100);
  return `${safe || "invoice"}.pdf`;
}

export function driveYear(date: Date): string {
  return String(date.getUTCFullYear());
}

export type DriveRecord = { no: string | null; year: string | null; file: string | null };

/**
 * What to remove from Drive after a successful upload: the old PDF when it now has a different
 * name or sits in a different year folder, and the old ledger row when the invoice number changed.
 */
export function planDriveCleanup(
  previous: DriveRecord,
  next: { no: string; year: string; file: string },
): { trash: { year: string; file: string } | null; deleteRowOf: string | null } {
  const moved =
    Boolean(previous.file && previous.year) &&
    (previous.file !== next.file || previous.year !== next.year);
  return {
    trash: moved ? { year: previous.year as string, file: previous.file as string } : null,
    deleteRowOf: previous.no && previous.no !== next.no ? previous.no : null,
  };
}

export type WebhookReply = { ok: boolean; error?: string; message?: string; version?: number };

/** Turns the Apps Script's HTTP answer into success or a message a person can act on. */
export function parseWebhookReply(status: number, statusText: string, text: string): WebhookReply {
  if (status === 403) {
    return {
      ok: false,
      error:
        "Google refused the request (HTTP 403). In Apps Script, deploy the script as a web app " +
        "with 'Who has access' set to 'Anyone', then try again.",
    };
  }
  if (status < 200 || status >= 300) {
    return { ok: false, error: `Google returned HTTP ${status}${statusText ? `: ${statusText}` : ""}.` };
  }

  let json: { status?: string; error?: string; message?: string; version?: unknown };
  try {
    json = JSON.parse(text);
  } catch {
    return {
      ok: false,
      error:
        "Google did not return a valid reply. Check that the address is your deployed web app's " +
        "address ending in /exec.",
    };
  }

  if (json.status === "SUCCESS") {
    return {
      ok: true,
      message: json.message,
      version: typeof json.version === "number" ? json.version : undefined,
    };
  }
  return { ok: false, error: json.error || "The Google script reported an error." };
}

/** A warning when the deployed script is older than the one this app was written for. */
export function scriptVersionWarning(version: number | undefined): string | undefined {
  if (version !== undefined && version >= REQUIRED_SCRIPT_VERSION) return undefined;
  return (
    "Your Google script is out of date. In Settings, copy the script again and redeploy it " +
    "(Deploy > Manage deployments > pencil > New version). Until then it does not check the private " +
    "key, and renamed or deleted invoices are not cleaned up in Drive."
  );
}
