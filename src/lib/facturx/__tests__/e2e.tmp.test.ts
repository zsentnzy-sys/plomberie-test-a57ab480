import { describe, expect, it } from "vitest";
import { ARTISAN_INFO } from "@/lib/artisan.server";
import { buildStructuredInvoice } from "@/lib/facturx/structured-invoice.server";
import { buildFacturxXml } from "@/lib/facturx/facturx-xml.server";
import { toFacturxPdfA3, assertPdfA3Structure } from "@/lib/facturx/facturx-pdfa.server";
import { renderDocumentPdf, computeTotals } from "@/lib/documents.server";

it("produces a hybrid pdf", async () => {
  const lines = [{ position:1, type:"Matériel", description:"Mitigeur", unit_price_ht:129.9, quantity:1, tva:10 }];
  const row:any = { invoice_number:"FACT-2026-0001", invoice_date:"2026-01-15", payment_method:"Virement bancaire",
    client_name:"Client SARL", client_address:"5 avenue de la Gare\n57000 Metz", client_email:"c@e.fr",
    total_ht:129.9, total_tva:12.99, total_ttc:142.89, customer_type:"company", customer_siren:"123456789", customer_country_code:"FR" };
  const data = buildStructuredInvoice({ row, lines: lines as any, artisan: ARTISAN_INFO });
  const xml = buildFacturxXml(data);
  const dl = lines.map(l=>({type:l.type as any,description:l.description,unit_price_ht:l.unit_price_ht,quantity:l.quantity,tva:l.tva as any}));
  const pdf = await renderDocumentPdf({ title:"FACTURE", documentNumber:row.invoice_number, artisan:ARTISAN_INFO,
    client:{name:row.client_name,address:row.client_address,email:row.client_email}, clientBlockLabel:"Facturé à",
    metaLines:["Date : 15/01/2026"], lines: dl, totals: computeTotals(dl), legal: ARTISAN_INFO.legal });
  const hybrid = await toFacturxPdfA3(pdf, { invoiceNumber: row.invoice_number, producer: ARTISAN_INFO.company, xml });
  const check = await assertPdfA3Structure(hybrid);
  expect(check.errors).toEqual([]);
  expect(hybrid.length).toBeGreaterThan(5000);
});
