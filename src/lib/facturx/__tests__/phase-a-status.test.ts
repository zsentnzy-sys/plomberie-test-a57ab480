import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  FACTURX_CONFIG,
  GENERATOR_QUALIFICATION,
} from "../facturx-config.server";

const root = join(import.meta.dirname, "..", "..", "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("Phase A — versions", () => {
  it("keeps the implemented spec version distinct from the Phase B target", () => {
    expect(FACTURX_CONFIG.implementedSpecificationVersion).toBe("1.0.07");
    expect(FACTURX_CONFIG.targetSpecificationVersion).toBe("1.09");
    expect(FACTURX_CONFIG.implementedSpecificationVersion).not.toBe(
      FACTURX_CONFIG.targetSpecificationVersion,
    );
  });

  it("never uses the XMP version as a specification version", () => {
    expect(FACTURX_CONFIG.xmpVersion).toBe("1.0");
    expect(FACTURX_CONFIG.implementedSpecificationVersion).not.toBe(
      FACTURX_CONFIG.xmpVersion);
  });

  it("ships no official validation artifacts, so the generator stays unqualified", () => {
    expect(FACTURX_CONFIG.validationArtifactsVersion).toBeNull();
    expect(GENERATOR_QUALIFICATION).toBe("unqualified");
  });
});

describe("Phase A — qualification script", () => {
  const script = read("scripts/validate-facturx.ts");

  it("treats a missing tool as a failure, not a warning", () => {
    expect(script).not.toContain("validation externe ignorée");
    expect(script).toContain("est obligatoire");
    expect(script).toContain("process.exit(1)");
  });

  it("never announces a successful Factur-X qualification", () => {
    expect(script).not.toContain("Qualification Factur-X réussie");
    expect(script).toContain("Vérifications Phase A réussies");
    expect(script).toContain("Generator qualification: UNQUALIFIED");
  });

  it("checks the embedded XML against the generated one", () => {
    expect(script).toContain("Embedded XML extraction");
    expect(script).toContain("Embedded XML consistency");
    expect(script).toContain("sha256");
  });
});
describe("Phase A — Supabase write failures", () => {
  const src = read("src/lib/invoices-pdf.server.ts");

  it("checks the final compliance update result", () => {
    expect(src).toContain("complianceUpdateError");
    expect(src).toContain(
      "la finalisation des métadonnées de la facture",
    );
  });

  it("checks runtime validation persistence failures", () => {
    expect(src).toContain(
      "l’enregistrement des auto-contrôles Factur-X",
    );
  });

  it("checks generation error persistence failures", () => {
    expect(src).toContain("generationErrorUpdateError");
    expect(src).toContain(
      "l’erreur n’a pas pu être enregistrée",
    );
  });
});