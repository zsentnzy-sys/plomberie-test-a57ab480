import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DocumentKind = "invoice" | "quote";

export interface HistoryRow {
  kind: DocumentKind;
  id: string;
  number: string;
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  createdAt: string;
  totalTTC: number;
  status: string;
  sentAt: string | null;
  hasPdf: boolean;
  /** Quotes only: invoice number already generated from this quote. */
  linkedInvoiceNumber?: string | null;
  /** Quotes only: the linked request must be confirmed before invoicing. */
  convertible?: boolean;
  convertBlockedReason?: string | null;
  /** Invoices only: 'facturx' | 'classic_pdf'. */
  format?: string;
  facturxProfile?: string | null;
  validationStatus?: string | null;
  validationSummary?: string | null;
}

export interface HistoryPage {
  rows: HistoryRow[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 25;

const listSchema = z.object({
  kind: z.enum(["invoice", "quote"]),
  search: z.string().trim().max(200).optional(),
  status: z.string().trim().max(40).optional(),
  page: z.number().int().min(0).max(10_000).optional(),
});

function escapeLike(value: string) {
  return value.replace(/[%,()]/g, " ").trim();
}

export const listDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listSchema.parse(data))
  .handler(async ({ data, context }): Promise<HistoryPage> => {
    const { assertAdmin } = await import("@/lib/quotes.guards.server");
    await assertAdmin(context);

    const page = data.page ?? 0;
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const search = data.search ? escapeLike(data.search) : "";

    if (data.kind === "invoice") {
      let q = context.supabase
        .from("invoices")
        .select(
          "id, invoice_number, client_name, client_address, client_email, created_at, total_ttc, status, sent_at, pdf_storage_path, invoice_format, facturx_profile, facturx_validation_status, facturx_validation_errors",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(from, to);
      if (data.status && data.status !== "all")
        q = q.eq("status", data.status as never);
      if (search)
        q = q.or(
          `client_name.ilike.%${search}%,client_email.ilike.%${search}%,invoice_number.ilike.%${search}%`,
        );

      const { data: rows, error, count } = await q;
      if (error) throw new Error(error.message);

      return {
        rows: (rows ?? []).map((r) => ({
          kind: "invoice" as const,
          id: r.id,
          number: r.invoice_number,
          clientName: r.client_name,
          clientAddress: r.client_address,
          clientEmail: r.client_email,
          createdAt: r.created_at,
          totalTTC: Number(r.total_ttc),
          status: r.status,
          sentAt: r.sent_at,
          hasPdf: Boolean(r.pdf_storage_path),
          format: r.invoice_format ?? "classic_pdf",
          facturxProfile: r.facturx_profile ?? null,
          validationStatus: r.facturx_validation_status ?? null,
          validationSummary: summarizeValidation(r.facturx_validation_errors),
        })),
        total: count ?? 0,
        page,
        pageSize: PAGE_SIZE,
      };
    }

    let q = context.supabase
      .from("quotes")
      .select(
        "id, quote_number, quote_request_id, client_name, client_address, client_email, created_at, total_ttc, status, sent_at, pdf_storage_path",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(from, to);
    if (data.status && data.status !== "all")
      q = q.eq("status", data.status as never);
    if (search)
      q = q.or(
        `client_name.ilike.%${search}%,client_email.ilike.%${search}%,quote_number.ilike.%${search}%`,
      );

    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    const quotes = rows ?? [];

    const ids = quotes.map((r) => r.id);
    const requestIds = quotes
      .map((r) => r.quote_request_id)
      .filter((v): v is string => Boolean(v));

    const [invoiceLinks, requests] = await Promise.all([
      ids.length
        ? context.supabase
            .from("invoices")
            .select("invoice_number, source_quote_id")
            .in("source_quote_id", ids)
        : Promise.resolve({ data: [] as { invoice_number: string; source_quote_id: string | null }[] }),
      requestIds.length
        ? context.supabase.from("quote_requests").select("id, status").in("id", requestIds)
        : Promise.resolve({ data: [] as { id: string; status: string }[] }),
    ]);

    const linkByQuote = new Map<string, string>();
    for (const l of (invoiceLinks.data ?? []) as {
      invoice_number: string;
      source_quote_id: string | null;
    }[]) {
      if (l.source_quote_id) linkByQuote.set(l.source_quote_id, l.invoice_number);
    }
    const statusByRequest = new Map<string, string>();
    for (const r of (requests.data ?? []) as { id: string; status: string }[]) {
      statusByRequest.set(r.id, r.status);
    }

    return {
      rows: quotes.map((r) => {
        const linked = linkByQuote.get(r.id) ?? null;
        const reqStatus = r.quote_request_id
          ? (statusByRequest.get(r.quote_request_id) ?? null)
          : null;
        let blocked: string | null = null;
        if (linked) blocked = `Déjà facturé (${linked})`;
        else if (reqStatus && reqStatus !== "confirmed")
          blocked = "La demande de devis doit être marquée « Traité » avant facturation.";
        return {
          kind: "quote" as const,
          id: r.id,
          number: r.quote_number,
          clientName: r.client_name,
          clientAddress: r.client_address,
          clientEmail: r.client_email,
          createdAt: r.created_at,
          totalTTC: Number(r.total_ttc),
          status: r.status,
          sentAt: r.sent_at,
          hasPdf: Boolean(r.pdf_storage_path),
          linkedInvoiceNumber: linked,
          convertible: !blocked,
          convertBlockedReason: blocked,
        };
      }),
      total: count ?? 0,
      page,
      pageSize: PAGE_SIZE,
    };
  });

export interface QuoteForInvoice {
  quoteId: string;
  quoteNumber: string;
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  clientPhone: string;
  lines: {
    type: "Service" | "Matériel" | "Taux horaire";
    description: string;
    unit_price_ht: number;
    quantity: number;
    tva: 0 | 5.5 | 10 | 20;
  }[];
}

/** Admin-only: quote payload used to prefill the invoice form. */
export const getQuoteForInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ quoteId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<QuoteForInvoice> => {
    const { assertAdmin } = await import("@/lib/quotes.guards.server");
    await assertAdmin(context);

    const { data: quote, error } = await context.supabase
      .from("quotes")
      .select(
        "id, quote_number, quote_request_id, client_name, client_address, client_email, client_phone",
      )
      .eq("id", data.quoteId)
      .maybeSingle();
    if (error || !quote) throw new Error("Devis introuvable.");

    const { data: existing } = await context.supabase
      .from("invoices")
      .select("invoice_number")
      .eq("source_quote_id", quote.id)
      .maybeSingle();
    if (existing)
      throw new Error(
        `Ce devis a déjà été transformé en facture (${existing.invoice_number}).`,
      );

    if (quote.quote_request_id) {
      const { data: req } = await context.supabase
        .from("quote_requests")
        .select("status")
        .eq("id", quote.quote_request_id)
        .maybeSingle();
      if (req && req.status !== "confirmed")
        throw new Error(
          "La demande de devis liée doit être marquée « Traité » avant facturation.",
        );
    }

    const { data: lines, error: linesErr } = await context.supabase
      .from("quote_lines")
      .select("type, description, unit_price_ht, quantity, tva, position")
      .eq("quote_id", quote.id)
      .order("position", { ascending: true });
    if (linesErr) throw new Error(linesErr.message);

    return {
      quoteId: quote.id,
      quoteNumber: quote.quote_number,
      clientName: quote.client_name,
      clientAddress: quote.client_address,
      clientEmail: quote.client_email,
      clientPhone: quote.client_phone ?? "",
      lines: (lines ?? []).map((l) => ({
        type: l.type as QuoteForInvoice["lines"][number]["type"],
        description: l.description,
        unit_price_ht: Number(l.unit_price_ht),
        quantity: Number(l.quantity),
        tva: Number(l.tva) as QuoteForInvoice["lines"][number]["tva"],
      })),
    };
  });
