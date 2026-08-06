import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories) {
    rmSync(directory, {
      recursive: true,
      force: true,
    });
  }

  temporaryDirectories.length = 0;
});

describe("inventory-facturx-package CLI", () => {
  it("inventorie les fichiers sans les modifier", () => {
    const directory = mkdtempSync(
      join(tmpdir(), "facturx-inventory-"),
    );

    temporaryDirectories.push(directory);

    const schemasDirectory = join(
      directory,
      "Schemas",
    );

    mkdirSync(schemasDirectory);

    writeFileSync(
      join(schemasDirectory, "invoice.xsd"),
      "<schema/>",
    );

    writeFileSync(
      join(directory, "README.txt"),
      "official package",
    );

    const result = spawnSync(
      "bun",
      [
        "scripts/inventory-facturx-package.ts",
        directory,
      ],
      {
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "Files: 2",
    );
    expect(result.stdout).toContain(
      '"path": "README.txt"',
    );
    expect(result.stdout).toContain(
      '"path": "Schemas/invoice.xsd"',
    );
    expect(result.stdout).toMatch(
      /"sha256": "[a-f0-9]{64}"/,
    );
  });

  it("échoue quand le dossier source est absent", () => {
    const result = spawnSync(
      "bun",
      [
        "scripts/inventory-facturx-package.ts",
        "/directory/that/does/not/exist",
      ],
      {
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "Source directory does not exist",
    );
  });
});