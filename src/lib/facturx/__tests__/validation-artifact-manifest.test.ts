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

    expect(manifest.facturxVersion).toBe("1.09");
    expect(manifest.zugferdVersion).toBe("2.5");
    expect(manifest.syntax).toBe(
      "UN/CEFACT CII D22B",
    );
    expect(manifest.profile).toBe("EN16931");
  });

  it("remains explicitly uninstalled while artifacts are absent", () => {
    const manifest = readManifest();

    expect(manifest.installed).toBe(false);
    expect(manifest.artifacts).toEqual([]);
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
});