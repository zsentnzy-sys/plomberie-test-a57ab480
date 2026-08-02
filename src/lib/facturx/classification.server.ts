// Server-side regulatory classification. Never trust a classification sent by
// the client: it is always recomputed here from the customer type, the country
// and the VAT identifiers.

import type {
  CustomerType,
  TransactionClassification,
} from "./structured-invoice.types";
import { isIsoCountryCode } from "./codes.server";

export interface RegulatoryInput {
  customerType: CustomerType;
  customerCountryCode: string;
  customerSiren?: string | null;
  customerSiret?: string | null;
  customerVatNumber?: string | null;
}

export function classifyTransaction(
  input: RegulatoryInput,
): TransactionClassification {
  const country = input.customerCountryCode.toUpperCase();
  if (input.customerType === "public_sector") return "public_sector";
  const isFrance = country === "FR";
  if (input.customerType === "company") {
    return isFrance ? "b2b_france" : "b2b_international";
  }
  return isFrance ? "b2c_france" : "b2c_international";
}

/** Conditional validation. Throws a user-readable French message. */
export function assertRegulatoryConsistency(input: RegulatoryInput): void {
  const country = input.customerCountryCode.toUpperCase();
  if (!isIsoCountryCode(country)) {
    throw new Error("Code pays du client invalide (format ISO attendu, ex. FR).");
  }

  const siren = (input.customerSiren ?? "").trim();
  const siret = (input.customerSiret ?? "").trim();
  const vat = (input.customerVatNumber ?? "").trim();

  if (input.customerType === "individual") {
    if (siren || siret || vat) {
      throw new Error(
        "Un client particulier ne peut pas porter de SIREN, SIRET ou numéro de TVA.",
      );
    }
    return;
  }

  if (country === "FR") {
    if (!/^\d{9}$/.test(siren)) {
      throw new Error("SIREN requis (9 chiffres) pour un client professionnel français.");
    }
    if (siret && !/^\d{14}$/.test(siret)) {
      throw new Error("SIRET invalide (14 chiffres attendus).");
    }
    if (siret && !siret.startsWith(siren)) {
      throw new Error("Le SIRET doit commencer par le SIREN du client.");
    }
    if (vat && !/^FR[0-9A-Z]{2}\d{9}$/.test(vat.replace(/\s/g, "").toUpperCase())) {
      throw new Error("Numéro de TVA intracommunautaire français invalide.");
    }
  } else if (vat && !/^[A-Z]{2}[0-9A-Z]{2,13}$/.test(vat.replace(/\s/g, "").toUpperCase())) {
    throw new Error("Numéro de TVA intracommunautaire invalide.");
  }
}