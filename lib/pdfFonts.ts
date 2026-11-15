import { existsSync } from "node:fs";
import path from "node:path";

import {
  PDF_FONT_FILES,
  REMOTE_PDF_FONTS,
  registerPdfFonts,
  type PdfFontSources,
} from "@/components/pdf/fonts";

/**
 * Where the server reads the PDF font from: the files in public/fonts, which are copied into
 * the deployed function (see outputFileTracingIncludes in next.config.ts). If they are somehow
 * missing, the PDFs still work from the published copies, as they did before.
 */
export function serverPdfFontSources(root: string = process.cwd()): PdfFontSources {
  const normal = path.join(root, "public", "fonts", PDF_FONT_FILES.normal);
  const italic = path.join(root, "public", "fonts", PDF_FONT_FILES.italic);
  if (existsSync(normal) && existsSync(italic)) return { normal, italic };
  console.warn("[PDF] public/fonts is missing the Arimo files; using the copies on GitHub instead.");
  return REMOTE_PDF_FONTS;
}

export function registerServerPdfFonts() {
  registerPdfFonts(serverPdfFontSources());
}
