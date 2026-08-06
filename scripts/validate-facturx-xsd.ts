import { resolve } from "node:path";

import {
  validateXmlWithXsd,
} from "../src/lib/facturx/validation/xsd-validator";

const defaultSchemaPath = resolve(
  "src/lib/facturx/validation/1.09/artifacts/en16931/Factur-X_1.09.2_EN16931.xsd",
);

const xmlArgument = process.argv[2];

if (!xmlArgument) {
  console.error(
    "Usage: bun scripts/validate-facturx-xsd.ts <invoice.xml>",
  );
  process.exit(2);
}

const xmlPath = resolve(xmlArgument);

const result = validateXmlWithXsd({
  schemaPath: defaultSchemaPath,
  xmlPath,
});

console.log("--- Factur-X XSD validation ---");
console.log("Artifact version: Factur-X 1.09.2");
console.log("Profile: EN16931");
console.log(`Schema: ${result.schemaPath}`);
console.log(`XML: ${result.xmlPath}`);
console.log(
  `xmllint available: ${
    result.available ? "YES" : "NO"
  }`,
);

if (!result.available) {
  console.error("XSD validation: NOT AVAILABLE");

  for (const error of result.errors) {
    console.error(`- ${error}`);
  }

  process.exit(1);
}

if (!result.valid) {
  console.error("XSD validation: FAIL");

  for (const error of result.errors) {
    console.error(`- ${error}`);
  }

  process.exit(1);
}

console.log("XSD validation: PASS");