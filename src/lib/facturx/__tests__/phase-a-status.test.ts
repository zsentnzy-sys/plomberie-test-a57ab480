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
  it("implements the Factur-X 1.09 specification", () => {
    expect(FACTURX_CONFIG.implementedSpecificationVersion).toBe("1.09");
    expect(FACTURX_CONFIG.targetSpecificationVersion).toBe("1.09");
  });

  it("never uses the XMP version as a specification version", () => {
    expect(FACTURX_CONFIG.xmpVersion).toBe("1.0");
    expect(FACTURX_CONFIG.implementedSpecificationVersion).not.toBe(
      FACTURX_CONFIG.xmpVersion);
  });

  it("ships official EN16931 1.09.2 artifacts and marks the generator qualified", () => {
    expect(FACTURX_CONFIG.validationArtifactsVersion).toBe("1.09.2");
    expect(GENERATOR_QUALIFICATION).toBe("qualified");
  });
});

// Le comportement du script de qualification (outils manquants, rapport VeraPDF,
// cohérence XML, résumé non trompeur) est couvert par des tests comportementaux
// dans scripts/lib/qualification-core.test.ts.

describe("Phase A — Supabase write failures", () => {
  const src = read("src/lib/invoices-pdf.server.ts");

  it("checks the final compliance update result", () => {
    expect(src).toContain("complianceUpdateError");
    expect(src).toContain(
      "la finalisation des métadonnées de la facture",
    );
  });

  it("checks generation error persistence failures", () => {
    expect(src).toContain("generationErrorUpdateError");
    expect(src).toContain(
      "l’erreur n’a pas pu être enregistrée",
    );
  });
});

describe("libellés internes du pipeline", () => {
  it("ne présente pas les contrôles internes comme une validation EN 16931", () => {
    const source = readFileSync(
      "src/lib/invoices-pdf.server.ts",
      "utf8",
    );

    expect(source).not.toContain(
      "Facture non conforme EN 16931",
    );

    expect(source).toContain(
      "Échec des contrôles métier internes de la facture.",
    );
  });
});