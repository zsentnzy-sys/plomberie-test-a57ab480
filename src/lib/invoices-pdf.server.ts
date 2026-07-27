// Server-only: fetch (or rebuild) the stored PDF of an existing invoice.
// Regeneration ONLY touches pdf_storage_path / generation_error — it must
// never overwrite the send state (email_*_status, status, sent_at).
const BUCKET = "request-attachments";

export interface StoredInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  payment_method: string;
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
  email_client_status: string | null;
  email_client_error: string | null;
  email_artisan_status: string | null;
  email_artisan_error: string | null;
}

export async function loadInvoice(invoiceId: string): Promise<StoredInvoice> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("invoices")
    .select(
      "id, invoice_number, invoice_date, payment_method, client_name, client_address, client_email, client_phone, total_ht, total_tva, total_ttc, artisan_snapshot, pdf_storage_path, status, email_client_status, email_client_error, email_artisan_status, email_artisan_error",
    )
    .eq("id", invoiceId)
    .single();
  if (error || !data) throw new Error("Facture introuvable.");
  return data as unknown as StoredInvoice;
}

/** Download the stored PDF, regenerating it from persisted rows if needed. */
export async function ensureInvoicePdf(row: StoredInvoice): Promise<Uint8Array> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (row.pdf_storage_path) {
    const dl = await supabaseAdmin.storage.from(BUCKET).download(row.pdf_storage_path);
    if (!dl.error && dl.data) return new Uint8Array(await dl.data.arrayBuffer());
  }

  const { computeTotals, artisanFromSnapshot, uploadDocumentPdf } = await import(
    "@/lib/documents.server"
  );
  const { generateInvoicePdf } = await import("@/lib/invoices.server");

  const { data: persisted, error: linesErr } = await supabaseAdmin
    .from("invoice_lines")
    .select("position, type, description, unit_price_ht, quantity, tva")
    .eq("invoice_id", row.id)
    .order("position", { ascending: true });
  if (linesErr || !persisted || persisted.length === 0) {
    throw new Error("Lignes de facture introuvables : impossible de régénérer le PDF.");
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
    bytes = await generateInvoicePdf({
      invoiceNumber: row.invoice_number,
      artisan: artisanFromSnapshot(row.artisan_snapshot as never),
      input: {
        client_name: row.client_name,
        client_address: row.client_address,
        client_email: row.client_email,
        client_phone: row.client_phone ?? undefined,
        payment_method: row.payment_method as
          | "Carte bancaire"
          | "Virement bancaire"
          | "Chèque"
          | "Espèces",
        invoice_date: row.invoice_date,
        lines,
      },
      totals: computeTotals(lines),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabaseAdmin.from("invoices").update({ generation_error: msg }).eq("id", row.id);
    throw new Error("Génération du PDF impossible.");
  }

  const path = `invoices/${row.invoice_date.slice(0, 4)}/${row.invoice_number}.pdf`;
  await uploadDocumentPdf(path, bytes);
  // Only the PDF-related columns are touched here.
  await supabaseAdmin
    .from("invoices")
    .update({ pdf_storage_path: path, generation_error: null })
    .eq("id", row.id);
  row.pdf_storage_path = path;
  return bytes;
}
