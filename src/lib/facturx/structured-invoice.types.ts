// Common data model shared by the PDF renderer, the CII XML generator and the
// persisted compliance snapshot. Amounts are integer cents to avoid any
// floating point drift between representations.

export type CustomerType = "individual" | "company" | "public_sector";

export type TransactionClassification =
  | "b2b_france"
  | "b2c_france"
  | "b2b_international"
  | "b2c_international"
  | "public_sector";

export interface StructuredPostalAddress {
  lines: string[];
  postcode: string | null;
  city: string | null;
  countryCode: string;
}

export interface StructuredParty {
  name: string;
  contactName?: string | null;
  address: StructuredPostalAddress;
  email?: string | null;
  phone?: string | null;
  siren?: string | null;
  siret?: string | null;
  vatNumber?: string | null;
}

export interface StructuredLine {
  position: number;
  /** Short product/service name (line type). */
  name: string;
  description: string;
  unitCode: string;
  quantity: number;
  unitPriceCents: number;
  netAmountCents: number;
  vatRate: number;
  vatCategoryCode: string;
}

export interface VatBreakdownEntry {
  categoryCode: string;
  rate: number;
  basisCents: number;
  taxCents: number;
}

export interface StructuredTotals {
  lineTotalCents: number;
  taxBasisCents: number;
  taxTotalCents: number;
  grandTotalCents: number;
  duePayableCents: number;
}

export interface StructuredInvoiceData {
  invoiceNumber: string;
  /** ISO YYYY-MM-DD */
  issueDate: string;
  typeCode: string;
  currency: string;
  seller: StructuredParty;
  buyer: StructuredParty;
  buyerCustomerType: CustomerType;
  classification: TransactionClassification;
  deliveryAddress?: StructuredPostalAddress | null;
  deliveryDate?: string | null;
  servicePeriodStart?: string | null;
  servicePeriodEnd?: string | null;
  purchaseOrderReference?: string | null;
  paymentReference?: string | null;
  dueDate?: string | null;
  paymentMeansCode: string;
  paymentMeansLabel: string;
  iban?: string | null;
  bic?: string | null;
  vatOnDebits: boolean;
  lines: StructuredLine[];
  vatBreakdown: VatBreakdownEntry[];
  totals: StructuredTotals;
  legalNote: string;
}