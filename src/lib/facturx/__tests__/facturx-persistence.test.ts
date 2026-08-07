import { describe, expect, it } from "vitest";

import { buildInvoiceComplianceMetadata } from "../facturx-persistence.server";

describe("buildInvoiceComplianceMetadata", () => {
  const common = {
    pdfStoragePath: "invoices/2026/FACT-2026-0001.pdf",
    pdfSha256: "abc123",
    validatedAt: "2026-08-04T00:00:00.000Z",
  };

  it("marks a classic PDF as outside the Factur-X validation scope", () => {
    const metadata = buildInvoiceComplianceMetadata({
      ...common,
      format: "classic_pdf",
    });

    expect(metadata).toEqual({
      pdf_storage_path: common.pdfStoragePath,
      generation_error: null,
      pdf_sha256: common.pdfSha256,
      runtime_validation_status: "not_applicable",
      external_validation_status: "not_applicable",
      generator_qualification_status: "unqualified",
    });
  });

  it("persists the actual generator and schema versions for Factur-X", () => {
    const snapshot = {
      invoiceNumber: "FACT-2026-0001",
      totals: {
        grandTotalCents: 29889,
      },
    };

    const metadata = buildInvoiceComplianceMetadata({
      ...common,
      format: "facturx",
      facturx: {
        xmlStoragePath:
          "invoices/2026/FACT-2026-0001-factur-x.xml",
        classification: "b2b_france",
        structuredInvoiceSnapshot: snapshot,
      },
    });

    expect(metadata).toMatchObject({
      pdf_storage_path: common.pdfStoragePath,
      generation_error: null,
      pdf_sha256: common.pdfSha256,
      xml_storage_path:
        "invoices/2026/FACT-2026-0001-factur-x.xml",

      facturx_version: "1.09",
      facturx_profile: "EN 16931",
      generator_version: "1.0.0",
      document_schema_version: "1.0",

      runtime_validation_status: "passed",
      generator_qualification_status: "qualified",
      external_validation_status: "not_run",

      facturx_validation_status: "pending",
      facturx_validation_errors: null,
      facturx_validated_at: common.validatedAt,

      transaction_classification: "b2b_france",
      structured_invoice_snapshot: snapshot,
    });
  });

  it("never reports runtime or external validation as passed for a classic PDF", () => {
    const metadata = buildInvoiceComplianceMetadata({
      ...common,
      format: "classic_pdf",
    });

    expect(metadata.runtime_validation_status).toBe(
      "not_applicable",
    );
    expect(metadata.external_validation_status).toBe(
      "not_applicable",
    );
    expect(metadata.generator_qualification_status).toBe(
      "unqualified",
    );
  });

  it("refuses to build Factur-X metadata without Factur-X data", () => {
    expect(() =>
      buildInvoiceComplianceMetadata({
        ...common,
        format: "facturx",
      }),
    ).toThrow(
      "Les métadonnées Factur-X sont requises pour une facture Factur-X.",
    );
  });
});