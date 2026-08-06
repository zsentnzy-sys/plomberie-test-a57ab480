import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  validateXmlWithXsd,
} from "../validation/xsd-validator";

const temporaryDirectories: string[] = [];

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(
    join(tmpdir(), "facturx-xsd-"),
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

describe("validateXmlWithXsd", () => {
  it("accepte un XML conforme à un XSD simple", () => {
    const directory = createTemporaryDirectory();

    const schemaPath = join(
      directory,
      "schema.xsd",
    );

    const xmlPath = join(
      directory,
      "valid.xml",
    );

    writeFileSync(
      schemaPath,
      `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema
  xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="invoice">
    <xs:complexType>
      <xs:sequence>
        <xs:element
          name="number"
          type="xs:string"
        />
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>`,
    );

    writeFileSync(
      xmlPath,
      `<?xml version="1.0" encoding="UTF-8"?>
<invoice>
  <number>FACT-2026-0001</number>
</invoice>`,
    );

    const result = validateXmlWithXsd({
      schemaPath,
      xmlPath,
    });

    expect(result.available).toBe(true);
    expect(result.valid).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it("refuse un XML qui ne respecte pas le XSD", () => {
    const directory = createTemporaryDirectory();

    const schemaPath = join(
      directory,
      "schema.xsd",
    );

    const xmlPath = join(
      directory,
      "invalid.xml",
    );

    writeFileSync(
      schemaPath,
      `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema
  xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="invoice">
    <xs:complexType>
      <xs:sequence>
        <xs:element
          name="number"
          type="xs:string"
        />
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>`,
    );

    writeFileSync(
      xmlPath,
      `<?xml version="1.0" encoding="UTF-8"?>
<invoice />`,
    );

    const result = validateXmlWithXsd({
      schemaPath,
      xmlPath,
    });

    expect(result.available).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("refuse la fixture vide avec le XSD officiel EN16931", () => {
    const result = validateXmlWithXsd({
      schemaPath: resolve(
        "src/lib/facturx/validation/1.09/artifacts/en16931/Factur-X_1.09.2_EN16931.xsd",
      ),
      xmlPath: resolve(
        "src/lib/facturx/validation/fixtures/invalid-empty-invoice.xml",
      ),
    });

    expect(result.available).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("signale clairement que xmllint est absent", () => {
    const directory = createTemporaryDirectory();

    const schemaPath = join(
      directory,
      "schema.xsd",
    );

    const xmlPath = join(
      directory,
      "invoice.xml",
    );

    writeFileSync(
      schemaPath,
      `<?xml version="1.0"?>
<xs:schema
  xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element
    name="invoice"
    type="xs:string"
  />
</xs:schema>`,
    );

    writeFileSync(
      xmlPath,
      "<invoice>test</invoice>",
    );

    const result = validateXmlWithXsd({
      schemaPath,
      xmlPath,
      executable:
        "xmllint-command-that-does-not-exist",
    });

    expect(result.available).toBe(false);
    expect(result.valid).toBe(false);
    expect(result.exitCode).toBeNull();
    expect(result.errors).toContain(
      "xmllint-command-that-does-not-exist is not available.",
    );
  });

  it("refuse un chemin XML absent avant exécution", () => {
    const directory = createTemporaryDirectory();

    const schemaPath = join(
      directory,
      "schema.xsd",
    );

    writeFileSync(
      schemaPath,
      `<?xml version="1.0"?>
<xs:schema
  xmlns:xs="http://www.w3.org/2001/XMLSchema" />`,
    );

    const missingXmlPath = join(
      directory,
      "missing.xml",
    );

    const result = validateXmlWithXsd({
      schemaPath,
      xmlPath: missingXmlPath,
    });

    expect(result.valid).toBe(false);
    expect(result.exitCode).toBeNull();
    expect(result.errors).toContain(
      `XML document does not exist: ${missingXmlPath}`,
    );
  });
});