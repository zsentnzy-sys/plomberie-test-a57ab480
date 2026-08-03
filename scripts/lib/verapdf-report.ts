export interface VeraPdfValidationResult {
  compliant: boolean;
  failedRules: number;
  failedChecks: number;
  nonCompliantReports: number;
  failedJobs: number;
  failedToParse: number;
  veraExceptions: number;
}

function readIntegerAttribute(
  xml: string,
  elementName: string,
  attributeName: string,
): number {
  const elementPattern = new RegExp(
    `<${elementName}\\b[^>]*\\b${attributeName}="(\\d+)"`,
  );
  const match = elementPattern.exec(xml);

  if (!match) {
    throw new Error(
      `Rapport VeraPDF incomplet : attribut ${elementName}.${attributeName} introuvable.`,
    );
  }

  return Number.parseInt(match[1], 10);
}

export function parseVeraPdfReport(xml: string): VeraPdfValidationResult {
  if (!xml.trim()) {
    throw new Error("Rapport VeraPDF vide.");
  }

  const validationReport = /<validationReport\b([^>]*)>/i.exec(xml);

  if (!validationReport) {
    throw new Error("Rapport VeraPDF invalide : validationReport introuvable.");
  }

  const complianceMatch = /\bisCompliant="(true|false)"/i.exec(
    validationReport[1],
  );

  if (!complianceMatch) {
    throw new Error(
      "Rapport VeraPDF invalide : attribut isCompliant introuvable.",
    );
  }

  const details = /<details\b([^>]*)>/i.exec(xml);

  if (!details) {
    throw new Error("Rapport VeraPDF invalide : détails introuvables.");
  }

  const readDetailsInteger = (attributeName: string): number => {
    const match = new RegExp(`\\b${attributeName}="(\\d+)"`).exec(details[1]);

    if (!match) {
      throw new Error(
        `Rapport VeraPDF incomplet : attribut details.${attributeName} introuvable.`,
      );
    }

    return Number.parseInt(match[1], 10);
  };

  const failedRules = readDetailsInteger("failedRules");
  const failedChecks = readDetailsInteger("failedChecks");
  const nonCompliantReports = readIntegerAttribute(
    xml,
    "validationReports",
    "nonCompliant",
  );
  const failedJobs = readIntegerAttribute(
    xml,
    "validationReports",
    "failedJobs",
  );
  const failedToParse = readIntegerAttribute(
    xml,
    "batchSummary",
    "failedToParse",
  );
  const veraExceptions = readIntegerAttribute(
    xml,
    "batchSummary",
    "veraExceptions",
  );

  const compliant =
    complianceMatch[1].toLowerCase() === "true" &&
    failedRules === 0 &&
    failedChecks === 0 &&
    nonCompliantReports === 0 &&
    failedJobs === 0 &&
    failedToParse === 0 &&
    veraExceptions === 0;

  return {
    compliant,
    failedRules,
    failedChecks,
    nonCompliantReports,
    failedJobs,
    failedToParse,
    veraExceptions,
  };
}