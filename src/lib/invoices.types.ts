// Shared, client-safe types for the invoices module.
export type EmailStatus = "sent" | "failed" | "pending";

export interface InvoiceEmailResult {
  status: EmailStatus;
  error?: string;
}

export type InvoiceGlobalStatus =
  | "generating"
  | "generation_failed"
  | "ready"
  | "sending"
  | "sent"
  | "partially_sent"
  | "send_failed"
  | "cancelled";

export interface GenerateInvoiceResult {
  invoiceId: string;
  invoiceNumber: string;
  pdfBase64: string;
  totals: { totalHT: number; totalTVA: number; totalTTC: number };
  emailClient: InvoiceEmailResult;
  emailArtisan: InvoiceEmailResult;
  reused: boolean;
  status: InvoiceGlobalStatus;
}
