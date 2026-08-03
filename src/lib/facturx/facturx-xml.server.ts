// CII (UN/CEFACT Cross Industry Invoice) generation for the EN 16931 profile.
// Three clearly separated stages: mapping -> serialisation -> validation.

import { SyntaxValidator } from "fast-xml-validator";

import {
  VALID_PAYMENT_MEANS,
  VALID_UNIT_CODES,
  VALID_VAT_CATEGORIES,
  isIsoCountryCode,
} from "./codes.server";
import { FACTURX_CONFIG } from "./facturx-config.server";
import { centsToDecimalString } from "./money.server";
import type {
  StructuredInvoiceData,
  StructuredParty,
  StructuredPostalAddress,
} from "./structured-invoice.types";

// ---------------------------------------------------------------------------
// Serialisation primitives (no raw concatenation of untrusted values)
// ---------------------------------------------------------------------------

const xmlSyntaxValidator = new SyntaxValidator();

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // Control characters are illegal in XML 1.0.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

type Attrs = Record<string, string>;

function el(name: string, content: string, attrs: Attrs = {}): string {
  const a = Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${escapeXml(v)}"`)
    .join("");
  return `<${name}${a}>${content}</${name}>`;
}

function text(name: string, value: string, attrs: Attrs = {}): string {
  return el(name, escapeXml(value), attrs);
}

function optional(name: string, value: string | null | undefined): string {
  const v = (value ?? "").trim();
  return v ? text(name, v) : "";
}

function dateEl(name: string, iso: string): string {
  return el(name, el("udt:DateTimeString", iso.replace(/-/g, ""), { format: "102" }));
}

function amount(cents: number): string {
  return centsToDecimalString(cents);
}

function quantityString(q: number): string {
  return q.toFixed(4);
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function addressXml(address: StructuredPostalAddress): string {
  const [line1, line2, line3] = address.lines;
  return el(
    "ram:PostalTradeAddress",
    [
      optional("ram:PostcodeCode", address.postcode),
      optional("ram:LineOne", line1),
      optional("ram:LineTwo", line2),
      optional("ram:LineThree", line3),
      optional("ram:CityName", address.city),
      text("ram:CountryID", address.countryCode),
    ].join(""),
  );
}

function partyXml(tag: string, party: StructuredParty, isSeller: boolean): string {
  const idBlocks = [
    party.siret ? el("ram:ID", escapeXml(party.siret), { schemeID: "0009" }) : "",
    party.siren
      ? el(
          "ram:SpecifiedLegalOrganization",
          el("ram:ID", escapeXml(party.siren), { schemeID: "0002" }),
        )
      : "",
  ].join("");

  const contact =
    party.contactName || party.phone || party.email
      ? el(
          "ram:DefinedTradeContact",
          [
            optional("ram:PersonName", party.contactName),
            party.phone
              ? el(
                  "ram:TelephoneUniversalCommunication",
                  text("ram:CompleteNumber", party.phone),
                )
              : "",
            party.email
              ? el("ram:EmailURIUniversalCommunication", text("ram:URIID", party.email))
              : "",
          ].join(""),
        )
      : "";

  const vat = party.vatNumber
    ? el(
        "ram:SpecifiedTaxRegistration",
        el("ram:ID", escapeXml(party.vatNumber.replace(/\s/g, "").toUpperCase()), {
          schemeID: "VA",
        }),
      )
    : "";

  return el(
    tag,
    [
      isSeller ? idBlocks : party.siret || party.siren ? idBlocks : "",
      text("ram:Name", party.name),
      contact,
      addressXml(party.address),
      party.email && !contact ? "" : "",
      vat,
    ].join(""),
  );
}

function lineXml(data: StructuredInvoiceData, index: number): string {
  const l = data.lines[index];
  return el(
    "ram:IncludedSupplyChainTradeLineItem",
    [
      el("ram:AssociatedDocumentLineDocument", text("ram:LineID", String(l.position))),
      el(
        "ram:SpecifiedTradeProduct",
        [text("ram:Name", l.name), text("ram:Description", l.description)].join(""),
      ),
      el(
        "ram:SpecifiedLineTradeAgreement",
        el(
          "ram:NetPriceProductTradePrice",
          text("ram:ChargeAmount", amount(l.unitPriceCents)),
        ),
      ),
      el(
        "ram:SpecifiedLineTradeDelivery",
        el("ram:BilledQuantity", escapeXml(quantityString(l.quantity)), {
          unitCode: l.unitCode,
        }),
      ),
      el(
        "ram:SpecifiedLineTradeSettlement",
        [
          el(
            "ram:ApplicableTradeTax",
            [
              text("ram:TypeCode", "VAT"),
              text("ram:CategoryCode", l.vatCategoryCode),
              text("ram:RateApplicablePercent", l.vatRate.toFixed(2)),
            ].join(""),
          ),
          el(
            "ram:SpecifiedTradeSettlementLineMonetarySummation",
            text("ram:LineTotalAmount", amount(l.netAmountCents)),
          ),
        ].join(""),
      ),
    ].join(""),
  );
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export function buildFacturxXml(data: StructuredInvoiceData): string {
  const notes = [
    data.legalNote,
    data.vatOnDebits ? "TVA sur les débits." : null,
  ].filter((v): v is string => Boolean(v && v.trim()));

  const document = el(
    "rsm:ExchangedDocument",
    [
      text("ram:ID", data.invoiceNumber),
      text("ram:TypeCode", data.typeCode),
      dateEl("ram:IssueDateTime", data.issueDate),
      ...notes.map((n) => el("ram:IncludedNote", text("ram:Content", n))),
    ].join(""),
  );

  const agreement = el(
    "ram:ApplicableHeaderTradeAgreement",
    [
      partyXml("ram:SellerTradeParty", data.seller, true),
      partyXml("ram:BuyerTradeParty", data.buyer, false),
      data.purchaseOrderReference
        ? el(
            "ram:BuyerOrderReferencedDocument",
            text("ram:IssuerAssignedID", data.purchaseOrderReference),
          )
        : "",
    ].join(""),
  );

  const delivery = el(
    "ram:ApplicableHeaderTradeDelivery",
    [
      data.deliveryAddress
        ? el("ram:ShipToTradeParty", [
            text("ram:Name", data.buyer.name),
            addressXml(data.deliveryAddress),
          ].join(""))
        : "",
      data.deliveryDate
        ? el(
            "ram:ActualDeliverySupplyChainEvent",
            dateEl("ram:OccurrenceDateTime", data.deliveryDate),
          )
        : "",
    ].join(""),
  );

  const paymentMeans = el(
    "ram:SpecifiedTradeSettlementPaymentMeans",
    [
      text("ram:TypeCode", data.paymentMeansCode),
      text("ram:Information", data.paymentMeansLabel),
      data.iban
        ? el(
            "ram:PayeePartyCreditorFinancialAccount",
            text("ram:IBANID", data.iban),
          )
        : "",
      data.bic
        ? el(
            "ram:PayeeSpecifiedCreditorFinancialInstitution",
            text("ram:BICID", data.bic),
          )
        : "",
    ].join(""),
  );

  const taxes = data.vatBreakdown
    .map((v) =>
      el(
        "ram:ApplicableTradeTax",
        [
          text("ram:CalculatedAmount", amount(v.taxCents)),
          text("ram:TypeCode", "VAT"),
          text("ram:BasisAmount", amount(v.basisCents)),
          text("ram:CategoryCode", v.categoryCode),
          text("ram:RateApplicablePercent", v.rate.toFixed(2)),
        ].join(""),
      ),
    )
    .join("");

  const period =
    data.servicePeriodStart || data.servicePeriodEnd
      ? el(
          "ram:BillingSpecifiedPeriod",
          [
            data.servicePeriodStart
              ? dateEl("ram:StartDateTime", data.servicePeriodStart)
              : "",
            data.servicePeriodEnd ? dateEl("ram:EndDateTime", data.servicePeriodEnd) : "",
          ].join(""),
        )
      : "";

  const terms = data.dueDate
    ? el("ram:SpecifiedTradePaymentTerms", dateEl("ram:DueDateDateTime", data.dueDate))
    : "";

  const summation = el(
    "ram:SpecifiedTradeSettlementHeaderMonetarySummation",
    [
      text("ram:LineTotalAmount", amount(data.totals.lineTotalCents)),
      text("ram:TaxBasisTotalAmount", amount(data.totals.taxBasisCents)),
      el("ram:TaxTotalAmount", escapeXml(amount(data.totals.taxTotalCents)), {
        currencyID: data.currency,
      }),
      text("ram:GrandTotalAmount", amount(data.totals.grandTotalCents)),
      text("ram:DuePayableAmount", amount(data.totals.duePayableCents)),
    ].join(""),
  );

  const settlement = el(
    "ram:ApplicableHeaderTradeSettlement",
    [
      optional("ram:PaymentReference", data.paymentReference),
      text("ram:InvoiceCurrencyCode", data.currency),
      paymentMeans,
      taxes,
      period,
      terms,
      summation,
    ].join(""),
  );

  const transaction = el(
    "rsm:SupplyChainTradeTransaction",
    [
      data.lines.map((_, i) => lineXml(data, i)).join(""),
      agreement,
      delivery,
      settlement,
    ].join(""),
  );

  const context = el(
    "rsm:ExchangedDocumentContext",
    el(
      "ram:GuidelineSpecifiedDocumentContextParameter",
      text("ram:ID", FACTURX_CONFIG.profileUrn),
    ),
  );

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<rsm:CrossIndustryInvoice ' +
    'xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" ' +
    'xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" ' +
    'xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">' +
    context +
    document +
    transaction +
    "</rsm:CrossIndustryInvoice>"
  );
}

// ---------------------------------------------------------------------------
// Validation (EN 16931 business rules subset applicable to this invoice model)
// ---------------------------------------------------------------------------

export interface XmlValidationResult {
  valid: boolean;
  errors: string[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateStructuredInvoice(
  data: StructuredInvoiceData,
): XmlValidationResult {
  const e: string[] = [];
  const push = (rule: string, message: string) => e.push(`${rule} — ${message}`);

  if (!data.invoiceNumber.trim()) push("BR-2", "numéro de facture manquant");
  if (!ISO_DATE.test(data.issueDate)) push("BR-3", "date d'émission invalide");
  if (data.typeCode !== "380") push("BR-4", "code type de facture invalide");
  if (data.currency !== "EUR") push("BR-5", "devise non supportée");
  if (!data.seller.name.trim()) push("BR-6", "nom du vendeur manquant");
  if (!data.buyer.name.trim()) push("BR-7", "nom de l'acheteur manquant");
  if (!isIsoCountryCode(data.seller.address.countryCode))
    push("BR-9", "pays du vendeur invalide");
  if (!isIsoCountryCode(data.buyer.address.countryCode))
    push("BR-11", "pays de l'acheteur invalide");
  if (!data.seller.siret && !data.seller.siren)
    push("BR-FR-01", "identifiant SIRET/SIREN du vendeur manquant");
  if (data.buyerCustomerType !== "individual" && !data.buyer.siren)
    push("BR-FR-02", "SIREN de l'acheteur professionnel manquant");
  if (data.lines.length === 0) push("BR-16", "aucune ligne de facture");
  if (!VALID_PAYMENT_MEANS.has(data.paymentMeansCode))
    push("BR-49", "moyen de paiement hors liste de codes");
  if (data.dueDate && !ISO_DATE.test(data.dueDate))
    push("BR-CO-25", "date d'échéance invalide");

  for (const l of data.lines) {
    const p = `ligne ${l.position}`;
    if (!l.description.trim()) push("BR-25", `${p} : description manquante`);
    if (!VALID_UNIT_CODES.has(l.unitCode)) push("BR-23", `${p} : unité invalide`);
    if (!VALID_VAT_CATEGORIES.has(l.vatCategoryCode))
      push("BR-CO-4", `${p} : catégorie de TVA invalide`);
    if (!(l.quantity > 0)) push("BR-22", `${p} : quantité invalide`);
    if (l.netAmountCents < 0) push("BR-24", `${p} : montant net négatif`);
  }

  const lineSum = data.lines.reduce((s, l) => s + l.netAmountCents, 0);
  if (lineSum !== data.totals.lineTotalCents)
    push("BR-CO-10", "somme des lignes différente du total HT");
  const basisSum = data.vatBreakdown.reduce((s, v) => s + v.basisCents, 0);
  if (basisSum !== data.totals.taxBasisCents)
    push("BR-CO-13", "base taxable différente de la ventilation TVA");
  const taxSum = data.vatBreakdown.reduce((s, v) => s + v.taxCents, 0);
  if (taxSum !== data.totals.taxTotalCents)
    push("BR-CO-14", "total TVA différent de la ventilation");
  if (data.totals.grandTotalCents !== data.totals.taxBasisCents + data.totals.taxTotalCents)
    push("BR-CO-15", "total TTC incohérent");
  if (data.totals.duePayableCents !== data.totals.grandTotalCents)
    push("BR-CO-16", "reste à payer incohérent");

  return { valid: e.length === 0, errors: e };
}

function findInvalidXmlEntity(xml: string): string | null {
  const entityPattern = /&([^;\s<&]+);/g;
  const allowedNamedEntities = new Set([
    "amp",
    "lt",
    "gt",
    "quot",
    "apos",
  ]);

  let match: RegExpExecArray | null;

  while ((match = entityPattern.exec(xml))) {
    const entity = match[1];

    const isNamedEntity = allowedNamedEntities.has(entity);
    const isDecimalEntity = /^#[0-9]+$/.test(entity);
    const isHexadecimalEntity = /^#x[0-9a-f]+$/i.test(entity);

    if (!isNamedEntity && !isDecimalEntity && !isHexadecimalEntity) {
      return entity;
    }
  }

  return null;
}

function countXmlRootElements(xml: string): number {
  const withoutSpecialSections = xml
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")
    .replace(/<\?[\s\S]*?\?>/g, "");

  const tagPattern =
    /<\s*(\/?)\s*([A-Za-z_][\w.:-]*)(?:\s[^<>]*?)?(\/?)\s*>/g;

  let depth = 0;
  let rootCount = 0;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(withoutSpecialSections))) {
    const isClosingTag = match[1] === "/";
    const isSelfClosingTag = match[3] === "/";

    if (isClosingTag) {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (depth === 0) {
      rootCount += 1;
    }

    if (!isSelfClosingTag) {
      depth += 1;
    }
  }

  return rootCount;
}

/**
 * Performs real XML 1.0 syntactic validation.
 *
 * This checks XML well-formedness only. It does not perform Factur-X XSD
 * validation, EN 16931 Schematron validation or business-rule validation.
 */
export function validateXmlSyntax(xml: string): XmlValidationResult {
  const trimmed = xml.trim();

  if (!trimmed) {
    return {
      valid: false,
      errors: ["XML — document vide"],
    };
  }

  const errors: string[] = [];

  const declaration =
    /^<\?xml\s+version=(["'])1\.0\1\s+encoding=(["'])UTF-8\2\s*\?>/i;

  if (!declaration.test(trimmed)) {
    errors.push("XML — déclaration XML UTF-8 manquante ou invalide");
  }

  if (/<!DOCTYPE/i.test(trimmed)) {
    errors.push("XML — déclaration DOCTYPE interdite");
  }

  const invalidEntity = findInvalidXmlEntity(trimmed);
  if (invalidEntity) {
    errors.push(`XML — entité inconnue : &${invalidEntity};`);
  }

  const rootCount = countXmlRootElements(trimmed);
  
  if (rootCount !== 1) {
    errors.push(`XML - un seul élément racine attendu, ${rootCount} trouvé(s)`);
  }

  try {
    xmlSyntaxValidator.validate(trimmed);
  } catch (error) {
    const detail = error as {
      message?: string;
      code?: string;
      line?: number;
      col?: number;
    };

    const location =
      typeof detail.line === "number" && typeof detail.col === "number"
        ? `ligne ${detail.line}, colonne ${detail.col}`
        : typeof detail.col === "number"
          ? `colonne ${detail.col}`
          : "position inconnue";

    const code = detail.code ? ` [${detail.code}]` : "";

    errors.push(
      `XML — ${detail.message ?? "document XML mal formé"}${code} (${location})`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}