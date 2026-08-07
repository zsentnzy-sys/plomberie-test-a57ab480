export interface PdfXmlConsistencyInput {
  pdfText: string;

  invoiceNumber: string;
  buyerName: string;

  totalHt: string;
  totalTva: string;
  totalTtc: string;

  lines: Array<{
    description: string;
    vatRate: number;
  }>;
}

export interface PdfXmlConsistencyResult {
  valid: boolean;
  errors: string[];
}

function normalize(value: string): string {
  return value
    .replace(/\u2019/g, "'")
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/\u2022/g, "·")
    .replace(/\s+/g, " ")
    .trim();
}

export function validatePdfXmlConsistency(
  input: PdfXmlConsistencyInput,
): PdfXmlConsistencyResult {
  const pdfText = normalize(input.pdfText);
  const errors: string[] = [];

  const expectText = (
    label: string,
    value: string,
  ) => {
    if (!pdfText.includes(normalize(value))) {
      errors.push(
        `${label} absent du PDF visible : ${value}`,
      );
    }
  };

  expectText(
    "Numéro de facture",
    input.invoiceNumber,
  );

  expectText(
    "Nom du client",
    input.buyerName,
  );

  expectText(
    "Total HT",
    input.totalHt,
  );

  expectText(
    "Total TVA",
    input.totalTva,
  );

  expectText(
    "Total TTC",
    input.totalTtc,
  );

  for (const line of input.lines) {
    expectText(
      "Description de ligne",
      line.description,
    );

    expectText(
      "Taux de TVA",
      `${line.vatRate}%`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}