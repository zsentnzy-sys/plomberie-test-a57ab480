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
  invoice_format?: string | null;
  customer_type?: string | null;
  customer_siren?: string | null;
  customer_siret?: string | null;
  customer_vat_number?: string | null;
  customer_country_code?: string | null;
  vat_on_debits?: boolean | null;
  delivery_address?: string | null;
  delivery_date?: string | null;
  payment_due_date?: string | null;
  payment_reference?: string | null;
  purchase_order_reference?: string | null;
  service_period_start?: string | null;
  service_period_end?: string | null;
}

export async function loadInvoice(invoiceId: string): Promise<StoredInvoice> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("invoices")
    .select(
      "id, invoice_number, invoice_date, payment_method, client_name, client_address, client_email, client_phone, total_ht, total_tva, total_ttc, artisan_snapshot, pdf_storage_path, status, email_client_status, email_client_error, email_artisan_status, email_artisan_error, invoice_format, customer_type, customer_siren, customer_siret, customer_vat_number, customer_country_code, vat_on_debits, delivery_address, delivery_date, payment_due_date, payment_reference, purchase_order_reference, service_period_start, service_period_end",
    )
    .eq("id", invoiceId)
    .single();
  if (error || !data) throw new Error("Facture introuvable.");
  return data as unknown as StoredInvoice;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
    .select(
      "position, type, description, unit_price_ht, quantity, tva, unit_code, vat_category_code",
    )
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

  const isFacturx = (row.invoice_format ?? "classic_pdf") === "facturx";
  const artisan = artisanFromSnapshot(row.artisan_snapshot as never);

  // Common data model + regulatory validation happen BEFORE any rendering, so
  // an invalid invoice never produces a downloadable document.
  let structured: import("@/lib/facturx/structured-invoice.types").StructuredInvoiceData | null =
    null;
  let xml: string | null = null;
  if (isFacturx) {
    const { buildStructuredInvoice } = await import(
      "@/lib/facturx/structured-invoice.server"
    );
    const { buildFacturxXml, validateStructuredInvoice, validateXmlSyntax } =
      await import("@/lib/facturx/facturx-xml.server");
    const { toCents, compareAmounts } = await import("@/lib/facturx/money.server");

    structured = buildStructuredInvoice({
      row: { ...row, ...{ total_ht: row.total_ht } },
      lines: persisted as never,
      artisan,
    });

    const mismatches = compareAmounts(
      "db",
      {
        totalHT: toCents(Number(row.total_ht)),
        totalTVA: toCents(Number(row.total_tva)),
        totalTTC: toCents(Number(row.total_ttc)),
      },
      {
        totalHT: structured.totals.lineTotalCents,
        totalTVA: structured.totals.taxTotalCents,
        totalTTC: structured.totals.grandTotalCents,
      },
    );
    if (mismatches.length) {
      await persistRuntimeValidation(
        row.id,
        "failed",
        mismatches.map((m) => `${m.field} : attendu ${m.expected}, obtenu ${m.actual}`),
      );
      throw new Error("Incohérence de montants détectée : génération interrompue.");
    }

    const rules = validateStructuredInvoice(structured);
    if (!rules.valid) {
      await persistRuntimeValidation(row.id, "failed", rules.errors);
      throw new Error(`Facture non conforme EN 16931 : ${rules.errors[0]}`);
    }
    xml = buildFacturxXml(structured);
    const syntax = validateXmlSyntax(xml);
    if (!syntax.valid) {
      await persistRuntimeValidation(row.id, "failed", syntax.errors);
      throw new Error("XML Factur-X invalide : génération interrompue.");
    }
  }

  let bytes: Uint8Array;
  try {
    bytes = await generateInvoicePdf({
      invoiceNumber: row.invoice_number,
      artisan,
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
    if (isFacturx && xml) {
      const { toFacturxPdfA3, assertPdfA3Structure } = await import(
        "@/lib/facturx/facturx-pdfa.server"
      );
      bytes = await toFacturxPdfA3(bytes, {
        invoiceNumber: row.invoice_number,
        producer: artisan.company || "Facturation",
        xml,
      });
      const structure = await assertPdfA3Structure(bytes);
      if (!structure.valid) {
        await persistRuntimeValidation(row.id, "failed", structure.errors);
        throw new Error(`PDF/A-3 non conforme : ${structure.errors[0]}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const { error: generationErrorUpdateError } = await supabaseAdmin
      .from("invoices")
      .update({ generation_error: msg })
      .eq("id", row.id);

    if (generationErrorUpdateError) {
      console.error("Impossible d’enregistrer l’erreur de génération du PDF", {
        invoiceId: row.id,
        originalGenerationError: msg,
        databaseCode: generationErrorUpdateError.code,
        databaseMessage: generationErrorUpdateError.message,
      });
      
      throw new Error("Génération du PDF impossible et l’erreur n’a pas pu être enregistrée.");
    }

    throw new Error("Génération du PDF impossible.");
  }

  const path = `invoices/${row.invoice_date.slice(0, 4)}/${row.invoice_number}.pdf`;
  await uploadDocumentPdf(path, bytes);

  // Only PDF/compliance columns are touched here — never the send state.
  const compliance: Record<string, unknown> = {
    pdf_storage_path: path,
    generation_error: null,
    pdf_sha256: await sha256Hex(bytes),
  };
  if (!isFacturx) {
    Object.assign(compliance, {
      runtime_validation_status: "not_applicable",
      external_validation_status: "not_applicable",
      generator_qualification_status: "unqualified",
    });
  }
  if (isFacturx && structured) {
    const { FACTURX_CONFIG, GENERATOR_QUALIFICATION } = await import(
      "@/lib/facturx/facturx-config.server"
    );
    const xmlPath = `invoices/${row.invoice_date.slice(0, 4)}/${row.invoice_number}-factur-x.xml`;
    const xmlUpload = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(xmlPath, new TextEncoder().encode(xml ?? ""), {
        contentType: "application/xml",
        upsert: true,
      });
    if (xmlUpload.error) {
      throw new Error("Écriture du XML Factur-X impossible : génération interrompue.");
    }
    Object.assign(compliance, {
      xml_storage_path: xmlPath,
      // The version actually implemented by this generator — never the XMP value.
      facturx_version: FACTURX_CONFIG.implementedSpecificationVersion,
      facturx_profile: FACTURX_CONFIG.profileLabel,
      generator_version: FACTURX_CONFIG.generatorVersion,
      document_schema_version: FACTURX_CONFIG.documentSchemaVersion,
      validation_artifacts_version: FACTURX_CONFIG.validationArtifactsVersion,
      // Internal self-checks only. Never a claim of official conformity.
      runtime_validation_status: "passed",
      generator_qualification_status: GENERATOR_QUALIFICATION,
      external_validation_status: "not_run",
      // Deprecated column, kept for backward compatibility only.
      facturx_validation_status: "pending",
      facturx_validation_errors: null,
      facturx_validated_at: new Date().toISOString(),
      transaction_classification: structured.classification,
      structured_invoice_snapshot: structured as unknown as Record<string, unknown>,
    });
  }
  const { assertSupabaseWriteSucceeded } = await import(
    "@/lib/supabase-write.server"
  );
  
  const { error: complianceUpdateError } = await supabaseAdmin
    .from("invoices")
    .update(compliance as never)
    .eq("id", row.id);
  assertSupabaseWriteSucceeded(
    complianceUpdateError,
    "la finalisation des métadonnées de la facture",
  );

  row.pdf_storage_path = path;
  return bytes;
}

/**
 * Persists the result of the INTERNAL self-checks only. It never touches the
 * generator qualification nor the external validation status: neither can be
 * earned at runtime.
 */
async function persistRuntimeValidation(
  invoiceId: string,
  status: "passed" | "failed" | "pending",
  errors: string[],
): Promise<void> {
  const { supabaseAdmin } = await import(
    "@/integrations/supabase/client.server"
  );
  const { assertSupabaseWriteSucceeded } = await import(
    "@/lib/supabase-write.server"
  );

  const { error } = await supabaseAdmin
    .from("invoices")
    .update({
      runtime_validation_status: status,
      generator_qualification_status: "unqualified",
      external_validation_status: "not_run",
      facturx_validation_errors: errors.length
        ? (errors as never)
        : null,
      facturx_validated_at: new Date().toISOString(),
    } as never)
    .eq("id", invoiceId);

  assertSupabaseWriteSucceeded(
    error,
    "l’enregistrement des auto-contrôles Factur-X",
  );
}
