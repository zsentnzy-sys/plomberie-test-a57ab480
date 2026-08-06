export type FacturxValidationProfile =
  | "MINIMUM"
  | "BASIC_WL"
  | "BASIC"
  | "EN16931"
  | "EXTENDED";

export type ValidationArtifactKind =
  | "xsd"
  | "schematron"
  | "xslt"
  | "code-list"
  | "documentation"
  | "sample";

export interface ValidationArtifactEntry {
  /**
   * Path relative to the directory containing manifest.json.
   */
  path: string;

  kind: ValidationArtifactKind;

  /**
   * Lowercase hexadecimal SHA-256.
   */
  sha256: string;

  /**
   * Profiles for which the artifact is applicable.
   */
  profiles: FacturxValidationProfile[];
}

export interface FacturxValidationArtifactManifest {
  manifestVersion: 1;

  facturxVersion: string;
  zugferdVersion: string;
  syntax: string;
  profile: FacturxValidationProfile;

  publisher: string;
  releaseDate: string;
  packageFileName: string;
  packageSha256: string;

  /**
   * Human-readable source reference.
   * Do not rely on this field for integrity verification.
   */
  source: string;

  /**
   * False until the official files have been copied and hashed.
   */
  installed: boolean;

  artifacts: ValidationArtifactEntry[];
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export function validateArtifactManifest(
  manifest: FacturxValidationArtifactManifest,
): string[] {
  const errors: string[] = [];

  if (manifest.manifestVersion !== 1) {
    errors.push("Unsupported manifest version.");
  }

  if (manifest.facturxVersion !== "1.09.2") {
  errors.push("Unexpected Factur-X version.");
  }

  if (manifest.zugferdVersion !== "2.5.2") {
    errors.push("Unexpected ZUGFeRD version.");
  }

  if (manifest.syntax !== "UN/CEFACT CII D22B") {
    errors.push("Unexpected invoice syntax.");
  }

  if (manifest.profile !== "EN16931") {
    errors.push("Unexpected validation profile.");
  }

  if (manifest.installed && manifest.artifacts.length === 0) {
    errors.push(
      "An installed manifest must contain validation artifacts.",
    );
  if (!manifest.packageFileName.trim()) {
    errors.push("Missing official package file name.");
  }

  if (!SHA256_PATTERN.test(manifest.packageSha256)) {
    errors.push("Invalid oofficial package SHA-256.");
  }
  }

  const paths = new Set<string>();

  for (const artifact of manifest.artifacts) {
    if (!artifact.path.trim()) {
      errors.push("Artifact path must not be empty.");
    }

    if (
      artifact.path.startsWith("/") ||
      artifact.path.includes("..")
    ) {
      errors.push(
        `Unsafe artifact path: ${artifact.path}`,
      );
    }

    if (paths.has(artifact.path)) {
      errors.push(
        `Duplicate artifact path: ${artifact.path}`,
      );
    }

    paths.add(artifact.path);

    if (!SHA256_PATTERN.test(artifact.sha256)) {
      errors.push(
        `Invalid SHA-256 for artifact: ${artifact.path}`,
      );
    }

    if (artifact.profiles.length === 0) {
      errors.push(
        `Missing profile for artifact: ${artifact.path}`,
      );
    }
  }

  return errors;
}