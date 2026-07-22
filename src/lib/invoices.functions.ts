import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const lineSchema = z.object({
  type: z.enum(["Service", "Matériel", "Taux horaire"]),
  description: z.string().trim().min(1, "Description requise").max(300),
  unit_price_ht: z.number().min(0).max(1_000_000),
  quantity: z.number().min(0.01).max(10_000),
  tva: z.union([z.literal(0), z.literal(5.5), z.literal(10), z.literal(20)]),
});

const invoiceSchema = z.object({
  client_name: z.string().trim().min(2, "Nom requis").max(120),
  client_address: z.string().trim().min(4, "Adresse requise").max(400),
  client_email: z.string().trim().email("Email invalide").max(255),
  client_phone: z.string().trim().max(30).optional().or(z.literal("")),
  payment_method: z.enum([
    "Carte bancaire",
    "Virement bancaire",
    "Chèque",
    "Espèces",
  ]),
  invoice_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (YYYY-MM-DD)"),
  lines: z.array(lineSchema).min(1, "Ajoutez au moins une ligne").max(50),
  artisan: z.object({
    company: z.string().max(120),
    fullName: z.string().max(120),
    address: z.string().max(400),
    phone: z.string().max(30),
    email: z.string().email().max(255),
    siret: z.string().max(60),
    iban: z.string().max(60).optional().or(z.literal("")),
    bic: z.string().max(30).optional().or(z.literal("")),
    legal: z.string().max(600),
  }),
});

export const generateInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => invoiceSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Admin gate
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc(
      "has_role",
      { _user_id: context.userId, _role: "admin" },
    );
    if (roleErr) throw new Error("Vérification du rôle impossible.");
    if (!isAdmin) throw new Error("Accès refusé.");

    // Reserve invoice number via admin-only RPC (uses auth.uid())
    const { data: invoiceNumber, error: numErr } = await context.supabase.rpc(
      "next_invoice_number",
    );
    if (numErr || !invoiceNumber) {
      throw new Error("Impossible d'obtenir un numéro de facture.");
    }

    // Build PDF (server-only helpers loaded lazily to keep client bundle clean)
    const { computeTotals, generateInvoicePdf, formatEUR, formatDateFR } =
      await import("@/lib/invoices.server");
    const totals = computeTotals(data.lines);
    const pdfBytes = await generateInvoicePdf({
      invoiceNumber: invoiceNumber as string,
      artisan: {
        ...data.artisan,
        iban: data.artisan.iban || undefined,
        bic: data.artisan.bic || undefined,
      },
      input: data,
      totals,
    });

    // Encode PDF as base64 (used for both Resend attachments and browser download).
    let binary = "";
    for (let i = 0; i < pdfBytes.length; i++) {
      binary += String.fromCharCode(pdfBytes[i]);
    }
    const pdfBase64 = btoa(binary);
    const pdfFilename = `${invoiceNumber}.pdf`;

    // Render both emails to HTML server-side, then send via Resend with the
    // PDF attached. We bypass the queued pipeline here because it doesn't
    // support attachments.
    const [{ render }, ClientEmailMod, ArtisanEmailMod, { sendInvoiceEmail }, { OWNER_EMAIL }] =
      await Promise.all([
        import("@react-email/components"),
        import("@/lib/email-templates/invoice-client"),
        import("@/lib/email-templates/invoice-artisan"),
        import("@/lib/invoice-email.server"),
        import("@/lib/email/dispatch.server"),
      ]);
    const ClientEmail = ClientEmailMod.default;
    const ArtisanEmail = ArtisanEmailMod.default;

    const commonView = {
      invoiceNumber: invoiceNumber as string,
      invoiceDate: formatDateFR(data.invoice_date),
      totalHT: formatEUR(totals.totalHT),
      totalTVA: formatEUR(totals.totalTVA),
      totalTTC: formatEUR(totals.totalTTC),
    };

    const [clientHtml, artisanHtml] = await Promise.all([
      render(
        ClientEmail({
          ...commonView,
          clientName: data.client_name,
        }) as any,
      ),
      render(
        ArtisanEmail({
          ...commonView,
          clientName: data.client_name,
          clientEmail: data.client_email,
          clientPhone: data.client_phone || undefined,
          clientAddress: data.client_address,
          paymentMethod: data.payment_method,
        }) as any,
      ),
    ]);

    // Send both emails. Failures are surfaced so the admin knows.
    await sendInvoiceEmail({
      to: data.client_email,
      subject: `Votre facture ${invoiceNumber} — Plomberie Dupont`,
      html: clientHtml,
      pdfBase64,
      pdfFilename,
      replyTo: data.artisan.email,
    });
    await sendInvoiceEmail({
      to: OWNER_EMAIL,
      subject: `Facture émise : ${invoiceNumber}`,
      html: artisanHtml,
      pdfBase64,
      pdfFilename,
    });

    return {
      invoiceNumber: invoiceNumber as string,
      pdfBase64,
      totals,
    };
  });