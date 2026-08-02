// Mapping between the internal wording used by the admin UI and the
// standardised code lists required by EN 16931 / Factur-X.

import type { CustomerType } from "./structured-invoice.types";

/** UN/ECE Recommendation 20 unit codes. */
export function unitCodeForLineType(type: string): string {
  switch (type) {
    case "Taux horaire":
      return "HUR"; // hour
    case "Matériel":
      return "C62"; // one (piece)
    case "Service":
    default:
      return "C62";
  }
}

/** UNTDID 4461 payment means. */
export function paymentMeansCode(method: string): string {
  switch (method) {
    case "Espèces":
      return "10";
    case "Chèque":
      return "20";
    case "Virement bancaire":
      return "30";
    case "Carte bancaire":
      return "48";
    default:
      return "1"; // instrument not defined
  }
}

/** UNTDID 5305 VAT category codes. */
export function vatCategoryCode(rate: number, customerCountry: string): string {
  if (rate > 0) return "S"; // standard / reduced rate
  if (customerCountry !== "FR") return "K"; // intra-community / export exempt
  return "Z"; // zero rated
}

export const VALID_UNIT_CODES = new Set(["HUR", "C62", "MTQ", "MTK", "MTR", "DAY"]);
export const VALID_PAYMENT_MEANS = new Set(["1", "10", "20", "30", "48", "58"]);
export const VALID_VAT_CATEGORIES = new Set(["S", "Z", "E", "K", "AE", "G", "O"]);

export function isIsoCountryCode(code: string): boolean {
  return /^[A-Z]{2}$/.test(code);
}

export function customerTypeLabel(type: CustomerType): string {
  switch (type) {
    case "company":
      return "Entreprise";
    case "public_sector":
      return "Secteur public";
    default:
      return "Particulier";
  }
}