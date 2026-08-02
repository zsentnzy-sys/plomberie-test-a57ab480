/**
 * Qualification script — NOT part of the runtime.
 *
 * Generates a reference Factur-X invoice and validates it with the official
 * tooling (VeraPDF for PDF/A-3B, Mustangproject/Schematron for EN 16931).
 * Run it in the sandbox or CI before deploying a change to the invoicing
 * chain; the production Worker runtime cannot host a JVM.
 *
 *   bun run scripts/validate-facturx.ts
 *
 * Exit code 1 means the generated file is NOT compliant.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { renderDocumentPdf } from "../src/lib/documents.server";
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
import { computeTotals } from "../src/lib/documents.server";

const outDir = join(tmpdir(), "facturx-qualification");
mkdirSync(outDir, { recursive: true });

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
if (!rules.valid) {
  console.error("Règles EN 16931 non respectées :\n" + rules.errors.join("\n"));
  process.exit(1);
}

const xml = buildFacturxXml(structured);
const syntax = validateXmlSyntax(xml);
if (!syntax.valid) {
  console.error("XML mal formé :\n" + syntax.errors.join("\n"));
  process.exit(1);
}

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
  lines: lines.map((l) => ({
    type: l.type as "Service" | "Matériel" | "Taux horaire",
    description: l.description,
    unit_price_ht: l.unit_price_ht,
    quantity: l.quantity,
    tva: l.tva as 0 | 5.5 | 10 | 20,
  })),
  totals: computeTotals(
    lines.map((l) => ({
      type: l.type as "Service" | "Matériel" | "Taux horaire",
      description: l.description,
      unit_price_ht: l.unit_price_ht,
      quantity: l.quantity,
      tva: l.tva as 0 | 5.5 | 10 | 20,
    })),
  ),
  legal: ARTISAN_INFO.legal,
});

const hybrid = await toFacturxPdfA3(pdf, {
  invoiceNumber: row.invoice_number,
  producer: ARTISAN_INFO.company,
  xml,
});

const structure = await assertPdfA3Structure(hybrid);
if (!structure.valid) {
  console.error("Auto-contrôles PDF/A-3 en échec :\n" + structure.errors.join("\n"));
  process.exit(1);
}

const pdfPath = join(outDir, "reference.pdf");
const xmlPath = join(outDir, "factur-x.xml");
writeFileSync(pdfPath, hybrid);
writeFileSync(xmlPath, xml);
console.log(`Fichiers générés :\n  ${pdfPath}\n  ${xmlPath}`);

function run(cmd: string, args: string[]): boolean {
  try {
    const out = execFileSync(cmd, args, { encoding: "utf8" });
    console.log(out);
    return true;
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string; code?: string };
    if (e.code === "ENOENT") {
      console.warn(`⚠ ${cmd} indisponible : validation externe ignorée.`);
      return true;
    }
    console.error(e.stdout ?? "", e.stderr ?? "");
    return false;
  }
}

// VeraPDF : conformité PDF/A-3B. Mustangproject : Schematron EN 16931.
const veraOk = run("verapdf", ["-f", "3b", "--format", "text", pdfPath]);
const mustangOk = run("java", [
  "-jar",
  process.env["MUSTANG_JAR"] ?? "Mustang-CLI.jar",
  "--action",
  "validate",
  "--source",
  pdfPath,
]);

if (!veraOk || !mustangOk) {
  console.error("❌ Qualification Factur-X en échec.");
  process.exit(1);
}
console.log("✅ Qualification Factur-X réussie.");