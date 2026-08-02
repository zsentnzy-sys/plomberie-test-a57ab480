// Server-only Factur-X constants. Single source of truth for version/profile
// identifiers used by the XML, the XMP metadata and the persisted compliance
// columns — nothing here may be duplicated elsewhere.

export const FACTURX_CONFIG = {
  /** Factur-X specification version implemented by this module. */
  specificationVersion: "1.0.07",
  /** ZUGFeRD/Factur-X profile URN (EN 16931 "COMFORT"). */
  profileUrn: "urn:cen.eu:en16931:2017",
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
} as const;

export type FacturxValidationStatus =
  | "not_applicable"
  | "pending"
  | "valid"
  | "invalid";