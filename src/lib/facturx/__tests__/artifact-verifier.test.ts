import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  verifyArtifactFiles,
} from "../validation/artifact-verifier";
import type {
  FacturxValidationArtifactManifest,
} from "../validation/artifact-manifest";

const temporaryDirectories: string[] = [];

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(
    join(tmpdir(), "facturx-artifacts-"),
  );

  temporaryDirectories.push(directory);
  return directory;
}

function sha256(content: string): string {
  return createHash("sha256")
    .update(content)
    .digest("hex");
}

function manifest(
  overrides: Partial<FacturxValidationArtifactManifest> = {},
): FacturxValidationArtifactManifest {
  return {
    manifestVersion: 1,
    facturxVersion: "1.09",
    zugferdVersion: "2.5",
    syntax: "UN/CEFACT CII D22B",
    profile: "EN16931",
    publisher: "FNFE-MPE / FeRD",
    releaseDate: "2026-06-10",
    source: "Official package",
    installed: false,
    artifacts: [],
    ...overrides,
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories) {
    rmSync(directory, {
      recursive: true,
      force: true,
    });
  }

  temporaryDirectories.length = 0;
});

describe("verifyArtifactFiles", () => {
  it("accepte un manifeste non installé sans artefact", () => {
    const directory = createTemporaryDirectory();
    const manifestPath = join(
      directory,
      "manifest.json",
    );

    const result = verifyArtifactFiles({
      manifest: manifest(),
      manifestPath,
    });

    expect(result).toEqual({
      valid: true,
      installed: false,
      checkedArtifacts: 0,
      errors: [],
    });
  });

  it("accepte un fichier présent avec le bon SHA-256", () => {
    const directory = createTemporaryDirectory();
    const artifactsDirectory = join(
      directory,
      "artifacts",
    );

    mkdirSync(artifactsDirectory);

    const content = "<schema>official</schema>";
    const relativePath = "artifacts/schema.xsd";

    writeFileSync(
      join(directory, relativePath),
      content,
    );

    const result = verifyArtifactFiles({
      manifest: manifest({
        installed: true,
        artifacts: [
          {
            path: relativePath,
            kind: "xsd",
            sha256: sha256(content),
            profiles: ["EN16931"],
          },
        ],
      }),
      manifestPath: join(
        directory,
        "manifest.json",
      ),
    });

    expect(result.valid).toBe(true);
    expect(result.checkedArtifacts).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it("échoue quand un artefact déclaré est absent", () => {
    const directory = createTemporaryDirectory();

    const result = verifyArtifactFiles({
      manifest: manifest({
        installed: true,
        artifacts: [
          {
            path: "artifacts/missing.xsd",
            kind: "xsd",
            sha256: "a".repeat(64),
            profiles: ["EN16931"],
          },
        ],
      }),
      manifestPath: join(
        directory,
        "manifest.json",
      ),
    });

    expect(result.valid).toBe(false);
    expect(result.checkedArtifacts).toBe(0);
    expect(result.errors).toContain(
      "Missing artifact: artifacts/missing.xsd",
    );
  });

  it("échoue quand le SHA-256 ne correspond pas", () => {
    const directory = createTemporaryDirectory();
    const artifactsDirectory = join(
      directory,
      "artifacts",
    );

    mkdirSync(artifactsDirectory);

    writeFileSync(
      join(artifactsDirectory, "schema.xsd"),
      "<schema>modified</schema>",
    );

    const result = verifyArtifactFiles({
      manifest: manifest({
        installed: true,
        artifacts: [
          {
            path: "artifacts/schema.xsd",
            kind: "xsd",
            sha256: "b".repeat(64),
            profiles: ["EN16931"],
          },
        ],
      }),
      manifestPath: join(
        directory,
        "manifest.json",
      ),
    });

    expect(result.valid).toBe(false);
    expect(result.checkedArtifacts).toBe(0);
    expect(
      result.errors.some((error) =>
        error.startsWith(
          "SHA-256 mismatch for artifact artifacts/schema.xsd",
        ),
      ),
    ).toBe(true);
  });

  it("échoue lorsque le manifeste est invalide", () => {
    const directory = createTemporaryDirectory();

    const result = verifyArtifactFiles({
      manifest: manifest({
        facturxVersion: "1.0.07",
      }),
      manifestPath: join(
        directory,
        "manifest.json",
      ),
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Unexpected Factur-X version.",
    );
  });
});