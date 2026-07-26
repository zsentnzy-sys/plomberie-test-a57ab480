// Server-only commercial & legal configuration for generated documents.
// The PDF engine (documents.server.ts) must only contain rendering logic:
// every business/legal sentence lives here.

/** Legal mentions printed at the bottom of invoices. */
export const INVOICE_LEGAL =
  "Assurance décennale et responsabilité civile professionnelle souscrites. TVA sur les débits. En cas de retard de paiement, indemnité forfaitaire de 40 EUR (art. L441-6 du Code de commerce). Facture payable à réception.";

/** Highlighted notice printed at the top of quotes. */
export const QUOTE_NOTICE =
  "Ce document est un DEVIS et ne constitue pas une facture. Aucun paiement n'est dû à ce stade.";

/** Legal mentions printed at the bottom of quotes. */
export const QUOTE_LEGAL =
  "Devis gratuit et sans engagement. Prix fermes pendant toute la durée de validité indiquée ci-dessus. " +
  "Pour accepter ce devis, retournez-le signé avec la mention « Bon pour accord », la date et votre signature, " +
  "ou répondez simplement à l'e-mail de transmission. Les travaux ne débutent qu'après accord écrit du client. " +
  "TVA applicable selon la nature des travaux. Assurance décennale et responsabilité civile professionnelle souscrites.";

/** Label of the signature area on quotes. */
export const QUOTE_SIGNATURE_LABEL =
  "Bon pour accord — date et signature du client :";

/** Label above the client identity block. */
export const INVOICE_CLIENT_LABEL = "Facturé à";
export const QUOTE_CLIENT_LABEL = "Devis adressé à";

/** Short document type labels used on continuation pages. */
export const INVOICE_TYPE_LABEL = "Facture";
export const QUOTE_TYPE_LABEL = "Devis";
