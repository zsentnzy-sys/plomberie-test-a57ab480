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
      FACTURX_CONFIG.xmpVersion,
    );
    const src = read("src/lib/invoices-pdf.server.ts");
    expect(src).toContain(
      "facturx_version: FACTURX_CONFIG.implementedSpecificationVersion",
    );
    expect(src).not.toContain("facturx_version: FACTURX_CONFIG.xmpVersion");
  });

  it("ships no official validation artifacts, so the generator stays unqualified", () => {
    expect(FACTURX_CONFIG.validationArtifactsVersion).toBeNull();
    expect(GENERATOR_QUALIFICATION).toBe("unqualified");
  });
});

describe("Phase A — persisted statuses", () => {
  const src = read("src/lib/invoices-pdf.server.ts");

  it("persists generator + document schema versions on hybrid invoices", () => {
    expect(src).toContain("generator_version: FACTURX_CONFIG.generatorVersion");
    expect(src).toContain(
      "document_schema_version: FACTURX_CONFIG.documentSchemaVersion",
    );
    expect(src).toContain(
      "validation_artifacts_version: FACTURX_CONFIG.validationArtifactsVersion",
    );
  });

  it("only ever claims internal self-checks, never qualification or external validity", () => {
    expect(src).toContain('runtime_validation_status: "passed"');
    expect(src).toContain('external_validation_status: "not_run"');
    expect(src).not.toContain('generator_qualification_status: "qualified"');
    expect(src).not.toContain('external_validation_status: "valid"');
    expect(src).not.toContain('facturx_validation_status: "valid"');
  });

  it("marks classic PDFs as out of scope", () => {
    expect(src).toContain('runtime_validation_status: "not_applicable"');
    expect(src).toContain('external_validation_status: "not_applicable"');
  });
});

describe("Phase A — admin history wording", () => {
  const ui = read("src/routes/admin/historique.tsx");
  const fns = read("src/lib/history.functions.ts");

  it("no longer claims the invoice is ready for an approved platform", () => {
    for (const forbidden of [
      "Prête pour plateforme agréée",
      "Conforme Factur-X",
      "Factur-X validée",
      "Prête à transmettre",
      "Conforme EN 16931",
    ]) {
      expect(ui).not.toContain(forbidden);
    }
  });

  it("shows the three separate statuses", () => {
    expect(ui).toContain("Auto-contrôles réussis");
    expect(ui).toContain("Moteur non qualifié");
    expect(ui).toContain("Validation externe non exécutée");
  });

  it("stops reading the deprecated column for display", () => {
    expect(fns).not.toContain("r.facturx_validation_status");
    expect(fns).toContain("runtime_validation_status");
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