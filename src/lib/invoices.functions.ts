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

    // Upload PDF to storage for signed link (7d). Bucket already private.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `invoices/${invoiceNumber}/${crypto.randomUUID()}.pdf`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("request-attachments")
      .upload(path, pdfBytes, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (upErr) throw new Error(`Upload PDF échoué : ${upErr.message}`);

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("request-attachments")
      .createSignedUrl(path, 60 * 60 * 24 * 7);
    if (signErr || !signed) throw new Error("Génération du lien signé échouée.");

    // Send emails (client + artisan)
    const { enqueueTransactionalEmail, OWNER_EMAIL } = await import(
      "@/lib/email/dispatch.server"
    );

    const commonData = {
      invoiceNumber,
      invoiceDate: formatDateFR(data.invoice_date),
      totalHT: formatEUR(totals.totalHT),
      totalTVA: formatEUR(totals.totalTVA),
      totalTTC: formatEUR(totals.totalTTC),
      pdfUrl: signed.signedUrl,
    };

    await enqueueTransactionalEmail({
      templateName: "invoice-client",
      recipientEmail: data.client_email,
      idempotencyKey: `invoice-client-${invoiceNumber}`,
      templateData: {
        ...commonData,
        clientName: data.client_name,
      },
      replyTo: data.artisan.email,
    });

    await enqueueTransactionalEmail({
      templateName: "invoice-artisan",
      recipientEmail: OWNER_EMAIL,
      idempotencyKey: `invoice-artisan-${invoiceNumber}`,
      templateData: {
        ...commonData,
        clientName: data.client_name,
        clientEmail: data.client_email,
        clientPhone: data.client_phone || undefined,
        clientAddress: data.client_address,
        paymentMethod: data.payment_method,
      },
    });

    // Base64 for immediate download in the admin UI
    let binary = "";
    for (let i = 0; i < pdfBytes.length; i++) {
      binary += String.fromCharCode(pdfBytes[i]);
    }
    const pdfBase64 = btoa(binary);

    return {
      invoiceNumber: invoiceNumber as string,
      pdfBase64,
      totals,
    };
  });