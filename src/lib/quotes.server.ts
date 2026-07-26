// Server-only helpers specific to quotes (devis). Layout primitives, totals and
// formatting come from documents.server.ts; the commercial/legal wording comes
// from document-config.server.ts.
import {
  renderDocumentPdf,
  formatDateFR,
  type DocumentLine,
  type DocumentTotals,
} from "./documents.server";
import type { ArtisanInfo } from "./artisan.server";
import {
  QUOTE_CLIENT_LABEL,
  QUOTE_LEGAL,
  QUOTE_NOTICE,
  QUOTE_SIGNATURE_LABEL,
  QUOTE_TYPE_LABEL,
} from "./document-config.server";

/** Default validity of a quote, in days. */
export const QUOTE_VALIDITY_DAYS = 30;

export { QUOTE_NOTICE, QUOTE_LEGAL } from "./document-config.server";

export interface QuoteInput {
  client_name: string;
  client_address: string;
  client_email: string;
  client_phone?: string;
  quote_date: string; // ISO YYYY-MM-DD
  valid_until: string; // ISO YYYY-MM-DD
  notes?: string;
  lines: DocumentLine[];
}

export async function generateQuotePdf(params: {
  quoteNumber: string;
  artisan: ArtisanInfo;
  input: QuoteInput;
  totals: DocumentTotals;
}): Promise<Uint8Array> {
  const { quoteNumber, artisan, input, totals } = params;
  return renderDocumentPdf({
    title: "DEVIS",
    documentNumber: quoteNumber,
    documentTypeLabel: QUOTE_TYPE_LABEL,
    artisan,
    client: {
      name: input.client_name,
      address: input.client_address,
      email: input.client_email,
      phone: input.client_phone,
    },
    clientBlockLabel: QUOTE_CLIENT_LABEL,
    metaLines: [
      `Date : ${formatDateFR(input.quote_date)}`,
      `Valable jusqu'au : ${formatDateFR(input.valid_until)}`,
    ],
    lines: input.lines,
    totals,
    notice: QUOTE_NOTICE,
    notes: input.notes,
    footerLines: [
      `Devis valable jusqu'au ${formatDateFR(input.valid_until)}.`,
    ],
    legal: QUOTE_LEGAL,
    signatureBlock: true,
    signatureLabel: QUOTE_SIGNATURE_LABEL,
  });
}

/** ISO date string N days after the given ISO date. */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
