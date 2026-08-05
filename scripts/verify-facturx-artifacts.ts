import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  verifyArtifactFiles,
} from "../src/lib/facturx/validation/artifact-verifier";
import type {
  FacturxValidationArtifactManifest,
} from "../src/lib/facturx/validation/artifact-manifest";

const manifestPath = resolve(
    process.env.FACTURX_ARTIFACT_MANIFEST_PATH ?? 
        "src/lib/facturx/validation/1.09/manifest.json",
);

let manifest: FacturxValidationArtifactManifest;

try {
  manifest = JSON.parse(
    readFileSync(manifestPath, "utf8"),
  ) as FacturxValidationArtifactManifest;
} catch (error) {
  console.error(
    "Factur-X artifact manifest: FAIL",
  );
  console.error(
    error instanceof Error
      ? error.message
      : String(error),
  );
  process.exit(1);
}

const result = verifyArtifactFiles({
  manifest,
  manifestPath,
});

console.log("--- Factur-X validation artifacts ---");
console.log(
  `Factur-X version: ${manifest.facturxVersion}`,
);
console.log(
  `ZUGFeRD version: ${manifest.zugferdVersion}`,
);
console.log(`Profile: ${manifest.profile}`);
console.log(
  `Installed: ${result.installed ? "YES" : "NO"}`,
);
console.log(
  `Checked artifacts: ${result.checkedArtifacts}`,
);

if (!result.installed) {
  console.log(
    "Validation artifacts: NOT INSTALLED",
  );
  console.log(
    "Generator qualification: UNQUALIFIED",
  );
  process.exit(0);
}

if (!result.valid) {
  console.error(
    "Validation artifact verification: FAIL",
  );

  for (const error of result.errors) {
    console.error(`- ${error}`);
  }

  process.exit(1);
}

console.log(
  "Validation artifact verification: PASS",
);
console.log(
  "Generator qualification: UNQUALIFIED",
);