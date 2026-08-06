import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export interface XsdValidationResult {
  valid: boolean;
  available: boolean;
  exitCode: number | null;
  schemaPath: string;
  xmlPath: string;
  stdout: string;
  stderr: string;
  errors: string[];
}

export interface ValidateXmlWithXsdOptions {
  xmlPath: string;
  schemaPath: string;
  executable?: string;
}

function normalizeOutput(
  stdout: string,
  stderr: string,
): string[] {
  return `${stdout}\n${stderr}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function validateXmlWithXsd(
  options: ValidateXmlWithXsdOptions,
): XsdValidationResult {
  const xmlPath = resolve(options.xmlPath);
  const schemaPath = resolve(options.schemaPath);
  const executable = options.executable ?? "xmllint";

  const initialErrors: string[] = [];

  if (!existsSync(schemaPath)) {
    initialErrors.push(
      `XSD schema does not exist: ${schemaPath}`,
    );
  }

  if (!existsSync(xmlPath)) {
    initialErrors.push(
      `XML document does not exist: ${xmlPath}`,
    );
  }

  if (initialErrors.length > 0) {
    return {
      valid: false,
      available: true,
      exitCode: null,
      schemaPath,
      xmlPath,
      stdout: "",
      stderr: "",
      errors: initialErrors,
    };
  }

  const execution = spawnSync(
    executable,
    [
      "--noout",
      "--nonet",
      "--schema",
      schemaPath,
      xmlPath,
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
      schemaPath,
      xmlPath,
      stdout: execution.stdout ?? "",
      stderr: execution.stderr ?? "",
      errors: [
        unavailable
          ? `${executable} is not available.`
          : execution.error.message,
      ],
    };
  }

  const stdout = execution.stdout ?? "";
  const stderr = execution.stderr ?? "";
  const exitCode = execution.status;

  return {
    valid: exitCode === 0,
    available: true,
    exitCode,
    schemaPath,
    xmlPath,
    stdout,
    stderr,
    errors:
      exitCode === 0
        ? []
        : normalizeOutput(stdout, stderr),
  };
}