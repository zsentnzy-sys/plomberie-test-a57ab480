import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  validateArtifactManifest,
  type FacturxValidationArtifactManifest,
} from "../validation/artifact-manifest";

function readManifest(): FacturxValidationArtifactManifest {
  return JSON.parse(
    readFileSync(
      "src/lib/facturx/validation/1.09/manifest.json",
      "utf8",
    ),
  ) as FacturxValidationArtifactManifest;
}

describe("Factur-X 1.09 validation artifact manifest", () => {
  it("declares the expected versions and syntax", () => {
    const manifest = readManifest();

    expect(manifest.facturxVersion).toBe("1.09.2");
    expect(manifest.zugferdVersion).toBe("2.5.2");
    expect(manifest.syntax).toBe(
      "UN/CEFACT CII D22B",
    );
    expect(manifest.profile).toBe("EN16931");
    
  });

  it("declares the installed official EN16931 artifact set", () => {
    const manifest = readManifest();

    expect(manifest.installed).toBe(true);
    expect(manifest.artifacts).toHaveLength(8);
    expect(manifest.artifacts.every((artifact) => artifact.profiles.includes("EN16931"))).toBe(true);
  });

  it("is structurally valid", () => {
    const manifest = readManifest();

    expect(
      validateArtifactManifest(manifest),
    ).toEqual([]);
  });

  it("refuses an installed manifest without artifacts", () => {
    const manifest = readManifest();

    const errors = validateArtifactManifest({
      ...manifest,
      installed: true,
      artifacts: [],
    });

    expect(errors).toContain(
      "An installed manifest must contain validation artifacts.",
    );
  });

  it("refuses invalid or unsafe artifact entries", () => {
    const manifest = readManifest();

    const errors = validateArtifactManifest({
      ...manifest,
      installed: true,
      artifacts: [
        {
          path: "../external/file.xsd",
          kind: "xsd",
          sha256: "invalid",
          profiles: [],
        },
      ],
    });

    expect(errors).toContain(
      "Unsafe artifact path: ../external/file.xsd",
    );

    expect(errors).toContain(
      "Invalid SHA-256 for artifact: ../external/file.xsd",
    );

    expect(errors).toContain(
      "Missing profile for artifact: ../external/file.xsd",
    );
  });

  it("pins the exact official release package", () => {
    const manifest = readManifest();

    expect(manifest.packageFileName).toBe("Factur-X-1.09.2-Zugferd-2.5.2-2026-08-04-FINAL-FR.zip");
    expect(manifest.packageSha256).toBe("7d2fe79580270c8babea3e40dbdae47bd68c0baa7022051be4f955921a1cd29a");
  });
});