/**
 * Phase A qualification script — NOT part of the runtime.
 *
 * Runs the structural checks that CAN be demonstrated today and fails loudly
 * when a required tool is missing. It NEVER concludes that the generator is
 * qualified: the official Factur-X XSD and the EN 16931 Schematron are not
 * integrated yet (Phase B).
 *
 *   bun run validate:facturx
 *
 * Exit code 1 means the Phase A checks did not pass.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PDFDocument } from "@cantoo/pdf-lib";

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

type StepResult = "PASS" | "FAIL" | "NOT IMPLEMENTED";
const results: Array<[string, StepResult]> = [];
const toolVersions: string[] = [];

function record(step: string, result: StepResult) {
  results.push([step, result]);
  return result;
}

function fatal(step: string, detail: string): never {
  record(step, "FAIL");
  console.error(`\n${step} : ${detail}`);
  report();
  process.exit(1);
}

function report(): void {
  console.log("\n--- Résumé Phase A ---");
  for (const [step, result] of results) console.log(`${step}: ${result}`);
  console.log("XSD Factur-X 1.09: NOT IMPLEMENTED");
  console.log("Schematron EN 16931: NOT IMPLEMENTED");
  console.log("Generator qualification: UNQUALIFIED");
  for (const v of toolVersions) console.log(v);
}

/** Runs a required external tool. A missing binary is a hard failure. */
function runRequired(step: string, cmd: string, args: string[]): void {
  try {
    const out = execFileSync(cmd, args, { encoding: "utf8" });
    console.log(out);
    record(step, "PASS");
  } catch (err) {
    const e = err as { code?: string; stdout?: string; stderr?: string };
    if (e.code === "ENOENT") {
      fatal(step, `${cmd} est obligatoire pour cette vérification et n'est pas installé.`);
    }
    console.error(e.stdout ?? "", e.stderr ?? "");
    fatal(step, `${cmd} a signalé une non-conformité.`);
  }
}

function toolVersion(cmd: string, args: string[]): void {
  try {
    const out = execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    toolVersions.push(`${cmd} version: ${out.split("\n")[0]?.trim() || "inconnue"}`);
  } catch (err) {
    const e = err as { code?: string; stderr?: string };
    if (e.code === "ENOENT") {
      fatal(`${cmd} availability`, `${cmd} est obligatoire et n'est pas installé.`);
    }
    const line = (e.stderr ?? "").split("\n")[0]?.trim();
    toolVersions.push(`${cmd} version: ${line || "inconnue"}`);
  }
}

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes as never).digest("hex");
}

const outDir = join(tmpdir(), "facturx-qualification");
mkdirSync(outDir, { recursive: true });

// Required tooling is checked BEFORE any work, so a missing binary fails fast.
toolVersion("verapdf", ["--version"]);
toolVersion("java", ["-version"]);

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

const rules = validateStructuredInvoice(structured);
if (!rules.valid) fatal("Internal business rules", rules.errors.join(" | "));
record("Internal business rules", "PASS");

const xml = buildFacturxXml(structured);
const syntax = validateXmlSyntax(xml);
if (!syntax.valid) fatal("XML well-formedness", syntax.errors.join(" | "));
record("XML well-formedness", "PASS");

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

const structure = await assertPdfA3Structure(hybrid);
if (!structure.valid) fatal("Internal PDF/A-3 self-checks", structure.errors.join(" | "));
record("Internal PDF/A-3 self-checks", "PASS");

const pdfPath = join(outDir, "reference.pdf");
const xmlPath = join(outDir, "factur-x.xml");
writeFileSync(pdfPath, hybrid);
writeFileSync(xmlPath, xml);
if (!existsSync(pdfPath) || !existsSync(xmlPath)) {
  fatal("Reference invoice", "la facture de référence n'a pas été écrite sur le disque.");
}
console.log(`Fichiers générés :\n  ${pdfPath}\n  ${xmlPath}`);

// --- Embedded XML extraction & consistency -------------------------------
const reloaded = await PDFDocument.load(hybrid, { updateMetadata: false });
const attachments = (await reloaded.getAttachments?.()) ?? [];
const embedded = attachments.find((a) => a.name === FACTURX_CONFIG.attachmentFileName);
if (!embedded?.data) {
  fatal("Embedded XML extraction", "impossible d'extraire factur-x.xml du PDF généré.");
}
record("Embedded XML extraction", "PASS");

const generatedHash = sha256(new TextEncoder().encode(xml));
const embeddedHash = sha256(new Uint8Array(embedded.data as unknown as ArrayBufferLike));
if (generatedHash !== embeddedHash) {
  fatal(
    "Embedded XML consistency",
    `empreintes différentes (généré ${generatedHash.slice(0, 12)}… / embarqué ${embeddedHash.slice(0, 12)}…).`,
  );
}
record("Embedded XML consistency", "PASS");

// --- PDF/A-3B conformance (VeraPDF, obligatoire) -------------------------
runRequired("PDF/A-3B VeraPDF", "verapdf", [
  "-f",
  "3b",
  "--format",
  "text",
  pdfPath,
]);

report();
console.log(
  "\nVérifications Phase A réussies.\n" +
    "Le générateur reste NON QUALIFIÉ tant que les validations officielles XSD " +
    "et Schematron EN 16931 ne sont pas intégrées (Phase B).\n" +
    `Version de spécification implémentée : ${FACTURX_CONFIG.implementedSpecificationVersion} ` +
    `(cible Phase B : ${FACTURX_CONFIG.targetSpecificationVersion}).`,
);