// Server-only helpers specific to quotes (devis). Layout primitives, totals and
// formatting come from documents.server.ts — only the labels, validity block
// and legal mentions are quote-specific.
import {
  renderDocumentPdf,
  formatDateFR,
  type ArtisanInfo,
  type DocumentLine,
  type DocumentTotals,
} from "./documents.server";

/** Default validity of a quote, in days. */
export const QUOTE_VALIDITY_DAYS = 30;

export const QUOTE_NOTICE =
  "Ce document est un DEVIS et ne constitue pas une facture. Aucun paiement n'est dû à ce stade.";

export const QUOTE_LEGAL =
  "Devis gratuit et sans engagement. Prix fermes pendant toute la durée de validité indiquée ci-dessus. " +
  "Pour accepter ce devis, retournez-le signé avec la mention « Bon pour accord », la date et votre signature, " +
  "ou répondez simplement à l'e-mail de transmission. Les travaux ne débutent qu'après accord écrit du client. " +
  "TVA applicable selon la nature des travaux. Assurance décennale et responsabilité civile professionnelle souscrites.";

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
    artisan,
    client: {
      name: input.client_name,
      address: input.client_address,
      email: input.client_email,
      phone: input.client_phone,
    },
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
  });
}

/** ISO date string N days after the given ISO date. */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
