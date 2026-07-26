// Server-only helpers for invoice PDF generation.
// All layout primitives are shared with quotes via documents.server.ts.
import {
  renderDocumentPdf,
  type ArtisanInfo,
  type DocumentLine,
  type DocumentTotals,
} from "./documents.server";

export {
  computeTotals,
  round2,
  formatEUR,
  formatDateFR,
  bytesToBase64,
  artisanFromSnapshot,
  uploadDocumentPdf,
  TVA_RATES,
} from "./documents.server";
export type {
  ArtisanInfo,
  DocumentLine as InvoiceLine,
  DocumentLineType as InvoiceLineType,
  DocumentTotals as InvoiceTotals,
  TvaRate,
} from "./documents.server";

import { formatDateFR } from "./documents.server";

export type PaymentMethod =
  | "Carte bancaire"
  | "Virement bancaire"
  | "Chèque"
  | "Espèces";

export interface InvoiceInput {
  client_name: string;
  client_address: string;
  client_email: string;
  client_phone?: string;
  payment_method: PaymentMethod;
  invoice_date: string; // ISO YYYY-MM-DD
  lines: DocumentLine[];
}

export async function generateInvoicePdf(params: {
  invoiceNumber: string;
  artisan: ArtisanInfo;
  input: InvoiceInput;
  totals: DocumentTotals;
}): Promise<Uint8Array> {
  const { invoiceNumber, artisan, input, totals } = params;
  return renderDocumentPdf({
    title: "FACTURE",
    documentNumber: invoiceNumber,
    artisan,
    client: {
      name: input.client_name,
      address: input.client_address,
      email: input.client_email,
      phone: input.client_phone,
    },
    metaLines: [
      `Date : ${formatDateFR(input.invoice_date)}`,
      `Paiement : ${input.payment_method}`,
    ],
    lines: input.lines,
    totals,
    footerLines: [`Mode de paiement : ${input.payment_method}`],
    legal: artisan.legal,
  });
}
