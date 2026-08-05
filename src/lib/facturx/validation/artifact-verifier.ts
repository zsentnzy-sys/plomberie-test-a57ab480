import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import { dirname, resolve, sep } from "node:path";

import {
  validateArtifactManifest,
  type FacturxValidationArtifactManifest,
} from "./artifact-manifest";

export interface ArtifactVerificationResult {
  valid: boolean;
  installed: boolean;
  checkedArtifacts: number;
  errors: string[];
}

export interface VerifyArtifactManifestOptions {
  manifest: FacturxValidationArtifactManifest;
  manifestPath: string;
}

function sha256File(path: string): string {
  return createHash("sha256")
    .update(readFileSync(path))
    .digest("hex");
}

function isPathInsideDirectory(
  directoryPath: string,
  candidatePath: string,
): boolean {
  const directory = realpathSync(directoryPath);
  const candidate = realpathSync(candidatePath);

  return (
    candidate === directory ||
    candidate.startsWith(`${directory}${sep}`)
  );
}

export function verifyArtifactFiles(
  options: VerifyArtifactManifestOptions,
): ArtifactVerificationResult {
  const { manifest, manifestPath } = options;

  const errors = validateArtifactManifest(manifest);

  if (errors.length > 0) {
    return {
      valid: false,
      installed: manifest.installed,
      checkedArtifacts: 0,
      errors,
    };
  }

  if (!manifest.installed) {
    return {
      valid: true,
      installed: false,
      checkedArtifacts: 0,
      errors: [],
    };
  }

  const manifestDirectory = dirname(
    resolve(manifestPath),
  );

  let checkedArtifacts = 0;

  for (const artifact of manifest.artifacts) {
    const artifactPath = resolve(
      manifestDirectory,
      artifact.path,
    );

    if (!existsSync(artifactPath)) {
      errors.push(
        `Missing artifact: ${artifact.path}`,
      );
      continue;
    }

    let stats;

    try {
      stats = statSync(artifactPath);
    } catch (error) {
      errors.push(
        `Unable to inspect artifact ${artifact.path}: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      );
      continue;
    }

    if (!stats.isFile()) {
      errors.push(
        `Artifact is not a file: ${artifact.path}`,
      );
      continue;
    }

    try {
      if (
        !isPathInsideDirectory(
          manifestDirectory,
          artifactPath,
        )
      ) {
        errors.push(
          `Artifact resolves outside manifest directory: ${artifact.path}`,
        );
        continue;
      }
    } catch (error) {
      errors.push(
        `Unable to resolve artifact ${artifact.path}: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      );
      continue;
    }

    const actualSha256 = sha256File(artifactPath);

    if (actualSha256 !== artifact.sha256) {
      errors.push(
        `SHA-256 mismatch for artifact ${artifact.path}: expected ${artifact.sha256}, got ${actualSha256}`,
      );
      continue;
    }

    checkedArtifacts += 1;
  }

  return {
    valid:
      errors.length === 0 &&
      checkedArtifacts === manifest.artifacts.length,
    installed: true,
    checkedArtifacts,
    errors,
  };
}