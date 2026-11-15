import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { Document, Font, Page, Text, renderToBuffer } from "@react-pdf/renderer";
import React from "react";

import { PDF_FONT_FAMILY } from "../components/pdf/fonts";
import { registerServerPdfFonts, serverPdfFontSources } from "../lib/pdfFonts";

registerServerPdfFonts();

type Line = { text: string; bold?: boolean };

function pdfOf(lines: Line[]) {
  const h = React.createElement;
  return renderToBuffer(
    h(
      Document,
      null,
      h(
        Page,
        { size: "A4", style: { padding: 20, fontFamily: PDF_FONT_FAMILY, fontSize: 10 } },
        ...lines.map((line, i) =>
          h(Text, { key: i, style: line.bold ? { fontWeight: "bold" } : {} }, line.text),
        ),
      ),
    ) as unknown as Parameters<typeof renderToBuffer>[0],
  );
}

const hasPdftotext = !spawnSync("pdftotext", ["-v"]).error;

function textOf(pdf: Buffer) {
  const dir = mkdtempSync(path.join(tmpdir(), "pdf-fonts-"));
  try {
    const file = path.join(dir, "out.pdf");
    writeFileSync(file, pdf);
    return spawnSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8" }).stdout;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// What the first PDF uses the digit 9 for is irrelevant; what matters is that it is only used in
// regular text there, and that the next PDF starts a bold line with it.
const firstPdf: Line[] = [
  { text: "TOTAL", bold: true },
  { text: "Code 09", bold: false },
];
const secondPdf: Line[] = [
  { text: "9001-X", bold: true },
  { text: "90,000.00", bold: true },
];

test("the font is read from the files in public/fonts, one file per face", () => {
  const { normal, italic } = serverPdfFontSources();
  assert.match(normal, /public[\\/]fonts[\\/]Arimo-Regular\.ttf$/);
  assert.match(italic, /public[\\/]fonts[\\/]Arimo-Italic\.ttf$/);

  const sources = Font.getRegisteredFonts()[PDF_FONT_FAMILY].sources;
  assert.equal(sources.length, 2, "regular and italic only");
  assert.equal(new Set(sources.map((s) => s.src)).size, 2, "no file may be registered twice");
});

test("bold text uses the regular face rather than a second copy of the same font", () => {
  const regular = Font.getFont({ fontFamily: PDF_FONT_FAMILY, fontWeight: 400, fontStyle: "normal" });
  const bold = Font.getFont({ fontFamily: PDF_FONT_FAMILY, fontWeight: 700, fontStyle: "normal" });
  assert.equal(bold, regular);
  const italic = Font.getFont({ fontFamily: PDF_FONT_FAMILY, fontWeight: 400, fontStyle: "italic" });
  const boldItalic = Font.getFont({ fontFamily: PDF_FONT_FAMILY, fontWeight: 700, fontStyle: "italic" });
  assert.equal(boldItalic, italic);
});

test("making a PDF leaves no glyph without its characters in the loaded fonts", async () => {
  await pdfOf(firstPdf);

  // A face is only loaded once some text uses it, so the italic one is not loaded here.
  const loaded = Font.getRegisteredFonts()[PDF_FONT_FAMILY].sources.filter((s) => s.data);
  assert.ok(loaded.length >= 1, "the regular face should be loaded by now");

  for (const source of loaded) {
    const glyphs = (source.data as unknown as { _glyphs?: Record<string, { codePoints: number[] }> })
      ._glyphs;
    assert.ok(glyphs, "fontkit keeps its glyphs in _glyphs; update this test if that has changed");
    for (const [id, glyph] of Object.entries(glyphs)) {
      if (id === "0") continue; // the "missing character" glyph has none by design
      assert.ok(glyph.codePoints.length > 0, `glyph ${id} of ${source.src} lost its characters`);
    }
  }
});

test(
  "a bold line that starts with a digit keeps it in a PDF made after another one",
  { skip: hasPdftotext ? false : "pdftotext (poppler) is not installed" },
  async () => {
    await pdfOf(firstPdf);
    const text = textOf(await pdfOf(secondPdf));
    assert.match(text, /\b9001-X\b/);
    assert.match(text, /\b90,000\.00\b/);

    // And again, once more, in the other order.
    await pdfOf(firstPdf);
    assert.match(textOf(await pdfOf(secondPdf)), /\b9001-X\b/);
  },
);
