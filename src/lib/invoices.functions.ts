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
  idempotency_key: z.string().uuid("Clé d'idempotence invalide"),
});

const BUCKET = "request-attachments";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export type EmailStatus = "sent" | "failed";
export interface InvoiceEmailResult {
  status: EmailStatus;
  error?: string;
}
export interface GenerateInvoiceResult {
  invoiceNumber: string;
  pdfBase64: string;
  totals: {
    totalHT: number;
    totalTVA: number;
    totalTTC: number;
  };
  emailClient: InvoiceEmailResult;
  emailArtisan: InvoiceEmailResult;
  reused: boolean;
}

export const generateInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => invoiceSchema.parse(data))
  .handler(async ({ data, context }): Promise<GenerateInvoiceResult> => {
    // Admin gate
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc(
      "has_role",
      { _user_id: context.userId, _role: "admin" },
    );
    if (roleErr) throw new Error("Vérification du rôle impossible.");
    if (!isAdmin) throw new Error("Accès refusé.");

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // ---- Idempotence : renvoie le résultat précédent si la clé existe déjà.
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("invoices")
      .select(
        "invoice_number, pdf_storage_path, total_ht, total_tva, total_ttc, email_client_status, email_client_error, email_artisan_status, email_artisan_error",
      )
      .eq("idempotency_key", data.idempotency_key)
      .maybeSingle();
    if (existingErr) throw new Error("Lecture de la facture existante impossible.");
    if (existing) {
      const dl = await supabaseAdmin.storage
        .from(BUCKET)
        .download(existing.pdf_storage_path);
      if (dl.error || !dl.data) throw new Error("PDF précédent introuvable.");
      const buf = new Uint8Array(await dl.data.arrayBuffer());
      return {
        invoiceNumber: existing.invoice_number,
        pdfBase64: bytesToBase64(buf),
        totals: {
          totalHT: Number(existing.total_ht),
          totalTVA: Number(existing.total_tva),
          totalTTC: Number(existing.total_ttc),
        },
        emailClient: {
          status: existing.email_client_status === "sent" ? "sent" : "failed",
          error: existing.email_client_error ?? undefined,
        },
        emailArtisan: {
          status: existing.email_artisan_status === "sent" ? "sent" : "failed",
          error: existing.email_artisan_error ?? undefined,
        },
        reused: true,
      };
    }

    // Reserve invoice number via admin-only RPC (uses auth.uid())
    const { data: invoiceNumber, error: numErr } = await context.supabase.rpc(
      "next_invoice_number",
    );
    if (numErr || !invoiceNumber) {
      throw new Error("Impossible d'obtenir un numéro de facture.");
    }
    const invoiceNo = invoiceNumber as string;

    // Build PDF (server-only helpers loaded lazily to keep client bundle clean)
    const { computeTotals, generateInvoicePdf, formatEUR, formatDateFR } =
      await import("@/lib/invoices.server");
    const totals = computeTotals(data.lines);
    const pdfBytes = await generateInvoicePdf({
      invoiceNumber: invoiceNo,
      artisan: {
        ...data.artisan,
        iban: data.artisan.iban || undefined,
        bic: data.artisan.bic || undefined,
      },
      input: data,
      totals,
    });

    const pdfBase64 = bytesToBase64(pdfBytes);
    const pdfFilename = `${invoiceNo}.pdf`;
    const year = data.invoice_date.slice(0, 4);
    const storagePath = `invoices/${year}/${invoiceNo}.pdf`;

    // Upload PDF (private bucket) before persisting the row.
    const up = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (up.error) {
      throw new Error(`Stockage du PDF impossible : ${up.error.message}`);
    }

    // Persist invoice + lines (pending email status).
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("invoices")
      .insert({
        invoice_number: invoiceNo,
        created_by: context.userId,
        client_name: data.client_name,
        client_address: data.client_address,
        client_email: data.client_email,
        client_phone: data.client_phone || null,
        payment_method: data.payment_method,
        invoice_date: data.invoice_date,
        total_ht: totals.totalHT,
        total_tva: totals.totalTVA,
        total_ttc: totals.totalTTC,
        pdf_storage_path: storagePath,
        idempotency_key: data.idempotency_key,
      })
      .select("id")
      .single();
    if (insErr || !inserted) {
      // Rollback the storage upload to keep bucket clean.
      await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
      throw new Error(`Enregistrement de la facture impossible : ${insErr?.message ?? "inconnu"}`);
    }
    const invoiceId = inserted.id;

    const linesRows = data.lines.map((l, i) => {
      const ht = l.unit_price_ht * l.quantity;
      const ttc = ht * (1 + l.tva / 100);
      return {
        invoice_id: invoiceId,
        position: i + 1,
        type: l.type,
        description: l.description,
        unit_price_ht: l.unit_price_ht,
        quantity: l.quantity,
        tva: l.tva,
        line_total_ht: Math.round(ht * 100) / 100,
        line_total_ttc: Math.round(ttc * 100) / 100,
      };
    });
    const { error: linesErr } = await supabaseAdmin
      .from("invoice_lines")
      .insert(linesRows);
    if (linesErr) {
      // Best-effort cleanup.
      await supabaseAdmin.from("invoices").delete().eq("id", invoiceId);
      await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
      throw new Error(`Enregistrement des lignes impossible : ${linesErr.message}`);
    }

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
      invoiceNumber: invoiceNo,
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

    // Send both emails independently. A single failure must not roll back
    // the invoice — the admin still gets the PDF and can retry later.
    async function trySend(fn: () => Promise<void>): Promise<InvoiceEmailResult> {
      try {
        await fn();
        return { status: "sent" };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { status: "failed", error: msg };
      }
    }

    const emailClient = await trySend(() =>
      sendInvoiceEmail({
        to: data.client_email,
        subject: `Votre facture ${invoiceNo} — Plomberie Dupont`,
        html: clientHtml,
        pdfBase64,
        pdfFilename,
        replyTo: data.artisan.email,
      }),
    );
    const emailArtisan = await trySend(() =>
      sendInvoiceEmail({
        to: OWNER_EMAIL,
        subject: `Facture émise : ${invoiceNo}`,
        html: artisanHtml,
        pdfBase64,
        pdfFilename,
      }),
    );

    await supabaseAdmin
      .from("invoices")
      .update({
        email_client_status: emailClient.status,
        email_client_error: emailClient.error ?? null,
        email_artisan_status: emailArtisan.status,
        email_artisan_error: emailArtisan.error ?? null,
      })
      .eq("id", invoiceId);

    return {
      invoiceNumber: invoiceNo,
      pdfBase64,
      totals,
      emailClient,
      emailArtisan,
      reused: false,
    };
  });

// Admin-only signed URL to re-download an invoice PDF from the private bucket.
export const getInvoicePdfSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ invoiceId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc(
      "has_role",
      { _user_id: context.userId, _role: "admin" },
    );
    if (roleErr) throw new Error("Vérification du rôle impossible.");
    if (!isAdmin) throw new Error("Accès refusé.");

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: row, error } = await supabaseAdmin
      .from("invoices")
      .select("pdf_storage_path, invoice_number")
      .eq("id", data.invoiceId)
      .maybeSingle();
    if (error || !row) throw new Error("Facture introuvable.");

    const signed = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(row.pdf_storage_path, 60 * 10, {
        download: `${row.invoice_number}.pdf`,
      });
    if (signed.error || !signed.data)
      throw new Error("Génération du lien impossible.");
    return { url: signed.data.signedUrl, invoiceNumber: row.invoice_number };
  });