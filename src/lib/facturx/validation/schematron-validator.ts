import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { XMLParser } from "fast-xml-parser";

export interface SchematronAssertion {
  id: string;
  flag: string | null;
  location: string | null;
  message: string;
  blocking: boolean;
}

export interface SchematronValidationResult {
  valid: boolean;
  available: boolean;
  exitCode: number | null;

  xmlPath: string;
  xsltPath: string;
  saxonJarPath: string;

  assertions: SchematronAssertion[];
  blockingAssertions: SchematronAssertion[];
  warnings: SchematronAssertion[];

  stdout: string;
  stderr: string;
  errors: string[];
}

export interface ValidateXmlWithSchematronOptions {
  xmlPath: string;
  xsltPath: string;
  saxonJarPath?: string;
  javaExecutable?: string;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value)
    ? value
    : [value];
}

function normalizeMessage(value: unknown): string {
  if (typeof value === "string") {
    return value.replace(/\s+/g, " ").trim();
  }

  if (
    value !== null &&
    typeof value === "object" &&
    "#text" in value
  ) {
    return String(
      (value as Record<string, unknown>)["#text"] ?? "",
    )
      .replace(/\s+/g, " ")
      .trim();
  }

  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSvrl(
  svrlContent: string,
): SchematronAssertion[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
    textNodeName: "#text",
    trimValues: true,
  });

  const parsed = parser.parse(svrlContent) as {
    "schematron-output"?: {
      "failed-assert"?: unknown;
    };
  };

  const rawAssertions = asArray(
    parsed["schematron-output"]?.["failed-assert"],
  );

  return rawAssertions.map((raw) => {
    const assertion = raw as Record<string, unknown>;

    const id = String(
      assertion["@_id"] ?? "UNKNOWN",
    );

    const rawFlag = assertion["@_flag"];
    const flag =
      rawFlag === undefined
        ? null
        : String(rawFlag);

    const location =
      assertion["@_location"] === undefined
        ? null
        : String(assertion["@_location"]);

    const message = normalizeMessage(
      assertion.text,
    );

    const blocking =
      flag?.toLowerCase() !== "warning";

    return {
      id,
      flag,
      location,
      message,
      blocking,
    };
  });
}

export function validateXmlWithSchematron(
  options: ValidateXmlWithSchematronOptions,
): SchematronValidationResult {
  const xmlPath = resolve(options.xmlPath);
  const xsltPath = resolve(options.xsltPath);

  const saxonJarPath = resolve(
    options.saxonJarPath ??
      process.env.SAXON_JAR ??
      "/usr/share/java/Saxon-HE.jar",
  );

  const javaExecutable =
    options.javaExecutable ?? "java";

  const initialErrors: string[] = [];

  if (!existsSync(xmlPath)) {
    initialErrors.push(
      `XML document does not exist: ${xmlPath}`,
    );
  }

  if (!existsSync(xsltPath)) {
    initialErrors.push(
      `Schematron XSLT does not exist: ${xsltPath}`,
    );
  }

  if (!existsSync(saxonJarPath)) {
    initialErrors.push(
      `Saxon JAR does not exist: ${saxonJarPath}`,
    );
  }

  if (initialErrors.length > 0) {
    return {
      valid: false,
      available: true,
      exitCode: null,
      xmlPath,
      xsltPath,
      saxonJarPath,
      assertions: [],
      blockingAssertions: [],
      warnings: [],
      stdout: "",
      stderr: "",
      errors: initialErrors,
    };
  }

  const directory = mkdtempSync(
    join(tmpdir(), "facturx-schematron-"),
  );

  const svrlPath = join(
    directory,
    "report.svrl.xml",
  );

  try {
    const execution = spawnSync(
      javaExecutable,
      [
        "-cp",
        saxonJarPath,
        "net.sf.saxon.Transform",
        `-s:${xmlPath}`,
        `-xsl:${xsltPath}`,
        `-o:${svrlPath}`,
      ],
      {
        encoding: "utf8",
      },
    );

    if (execution.error) {
      const unavailable =
        "code" in execution.error &&
        execution.error.code === "ENOENT";

      return {
        valid: false,
        available: !unavailable,
        exitCode: null,
        xmlPath,
        xsltPath,
        saxonJarPath,
        assertions: [],
        blockingAssertions: [],
        warnings: [],
        stdout: execution.stdout ?? "",
        stderr: execution.stderr ?? "",
        errors: [
          unavailable
            ? `${javaExecutable} is not available.`
            : execution.error.message,
        ],
      };
    }

    const stdout = execution.stdout ?? "";
    const stderr = execution.stderr ?? "";
    const exitCode = execution.status;

    if (
      exitCode !== 0 ||
      !existsSync(svrlPath)
    ) {
      return {
        valid: false,
        available: true,
        exitCode,
        xmlPath,
        xsltPath,
        saxonJarPath,
        assertions: [],
        blockingAssertions: [],
        warnings: [],
        stdout,
        stderr,
        errors: [
          ...stdout
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean),
          ...stderr
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean),
          ...(!existsSync(svrlPath)
            ? ["SVRL report was not generated."]
            : []),
        ],
      };
    }

    const assertions = parseSvrl(
      readFileSync(svrlPath, "utf8"),
    );

    const blockingAssertions =
      assertions.filter(
        (assertion) => assertion.blocking,
      );

    const warnings = assertions.filter(
      (assertion) => !assertion.blocking,
    );

    return {
      valid: blockingAssertions.length === 0,
      available: true,
      exitCode,
      xmlPath,
      xsltPath,
      saxonJarPath,
      assertions,
      blockingAssertions,
      warnings,
      stdout,
      stderr,
      errors: blockingAssertions.map(
        (assertion) =>
          `${assertion.id}: ${assertion.message}`,
      ),
    };
  } finally {
    rmSync(directory, {
      recursive: true,
      force: true,
    });
  }
}