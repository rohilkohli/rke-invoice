import fs from "fs";
import path from "path";

/**
 * Resolves the company logo to a data URL.
 * - If the DB has a data URL or http URL, return it as-is.
 * - Otherwise, fall back to reading `public/RKE logo.png` from disk.
 */
export function resolveLogoDataUrl(dbLogoUrl: string | null | undefined): string | null {
  if (dbLogoUrl && (dbLogoUrl.startsWith("data:") || dbLogoUrl.startsWith("http"))) {
    return dbLogoUrl;
  }

  try {
    const logoPath = path.join(process.cwd(), "public", "RKE logo.png");
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      return `data:image/png;base64,${logoBuffer.toString("base64")}`;
    }
  } catch {
    // ignore
  }

  return null;
}
