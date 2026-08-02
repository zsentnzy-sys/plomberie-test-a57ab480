import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import type { GenerateInvoiceResult } from "./invoices.types";

export type {
  EmailStatus,
  InvoiceEmailResult,
  InvoiceGlobalStatus,
  GenerateInvoiceResult,
} from "./invoices.types";

const lineSchema = z.object({
  type: z.enum(["Service", "Matériel", "Taux horaire"]),
  description: z.string().trim().min(1, "Description requise").max(300),
  unit_price_ht: z.number().min(0).max(1_000_000),
  quantity: z.number().min(0.01).max(10_000),
  tva: z.union([z.literal(0), z.literal(5.5), z.literal(10), z.literal(20)]),
});

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (YYYY-MM-DD)")
  .optional()
  .or(z.literal(""));

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
  idempotency_key: z.string().uuid("Clé d'idempotence invalide"),
  source_quote_id: z.string().uuid().optional(),
  // --- Factur-X regulatory block (all optional for a B2C invoice) ---
  customer_type: z.enum(["individual", "company", "public_sector"]).default("individual"),
  customer_siren: z.string().trim().max(20).optional().or(z.literal("")),
  customer_siret: z.string().trim().max(20).optional().or(z.literal("")),
  customer_vat_number: z.string().trim().max(20).optional().or(z.literal("")),
  customer_country_code: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, "Code pays invalide")
    .default("FR"),
  operation_category: z.enum(["goods", "services", "mixed"]).default("services"),
  vat_on_debits: z.boolean().default(true),
  delivery_address: z.string().trim().max(400).optional().or(z.literal("")),
  delivery_date: isoDate,
  payment_due_date: isoDate,
  payment_reference: z.string().trim().max(60).optional().or(z.literal("")),
  purchase_order_reference: z.string().trim().max(60).optional().or(z.literal("")),
  service_period_start: isoDate,
  service_period_end: isoDate,
});

const BUCKET = "request-attachments";

export const generateInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => invoiceSchema.parse(data))
  .handler(async ({ data, context }): Promise<GenerateInvoiceResult> => {
    const { assertAdmin } = await import("@/lib/quotes.guards.server");
    await assertAdmin(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildArtisanSnapshot } = await import("@/lib/artisan.server");
    const { bytesToBase64, formatEUR, formatDateFR } = await import(
      "@/lib/documents.server"
    );
    const { loadInvoice, ensureInvoicePdf } = await import("@/lib/invoices-pdf.server");
    const { sendInvoiceEmails } = await import("@/lib/invoices-email.server");

    const artisanSnapshot = buildArtisanSnapshot();

    // Atomic: invoice + lines are created (or reused) in a single transaction.
    const { data: rpcRows, error: rpcErr } = await context.supabase.rpc(
      "create_invoice_with_lines_for_idempotency",
      {
        _idempotency_key: data.idempotency_key,
        _client_name: data.client_name,
        _client_address: data.client_address,
        _client_email: data.client_email,
        _client_phone: data.client_phone || "",
        _payment_method: data.payment_method,
        _invoice_date: data.invoice_date,
        _artisan_snapshot: artisanSnapshot as unknown as Json,
        _lines: data.lines.map((l, i) => ({ ...l, position: i + 1 })) as unknown as Json,
        _source_quote_id: (data.source_quote_id ?? null) as unknown as string,
      },
    );
    if (rpcErr || !rpcRows || rpcRows.length === 0) {
      console.error(`[invoices] RPC failure: ${rpcErr?.message ?? "no row"}`);
      throw new Error(rpcErr?.message ?? "Création de la facture impossible.");
    }
    const rpcRow = rpcRows[0] as {
      invoice_id: string;
      invoice_number: string;
      reused: boolean;
    };

    const row = await loadInvoice(rpcRow.invoice_id);

    let pdfBytes: Uint8Array;
    try {
      pdfBytes = await ensureInvoicePdf(row);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await supabaseAdmin
        .from("invoices")
        .update({ status: "generation_failed", generation_error: msg })
        .eq("id", row.id);
      throw err;
    }

    if (row.status === "generating" || row.status === "generation_failed") {
      await supabaseAdmin
        .from("invoices")
        .update({ status: "ready", generation_error: null })
        .eq("id", row.id);
    }

    const pdfBase64 = bytesToBase64(pdfBytes);

    // Sends only to recipients that aren't already 'sent' (retry-safe).
    const { emailClient, emailArtisan, status } = await sendInvoiceEmails({
      invoiceId: row.id,
      invoiceNo: row.invoice_number,
      pdfBase64,
      view: {
        invoiceNumber: row.invoice_number,
        invoiceDate: formatDateFR(row.invoice_date),
        totalHT: formatEUR(Number(row.total_ht)),
        totalTVA: formatEUR(Number(row.total_tva)),
        totalTTC: formatEUR(Number(row.total_ttc)),
      },
      client: {
        name: row.client_name,
        email: row.client_email,
        phone: row.client_phone ?? undefined,
        address: row.client_address,
      },
      paymentMethod: row.payment_method,
      replyTo: artisanSnapshot.email,
    });

    return {
      invoiceId: row.id,
      invoiceNumber: row.invoice_number,
      pdfBase64,
      totals: {
        totalHT: Number(row.total_ht),
        totalTVA: Number(row.total_tva),
        totalTTC: Number(row.total_ttc),
      },
      emailClient,
      emailArtisan,
      reused: rpcRow.reused,
      status,
    };
  });

/**
 * Admin-only: resend an existing invoice to the recipients that are not
 * already 'sent'. Reuses the stored PDF and the existing invoice number.
 */
export const resendInvoiceEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ invoiceId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/quotes.guards.server");
    await assertAdmin(context);

    const { bytesToBase64, formatEUR, formatDateFR } = await import(
      "@/lib/documents.server"
    );
    const { loadInvoice, ensureInvoicePdf } = await import("@/lib/invoices-pdf.server");
    const { sendInvoiceEmails } = await import("@/lib/invoices-email.server");

    const row = await loadInvoice(data.invoiceId);
    const pdfBytes = await ensureInvoicePdf(row);

    const result = await sendInvoiceEmails({
      invoiceId: row.id,
      invoiceNo: row.invoice_number,
      pdfBase64: bytesToBase64(pdfBytes),
      view: {
        invoiceNumber: row.invoice_number,
        invoiceDate: formatDateFR(row.invoice_date),
        totalHT: formatEUR(Number(row.total_ht)),
        totalTVA: formatEUR(Number(row.total_tva)),
        totalTTC: formatEUR(Number(row.total_ttc)),
      },
      client: {
        name: row.client_name,
        email: row.client_email,
        phone: row.client_phone ?? undefined,
        address: row.client_address,
      },
      paymentMethod: row.payment_method,
      replyTo: (row.artisan_snapshot as { email?: string } | null)?.email,
    });

    return {
      invoiceId: row.id,
      invoiceNumber: row.invoice_number,
      emailClient: result.emailClient,
      emailArtisan: result.emailArtisan,
      status: result.status,
    };
  });

// Admin-only signed URL to re-download an invoice PDF from the private bucket.
export const getInvoicePdfSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ invoiceId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/quotes.guards.server");
    await assertAdmin(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("invoices")
      .select("pdf_storage_path, invoice_number")
      .eq("id", data.invoiceId)
      .maybeSingle();
    if (error || !row) throw new Error("Facture introuvable.");
    if (!row.pdf_storage_path) throw new Error("PDF non disponible pour cette facture.");

    const signed = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(row.pdf_storage_path, 60 * 10, {
        download: `${row.invoice_number}.pdf`,
      });
    if (signed.error || !signed.data)
      throw new Error("Génération du lien impossible.");
    return { url: signed.data.signedUrl, invoiceNumber: row.invoice_number };
  });
