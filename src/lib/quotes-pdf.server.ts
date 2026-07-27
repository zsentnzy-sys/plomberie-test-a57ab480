// Server-only: fetch (or rebuild) the stored PDF of an existing quote.
// Regeneration ONLY touches pdf_storage_path / generation_error.
const BUCKET = "request-attachments";

export interface StoredQuote {
  id: string;
  quote_number: string;
  quote_date: string;
  valid_until: string;
  notes: string | null;
  client_name: string;
  client_address: string;
  client_email: string;
  client_phone: string | null;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  artisan_snapshot: unknown;
  pdf_storage_path: string | null;
  status: string;
}

export async function loadQuote(quoteId: string): Promise<StoredQuote> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("quotes")
    .select(
      "id, quote_number, quote_date, valid_until, notes, client_name, client_address, client_email, client_phone, total_ht, total_tva, total_ttc, artisan_snapshot, pdf_storage_path, status",
    )
    .eq("id", quoteId)
    .single();
  if (error || !data) throw new Error("Devis introuvable.");
  return data as unknown as StoredQuote;
}

export async function ensureQuotePdf(row: StoredQuote): Promise<Uint8Array> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (row.pdf_storage_path) {
    const dl = await supabaseAdmin.storage.from(BUCKET).download(row.pdf_storage_path);
    if (!dl.error && dl.data) return new Uint8Array(await dl.data.arrayBuffer());
  }

  const { computeTotals, artisanFromSnapshot, uploadDocumentPdf } = await import(
    "@/lib/documents.server"
  );
  const { generateQuotePdf } = await import("@/lib/quotes.server");

  const { data: persisted, error: linesErr } = await supabaseAdmin
    .from("quote_lines")
    .select("position, type, description, unit_price_ht, quantity, tva")
    .eq("quote_id", row.id)
    .order("position", { ascending: true });
  if (linesErr || !persisted || persisted.length === 0) {
    throw new Error("Lignes du devis introuvables : impossible de régénérer le PDF.");
  }

  const lines = persisted.map((l) => ({
    type: l.type as "Service" | "Matériel" | "Taux horaire",
    description: l.description,
    unit_price_ht: Number(l.unit_price_ht),
    quantity: Number(l.quantity),
    tva: Number(l.tva) as 0 | 5.5 | 10 | 20,
  }));

  let bytes: Uint8Array;
  try {
    bytes = await generateQuotePdf({
      quoteNumber: row.quote_number,
      artisan: artisanFromSnapshot(row.artisan_snapshot as never),
      input: {
        client_name: row.client_name,
        client_address: row.client_address,
        client_email: row.client_email,
        client_phone: row.client_phone ?? undefined,
        quote_date: row.quote_date,
        valid_until: row.valid_until,
        notes: row.notes ?? undefined,
        lines,
      },
      totals: computeTotals(lines),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabaseAdmin.from("quotes").update({ generation_error: msg }).eq("id", row.id);
    throw new Error("Génération du PDF du devis impossible.");
  }

  const path = `quotes/${row.quote_date.slice(0, 4)}/${row.quote_number}.pdf`;
  await uploadDocumentPdf(path, bytes);
  await supabaseAdmin
    .from("quotes")
    .update({ pdf_storage_path: path, generation_error: null })
    .eq("id", row.id);
  row.pdf_storage_path = path;
  return bytes;
}
