import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { quoteSchema } from "./quotes.schemas";
import type { GenerateQuoteResult } from "./quotes.types";

export type {
  QuoteEmailStatus,
  QuoteEmailResult,
  QuoteGlobalStatus,
  GenerateQuoteResult,
} from "./quotes.types";

export const generateQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => quoteSchema.parse(data))
  .handler(async ({ data, context }): Promise<GenerateQuoteResult> => {
    const { assertAdmin } = await import("@/lib/quotes.guards.server");
    await assertAdmin(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildArtisanSnapshot } = await import("@/lib/artisan.server");
    const { formatEUR, formatDateFR, bytesToBase64 } = await import(
      "@/lib/documents.server"
    );
    const { loadQuote, ensureQuotePdf } = await import("@/lib/quotes-pdf.server");
    const { sendQuoteEmails } = await import("@/lib/quotes-email.server");

    const artisanSnapshot = buildArtisanSnapshot();

    // Atomic: quote + lines are created (or reused) in a single transaction.
    const { data: rpcRows, error: rpcErr } = await context.supabase.rpc(
      "create_quote_with_lines_for_idempotency",
      {
        _idempotency_key: data.idempotency_key,
        _quote_request_id: (data.quote_request_id ?? null) as unknown as string,
        _client_name: data.client_name,
        _client_address: data.client_address,
        _client_email: data.client_email,
        _client_phone: data.client_phone || "",
        _quote_date: data.quote_date,
        _valid_until: data.valid_until,
        _notes: (data.notes || null) as unknown as string,
        _artisan_snapshot: artisanSnapshot as unknown as Json,
        _lines: data.lines.map((l, i) => ({ ...l, position: i + 1 })) as unknown as Json,
      },
    );
    if (rpcErr || !rpcRows || rpcRows.length === 0) {
      console.error(`[quotes] RPC failure: ${rpcErr?.message ?? "no row"}`);
      throw new Error(rpcErr?.message ?? "Création du devis impossible.");
    }
    const rpcRow = rpcRows[0] as {
      quote_id: string;
      quote_number: string;
      reused: boolean;
    };

    const row = await loadQuote(rpcRow.quote_id);

    let pdfBytes: Uint8Array;
    try {
      pdfBytes = await ensureQuotePdf(row);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await supabaseAdmin
        .from("quotes")
        .update({ status: "generation_failed", generation_error: msg })
        .eq("id", row.id);
      throw err;
    }

    if (row.status === "generating" || row.status === "generation_failed") {
      await supabaseAdmin
        .from("quotes")
        .update({ status: "ready", generation_error: null })
        .eq("id", row.id);
    }

    const pdfBase64 = bytesToBase64(pdfBytes);

    // Retry-safe: only recipients that aren't already 'sent' are mailed.
    const { emailClient, emailArtisan, status } = await sendQuoteEmails({
      quoteId: row.id,
      quoteNo: row.quote_number,
      pdfBase64,
      view: {
        quoteNumber: row.quote_number,
        quoteDate: formatDateFR(row.quote_date),
        validUntil: formatDateFR(row.valid_until),
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
      replyTo: artisanSnapshot.email,
    });

    return {
      quoteId: row.id,
      quoteNumber: row.quote_number,
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

/** Admin-only: resend an existing quote without creating a new one. */
export const resendQuoteEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ quoteId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/quotes.guards.server");
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { bytesToBase64, formatEUR, formatDateFR } = await import(
      "@/lib/documents.server"
    );

    const { loadQuote, ensureQuotePdf } = await import("@/lib/quotes-pdf.server");
    const q = await loadQuote(data.quoteId);
    const pdfBase64 = bytesToBase64(await ensureQuotePdf(q));

    const { sendQuoteEmails } = await import("@/lib/quotes-email.server");
    const result = await sendQuoteEmails({
      quoteId: q.id,
      quoteNo: q.quote_number,
      pdfBase64,
      view: {
        quoteNumber: q.quote_number,
        quoteDate: formatDateFR(q.quote_date),
        validUntil: formatDateFR(q.valid_until),
        totalHT: formatEUR(Number(q.total_ht)),
        totalTVA: formatEUR(Number(q.total_tva)),
        totalTTC: formatEUR(Number(q.total_ttc)),
      },
      client: {
        name: q.client_name,
        email: q.client_email,
        phone: q.client_phone ?? undefined,
        address: q.client_address,
      },
      replyTo: (q.artisan_snapshot as any)?.email,
    });

    return {
      quoteId: q.id,
      quoteNumber: q.quote_number,
      emailClient: result.emailClient,
      emailArtisan: result.emailArtisan,
      status: result.status,
    };
  });

/** Admin-only signed URL to download a quote PDF from the private bucket. */
export const getQuotePdfSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ quoteId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/quotes.guards.server");
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("quotes")
      .select("pdf_storage_path, quote_number")
      .eq("id", data.quoteId)
      .maybeSingle();
    if (error || !row) throw new Error("Devis introuvable.");
    if (!row.pdf_storage_path) throw new Error("PDF non disponible pour ce devis.");

    const signed = await supabaseAdmin.storage
      .from("request-attachments")
      .createSignedUrl(row.pdf_storage_path, 60 * 10, {
        download: `${row.quote_number}.pdf`,
      });
    if (signed.error || !signed.data) throw new Error("Lien de téléchargement indisponible.");
    return { url: signed.data.signedUrl, quoteNumber: row.quote_number };
  });

/** Admin-only: the quote request row + its existing quote, for the editor. */
export const getQuoteRequestDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ requestId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/quotes.guards.server");
    await assertAdmin(context);
    const { data: request, error } = await context.supabase
      .from("quote_requests")
      .select("*")
      .eq("id", data.requestId)
      .maybeSingle();
    if (error || !request) throw new Error("Demande de devis introuvable.");

    const { data: quote } = await context.supabase
      .from("quotes")
      .select("id, quote_number, status, total_ttc, quote_date, valid_until, sent_at")
      .eq("quote_request_id", data.requestId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return { request, quote: quote ?? null };
  });
