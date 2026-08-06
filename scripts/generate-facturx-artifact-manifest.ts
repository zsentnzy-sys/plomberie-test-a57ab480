import { createHash } from "node:crypto";
import {
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import {
  relative,
  resolve,
} from "node:path";

import type {
  FacturxValidationArtifactManifest,
  ValidationArtifactEntry,
  ValidationArtifactKind,
} from "../src/lib/facturx/validation/artifact-manifest";

const manifestPath = resolve(
  "src/lib/facturx/validation/1.09/manifest.json",
);

const manifestDirectory = resolve(
  "src/lib/facturx/validation/1.09",
);

const artifactsDirectory = resolve(
  manifestDirectory,
  "artifacts",
);

function walk(directory: string): string[] {
  const files: string[] = [];

  for (const name of readdirSync(directory)) {
    const path = resolve(directory, name);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      files.push(...walk(path));
    } else if (stats.isFile()) {
      files.push(path);
    }
  }

  return files;
}

function sha256File(path: string): string {
  return createHash("sha256")
    .update(readFileSync(path))
    .digest("hex");
}

function kindForPath(
  path: string,
): ValidationArtifactKind {
  if (path.endsWith(".xsd")) return "xsd";
  if (path.endsWith(".sch")) return "schematron";
  if (path.endsWith(".xslt")) return "xslt";
  if (path.endsWith("_codedb.xml")) {
    return "code-list";
  }

  throw new Error(
    `Unsupported validation artifact: ${path}`,
  );
}

const artifacts: ValidationArtifactEntry[] =
  walk(artifactsDirectory)
    .sort()
    .map((absolutePath) => {
      const path = relative(
        manifestDirectory,
        absolutePath,
      ).replaceAll("\\", "/");

      return {
        path,
        kind: kindForPath(path),
        sha256: sha256File(absolutePath),
        profiles: ["EN16931"],
      };
    });

const manifest: FacturxValidationArtifactManifest = {
  manifestVersion: 1,
  facturxVersion: "1.09.2",
  zugferdVersion: "2.5.2",
  syntax: "UN/CEFACT CII D22B",
  profile: "EN16931",

  publisher: "FNFE-MPE / FeRD",
  releaseDate: "2026-08-04",

  source:
    "Official Factur-X 1.09.2 / ZUGFeRD 2.5.2 FINAL FR package",

  packageFileName:
    "Factur-X-1.09.2-Zugferd-2.5.2-2026-08-04-FINAL-FR.zip",

  packageSha256:
    "7d2fe79580270c8babea3e40dbdae47bd68c0baa7022051be4f955921a1cd29a",

  installed: true,
  artifacts,
};

writeFileSync(
  manifestPath,
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log(
  `Manifest written with ${artifacts.length} artifacts.`,
);