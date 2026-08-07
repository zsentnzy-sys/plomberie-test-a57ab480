// Server-only Factur-X constants. Single source of truth for version/profile
// identifiers used by the XML, the XMP metadata and the persisted compliance
// columns — nothing here may be duplicated elsewhere.

export const FACTURX_CONFIG = {
  /**
   * Factur-X specification version ACTUALLY implemented by this generator.
   * This is the only version that may be persisted on a produced document.
   */
  implementedSpecificationVersion: "1.09",
  /** Factur-X specification implemented by the current qualified generator. */
  targetSpecificationVersion: "1.09",
  targetZugferdVersion: "2.5",
  /** ZUGFeRD/Factur-X profile URN (EN 16931 "COMFORT"). */
  profileUrn: "urn:cen.eu:en16931:2017",
  profile: "EN16931",
  profileLabel: "EN 16931",
  /** Mandatory attachment file name — any other name breaks readers. */
  attachmentFileName: "factur-x.xml",
  attachmentMimeType: "application/xml",
  attachmentDescription: "Facture électronique Factur-X (CII EN 16931)",
  /** XMP extension schema values. */
  xmpDocumentType: "INVOICE",
  xmpVersion: "1.0",
  xmpConformanceLevel: "EN 16931",
  /** PDF/A part & conformance targeted by the hybrid file. */
  pdfaPart: "3",
  pdfaConformance: "B",
  currency: "EUR",
  /** UNTDID 1001 — commercial invoice. */
  invoiceTypeCode: "380",
  /** Identifies the exact generator build that produced a document. */
  generatorVersion: "1.0.0",
  /** Internal shape of the structured invoice snapshot. */
  documentSchemaVersion: "1.0",
  /**
   * Version of the OFFICIAL validation artifacts (XSD/Schematron) bundled with
   * the generator. null = none bundled, so no qualification is possible.
   */
  validationArtifactsVersion: "1.09.2",
} as const;

/** Internal self-checks performed at generation time. NOT official validation. */
export type RuntimeValidationStatus =
  | "not_applicable"
  | "pending"
  | "passed"
  | "failed";

/** CI qualification of the generator build itself. */
export type GeneratorQualificationStatus =
  | "unqualified"
  | "qualified"
  | "qualification_failed";

/** Per-document validation by an external/official validator. */
export type ExternalValidationStatus =
  | "not_applicable"
  | "not_run"
  | "valid"
  | "invalid";

/**
 * Qualification status of the current generator implementation.
 *
 * The generator is qualified by the end-to-end CI pipeline:
 * - official EN16931 XSD
 * - official EN16931 Schematron
 * - PDF/A-3B veraPDF validation
 * - embedded XML extraction and consistency
 * - Factur-X XMP / associated-file structural checks
 * - visible PDF / structured-data consistency
 */
export const GENERATOR_QUALIFICATION: GeneratorQualificationStatus =
  "qualified";

/** @deprecated Phase A — kept only for the legacy facturx_validation_status column. */
export type FacturxValidationStatus =
  | "not_applicable"
  | "pending"
  | "valid"
  | "invalid";