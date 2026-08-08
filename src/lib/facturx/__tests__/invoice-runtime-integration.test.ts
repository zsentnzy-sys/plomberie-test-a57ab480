import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { PDFDocument } from "@cantoo/pdf-lib";

import { ARTISAN_INFO } from "../../artisan.server";

const uploadedFiles: Array<{
  path: string;
  data: unknown;
  options?: unknown;
}> = [];

const invoiceUpdates: Record<string, unknown>[] = [];

let failXmlUpload = false;
let failComplianceUpdate = false;

const invoiceLines = [
  {
    position: 1,
    type: "Taux horaire",
    description:
      "Dépannage plomberie — recherche de fuite",
    unit_price_ht: 65,
    quantity: 2,
    tva: 20,
    unit_code: "HUR",
    vat_category_code: "S",
  },
  {
    position: 2,
    type: "Matériel",
    description: "Mitigeur thermostatique",
    unit_price_ht: 129.9,
    quantity: 1,
    tva: 10,
    unit_code: "C62",
    vat_category_code: "S",
  },
];

const storageBucket = {
  upload: vi.fn(
    async (
      path: string,
      data: unknown,
      options?: unknown,
    ) => {
      uploadedFiles.push({
        path,
        data,
        options,
      });

      if (
        failXmlUpload &&
        path.endsWith("-factur-x.xml")
      ) {
        return {
          data: null,
          error: {
            message: "échec XML simulé",
          },
        };
      }

      return {
        data: {
          path,
        },
        error: null,
      };
    },
  ),

  remove: vi.fn(
    async (
      paths: string[],
    ) => ({
      data: paths,
      error: null,
    }),
  ),

  download: vi.fn(async () => ({
    data: null,
    error: {
      message: "not found",
    },
  })),
};

const supabaseAdmin = {
  from(table: string) {
    if (table === "invoice_lines") {
      return {
        select() {
          return {
            eq() {
              return {
                async order() {
                  return {
                    data: invoiceLines,
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    }

    if (table === "invoices") {
        return {
            update(
            payload: Record<string, unknown>,
            ) {
            invoiceUpdates.push(payload);

            return {
                async eq() {
                const isComplianceUpdate =
                    "facturx_version" in payload;

                if (
                    failComplianceUpdate &&
                    isComplianceUpdate
                ) {
                    return {
                    data: null,
                    error: {
                        message:
                        "échec persistance simulé",
                    },
                    };
                }

                return {
                    data: null,
                    error: null,
                };
                },
            };
            },
        };
    }

    throw new Error(
      `Unexpected Supabase table: ${table}`,
    );
  },

  storage: {
    from() {
      return storageBucket;
    },
  },
};

vi.mock(
  "@/integrations/supabase/client.server",
  () => ({
    supabaseAdmin,
  }),
);

describe(
  "Factur-X — runtime production-like",
  () => {
    beforeEach(() => {
      uploadedFiles.length = 0;
      invoiceUpdates.length = 0;

      failXmlUpload = false;
      failComplianceUpdate = false;

      storageBucket.upload.mockClear();
      storageBucket.remove.mockClear();
      storageBucket.download.mockClear();
    });

    it(
      "génère, stocke et persiste une facture Factur-X complète",
      async () => {
        const {
          ensureInvoicePdf,
        } = await import(
          "../../invoices-pdf.server"
        );

        const row = {
          id: "invoice-runtime-test",

          invoice_number:
            "FACT-2026-9998",

          invoice_date:
            "2026-01-15",

          payment_method:
            "Virement bancaire",

          client_name:
            "Entreprise Témoin SARL",

          client_address:
            "5 avenue de la Gare\n57000 Metz",

          client_email:
            "compta@exemple.fr",

          client_phone:
            "+33 3 87 00 00 00",

          total_ht: 259.9,
          total_tva: 38.99,
          total_ttc: 298.89,

          artisan_snapshot:
            ARTISAN_INFO,

          pdf_storage_path: null,

          status: "draft",

          email_client_status: null,
          email_client_error: null,

          email_artisan_status: null,
          email_artisan_error: null,

          invoice_format:
            "facturx",

          customer_type:
            "company",

          customer_siren:
            "123456789",

          customer_siret:
            "12345678900012",

          customer_vat_number:
            null,

          customer_country_code:
            "FR",

          vat_on_debits: true,

          delivery_address: null,
          delivery_date: null,

          payment_due_date:
            "2026-02-15",

          payment_reference: null,

          purchase_order_reference:
            null,

          service_period_start: null,
          service_period_end: null,
        };

        const pdf =
          await ensureInvoicePdf(row);

        expect(
          pdf,
        ).toBeInstanceOf(
          Uint8Array,
        );

        expect(
          pdf.length,
        ).toBeGreaterThan(1000);

        // Le PDF retourné doit réellement
        // contenir factur-x.xml.
        const loaded =
          await PDFDocument.load(
            pdf,
            {
              updateMetadata: false,
            },
          );

        const attachments =
          (await loaded.getAttachments?.()) ??
          [];

        const facturx =
          attachments.find(
            (attachment) =>
              attachment.name ===
              "factur-x.xml",
          );

        expect(
          facturx,
        ).toBeDefined();

        expect(
          facturx?.data,
        ).toBeDefined();

        // PDF et XML doivent tous deux
        // avoir été envoyés au Storage.
        expect(
          uploadedFiles.some(
            (upload) =>
              upload.path ===
              "invoices/2026/FACT-2026-9998.pdf",
          ),
        ).toBe(true);

        expect(
          uploadedFiles.some(
            (upload) =>
              upload.path ===
              "invoices/2026/FACT-2026-9998-factur-x.xml",
          ),
        ).toBe(true);

        // Le cycle runtime doit commencer
        // en pending.
        expect(
          invoiceUpdates.some(
            (update) =>
              update
                .runtime_validation_status ===
              "pending",
          ),
        ).toBe(true);

        // La finalisation doit persister
        // les métadonnées Factur-X.
        const finalMetadata =
          invoiceUpdates.find(
            (update) =>
              update
                .runtime_validation_status ===
              "passed",
          );

        expect(
          finalMetadata,
        ).toBeDefined();

        expect(
          finalMetadata,
        ).toMatchObject({
          facturx_version:
            "1.09",

          facturx_profile:
            "EN 16931",

          validation_artifacts_version:
            "1.09.2",

          runtime_validation_status:
            "passed",

          generator_qualification_status:
            "qualified",

          external_validation_status:
            "not_run",

          transaction_classification:
            "b2b_france",
        });

        // Une régénération de PDF ne doit
        // jamais modifier l'état d'envoi.
        for (
          const update
          of invoiceUpdates
        ) {
          expect(
            update,
          ).not.toHaveProperty(
            "status",
          );

          expect(
            update,
          ).not.toHaveProperty(
            "sent_at",
          );

          expect(
            update,
          ).not.toHaveProperty(
            "email_client_status",
          );

          expect(
            update,
          ).not.toHaveProperty(
            "email_artisan_status",
          );
        }
      },
    );

    it(
      "nettoie le PDF si l'upload XML Factur-X échoue",
      async () => {
        failXmlUpload = true;

        const {
          ensureInvoicePdf,
        } = await import(
          "../../invoices-pdf.server"
        );

        const row = {
          id: "invoice-runtime-failure",

          invoice_number:
            "FACT-2026-9997",

          invoice_date:
            "2026-01-15",

          payment_method:
            "Virement bancaire",

          client_name:
            "Entreprise Témoin SARL",

          client_address:
            "5 avenue de la Gare\n57000 Metz",

          client_email:
            "compta@exemple.fr",

          client_phone:
            "+33 3 87 00 00 00",

          total_ht: 259.9,
          total_tva: 38.99,
          total_ttc: 298.89,

          artisan_snapshot:
            ARTISAN_INFO,

          pdf_storage_path: null,

          status: "draft",

          email_client_status: null,
          email_client_error: null,

          email_artisan_status: null,
          email_artisan_error: null,

          invoice_format:
            "facturx",

          customer_type:
            "company",

          customer_siren:
            "123456789",

          customer_siret:
            "12345678900012",

          customer_vat_number:
            null,

          customer_country_code:
            "FR",

          vat_on_debits: true,

          delivery_address: null,
          delivery_date: null,

          payment_due_date:
            "2026-02-15",

          payment_reference: null,

          purchase_order_reference:
            null,

          service_period_start: null,
          service_period_end: null,
        };

        await expect(
          ensureInvoicePdf(row),
        ).rejects.toThrow(
          "La génération de la facture Factur-X a échoué.",
        );

        const pdfPath =
          "invoices/2026/FACT-2026-9997.pdf";

        // Le PDF a bien été uploadé
        // avant l'échec XML.
        expect(
          uploadedFiles.some(
            (upload) =>
              upload.path ===
              pdfPath,
          ),
        ).toBe(true);

        // Mais il doit ensuite être supprimé
        // afin d'éviter un document partiellement
        // publié dans Storage.
        expect(
          storageBucket.remove,
        ).toHaveBeenCalledWith([
          pdfPath,
        ]);

        // Le runtime doit être marqué
        // comme échoué.
        expect(
          invoiceUpdates.some(
            (update) =>
              update
                .runtime_validation_status ===
              "failed",
          ),
        ).toBe(true);

        // Le chemin du PDF ne doit jamais
        // être persisté comme finalisé.
        expect(
          invoiceUpdates.some(
            (update) =>
              update.pdf_storage_path ===
              pdfPath,
          ),
        ).toBe(false);
      },
    );

    it(
        "nettoie le PDF et le XML si la finalisation DB échoue",
        async () => {
            failComplianceUpdate = true;

            const {
            ensureInvoicePdf,
            } = await import(
            "../../invoices-pdf.server"
            );

            const row = {
            id: "invoice-runtime-db-failure",

            invoice_number:
                "FACT-2026-9996",

            invoice_date:
                "2026-01-15",

            payment_method:
                "Virement bancaire",

            client_name:
                "Entreprise Témoin SARL",

            client_address:
                "5 avenue de la Gare\n57000 Metz",

            client_email:
                "compta@exemple.fr",

            client_phone:
                "+33 3 87 00 00 00",

            total_ht: 259.9,
            total_tva: 38.99,
            total_ttc: 298.89,

            artisan_snapshot:
                ARTISAN_INFO,

            pdf_storage_path: null,

            status: "draft",

            email_client_status: null,
            email_client_error: null,

            email_artisan_status: null,
            email_artisan_error: null,

            invoice_format:
                "facturx",

            customer_type:
                "company",

            customer_siren:
                "123456789",

            customer_siret:
                "12345678900012",

            customer_vat_number: null,

            customer_country_code:
                "FR",

            vat_on_debits: true,

            delivery_address: null,
            delivery_date: null,

            payment_due_date:
                "2026-02-15",

            payment_reference: null,

            purchase_order_reference: null,

            service_period_start: null,
            service_period_end: null,
            };

            await expect(
            ensureInvoicePdf(row),
            ).rejects.toThrow(
            "La génération de la facture Factur-X a échoué.",
            );

            const pdfPath =
            "invoices/2026/FACT-2026-9996.pdf";

            const xmlPath =
            "invoices/2026/FACT-2026-9996-factur-x.xml";

            // Les deux uploads avaient réussi.
            expect(
            uploadedFiles.some(
                (upload) =>
                upload.path === pdfPath,
            ),
            ).toBe(true);

            expect(
            uploadedFiles.some(
                (upload) =>
                upload.path === xmlPath,
            ),
            ).toBe(true);

            // Si la DB refuse la finalisation,
            // aucun artefact ne doit rester publié.
            expect(
            storageBucket.remove,
            ).toHaveBeenCalledWith([
            pdfPath,
            xmlPath,
            ]);

            // Le runtime doit finir en échec.
            expect(
            invoiceUpdates.some(
                (update) =>
                update
                    .runtime_validation_status ===
                "failed",
            ),
            ).toBe(true);

            // La facture ne doit jamais être
            // considérée comme finalisée.
            expect(
            row.pdf_storage_path,
            ).toBeNull();
        },
    );
  },
);