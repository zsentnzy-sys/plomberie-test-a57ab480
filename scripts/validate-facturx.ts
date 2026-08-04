/**
 * Phase A qualification script — NOT part of the runtime.
 *
 * This file only performs system access (running tools, rendering the
 * reference invoice, reading/writing files). Every decision lives in
 * scripts/lib/qualification-core.ts, which is unit-tested.
 *
 *   bun run validate:facturx
 *
 * Exit code 1 means the Phase A checks did not pass. A success NEVER means the
 * generator is qualified: the official Factur-X XSD and the EN 16931
 * Schematron are not integrated yet (Phase B).
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PDFDocument } from "@cantoo/pdf-lib";

import {
  evaluateQualification,
  type ToolExecutionResult,
} from "./lib/qualification-core.js";

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
const referencePdfExists = existsSync(pdfPath);
const externalXml = existsSync(xmlPath)
  ? new Uint8Array(
      (await import("node:fs")).readFileSync(xmlPath) as unknown as ArrayBufferLike,
    )
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

console.log(`\n${result.summary.join("\n")}`);
console.log(
  `\nVersion de spécification implémentée : ${FACTURX_CONFIG.implementedSpecificationVersion} ` +
    `(cible Phase B : ${FACTURX_CONFIG.targetSpecificationVersion}).`,
);

process.exit(result.exitCode);