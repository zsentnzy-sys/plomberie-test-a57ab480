import {
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

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(
    join(tmpdir(), "facturx-cli-"),
  );

  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories) {
    rmSync(directory, {
      recursive: true,
      force: true,
    });
  }

  temporaryDirectories.length = 0;
});

describe("verify-facturx-artifacts CLI", () => {
  it("sort avec le code 0 quand les artefacts ne sont pas encore installés", () => {
    const directory = createTemporaryDirectory();
    const manifestPath = join(
      directory,
      "manifest.json",
    );

    writeFileSync(
      manifestPath,
      JSON.stringify({
        manifestVersion: 1,
        facturxVersion: "1.09",
        zugferdVersion: "2.5",
        syntax: "UN/CEFACT CII D22B",
        profile: "EN16931",
        publisher: "FNFE-MPE / FeRD",
        releaseDate: "2026-06-10",
        source: "Official package",
        installed: false,
        artifacts: [],
      }),
    );

    const result = spawnSync(
      "bun",
      ["scripts/verify-facturx-artifacts.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          FACTURX_ARTIFACT_MANIFEST_PATH:
            manifestPath,
        },
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "Validation artifacts: NOT INSTALLED",
    );
    expect(result.stdout).toContain(
      "Generator qualification: UNQUALIFIED",
    );
  });

  it("sort avec le code 1 quand un artefact déclaré est absent", () => {
    const directory = createTemporaryDirectory();
    const manifestPath = join(
      directory,
      "manifest.json",
    );

    writeFileSync(
      manifestPath,
      JSON.stringify({
        manifestVersion: 1,
        facturxVersion: "1.09",
        zugferdVersion: "2.5",
        syntax: "UN/CEFACT CII D22B",
        profile: "EN16931",
        publisher: "FNFE-MPE / FeRD",
        releaseDate: "2026-06-10",
        source: "Official package",
        installed: true,
        artifacts: [
          {
            path: "artifacts/missing.xsd",
            kind: "xsd",
            sha256: "a".repeat(64),
            profiles: ["EN16931"],
          },
        ],
      }),
    );

    const result = spawnSync(
      "bun",
      ["scripts/verify-facturx-artifacts.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          FACTURX_ARTIFACT_MANIFEST_PATH:
            manifestPath,
        },
      },
    );

    expect(result.status).toBe(1);

    const output =
      `${result.stdout}\n${result.stderr}`;

    expect(output).toContain(
      "Validation artifact verification: FAIL",
    );

    expect(output).toContain(
      "Missing artifact: artifacts/missing.xsd",
    );
  });
});