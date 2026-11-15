import { Font } from "@react-pdf/renderer";

/**
 * The font every invoice PDF is drawn in: Arimo, which has the rupee sign.
 *
 * Only two faces are registered, regular and italic, and each one is a single file. Bold text
 * is drawn with the regular face (the same look the invoices have always had).
 *
 * Do not register the same file a second time for bold. react-pdf then holds two copies of
 * the font under one name, and after the first PDF has been made the second copy keeps
 * glyphs without their characters, so a later PDF loses the first character of any bold text
 * that starts with a digit that the first PDF only used in regular text (a tax total of
 * 90,000.00 came out as 0,000.00, an invoice number of 9001 as 001). If a real bold is ever
 * wanted, add a separate static bold font file, not another copy of this one.
 */
export const PDF_FONT_FAMILY = "Arimo";

/** The font files in public/fonts. */
export const PDF_FONT_FILES = {
  normal: "Arimo-Regular.ttf",
  italic: "Arimo-Italic.ttf",
} as const;

export type PdfFontSources = { normal: string; italic: string };

/** Only used if the files in public/fonts cannot be found on the server. */
export const REMOTE_PDF_FONTS: PdfFontSources = {
  normal: "https://raw.githubusercontent.com/google/fonts/main/ofl/arimo/Arimo%5Bwght%5D.ttf",
  italic:
    "https://raw.githubusercontent.com/google/fonts/main/ofl/arimo/Arimo-Italic%5Bwght%5D.ttf",
};

/** Registers the font once, whatever the number of times it is called. */
export function registerPdfFonts(sources: PdfFontSources) {
  if (Font.getRegisteredFontFamilies().includes(PDF_FONT_FAMILY)) return;
  Font.register({
    family: PDF_FONT_FAMILY,
    fonts: [
      { src: sources.normal, fontWeight: "normal", fontStyle: "normal" },
      { src: sources.italic, fontWeight: "normal", fontStyle: "italic" },
    ],
  });
}

/** In the browser the font files come from this site, next to the page. */
export function registerBrowserPdfFonts() {
  registerPdfFonts({
    normal: `${window.location.origin}/fonts/${PDF_FONT_FILES.normal}`,
    italic: `${window.location.origin}/fonts/${PDF_FONT_FILES.italic}`,
  });
}
