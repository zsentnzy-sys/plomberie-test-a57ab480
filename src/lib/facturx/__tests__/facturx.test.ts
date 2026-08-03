import { describe, expect, it } from "vitest";

import {
  centsToDecimalString,
  lineNetCents,
  toCents,
  vatCents,
} from "../money.server";
import {
  paymentMeansCode,
  unitCodeForLineType,
  vatCategoryCode,
} from "../codes.server";
import {
  assertRegulatoryConsistency,
  classifyTransaction,
} from "../classification.server";
import {
  buildStructuredInvoice,
  parsePostalAddress,
} from "../structured-invoice.server";
import {
  buildFacturxXml,
  escapeXml,
  validateStructuredInvoice,
  validateXmlSyntax,
} from "../facturx-xml.server";
import type { ArtisanInfo } from "../../artisan.server";

const artisan: ArtisanInfo = {
  company: "Plomberie Dupont",
  fullName: "Jean Dupont",
  address: "12 rue des Artisans\n57000 Metz",
  phone: "+33 6 00 00 00 00",
  email: "contact@example.test",
  siret: "SIRET 123 456 789 00012 - APE 4322A",
  iban: "FR76 0000 0000 0000 0000 0000 000",
  bic: "AGRIFRPP",
  legal: "Mentions légales de test.",
};

const baseRow = {
  invoice_number: "FACT-2026-0001",
  invoice_date: "2026-01-15",
  payment_method: "Virement bancaire",
  client_name: "Client & Fils <SARL>",
  client_address: "5 avenue de la Gare\n57000 Metz",
  client_email: "client@example.test",
  client_phone: "+33 3 87 00 00 00",
  total_ht: 259.9,
  total_tva: 38.99,
  total_ttc: 298.89,
  customer_type: "company",
  customer_siren: "123456789",
  customer_country_code: "FR",
};

const baseLines = [
  {
    position: 1,
    type: "Taux horaire",
    description: "Recherche de fuite",
    unit_price_ht: 65,
    quantity: 2,
    tva: 20,
  },
  {
    position: 2,
    type: "Matériel",
    description: "Mitigeur",
    unit_price_ht: 129.9,
    quantity: 1,
    tva: 10,
  },
];

describe("money", () => {
  it("rounds to integer cents", () => {
    expect(toCents(129.9)).toBe(12990);
    expect(toCents(0.145)).toBe(15);
    expect(lineNetCents(6500, 2)).toBe(13000);
    expect(vatCents(12990, 10)).toBe(1299);
    expect(centsToDecimalString(29889)).toBe("298.89");
    expect(centsToDecimalString(5)).toBe("0.05");
  });
});

describe("code mapping", () => {
  it("maps units and payment means", () => {
    expect(unitCodeForLineType("Taux horaire")).toBe("HUR");
    expect(unitCodeForLineType("Matériel")).toBe("C62");
    expect(paymentMeansCode("Virement bancaire")).toBe("30");
    expect(paymentMeansCode("Carte bancaire")).toBe("48");
    expect(paymentMeansCode("Chèque")).toBe("20");
    expect(paymentMeansCode("Espèces")).toBe("10");
    expect(vatCategoryCode(20, "FR")).toBe("S");
    expect(vatCategoryCode(0, "FR")).toBe("Z");
    expect(vatCategoryCode(0, "BE")).toBe("K");
  });
});

describe("classification", () => {
  it("classifies from country and customer type", () => {
    expect(
      classifyTransaction({
        customerType: "individual",
        customerCountryCode: "FR",
      }),
    ).toBe("b2c_france");

    expect(
      classifyTransaction({
        customerType: "company",
        customerCountryCode: "FR",
      }),
    ).toBe("b2b_france");

    expect(
      classifyTransaction({
        customerType: "company",
        customerCountryCode: "BE",
      }),
    ).toBe("b2b_international");

    expect(
      classifyTransaction({
        customerType: "public_sector",
        customerCountryCode: "FR",
      }),
    ).toBe("public_sector");
  });

  it("requires a SIREN for French professionals only", () => {
    expect(() =>
      assertRegulatoryConsistency({
        customerType: "company",
        customerCountryCode: "FR",
      }),
    ).toThrow(/SIREN/);

    expect(() =>
      assertRegulatoryConsistency({
        customerType: "individual",
        customerCountryCode: "FR",
        customerSiren: "123456789",
      }),
    ).toThrow(/particulier/);

    expect(() =>
      assertRegulatoryConsistency({
        customerType: "individual",
        customerCountryCode: "FR",
      }),
    ).not.toThrow();
  });
});

describe("structured invoice + XML", () => {
  const data = buildStructuredInvoice({
    row: baseRow as never,
    lines: baseLines as never,
    artisan,
  });

  it("parses postal addresses", () => {
    const address = parsePostalAddress(
      "5 avenue de la Gare\n57000 Metz",
      "FR",
    );

    expect(address.postcode).toBe("57000");
    expect(address.city).toBe("Metz");
    expect(address.lines).toEqual(["5 avenue de la Gare"]);
  });

  it("computes coherent totals in cents", () => {
    expect(data.totals.lineTotalCents).toBe(25990);
    expect(data.totals.taxTotalCents).toBe(3899);
    expect(data.totals.grandTotalCents).toBe(29889);
    expect(data.vatBreakdown.map((value) => value.rate)).toEqual([10, 20]);
  });

  it("passes the EN 16931 rule subset", () => {
    expect(validateStructuredInvoice(data)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("escapes XML special characters", () => {
    expect(escapeXml('a & b < c > "d"')).toBe(
      "a &amp; b &lt; c &gt; &quot;d&quot;",
    );

    const xml = buildFacturxXml(data);

    expect(xml).toContain("Client &amp; Fils &lt;SARL&gt;");
    expect(xml).toContain("urn:cen.eu:en16931:2017");
  });

  it("accepts the generated Factur-X XML with a real parser", () => {
    const xml = buildFacturxXml(data);

    expect(validateXmlSyntax(xml)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects incorrectly nested XML elements", () => {
    const result = validateXmlSyntax(
      '<?xml version="1.0" encoding="UTF-8"?><root><a><b></a></b></root>',
    );

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects an attribute without quotes", () => {
    const result = validateXmlSyntax(
      '<?xml version="1.0" encoding="UTF-8"?><root id=123></root>',
    );

    expect(result.valid).toBe(false);
  });

  it("rejects an unknown XML entity", () => {
    const result = validateXmlSyntax(
      '<?xml version="1.0" encoding="UTF-8"?><root>Client &inconnue;</root>',
    );

    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/entité.*inconnue/i);
  });

  it("rejects multiple root elements", () => {
    const result = validateXmlSyntax(
      '<?xml version="1.0" encoding="UTF-8"?><first></first><second></second>',
    );

    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/racine/i);
  });

  it("rejects an empty XML document", () => {
    expect(validateXmlSyntax("")).toEqual({
      valid: false,
      errors: ["XML — document vide"],
    });
  });

  it("rejects a missing UTF-8 declaration", () => {
    const result = validateXmlSyntax("<root></root>");

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "XML — déclaration XML UTF-8 manquante ou invalide",
    );
  });

  it("rejects XML documents containing a DOCTYPE", () => {
    const result = validateXmlSyntax(
      '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE root><root></root>',
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "XML — déclaration DOCTYPE interdite",
    );
  });

  it("accepts predefined and numeric XML entities", () => {
    const result = validateXmlSyntax(
      '<?xml version="1.0" encoding="UTF-8"?><root>&amp; &lt; &#65; &#x41;</root>',
    );

    expect(result).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects an inconsistent total", () => {
    const broken = {
      ...data,
      totals: {
        ...data.totals,
        grandTotalCents: 1,
      },
    };

    expect(validateStructuredInvoice(broken).valid).toBe(false);
  });
});
