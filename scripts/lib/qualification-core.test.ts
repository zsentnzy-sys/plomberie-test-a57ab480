import { describe, expect, it } from "vitest";

import {
  evaluateQualification,
  GENERATOR_QUALIFICATION_LINE,
  SUCCESS_LINE,
  type QualificationInputs,
  type ToolExecutionResult,
} from "./qualification-core.js";

const availableTool: ToolExecutionResult = {
  available: true,
  exitCode: 0,
  stdout: "",
  stderr: "",
};

const missingTool: ToolExecutionResult = {
  available: false,
  exitCode: null,
  errorMessage: "l'outil est obligatoire et n'est pas installé.",
};

const compliantReport = `<?xml version="1.0"?>
<report>
  <batchSummary failedToParse="0" veraExceptions="0">
    <validationReports nonCompliant="0" failedJobs="0"/>
  </batchSummary>
  <validationReport isCompliant="true">
    <details failedRules="0" failedChecks="0"/>
  </validationReport>
</report>`;

const nonCompliantReport = `<?xml version="1.0"?>
<report>
  <batchSummary failedToParse="0" veraExceptions="0">
    <validationReports nonCompliant="1" failedJobs="0"/>
  </batchSummary>
  <validationReport isCompliant="false">
    <details failedRules="3" failedChecks="7"/>
  </validationReport>
</report>`;

const xmlBytes = new TextEncoder().encode("<rsm:CrossIndustryInvoice/>");
const otherXmlBytes = new TextEncoder().encode("<rsm:CrossIndustryInvoice2/>");

function inputs(overrides: Partial<QualificationInputs> = {}): QualificationInputs {
  return {
    java: availableTool,
    verapdf: availableTool,
    businessRules: { valid: true, errors: [] },
    xmlSyntax: { valid: true, errors: [] },
    pdfA3SelfChecks: { valid: true, errors: [] },
    pdfXmlConsistency: { valid: true, errors: []},
    xsdValidation : {valid: true, errors: []},
    schematronValidation: {valid: true, errors: []},
    schematronWarnings: [],
    referencePdfExists: true,
    veraPdfReportXml: compliantReport,
    generatedXml: xmlBytes,
    externalXml: xmlBytes,
    embeddedXml: xmlBytes,
    ...overrides,
  };
}

const stepOf = (
  result: ReturnType<typeof evaluateQualification>,
  name: string,
) => result.steps.find((s) => s.name === name);

describe("evaluateQualification — échecs d'outils", () => {
  it("échoue quand VeraPDF est absent", () => {
    const result = evaluateQualification(
      inputs({ verapdf: missingTool, veraPdfReportXml: "" }),
    );
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(stepOf(result, "VeraPDF availability")?.status).toBe("FAIL");
  });

  it("échoue quand Java est absent", () => {
    const result = evaluateQualification(inputs({ java: missingTool }));
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(stepOf(result, "Java availability")?.status).toBe("FAIL");
  });

  it("échoue quand Java retourne un code non nul", () => {
    const result = evaluateQualification(
      inputs({
        java: {
          ...availableTool,
          exitCode: 1,
          stderr: "Java runtime failure",
        },
      }),
    );

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(stepOf(result, "Java availability")?.status).toBe("FAIL");
    expect(stepOf(result, "Java availability")?.detail).toContain(
      "code 1",
    );
  });

  it("échoue quand la facture de référence est absente", () => {
    const result = evaluateQualification(inputs({ referencePdfExists: false }));
    expect(result.success).toBe(false);
    expect(stepOf(result, "Reference invoice")?.status).toBe("FAIL");
  });
});

describe("evaluateQualification — rapport VeraPDF", () => {
  it("échoue sur un rapport vide", () => {
    const result = evaluateQualification(inputs({ veraPdfReportXml: "" }));
    expect(result.success).toBe(false);
    expect(stepOf(result, "PDF/A-3B VeraPDF")?.detail).toContain("aucun rapport");
  });

  it("échoue sur un rapport illisible", () => {
    const result = evaluateQualification(
      inputs({ veraPdfReportXml: "<report>tronqué" }),
    );
    expect(result.success).toBe(false);
    expect(stepOf(result, "PDF/A-3B VeraPDF")?.detail).toContain(
      "machine-readable invalide",
    );
  });

  it("échoue sur un rapport non conforme", () => {
    const result = evaluateQualification(
      inputs({ veraPdfReportXml: nonCompliantReport }),
    );
    expect(result.success).toBe(false);
    expect(stepOf(result, "PDF/A-3B VeraPDF")?.detail).toContain(
      "non conforme PDF/A-3B",
    );
  });

  it("échoue quand VeraPDF renvoie un code non nul malgré un rapport conforme", () => {
    const result = evaluateQualification(
      inputs({ verapdf: { ...availableTool, exitCode: 1 } }),
    );
    expect(result.success).toBe(false);
    expect(stepOf(result, "PDF/A-3B VeraPDF")?.detail).toContain("code 1");
  });
});

describe("evaluateQualification — cohérence XML", () => {
  it("échoue quand l'XML embarqué est absent", () => {
    const result = evaluateQualification(inputs({ embeddedXml: undefined }));
    expect(result.success).toBe(false);
    expect(stepOf(result, "Embedded XML extraction")?.status).toBe("FAIL");
  });

  it("échoue quand l'XML externe est absent", () => {
    const result = evaluateQualification(inputs({ externalXml: undefined }));
    expect(result.success).toBe(false);
    expect(stepOf(result, "Embedded XML consistency")?.status).toBe("FAIL");
  });

  it("échoue quand l'XML externe diffère du XML généré", () => {
    const result = evaluateQualification(inputs({ externalXml: otherXmlBytes }));
    expect(result.success).toBe(false);
    expect(stepOf(result, "Embedded XML consistency")?.detail).toContain(
      "écrit sur le disque diffère",
    );
  });

  it("échoue quand l'XML embarqué diffère du XML généré", () => {
    const result = evaluateQualification(inputs({ embeddedXml: otherXmlBytes }));
    expect(result.success).toBe(false);
    expect(stepOf(result, "Embedded XML consistency")?.detail).toContain(
      "embarqué diffère",
    );
  });
});

describe("evaluateQualification — auto-contrôles internes", () => {
  it("échoue sur des règles métier internes en erreur", () => {
    const result = evaluateQualification(
      inputs({ businessRules: { valid: false, errors: ["SIREN manquant"] } }),
    );
    expect(result.success).toBe(false);
    expect(stepOf(result, "Internal business rules")?.detail).toContain(
      "SIREN manquant",
    );
  });

  it("échoue sur un XML mal formé", () => {
    const result = evaluateQualification(
      inputs({ xmlSyntax: { valid: false, errors: ["balise non fermée"] } }),
    );
    expect(result.success).toBe(false);
    expect(stepOf(result, "XML well-formedness")?.status).toBe("FAIL");
  });

  it("échoue sur une structure PDF/A-3 interne invalide", () => {
    const result = evaluateQualification(
      inputs({ pdfA3SelfChecks: { valid: false, errors: ["OutputIntent absent"] } }),
    );
    expect(result.success).toBe(false);
    expect(stepOf(result, "Internal PDF/A-3 self-checks")?.status).toBe("FAIL");
  });
});

describe("evaluateQualification — scénario Phase A complet", () => {
  const result = evaluateQualification(inputs());

  it("réussit avec un code de sortie nul", () => {
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.steps.every((s) => s.status === "PASS")).toBe(true);
  });

  it("qualifie le générateur quand toute la chaîne passe", () => {
    const result = evaluateQualification(inputs());

    expect(result.generatorQualification).toBe(
      "QUALIFIED",
    );

    expect(result.summary).toContain(
      "Generator qualification: QUALIFIED",
    );
  });

  it("marque la qualification en échec si un contrôle échoue", () => {
    const result = evaluateQualification(
      inputs({
        xsdValidation: {
          valid: false,
          errors: ["XSD rejeté"],
        },
      }),
    );

    expect(result.success).toBe(false);

    expect(
      result.generatorQualification,
    ).toBe("QUALIFICATION_FAILED");

    expect(result.summary).toContain(
      "Generator qualification: QUALIFICATION_FAILED",
    );
  });

  it("n'annonce jamais une qualification Factur-X réussie", () => {
    const text = result.summary.join("\n");
    expect(text).not.toContain("Qualification Factur-X réussie");
    expect(text).toContain(SUCCESS_LINE);
  });

  it("échoue si le PDF visible diffère des données structurées", () => {
    const result = evaluateQualification(
      inputs({
        pdfXmlConsistency: {
          valid: false,
          errors: [
            "Total TTC absent du PDF visible",
          ],
        },
      }),
    );

    expect(result.success).toBe(false);

    expect(
      stepOf(
        result,
        "Visible PDF / XML consistency",
      )?.status,
    ).toBe("FAIL");
  });

  it("échoue quand le XSD officiel rejette le XML embarqué", () => {
    const result = evaluateQualification(
      inputs({
        xsdValidation: {
          valid: false,
          errors: ["XSD officiel rejeté"],
        },
      }),
    );
    expect(result.success).toBe(false);
    expect(
      stepOf(
        result,
        "Official Factur-X XSD 1.09.2",
      )?.status,
    ).toBe("FAIL");
  })

  it("échoue sur une règle Schematron bloquante", () => {
    const result = evaluateQualification(
      inputs({
        schematronValidation: {
          valid: false,
          errors: [
            "BR-S-02: Seller tax identifier missing",
          ],
        },
      }),
    );

    expect(result.success).toBe(false);

    expect(
      stepOf(
        result,
        "Official EN16931 Schematron 1.09.2",
      )?.status,
    ).toBe("FAIL");
  });
});