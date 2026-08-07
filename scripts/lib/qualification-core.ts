/**
 * Decision core of the Phase A qualification script.
 *
 * It performs NO system access: the script feeds it structured results and the
 * core decides which steps pass, what the summary says and which exit code the
 * process must use. This keeps the decisions testable without veraPDF or Java.
 *
 * The core can never qualify the generator: Phase A ships no official XSD nor
 * Schematron artifacts.
 */
import { parseVeraPdfReport } from "./verapdf-report.js";

export type StepStatus = "PASS" | "FAIL" | "NOT IMPLEMENTED";

export interface QualificationStep {
  name: string;
  status: StepStatus;
  detail?: string;
}

export interface ToolExecutionResult {
  available: boolean;
  exitCode: number | null;
  stdout?: string;
  stderr?: string;
  errorMessage?: string;
}

export interface CheckOutcome {
  valid: boolean;
  errors: string[];
}

export interface QualificationInputs {
  java: ToolExecutionResult;
  verapdf: ToolExecutionResult;
  /** Internal business rules over the structured invoice. */
  businessRules: CheckOutcome;
  /** XML well-formedness, checked with a real parser. */
  xmlSyntax: CheckOutcome;
  /** Internal PDF/A-3 structural self-checks. */
  pdfA3SelfChecks: CheckOutcome;
  xsdValidation: CheckOutcome;
  schematronValidation: CheckOutcome;
  schematronWarnings?: string[];
  pdfXmlConsistency: CheckOutcome;
  /** The reference PDF was written to disk. */
  referencePdfExists: boolean;
  /** Raw veraPDF XML report, when one was produced. */
  veraPdfReportXml?: string;
  /** XML produced by the generator. */
  generatedXml: Uint8Array;
  /** XML written next to the reference PDF. */
  externalXml?: Uint8Array;
  /** XML extracted back from the generated PDF. */
  embeddedXml?: Uint8Array;
}

export interface QualificationResult {
  success: boolean;
  exitCode: 0 | 1;
  steps: QualificationStep[];
  generatorQualification: "UNQUALIFIED";
  summary: string[];
}

export const GENERATOR_QUALIFICATION_LINE =
  "Generator qualification: UNQUALIFIED";

export const SUCCESS_LINE = "Vérifications Phase A réussies";

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

function toolStep(
  name: string,
  tool: ToolExecutionResult,
): QualificationStep {
  if (!tool.available) {
    return {
      name,
      status: "FAIL",
      detail:
        tool.errorMessage ??
        `${name} : l'outil est obligatoire et n'est pas installé.`,
    };
  }

  if (tool.exitCode !== 0) {
    return {
      name,
      status: "FAIL",
      detail: `${name} a terminé avec le code ${tool.exitCode}.`,
    };
  }

  return { name, status: "PASS" };
}

function outcomeStep(name: string, outcome: CheckOutcome): QualificationStep {
  return outcome.valid
    ? { name, status: "PASS" }
    : { name, status: "FAIL", detail: outcome.errors.join(" | ") };
}

function veraPdfStep(inputs: QualificationInputs): QualificationStep {
  const name = "PDF/A-3B VeraPDF";
  const xml = inputs.veraPdfReportXml ?? "";

  if (!xml.trim()) {
    return {
      name,
      status: "FAIL",
      detail: `VeraPDF n'a produit aucun rapport. Code de sortie : ${
        inputs.verapdf.exitCode ?? "inconnu"
      }.`,
    };
  }

  let parsed: ReturnType<typeof parseVeraPdfReport>;
  try {
    parsed = parseVeraPdfReport(xml);
  } catch (error) {
    return {
      name,
      status: "FAIL",
      detail: `rapport machine-readable invalide : ${
        error instanceof Error ? error.message : "rapport illisible"
      }`,
    };
  }

  if (!parsed.compliant) {
    return {
      name,
      status: "FAIL",
      detail: [
        "document non conforme PDF/A-3B",
        `failedRules=${parsed.failedRules}`,
        `failedChecks=${parsed.failedChecks}`,
        `nonCompliant=${parsed.nonCompliantReports}`,
        `failedJobs=${parsed.failedJobs}`,
        `failedToParse=${parsed.failedToParse}`,
        `veraExceptions=${parsed.veraExceptions}`,
      ].join(", "),
    };
  }

  if (inputs.verapdf.exitCode !== 0) {
    return {
      name,
      status: "FAIL",
      detail: `le rapport indique une conformité, mais VeraPDF a terminé avec le code ${
        inputs.verapdf.exitCode ?? "inconnu"
      }.`,
    };
  }

  return { name, status: "PASS" };
}

function xmlSteps(inputs: QualificationInputs): QualificationStep[] {
  const extraction: QualificationStep = !inputs.embeddedXml
    ? {
        name: "Embedded XML extraction",
        status: "FAIL",
        detail: "impossible d'extraire factur-x.xml du PDF généré.",
      }
    : { name: "Embedded XML extraction", status: "PASS" };

  if (extraction.status === "FAIL") {
    return [
      extraction,
      {
        name: "Embedded XML consistency",
        status: "FAIL",
        detail: "XML embarqué indisponible.",
      },
    ];
  }

  if (!inputs.externalXml) {
    return [
      extraction,
      {
        name: "Embedded XML consistency",
        status: "FAIL",
        detail: "le XML externe n'a pas été écrit sur le disque.",
      },
    ];
  }

  if (!bytesEqual(inputs.generatedXml, inputs.externalXml)) {
    return [
      extraction,
      {
        name: "Embedded XML consistency",
        status: "FAIL",
        detail: "le XML écrit sur le disque diffère du XML généré.",
      },
    ];
  }

  if (!bytesEqual(inputs.generatedXml, inputs.embeddedXml!)) {
    return [
      extraction,
      {
        name: "Embedded XML consistency",
        status: "FAIL",
        detail: "le XML embarqué diffère du XML généré.",
      },
    ];
  }

  return [extraction, { name: "Embedded XML consistency", status: "PASS" }];
}

export function evaluateQualification(
  inputs: QualificationInputs,
): QualificationResult {
  const steps: QualificationStep[] = [
    toolStep("Java availability", inputs.java),
    toolStep("VeraPDF availability", inputs.verapdf),
    inputs.referencePdfExists
      ? { name: "Reference invoice", status: "PASS" }
      : {
          name: "Reference invoice",
          status: "FAIL",
          detail: "la facture de référence n'a pas été écrite sur le disque.",
        },
    outcomeStep("Internal business rules", inputs.businessRules),
    outcomeStep("XML well-formedness", inputs.xmlSyntax),
    outcomeStep("Internal PDF/A-3 self-checks", inputs.pdfA3SelfChecks),
    ...xmlSteps(inputs),
    outcomeStep("Visible PDF / XML consistency", inputs.pdfXmlConsistency),
    outcomeStep("Official Factur-X XSD 1.09.2", inputs.xsdValidation),
    outcomeStep("Official EN16931 Schematron 1.09.2", inputs.schematronValidation),
    veraPdfStep(inputs),
  ];

  const success = steps.every((step) => step.status === "PASS");

  return {
    success,
    exitCode: success ? 0 : 1,
    steps,
    generatorQualification: "UNQUALIFIED",
    summary: buildSummary(steps, success),
  };
}

export function buildSummary(
  steps: QualificationStep[],
  success: boolean,
): string[] {
  const lines = ["--- Résumé Phase A ---"];
  for (const step of steps) {
    lines.push(
      step.detail
        ? `${step.name}: ${step.status} (${step.detail})`
        : `${step.name}: ${step.status}`,
    );
  }
  // Never conditional: Phase A can never qualify the generator.
  lines.push(GENERATOR_QUALIFICATION_LINE);
  if (success) lines.push(SUCCESS_LINE);
  return lines;
}