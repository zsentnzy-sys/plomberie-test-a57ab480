// Abstraction reserved for a future accredited e-invoicing platform (PDP/PA).
// No provider is wired: invoices stay at e_invoice_status = 'not_submitted'
// and nothing in the UI can trigger a transmission today.

export type EInvoiceSubmissionStatus =
  | "not_submitted"
  | "queued"
  | "submitted"
  | "accepted"
  | "rejected"
  | "failed";

export interface EInvoiceSubmission {
  invoiceId: string;
  /** PDF/A-3 hybrid document bytes. */
  pdf: Uint8Array;
  /** Raw CII XML (same content as the embedded factur-x.xml). */
  xml: string;
}

export interface EInvoiceSubmissionResult {
  status: EInvoiceSubmissionStatus;
  providerReference?: string;
  error?: string;
}

export interface EInvoiceProvider {
  readonly id: string;
  readonly label: string;
  submit(submission: EInvoiceSubmission): Promise<EInvoiceSubmissionResult>;
  getStatus(providerReference: string): Promise<EInvoiceSubmissionResult>;
}