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
  idempotency_key: z.string().uuid("Clé d'idempotence invalide"),
});

const BUCKET = "request-attachments";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export type EmailStatus = "sent" | "failed" | "pending";
export interface InvoiceEmailResult {
  status: EmailStatus;
  error?: string;
}
export type InvoiceGlobalStatus =
  | "generating"
  | "generation_failed"
  | "ready"
  | "sending"
  | "sent"
  | "partially_sent"
  | "send_failed"
  | "cancelled";

export interface GenerateInvoiceResult {
  invoiceId: string;
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
  status: InvoiceGlobalStatus;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const generateInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => invoiceSchema.parse(data))
  .handler(async ({ data, context }): Promise<GenerateInvoiceResult> => {
    // Admin gate (defence-in-depth; the RPC also checks).
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc(
      "has_role",
      { _user_id: context.userId, _role: "admin" },
    );
    if (roleErr) throw new Error("Vérification du rôle impossible.");
    if (!isAdmin) throw new Error("Accès refusé.");

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { buildArtisanSnapshot } = await import("@/lib/artisan.server");
    const {
      computeTotals,
      generateInvoicePdf,
      formatEUR,
      formatDateFR,
    } = await import("@/lib/invoices.server");

    const totals = computeTotals(data.lines);
    const artisanSnapshot = buildArtisanSnapshot();

    // ---- Atomic idempotent creation (existing row returned, otherwise
    // number reserved + row inserted with status='generating').
    const { data: rpcRows, error: rpcErr } = await context.supabase.rpc(
      "create_invoice_for_idempotency",
      {
        _idempotency_key: data.idempotency_key,
        _client_name: data.client_name,
        _client_address: data.client_address,
        _client_email: data.client_email,
        _client_phone: data.client_phone || "",
        _payment_method: data.payment_method,
        _invoice_date: data.invoice_date,
        _total_ht: totals.totalHT,
        _total_tva: totals.totalTVA,
        _total_ttc: totals.totalTTC,
        _artisan_snapshot: artisanSnapshot as unknown as import("@/integrations/supabase/types").Json,
      },
    );
    if (rpcErr || !rpcRows || rpcRows.length === 0) {
      throw new Error(
        `Création de la facture impossible : ${rpcErr?.message ?? "inconnu"}`,
      );
    }
    const row = rpcRows[0] as {
      invoice_id: string;
      invoice_number: string;
      reused: boolean;
    };
    const invoiceId = row.invoice_id;
    const invoiceNo = row.invoice_number;
    const reused = row.reused;

    // ---- Reused path ----------------------------------------------------
    if (reused) {
      const { data: existing, error: exErr } = await supabaseAdmin
        .from("invoices")
        .select(
          "id, invoice_number, status, pdf_storage_path, total_ht, total_tva, total_ttc, invoice_date, payment_method, client_name, client_address, client_email, client_phone, email_client_status, email_client_error, email_artisan_status, email_artisan_error, artisan_snapshot",
        )
        .eq("id", invoiceId)
        .single();
      if (exErr || !existing) throw new Error("Facture existante introuvable.");

      let pdfPath = existing.pdf_storage_path;
      let pdfBytes: Uint8Array | null = null;

      if (pdfPath) {
        const dl = await supabaseAdmin.storage.from(BUCKET).download(pdfPath);
        if (dl.error || !dl.data) {
          pdfPath = null; // fall through to regeneration
        } else {
          pdfBytes = new Uint8Array(await dl.data.arrayBuffer());
        }
      }

      if (!pdfBytes) {
        // Regenerate from persisted data (no new number).
        const { data: persistedLines, error: linesErr } = await supabaseAdmin
          .from("invoice_lines")
          .select(
            "position, type, description, unit_price_ht, quantity, tva",
          )
          .eq("invoice_id", invoiceId)
          .order("position", { ascending: true });
        if (linesErr || !persistedLines) {
          throw new Error("Lignes de facture introuvables.");
        }
        const rebuiltLines = persistedLines.map((l) => ({
          type: l.type as "Service" | "Matériel" | "Taux horaire",
          description: l.description,
          unit_price_ht: Number(l.unit_price_ht),
          quantity: Number(l.quantity),
          tva: Number(l.tva) as 0 | 5.5 | 10 | 20,
        }));
        const rebuiltTotals = computeTotals(rebuiltLines);
        const snap = (existing.artisan_snapshot ?? {}) as Record<string, unknown>;
        pdfBytes = await generateInvoicePdf({
          invoiceNumber: existing.invoice_number,
          artisan: {
            company: String(snap.company ?? ""),
            fullName: String(snap.fullName ?? ""),
            address: String(snap.address ?? ""),
            phone: String(snap.phone ?? ""),
            email: String(snap.email ?? ""),
            siret: String(snap.siret ?? ""),
            iban: snap.iban ? String(snap.iban) : undefined,
            bic: snap.bic ? String(snap.bic) : undefined,
            legal: String(snap.legal ?? ""),
          },
          input: {
            client_name: existing.client_name,
            client_address: existing.client_address,
            client_email: existing.client_email,
            client_phone: existing.client_phone ?? undefined,
            payment_method:
              existing.payment_method as GenerateInvoiceResult["totals"] extends never
                ? never
                : "Carte bancaire" | "Virement bancaire" | "Chèque" | "Espèces",
            invoice_date: existing.invoice_date,
            lines: rebuiltLines,
          },
          totals: rebuiltTotals,
        });

        const year = existing.invoice_date.slice(0, 4);
        const newPath = `invoices/${year}/${existing.invoice_number}.pdf`;
        const up = await supabaseAdmin.storage
          .from(BUCKET)
          .upload(newPath, pdfBytes, {
            contentType: "application/pdf",
            upsert: true,
          });
        if (up.error) {
          throw new Error(`Stockage du PDF impossible : ${up.error.message}`);
        }
        pdfPath = newPath;
        await supabaseAdmin
          .from("invoices")
          .update({ pdf_storage_path: newPath, status: "ready" })
          .eq("id", invoiceId);
      }

      return {
        invoiceId,
        invoiceNumber: existing.invoice_number,
        pdfBase64: bytesToBase64(pdfBytes!),
        totals: {
          totalHT: Number(existing.total_ht),
          totalTVA: Number(existing.total_tva),
          totalTTC: Number(existing.total_ttc),
        },
        emailClient: {
          status:
            (existing.email_client_status as EmailStatus) ?? "pending",
          error: existing.email_client_error ?? undefined,
        },
        emailArtisan: {
          status:
            (existing.email_artisan_status as EmailStatus) ?? "pending",
          error: existing.email_artisan_error ?? undefined,
        },
        reused: true,
        status: (existing.status as InvoiceGlobalStatus) ?? "ready",
      };
    }

    // ---- Fresh invoice: insert lines, build PDF, upload, mark ready ----
    async function markGenerationFailed(msg: string) {
      await supabaseAdmin
        .from("invoices")
        .update({ status: "generation_failed", generation_error: msg })
        .eq("id", invoiceId);
    }

    const linesRows = data.lines.map((l, i) => {
      const ht = round2(l.unit_price_ht * l.quantity);
      const tva = round2(ht * (l.tva / 100));
      const ttc = round2(ht + tva);
      return {
        invoice_id: invoiceId,
        position: i + 1,
        type: l.type,
        description: l.description,
        unit_price_ht: l.unit_price_ht,
        quantity: l.quantity,
        tva: l.tva,
        line_total_ht: ht,
        line_total_tva: tva,
        line_total_ttc: ttc,
      };
    });
    const { error: linesErr } = await supabaseAdmin
      .from("invoice_lines")
      .insert(linesRows);
    if (linesErr) {
      await markGenerationFailed(linesErr.message);
      throw new Error(`Enregistrement des lignes impossible : ${linesErr.message}`);
    }

    let pdfBytes: Uint8Array;
    try {
      pdfBytes = await generateInvoicePdf({
        invoiceNumber: invoiceNo,
        artisan: artisanSnapshot,
        input: {
          client_name: data.client_name,
          client_address: data.client_address,
          client_email: data.client_email,
          client_phone: data.client_phone || undefined,
          payment_method: data.payment_method,
          invoice_date: data.invoice_date,
          lines: data.lines,
        },
        totals,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await markGenerationFailed(msg);
      throw new Error(`Génération du PDF impossible : ${msg}`);
    }

    const year = data.invoice_date.slice(0, 4);
    const storagePath = `invoices/${year}/${invoiceNo}.pdf`;
    const up = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (up.error) {
      await markGenerationFailed(up.error.message);
      throw new Error(`Stockage du PDF impossible : ${up.error.message}`);
    }

    const { error: readyErr } = await supabaseAdmin
      .from("invoices")
      .update({ pdf_storage_path: storagePath, status: "ready" })
      .eq("id", invoiceId);
    if (readyErr) {
      await markGenerationFailed(readyErr.message);
      throw new Error(`Mise à jour du statut impossible : ${readyErr.message}`);
    }

    const pdfBase64 = bytesToBase64(pdfBytes);
    const pdfFilename = `${invoiceNo}.pdf`;

    // ---- Emails: independent sends + independent status updates -------
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
        ClientEmail({ ...commonView, clientName: data.client_name }) as any,
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

    // Enter sending state.
    await supabaseAdmin
      .from("invoices")
      .update({ status: "sending" })
      .eq("id", invoiceId);

    async function trySend(
      fn: () => Promise<void>,
    ): Promise<InvoiceEmailResult> {
      try {
        await fn();
        return { status: "sent" };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { status: "failed", error: msg };
      }
    }

    // Client email first — update its status immediately after the attempt.
    const emailClient = await trySend(() =>
      sendInvoiceEmail({
        to: data.client_email,
        subject: `Votre facture ${invoiceNo} — Plomberie Dupont`,
        html: clientHtml,
        pdfBase64,
        pdfFilename,
        replyTo: artisanSnapshot.email,
        idempotencyKey: `invoice/${invoiceId}/client/v1`,
      }),
    );
    const clientUpdate = await supabaseAdmin
      .from("invoices")
      .update({
        email_client_status: emailClient.status,
        email_client_error: emailClient.error ?? null,
      })
      .eq("id", invoiceId);
    if (clientUpdate.error) {
      console.error(
        `[invoices] failed to persist client email status: ${clientUpdate.error.message}`,
      );
    }

    // Then artisan email.
    const emailArtisan = await trySend(() =>
      sendInvoiceEmail({
        to: OWNER_EMAIL,
        subject: `Facture émise : ${invoiceNo}`,
        html: artisanHtml,
        pdfBase64,
        pdfFilename,
        idempotencyKey: `invoice/${invoiceId}/artisan/v1`,
      }),
    );
    const artisanUpdate = await supabaseAdmin
      .from("invoices")
      .update({
        email_artisan_status: emailArtisan.status,
        email_artisan_error: emailArtisan.error ?? null,
      })
      .eq("id", invoiceId);
    if (artisanUpdate.error) {
      console.error(
        `[invoices] failed to persist artisan email status: ${artisanUpdate.error.message}`,
      );
    }

    // Compute global status. Only 'sent'/'failed' feed into the global state;
    // never coerce a 'pending' into 'failed'.
    let globalStatus: InvoiceGlobalStatus;
    if (emailClient.status === "sent" && emailArtisan.status === "sent") {
      globalStatus = "sent";
    } else if (
      emailClient.status === "failed" &&
      emailArtisan.status === "failed"
    ) {
      globalStatus = "send_failed";
    } else if (
      emailClient.status === "sent" ||
      emailArtisan.status === "sent"
    ) {
      globalStatus = "partially_sent";
    } else {
      // Both still pending for some reason — keep 'sending' so a retry can pick up.
      globalStatus = "sending";
    }

    await supabaseAdmin
      .from("invoices")
      .update({
        status: globalStatus,
        sent_at: globalStatus === "sent" ? new Date().toISOString() : null,
      })
      .eq("id", invoiceId);

    return {
      invoiceId,
      invoiceNumber: invoiceNo,
      pdfBase64,
      totals: {
        totalHT: totals.totalHT,
        totalTVA: totals.totalTVA,
        totalTTC: totals.totalTTC,
      },
      emailClient,
      emailArtisan,
      reused: false,
      status: globalStatus,
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