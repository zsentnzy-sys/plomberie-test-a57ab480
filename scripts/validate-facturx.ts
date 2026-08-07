/**
 * End-to-end Factur-X generator qualification script.
 *
 * This script validates a real generated hybrid invoice through:
 * - internal structured-invoice checks
 * - PDF/A-3 structural checks
 * - embedded XML extraction and consistency
 * - visible PDF / structured-data consistency
 * - official Factur-X EN16931 XSD
 * - official EN16931 Schematron
 * - veraPDF PDF/A-3B validation
 *
 *   bun run validate:facturx
 *
 * Exit code 0 means the reference generator pipeline passed every
 * qualification step.
 * Exit code 1 means qualification failed.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { PDFDocument } from "@cantoo/pdf-lib";

import {
  evaluateQualification,
  type ToolExecutionResult,
} from "./lib/qualification-core.js";

import { validateXmlWithSchematron } from "../src/lib/facturx/validation/schematron-validator.js"
import { validateXmlWithXsd } from "../src/lib/facturx/validation/xsd-validator.js"
import { validatePdfXmlConsistency } from "./lib/pdf-xml-consistency.js";

import { renderDocumentPdf, computeTotals } from "../src/lib/documents.server";
import { ARTISAN_INFO } from "../src/lib/artisan.server";
import { buildStructuredInvoice } from "../src/lib/facturx/structured-invoice.server";
import {
  buildFacturxXml,
  validateStructuredInvoice,
  validateXmlSyntax,
} from "../src/lib/facturx/facturx-xml.server";
import {
  assertPdfA3Structure,
  toFacturxPdfA3,
} from "../src/lib/facturx/facturx-pdfa.server";
import { FACTURX_CONFIG } from "../src/lib/facturx/facturx-config.server";

function runTool(cmd: string, args: string[]): ToolExecutionResult {
  const execution = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (execution.error) {
    const code = (execution.error as NodeJS.ErrnoException).code;
    return {
      available: false,
      exitCode: null,
      stdout: "",
      stderr: "",
      errorMessage:
        code === "ENOENT"
          ? `${cmd} est obligatoire pour cette vérification et n'est pas installé.`
          : `impossible d'exécuter ${cmd} : ${execution.error.message}`,
    };
  }

  return {
    available: true,
    exitCode: execution.status,
    stdout: execution.stdout ?? "",
    stderr: execution.stderr ?? "",
  };
}

const outDir = join(tmpdir(), "facturx-qualification");
mkdirSync(outDir, { recursive: true });

const java = runTool("java", ["-version"]);
const verapdfVersion = runTool("verapdf", ["--version"]);

const lines = [
  {
    position: 1,
    type: "Taux horaire",
    description: "Dépannage plomberie — recherche de fuite",
    unit_price_ht: 65,
    quantity: 2,
    tva: 20,
  },
  {
    position: 2,
    type: "Matériel",
    description: "Mitigeur thermostatique",
    unit_price_ht: 129.9,
    quantity: 1,
    tva: 10,
  },
];

const row = {
  invoice_number: "FACT-2026-9999",
  invoice_date: "2026-01-15",
  payment_method: "Virement bancaire",
  client_name: "Entreprise Témoin SARL",
  client_address: "5 avenue de la Gare\n57000 Metz",
  client_email: "compta@exemple.fr",
  client_phone: "+33 3 87 00 00 00",
  total_ht: 259.9,
  total_tva: 38.99,
  total_ttc: 298.89,
  customer_type: "company",
  customer_siren: "123456789",
  customer_siret: "12345678900012",
  customer_country_code: "FR",
  vat_on_debits: true,
  payment_due_date: "2026-02-15",
};

const structured = buildStructuredInvoice({ row, lines, artisan: ARTISAN_INFO });
const businessRules = validateStructuredInvoice(structured);
const xml = buildFacturxXml(structured);
const xmlSyntax = validateXmlSyntax(xml);

const typedLines = lines.map((l) => ({
  type: l.type as "Service" | "Matériel" | "Taux horaire",
  description: l.description,
  unit_price_ht: l.unit_price_ht,
  quantity: l.quantity,
  tva: l.tva as 0 | 5.5 | 10 | 20,
}));

const pdf = await renderDocumentPdf({
  title: "FACTURE",
  documentNumber: row.invoice_number,
  artisan: ARTISAN_INFO,
  client: {
    name: row.client_name,
    address: row.client_address,
    email: row.client_email,
    phone: row.client_phone,
  },
  clientBlockLabel: "Facturé à",
  metaLines: [`Date : 15/01/2026`, `Paiement : ${row.payment_method}`],
  lines: typedLines,
  totals: computeTotals(typedLines),
  legal: ARTISAN_INFO.legal,
});

const hybrid = await toFacturxPdfA3(pdf, {
  invoiceNumber: row.invoice_number,
  producer: ARTISAN_INFO.company,
  xml,
});

const pdfA3SelfChecks = await assertPdfA3Structure(hybrid);

const pdfPath = join(outDir, "reference.pdf");
const xmlPath = join(outDir, "factur-x.xml");
const veraPdfReportPath = join(outDir, "verapdf-report.xml");
const generatedXmlBytes = new TextEncoder().encode(xml);

writeFileSync(pdfPath, hybrid);
writeFileSync(xmlPath, generatedXmlBytes);
const pdfTextRun = runTool(
  "pdftotext",
  [
    "-layout",
    pdfPath,
    "-",
  ],
);
const pdfXmlConsistency =
  pdfTextRun.available &&
  pdfTextRun.exitCode === 0
    ? validatePdfXmlConsistency({
        pdfText:
          pdfTextRun.stdout ?? "",

        invoiceNumber:
          structured.invoiceNumber,

        buyerName:
          structured.buyer.name,

        totalHt:
          `${(
            structured.totals
              .lineTotalCents / 100
          )
            .toFixed(2)
            .replace(".", ",")} EUR`,

        totalTva:
          `${(
            structured.totals
              .taxTotalCents / 100
          )
            .toFixed(2)
            .replace(".", ",")} EUR`,

        totalTtc:
          `${(
            structured.totals
              .grandTotalCents / 100
          )
            .toFixed(2)
            .replace(".", ",")} EUR`,

        lines:
          structured.lines.map(
            (line) => ({
              description:
                line.description,
              vatRate:
                line.vatRate,
            }),
          ),
      })
    : {
        valid: false,
        errors: [
          pdfTextRun.available
            ? `pdftotext a échoué avec le code ${pdfTextRun.exitCode}.`
            : "pdftotext n'est pas installé.",
        ],
      };
const referencePdfExists = existsSync(pdfPath);
const externalXml = existsSync(xmlPath)
  ? new Uint8Array(readFileSync(xmlPath))
  : undefined;

// --- Embedded XML extraction ---------------------------------------------
const reloaded = await PDFDocument.load(hybrid, { updateMetadata: false });
const attachments = (await reloaded.getAttachments?.()) ?? [];
const embedded = attachments.find(
  (a) => a.name === FACTURX_CONFIG.attachmentFileName,
);
const embeddedXml = embedded?.data
  ? new Uint8Array(embedded.data as unknown as ArrayBufferLike)
  : undefined;

const embeddedXmlPath = join(outDir, "factur-x-extracted.xml");
if (embeddedXml) {
  writeFileSync(embeddedXmlPath, embeddedXml);
}

const xsdResult = embeddedXml
  ? validateXmlWithXsd({
      xmlPath: embeddedXmlPath,
      schemaPath: resolve("src/lib/facturx/validation/1.09/artifacts/en16931/Factur-X_1.09.2_EN16931.xsd"),
    })
  : null;

const xsdValidation = xsdResult
  ? {
      valid:
        xsdResult.available && 
        xsdResult.valid &&
        xsdResult.exitCode === 0,
      errors: xsdResult.errors,
    }
  : { valid: false, errors: ["XML embarqué indisponible pour validation XSD."] };

const schematronResult = embeddedXml
    ? validateXmlWithSchematron({
      xmlPath: embeddedXmlPath,
      xsltPath: resolve("src/lib/facturx/validation/1.09/artifacts/en16931/xslt/FACTUR-X_EN16931.xslt"),
    })
  : null;

const schematronValidation = schematronResult
    ? {
        valid:
          schematronResult.available &&
          schematronResult.valid &&
          schematronResult.exitCode === 0,
        errors:
          schematronResult.blockingAssertions.map((assertion) => `${assertion.id}: ${assertion.message}`)
    }
  : {
    valide: false,
    errors: [
      "XML embarqué indisponible pour validation Schematron."
    ],
  };

const schematronWarnings =
  schematronResult?.warnings.map(
    (warning) =>
      `${warning.id}: ${warning.message}`,
  ) ?? [];

// --- veraPDF -------------------------------------------------------------
let veraPdfRun: ToolExecutionResult = verapdfVersion;
let veraPdfReportXml = "";

if (verapdfVersion.available) {
  veraPdfRun = runTool("verapdf", [
    "-f",
    "3b",
    "--format",
    "xml",
    "--loglevel",
    "1",
    pdfPath,
  ]);
  veraPdfReportXml = veraPdfRun.stdout ?? "";
  writeFileSync(veraPdfReportPath, veraPdfReportXml, "utf8");
  writeFileSync(`${veraPdfReportPath}.log`, veraPdfRun.stderr ?? "", "utf8");
}

const result = evaluateQualification({
  java,
  verapdf: veraPdfRun,
  businessRules,
  xmlSyntax,
  pdfA3SelfChecks,
  pdfXmlConsistency,
  xsdValidation,
  schematronValidation,
  schematronWarnings,
  referencePdfExists,
  veraPdfReportXml,
  generatedXml: generatedXmlBytes,
  externalXml,
  embeddedXml,
});

console.log(`Fichiers générés :\n  ${pdfPath}\n  ${xmlPath}`);
if (java.available) {
  console.log(`java version: ${(java.stderr ?? "").split("\n")[0]?.trim()}`);
}
if (verapdfVersion.available) {
  console.log(
    `verapdf version: ${(verapdfVersion.stdout ?? "").split("\n")[0]?.trim()}`,
  );
}
if (schematronWarnings.length > 0) {
  console.log(
    "\n--- Schematron warnings ---",
  );

  for (const warning of schematronWarnings) {
    console.log(`- ${warning}`);
  }
}

console.log(`\n${result.summary.join("\n")}`);
console.log(
  `\nFactur-X ${FACTURX_CONFIG.implementedSpecificationVersion} ` +
    `— artefacts de validation ${FACTURX_CONFIG.validationArtifactsVersion}.`,
);

process.exit(result.exitCode);