import {
  FACTURX_CONFIG,
  GENERATOR_QUALIFICATION,
} from "./facturx-config.server";

interface CommonComplianceInput {
  pdfStoragePath: string;
  pdfSha256: string;
  validatedAt: string;
}

interface ClassicPdfComplianceInput
  extends CommonComplianceInput {
  format: "classic_pdf";
}

interface FacturxComplianceData {
  xmlStoragePath: string;
  classification: string;
  structuredInvoiceSnapshot: Record<string, unknown>;
}

interface FacturxComplianceInput
  extends CommonComplianceInput {
  format: "facturx";
  facturx?: FacturxComplianceData;
}

type ComplianceInput =
  | ClassicPdfComplianceInput
  | FacturxComplianceInput;

export type InvoiceComplianceMetadata =
  Record<string, unknown> & {
    pdf_storage_path: string;
    generation_error: null;
    pdf_sha256: string;
    runtime_validation_status: string;
    external_validation_status: string;
    generator_qualification_status: string;
  };

export function buildInvoiceComplianceMetadata(
  input: ComplianceInput,
): InvoiceComplianceMetadata {
  const common = {
    pdf_storage_path: input.pdfStoragePath,
    generation_error: null,
    pdf_sha256: input.pdfSha256,
  };

  if (input.format === "classic_pdf") {
    return {
      ...common,
      runtime_validation_status: "not_applicable",
      external_validation_status: "not_applicable",
      generator_qualification_status: "unqualified",
    };
  }

  if (!input.facturx) {
    throw new Error(
      "Les métadonnées Factur-X sont requises pour une facture Factur-X.",
    );
  }

  return {
    ...common,

    xml_storage_path: input.facturx.xmlStoragePath,

    facturx_version:
      FACTURX_CONFIG.implementedSpecificationVersion,
    facturx_profile: FACTURX_CONFIG.profileLabel,
    generator_version: FACTURX_CONFIG.generatorVersion,
    document_schema_version:
      FACTURX_CONFIG.documentSchemaVersion,
    validation_artifacts_version:
      FACTURX_CONFIG.validationArtifactsVersion,

    runtime_validation_status: "passed",
    generator_qualification_status:
      GENERATOR_QUALIFICATION,
    external_validation_status: "not_run",

    // Colonne obsolète conservée pour compatibilité.
    facturx_validation_status: "pending",
    facturx_validation_errors: null,
    facturx_validated_at: input.validatedAt,

    transaction_classification:
      input.facturx.classification,
    structured_invoice_snapshot:
      input.facturx.structuredInvoiceSnapshot,
  };
}