import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "@cantoo/pdf-lib";

import {
  assertPdfA3Structure,
  toFacturxPdfA3,
} from "../facturx-pdfa.server";

describe("Factur-X PDF/A-3", () => {
  it("embarque les métadonnées XMP Factur-X attendues", async () => {
    const source = await PDFDocument.create();

    const page = source.addPage([595, 842]);

    const font = await source.embedFont(
      StandardFonts.Helvetica,
    );

    page.drawText("Facture de test", {
      x: 50,
      y: 780,
      size: 12,
      font,
    });

    const sourcePdf = await source.save();

    const validXml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<rsm:CrossIndustryInvoice ' +
      'xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100">' +
      "</rsm:CrossIndustryInvoice>";

    const hybrid = await toFacturxPdfA3(
      sourcePdf,
      {
        invoiceNumber: "FACT-TEST-001",
        producer: "Plomberie Dupont",
        xml: validXml,
        createdAt: new Date(
          "2026-08-07T12:00:00Z",
        ),
      },
    );

    const result =
      await assertPdfA3Structure(hybrid);

    expect(result.errors).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "Métadonnée XMP incorrecte ou absente",
        ),
      ]),
    );
  });
});