// Server-only artisan/company information. MUST NEVER be imported from
// client code — the .server.ts suffix guarantees the bundler strips it
// from client bundles. SIRET, IBAN, BIC and legal mentions live here.

export interface ArtisanInfo {
  company: string;
  fullName: string;
  address: string;
  phone: string;
  email: string;
  siret: string;
  iban?: string;
  bic?: string;
  legal: string;
}

export const ARTISAN_INFO: ArtisanInfo = {
  company: "Plomberie Dupont",
  fullName: "Jean Dupont",
  address: "12 rue des Artisans\n57000 Metz",
  phone: "+33 6 00 00 00 00",
  email: "contact@plomberie-dupont.fr",
  siret: "SIRET 000 000 000 00000 - APE 4322A",
  iban: "FR76 0000 0000 0000 0000 0000 000",
  bic: "AGRIFRPP",
  legal:
    "Assurance décennale et responsabilité civile professionnelle souscrites. TVA sur les débits. En cas de retard de paiement, indemnité forfaitaire de 40 EUR (art. L441-6 du Code de commerce). Facture payable à réception.",
};

// Snapshot persisted in invoices.artisan_snapshot at generation time so
// re-downloading or regenerating the PDF later stays faithful to what the
// customer originally received, even if ARTISAN_INFO changes.
export function buildArtisanSnapshot(): ArtisanInfo {
  return { ...ARTISAN_INFO };
}