import { describe, expect, it } from "vitest";

import { parseVeraPdfReport } from "./verapdf-report";

const compliantReport = `<?xml version="1.0" encoding="utf-8"?>
<report>
  <jobs>
    <job>
      <validationReport
        profileName="PDF/A-3b validation profile"
        isCompliant="true">
        <details
          passedRules="120"
          failedRules="0"
          passedChecks="500"
          failedChecks="0">
        </details>
      </validationReport>
    </job>
  </jobs>
  <batchSummary
    totalJobs="1"
    failedToParse="0"
    encrypted="0"
    outOfMemory="0"
    veraExceptions="0">
    <validationReports
      compliant="1"
      nonCompliant="0"
      failedJobs="0">1</validationReports>
  </batchSummary>
</report>`;

describe("parseVeraPdfReport", () => {
  it("accepts an explicitly compliant VeraPDF report", () => {
    expect(parseVeraPdfReport(compliantReport)).toEqual({
      compliant: true,
      failedRules: 0,
      failedChecks: 0,
      nonCompliantReports: 0,
      failedJobs: 0,
      failedToParse: 0,
      veraExceptions: 0,
    });
  });

  it("rejects a report containing failed validation checks", () => {
    const report = compliantReport
      .replace('isCompliant="true"', 'isCompliant="false"')
      .replace('failedRules="0"', 'failedRules="1"')
      .replace('failedChecks="0"', 'failedChecks="3"')
      .replace('compliant="1"', 'compliant="0"')
      .replace('nonCompliant="0"', 'nonCompliant="1"');

    const result = parseVeraPdfReport(report);

    expect(result.compliant).toBe(false);
    expect(result.failedRules).toBe(1);
    expect(result.failedChecks).toBe(3);
    expect(result.nonCompliantReports).toBe(1);
  });

  it("rejects a report containing a failed job", () => {
    const report = compliantReport.replace(
      'failedJobs="0"',
      'failedJobs="1"',
    );

    expect(parseVeraPdfReport(report).compliant).toBe(false);
  });

  it("rejects a report that VeraPDF could not parse", () => {
    const report = compliantReport.replace(
      'failedToParse="0"',
      'failedToParse="1"',
    );

    expect(parseVeraPdfReport(report).compliant).toBe(false);
  });

  it("throws when the report does not contain a validation result", () => {
    expect(() => parseVeraPdfReport("<report></report>")).toThrow(
      /validationReport introuvable/,
    );
  });

  it("throws when the report is empty", () => {
    expect(() => parseVeraPdfReport("")).toThrow(/vide/);
  });
});