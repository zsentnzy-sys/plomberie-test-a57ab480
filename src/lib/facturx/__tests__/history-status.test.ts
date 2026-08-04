import { describe, expect, it } from "vitest";

import { buildFacturxHistoryStatus } from "../history-status";

describe("buildFacturxHistoryStatus", () => {
  it("reports successful internal checks without claiming qualification", () => {
    const status = buildFacturxHistoryStatus({
      runtimeValidationStatus: "passed",
      generatorQualificationStatus: "unqualified",
      externalValidationStatus: "not_run",
      validationSummary: null,
    });

    expect(status).toEqual({
      runtime: {
        label: "Auto-contrôles réussis",
        tone: "neutral",
      },
      generator: {
        label: "Moteur non qualifié",
        tone: "neutral",
      },
      external: {
        label: "Validation externe non exécutée",
        tone: "neutral",
      },
    });
  });

  it("includes the stored summary when internal checks fail", () => {
    const status = buildFacturxHistoryStatus({
      runtimeValidationStatus: "failed",
      generatorQualificationStatus: "unqualified",
      externalValidationStatus: "not_run",
      validationSummary: "Total TTC incohérent",
    });

    expect(status.runtime).toEqual({
      label: "Auto-contrôles en échec : Total TTC incohérent",
      tone: "error",
    });
  });

  it("uses a safe fallback when no failure summary exists", () => {
    const status = buildFacturxHistoryStatus({
      runtimeValidationStatus: "failed",
      generatorQualificationStatus: "unqualified",
      externalValidationStatus: "not_run",
      validationSummary: null,
    });

    expect(status.runtime.label).toBe(
      "Auto-contrôles en échec : erreur interne",
    );
  });

  it("reports pending internal checks", () => {
    const status = buildFacturxHistoryStatus({
      runtimeValidationStatus: null,
      generatorQualificationStatus: null,
      externalValidationStatus: null,
      validationSummary: null,
    });

    expect(status.runtime.label).toBe(
      "Auto-contrôles en attente",
    );
    expect(status.generator.label).toBe(
      "Moteur non qualifié",
    );
    expect(status.external.label).toBe(
      "Validation externe non exécutée",
    );
  });

  it("reports all supported qualification states", () => {
    expect(
      buildFacturxHistoryStatus({
        runtimeValidationStatus: "passed",
        generatorQualificationStatus: "qualified",
        externalValidationStatus: "not_run",
        validationSummary: null,
      }).generator.label,
    ).toBe("Moteur qualifié en CI");

    expect(
      buildFacturxHistoryStatus({
        runtimeValidationStatus: "passed",
        generatorQualificationStatus: "qualification_failed",
        externalValidationStatus: "not_run",
        validationSummary: null,
      }).generator.label,
    ).toBe("Qualification du moteur en échec");
  });

  it("reports all supported external validation states", () => {
    expect(
      buildFacturxHistoryStatus({
        runtimeValidationStatus: "passed",
        generatorQualificationStatus: "unqualified",
        externalValidationStatus: "valid",
        validationSummary: null,
      }).external.label,
    ).toBe("Validation externe réussie");

    expect(
      buildFacturxHistoryStatus({
        runtimeValidationStatus: "passed",
        generatorQualificationStatus: "unqualified",
        externalValidationStatus: "invalid",
        validationSummary: null,
      }).external.label,
    ).toBe("Validation externe échouée");

    expect(
      buildFacturxHistoryStatus({
        runtimeValidationStatus: "not_applicable",
        generatorQualificationStatus: "unqualified",
        externalValidationStatus: "not_applicable",
        validationSummary: null,
      }),
    ).toMatchObject({
      runtime: {
        label: "Auto-contrôles non applicables",
      },
      external: {
        label: "Validation externe non applicable",
      },
    });
  });
});