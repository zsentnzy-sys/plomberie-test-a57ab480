// Builds the single common data model consumed by BOTH the PDF renderer and
// the CII XML generator. It is derived exclusively from persisted rows and the
// artisan snapshot taken at creation time — never from live configuration.

import type { ArtisanInfo } from "../artisan.server";
import {
  paymentMeansCode,
  unitCodeForLineType,
  vatCategoryCode,
} from "./codes.server";
import { assertRegulatoryConsistency, classifyTransaction } from "./classification.server";
import { FACTURX_CONFIG } from "./facturx-config.server";
import { lineNetCents, toCents, vatCents } from "./money.server";
import type {
  CustomerType,
  StructuredInvoiceData,
  StructuredLine,
  StructuredParty,
  StructuredPostalAddress,
  VatBreakdownEntry,
} from "./structured-invoice.types";

export interface PersistedInvoiceLine {
  position: number;
  type: string;
  description: string;
  unit_price_ht: number | string;
  quantity: number | string;
  tva: number | string;
  unit_code?: string | null;
  vat_category_code?: string | null;
}

export interface PersistedInvoiceRecord {
  invoice_number: string;
  invoice_date: string;
  payment_method: string;
  client_name: string;
  client_address: string;
  client_email: string;
  client_phone: string | null;
  total_ht: number | string;
  total_tva: number | string;
  total_ttc: number | string;
  customer_type?: string | null;
  customer_siren?: string | null;
  customer_siret?: string | null;
  customer_vat_number?: string | null;
  customer_country_code?: string | null;
  vat_on_debits?: boolean | null;
  delivery_address?: string | null;
  delivery_date?: string | null;
  payment_due_date?: string | null;
  payment_reference?: string | null;
  purchase_order_reference?: string | null;
  service_period_start?: string | null;
  service_period_end?: string | null;
}

/** Split a free-text French address into street lines + postcode/city. */
export function parsePostalAddress(
  raw: string,
  countryCode: string,
): StructuredPostalAddress {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  let postcode: string | null = null;
  let city: string | null = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = /^(\d{5})\s+(.+)$/.exec(lines[i]);
    if (m) {
      postcode = m[1];
      city = m[2];
      lines.splice(i, 1);
      break;
    }
  }
  return { lines, postcode, city, countryCode: countryCode.toUpperCase() };
}

function digitsOnly(value: string | null | undefined): string | null {
  const v = (value ?? "").replace(/\D/g, "");
  return v || null;
}

function sellerFromSnapshot(artisan: ArtisanInfo): StructuredParty {
  // The snapshot stores the SIRET inside a human sentence ("SIRET 000 ... - APE").
  const siretMatch = /(\d[\d\s]{12,20}\d)/.exec(artisan.siret ?? "");
  const siret = siretMatch ? siretMatch[1].replace(/\s/g, "") : null;
  return {
    name: artisan.company,
    contactName: artisan.fullName,
    address: parsePostalAddress(artisan.address, "FR"),
    email: artisan.email,
    phone: artisan.phone,
    siret,
    siren: siret ? siret.slice(0, 9) : null,
    vatNumber: null,
  };
}

export function buildStructuredInvoice(params: {
  row: PersistedInvoiceRecord;
  lines: PersistedInvoiceLine[];
  artisan: ArtisanInfo;
}): StructuredInvoiceData {
  const { row, lines, artisan } = params;
  if (lines.length === 0) throw new Error("Facture sans ligne : génération impossible.");

  const customerType = (row.customer_type ?? "individual") as CustomerType;
  const country = (row.customer_country_code ?? "FR").toUpperCase();
  const regulatory = {
    customerType,
    customerCountryCode: country,
    customerSiren: row.customer_siren ?? null,
    customerSiret: row.customer_siret ?? null,
    customerVatNumber: row.customer_vat_number ?? null,
  };
  assertRegulatoryConsistency(regulatory);

  const structuredLines: StructuredLine[] = lines
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((l) => {
      const unitPriceCents = toCents(Number(l.unit_price_ht));
      const quantity = Number(l.quantity);
      const rate = Number(l.tva);
      return {
        position: l.position,
        name: l.type,
        description: l.description,
        unitCode: l.unit_code ?? unitCodeForLineType(l.type),
        quantity,
        unitPriceCents,
        netAmountCents: lineNetCents(unitPriceCents, quantity),
        vatRate: rate,
        vatCategoryCode: l.vat_category_code ?? vatCategoryCode(rate, country),
      };
    });

  const byRate = new Map<string, VatBreakdownEntry>();
  for (const l of structuredLines) {
    const key = `${l.vatCategoryCode}:${l.vatRate}`;
    const entry =
      byRate.get(key) ??
      { categoryCode: l.vatCategoryCode, rate: l.vatRate, basisCents: 0, taxCents: 0 };
    entry.basisCents += l.netAmountCents;
    entry.taxCents += vatCents(l.netAmountCents, l.vatRate);
    byRate.set(key, entry);
  }
  const vatBreakdown = Array.from(byRate.values()).sort((a, b) => a.rate - b.rate);

  const lineTotalCents = structuredLines.reduce((s, l) => s + l.netAmountCents, 0);
  const taxTotalCents = vatBreakdown.reduce((s, v) => s + v.taxCents, 0);
  const grandTotalCents = lineTotalCents + taxTotalCents;

  const buyer: StructuredParty = {
    name: row.client_name,
    address: parsePostalAddress(row.client_address, country),
    email: row.client_email,
    phone: row.client_phone,
    siren: digitsOnly(row.customer_siren),
    siret: digitsOnly(row.customer_siret),
    vatNumber: row.customer_vat_number ?? null,
  };

  return {
    invoiceNumber: row.invoice_number,
    issueDate: row.invoice_date,
    typeCode: FACTURX_CONFIG.invoiceTypeCode,
    currency: FACTURX_CONFIG.currency,
    seller: sellerFromSnapshot(artisan),
    buyer,
    buyerCustomerType: customerType,
    classification: classifyTransaction(regulatory),
    deliveryAddress: row.delivery_address
      ? parsePostalAddress(row.delivery_address, country)
      : null,
    deliveryDate: row.delivery_date ?? null,
    servicePeriodStart: row.service_period_start ?? null,
    servicePeriodEnd: row.service_period_end ?? null,
    purchaseOrderReference: row.purchase_order_reference ?? null,
    paymentReference: row.payment_reference ?? null,
    dueDate: row.payment_due_date ?? null,
    paymentMeansCode: paymentMeansCode(row.payment_method),
    paymentMeansLabel: row.payment_method,
    iban: artisan.iban ? artisan.iban.replace(/\s/g, "") : null,
    bic: artisan.bic ?? null,
    vatOnDebits: row.vat_on_debits ?? true,
    lines: structuredLines,
    vatBreakdown,
    totals: {
      lineTotalCents,
      taxBasisCents: lineTotalCents,
      taxTotalCents,
      grandTotalCents,
      duePayableCents: grandTotalCents,
    },
    legalNote: artisan.legal,
  };
}