import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { quoteSchema } from "./quotes.schemas";
import type { QuoteEmailStatus, QuoteGlobalStatus, GenerateQuoteResult } from "./quotes.types";

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
    const {
      computeTotals,
      formatEUR,
      formatDateFR,
      bytesToBase64,
      artisanFromSnapshot,
      uploadDocumentPdf,
      round2,
    } = await import("@/lib/documents.server");
    const { generateQuotePdf } = await import("@/lib/quotes.server");

    const totals = computeTotals(data.lines);
    const artisanSnapshot = buildArtisanSnapshot();

    const { data: rpcRows, error: rpcErr } = await context.supabase.rpc(
      "create_quote_for_idempotency",
      {
        _idempotency_key: data.idempotency_key,
        _quote_request_id: data.quote_request_id ?? null,
        _client_name: data.client_name,
        _client_address: data.client_address,
        _client_email: data.client_email,
        _client_phone: data.client_phone || "",
        _quote_date: data.quote_date,
        _valid_until: data.valid_until,
        _notes: data.notes || null,
        _total_ht: totals.totalHT,
        _total_tva: totals.totalTVA,
        _total_ttc: totals.totalTTC,
        _artisan_snapshot: artisanSnapshot as unknown as Json,
      },
    );
    if (rpcErr || !rpcRows || rpcRows.length === 0) {
      console.error(`[quotes] RPC failure: ${rpcErr?.message ?? "no row"}`);
      throw new Error("Création du devis impossible.");
    }
    const row = rpcRows[0] as {
      quote_id: string;
      quote_number: string;
      reused: boolean;
    };
    const quoteId = row.quote_id;
    const quoteNo = row.quote_number;

    // ---------------- Reused path ----------------
    if (row.reused) {
      const { data: existing, error: exErr } = await supabaseAdmin
        .from("quotes")
        .select("*")
        .eq("id", quoteId)
        .single();
      if (exErr || !existing) throw new Error("Devis existant introuvable.");

      let pdfBytes: Uint8Array | null = null;
      if (existing.pdf_storage_path) {
        const dl = await supabaseAdmin.storage
          .from("request-attachments")
          .download(existing.pdf_storage_path);
        if (!dl.error && dl.data) pdfBytes = new Uint8Array(await dl.data.arrayBuffer());
      }

      if (!pdfBytes) {
        const { data: persisted, error: linesErr } = await supabaseAdmin
          .from("quote_lines")
          .select("position, type, description, unit_price_ht, quantity, tva")
          .eq("quote_id", quoteId)
          .order("position", { ascending: true });
        if (linesErr || !persisted || persisted.length === 0) {
          throw new Error("Lignes du devis introuvables.");
        }
        const rebuiltLines = persisted.map((l) => ({
          type: l.type as "Service" | "Matériel" | "Taux horaire",
          description: l.description,
          unit_price_ht: Number(l.unit_price_ht),
          quantity: Number(l.quantity),
          tva: Number(l.tva) as 0 | 5.5 | 10 | 20,
        }));
        pdfBytes = await generateQuotePdf({
          quoteNumber: existing.quote_number,
          artisan: artisanFromSnapshot(existing.artisan_snapshot),
          input: {
            client_name: existing.client_name,
            client_address: existing.client_address,
            client_email: existing.client_email,
            client_phone: existing.client_phone ?? undefined,
            quote_date: existing.quote_date,
            valid_until: existing.valid_until,
            notes: existing.notes ?? undefined,
            lines: rebuiltLines,
          },
          totals: computeTotals(rebuiltLines),
        });
        const path = `quotes/${existing.quote_date.slice(0, 4)}/${existing.quote_number}.pdf`;
        await uploadDocumentPdf(path, pdfBytes);
        await supabaseAdmin
          .from("quotes")
          .update({ pdf_storage_path: path, status: "ready" })
          .eq("id", quoteId);
      }

      return {
        quoteId,
        quoteNumber: existing.quote_number,
        pdfBase64: bytesToBase64(pdfBytes),
        totals: {
          totalHT: Number(existing.total_ht),
          totalTVA: Number(existing.total_tva),
          totalTTC: Number(existing.total_ttc),
        },
        emailClient: {
          status: (existing.email_client_status as QuoteEmailStatus) ?? "pending",
          error: existing.email_client_error ?? undefined,
        },
        emailArtisan: {
          status: (existing.email_artisan_status as QuoteEmailStatus) ?? "pending",
          error: existing.email_artisan_error ?? undefined,
        },
        reused: true,
        status: (existing.status as QuoteGlobalStatus) ?? "ready",
      };
    }

    // ---------------- Fresh quote ----------------
    async function markGenerationFailed(msg: string) {
      await supabaseAdmin
        .from("quotes")
        .update({ status: "generation_failed", generation_error: msg })
        .eq("id", quoteId);
    }

    const lineRows = data.lines.map((l, i) => {
      const ht = round2(l.unit_price_ht * l.quantity);
      const tva = round2(ht * (l.tva / 100));
      return {
        quote_id: quoteId,
        position: i + 1,
        type: l.type,
        description: l.description,
        unit_price_ht: l.unit_price_ht,
        quantity: l.quantity,
        tva: l.tva,
        line_total_ht: ht,
        line_total_tva: tva,
        line_total_ttc: round2(ht + tva),
      };
    });
    const { error: insErr } = await supabaseAdmin.from("quote_lines").insert(lineRows);
    if (insErr) {
      await markGenerationFailed(insErr.message);
      throw new Error("Enregistrement des lignes du devis impossible.");
    }

    let pdfBytes: Uint8Array;
    try {
      pdfBytes = await generateQuotePdf({
        quoteNumber: quoteNo,
        artisan: artisanSnapshot,
        input: {
          client_name: data.client_name,
          client_address: data.client_address,
          client_email: data.client_email,
          client_phone: data.client_phone || undefined,
          quote_date: data.quote_date,
          valid_until: data.valid_until,
          notes: data.notes || undefined,
          lines: data.lines,
        },
        totals,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await markGenerationFailed(msg);
      throw new Error("Génération du PDF du devis impossible.");
    }

    const storagePath = `quotes/${data.quote_date.slice(0, 4)}/${quoteNo}.pdf`;
    try {
      await uploadDocumentPdf(storagePath, pdfBytes);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await markGenerationFailed(msg);
      throw new Error("Stockage du PDF du devis impossible.");
    }

    const { error: readyErr } = await supabaseAdmin
      .from("quotes")
      .update({ pdf_storage_path: storagePath, status: "ready" })
      .eq("id", quoteId);
    if (readyErr) {
      await markGenerationFailed(readyErr.message);
      throw new Error("Mise à jour du statut du devis impossible.");
    }

    const pdfBase64 = bytesToBase64(pdfBytes);
    const view = {
      quoteNumber: quoteNo,
      quoteDate: formatDateFR(data.quote_date),
      validUntil: formatDateFR(data.valid_until),
      totalHT: formatEUR(totals.totalHT),
      totalTVA: formatEUR(totals.totalTVA),
      totalTTC: formatEUR(totals.totalTTC),
    };

    const { sendQuoteEmails } = await import("@/lib/quotes-email.server");
    const { emailClient, emailArtisan, status } = await sendQuoteEmails({
      quoteId,
      quoteNo,
      pdfBase64,
      view,
      client: {
        name: data.client_name,
        email: data.client_email,
        phone: data.client_phone || undefined,
        address: data.client_address,
      },
      replyTo: artisanSnapshot.email,
    });

    return {
      quoteId,
      quoteNumber: quoteNo,
      pdfBase64,
      totals: {
        totalHT: totals.totalHT,
        totalTVA: totals.totalTVA,
        totalTTC: totals.totalTTC,
      },
      emailClient,
      emailArtisan,
      reused: false,
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

    const { data: q, error } = await supabaseAdmin
      .from("quotes")
      .select("*")
      .eq("id", data.quoteId)
      .maybeSingle();
    if (error || !q) throw new Error("Devis introuvable.");
    if (!q.pdf_storage_path) throw new Error("PDF indisponible : régénérez le devis.");

    const dl = await supabaseAdmin.storage
      .from("request-attachments")
      .download(q.pdf_storage_path);
    if (dl.error || !dl.data) throw new Error("PDF indisponible : régénérez le devis.");
    const pdfBase64 = bytesToBase64(new Uint8Array(await dl.data.arrayBuffer()));

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
