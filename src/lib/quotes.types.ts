// Shared, client-safe types for the quotes module.
export type QuoteEmailStatus = "sent" | "failed" | "pending";

export interface QuoteEmailResult {
  status: QuoteEmailStatus;
  error?: string;
}

export type QuoteGlobalStatus =
  | "generating"
  | "generation_failed"
  | "ready"
  | "sending"
  | "sent"
  | "partially_sent"
  | "send_failed"
  | "accepted"
  | "refused"
  | "expired"
  | "cancelled";

export interface GenerateQuoteResult {
  quoteId: string;
  quoteNumber: string;
  pdfBase64: string;
  totals: { totalHT: number; totalTVA: number; totalTTC: number };
  emailClient: QuoteEmailResult;
  emailArtisan: QuoteEmailResult;
  reused: boolean;
  status: QuoteGlobalStatus;
}
