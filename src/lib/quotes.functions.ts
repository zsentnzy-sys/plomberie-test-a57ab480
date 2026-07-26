import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

const lineSchema = z.object({
  type: z.enum(["Service", "Matériel", "Taux horaire"]),
  description: z.string().trim().min(1, "Description requise").max(300),
  unit_price_ht: z.number().min(0).max(1_000_000),
  quantity: z.number().min(0.01).max(10_000),
  tva: z.union([z.literal(0), z.literal(5.5), z.literal(10), z.literal(20)]),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (YYYY-MM-DD)");

const quoteSchema = z
  .object({
    quote_request_id: z.string().uuid().optional(),
    client_name: z.string().trim().min(2, "Nom requis").max(120),
    client_address: z.string().trim().min(4, "Adresse requise").max(400),
    client_email: z.string().trim().email("Email invalide").max(255),
    client_phone: z.string().trim().max(30).optional().or(z.literal("")),
    quote_date: isoDate,
    valid_until: isoDate,
    notes: z.string().trim().max(1000).optional().or(z.literal("")),
    lines: z.array(lineSchema).min(1, "Ajoutez au moins une ligne").max(50),
    idempotency_key: z.string().uuid("Clé d'idempotence invalide"),
  })
  .refine((d) => d.valid_until >= d.quote_date, {
    message: "La date de validité doit être postérieure à la date du devis",
    path: ["valid_until"],
  });

export type QuoteEmailStatus = "sent" | "failed" | "pending";
export interface QuoteEmailResult {
  status: QuoteEmailStatus;
  error?: string;
}
export type QuoteGlobalStatus =
  | "generating"
  | "generation_failed"
  | "ready"
  | "sending"
  | "sent"
  | "partially_sent"
  | "send_failed"
  | "accepted"
  | "refused"
  | "expired"
  | "cancelled";

export interface GenerateQuoteResult {
  quoteId: string;
  quoteNumber: string;
  pdfBase64: string;
  totals: { totalHT: number; totalTVA: number; totalTTC: number };
  emailClient: QuoteEmailResult;
  emailArtisan: QuoteEmailResult;
  reused: boolean;
  status: QuoteGlobalStatus;
}

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error("Vérification du rôle impossible.");
  if (!isAdmin) throw new Error("Accès refusé.");
}

/** Never leak raw provider errors to the browser. */
function safeEmailError(err: unknown, scope: string): string {
  const raw = err instanceof Error ? err.message : String(err);
  console.error(`[quotes] ${scope} email failure: ${raw}`);
  return "L'envoi de l'e-mail a échoué. Réessayez depuis la liste des demandes.";
}

export const generateQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => quoteSchema.parse(data))
  .handler(async ({ data, context }): Promise<GenerateQuoteResult> => {
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

/**
 * Shared email step: sends the client mail, persists its status immediately,
 * then the artisan copy, then computes the global status. Never coerces a
 * pending status into failed.
 */
async function sendQuoteEmails(args: {
  quoteId: string;
  quoteNo: string;
  pdfBase64: string;
  view: {
    quoteNumber: string;
    quoteDate: string;
    validUntil: string;
    totalHT: string;
    totalTVA: string;
    totalTTC: string;
  };
  client: { name: string; email: string; phone?: string; address: string };
  replyTo?: string;
}): Promise<{
  emailClient: QuoteEmailResult;
  emailArtisan: QuoteEmailResult;
  status: QuoteGlobalStatus;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ render }, ClientMod, ArtisanMod, { sendDocumentEmail }, { OWNER_EMAIL }] =
    await Promise.all([
      import("@react-email/components"),
      import("@/lib/email-templates/quote-document-client"),
      import("@/lib/email-templates/quote-document-artisan"),
      import("@/lib/invoice-email.server"),
      import("@/lib/email/dispatch.server"),
    ]);

  const [clientHtml, artisanHtml] = await Promise.all([
    render(
      ClientMod.default({ ...args.view, clientName: args.client.name }) as any,
    ),
    render(
      ArtisanMod.default({
        ...args.view,
        clientName: args.client.name,
        clientEmail: args.client.email,
        clientPhone: args.client.phone,
        clientAddress: args.client.address,
      }) as any,
    ),
  ]);

  await supabaseAdmin.from("quotes").update({ status: "sending" }).eq("id", args.quoteId);

  const pdfFilename = `${args.quoteNo}.pdf`;

  let emailClient: QuoteEmailResult;
  try {
    await sendDocumentEmail({
      to: args.client.email,
      subject: `Votre devis ${args.quoteNo} — Plomberie Dupont`,
      html: clientHtml,
      pdfBase64: args.pdfBase64,
      pdfFilename,
      replyTo: args.replyTo,
      idempotencyKey: `quote/${args.quoteId}/client/v1`,
    });
    emailClient = { status: "sent" };
  } catch (err) {
    emailClient = { status: "failed", error: safeEmailError(err, "client") };
  }
  const clientUpd = await supabaseAdmin
    .from("quotes")
    .update({
      email_client_status: emailClient.status,
      email_client_error: emailClient.error ?? null,
    })
    .eq("id", args.quoteId);
  if (clientUpd.error) {
    console.error(`[quotes] client status persist failed: ${clientUpd.error.message}`);
  }

  let emailArtisan: QuoteEmailResult;
  try {
    await sendDocumentEmail({
      to: OWNER_EMAIL,
      subject: `Devis émis : ${args.quoteNo}`,
      html: artisanHtml,
      pdfBase64: args.pdfBase64,
      pdfFilename,
      idempotencyKey: `quote/${args.quoteId}/artisan/v1`,
    });
    emailArtisan = { status: "sent" };
  } catch (err) {
    emailArtisan = { status: "failed", error: safeEmailError(err, "artisan") };
  }
  const artisanUpd = await supabaseAdmin
    .from("quotes")
    .update({
      email_artisan_status: emailArtisan.status,
      email_artisan_error: emailArtisan.error ?? null,
    })
    .eq("id", args.quoteId);
  if (artisanUpd.error) {
    console.error(`[quotes] artisan status persist failed: ${artisanUpd.error.message}`);
  }

  let status: QuoteGlobalStatus;
  if (emailClient.status === "sent" && emailArtisan.status === "sent") {
    status = "sent";
  } else if (emailClient.status === "failed" && emailArtisan.status === "failed") {
    status = "send_failed";
  } else if (emailClient.status === "sent" || emailArtisan.status === "sent") {
    status = "partially_sent";
  } else {
    status = "sending";
  }

  await supabaseAdmin
    .from("quotes")
    .update({
      status,
      sent_at: status === "sent" ? new Date().toISOString() : null,
    })
    .eq("id", args.quoteId);

  return { emailClient, emailArtisan, status };
}

/** Admin-only: resend an existing quote without creating a new one. */
export const resendQuoteEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ quoteId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
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
