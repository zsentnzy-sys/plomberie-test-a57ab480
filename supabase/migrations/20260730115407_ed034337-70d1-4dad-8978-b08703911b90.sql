ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS source_quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_source_quote_id_key
  ON public.invoices (source_quote_id)
  WHERE source_quote_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_invoice_with_lines_for_idempotency(
  _idempotency_key text,
  _client_name text,
  _client_address text,
  _client_email text,
  _client_phone text,
  _payment_method text,
  _invoice_date date,
  _artisan_snapshot jsonb,
  _lines jsonb,
  _source_quote_id uuid DEFAULT NULL
)
 RETURNS TABLE(invoice_id uuid, invoice_number text, reused boolean, total_ht numeric, total_tva numeric, total_ttc numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lines jsonb;
  v_ht numeric;
  v_tva numeric;
  v_ttc numeric;
  v_fp text;
  v_id uuid;
  v_num text;
  v_existing_fp text;
  v_existing_status public.invoice_status;
  v_line_count int;
  v_year int := EXTRACT(YEAR FROM _invoice_date)::int;
  v_seq int;
  v_req_status text;
  v_existing_invoice text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF _source_quote_id IS NOT NULL THEN
    SELECT i.invoice_number INTO v_existing_invoice
    FROM public.invoices i
    WHERE i.source_quote_id = _source_quote_id
      AND i.idempotency_key <> _idempotency_key
    LIMIT 1;
    IF v_existing_invoice IS NOT NULL THEN
      RAISE EXCEPTION 'Ce devis a déjà été transformé en facture (%).', v_existing_invoice;
    END IF;

    SELECT qr.status INTO v_req_status
    FROM public.quotes q
    LEFT JOIN public.quote_requests qr ON qr.id = q.quote_request_id
    WHERE q.id = _source_quote_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Devis introuvable.';
    END IF;

    IF v_req_status IS NOT NULL AND v_req_status <> 'confirmed' THEN
      RAISE EXCEPTION 'La demande de devis liée doit être confirmée avant facturation.';
    END IF;
  END IF;

  v_lines := public.normalize_document_lines(_lines);

  SELECT
    sum(round((l->>'unit_price_ht')::numeric * (l->>'quantity')::numeric, 2)),
    sum(round(round((l->>'unit_price_ht')::numeric * (l->>'quantity')::numeric, 2)
        * (l->>'tva')::numeric / 100, 2))
  INTO v_ht, v_tva
  FROM jsonb_array_elements(v_lines) l;
  v_ttc := round(v_ht + v_tva, 2);
  v_ht := round(v_ht, 2);
  v_tva := round(v_tva, 2);

  v_fp := md5(
    coalesce(btrim(_client_name), '') || '|' ||
    coalesce(btrim(_client_address), '') || '|' ||
    lower(coalesce(btrim(_client_email), '')) || '|' ||
    coalesce(btrim(_client_phone), '') || '|' ||
    coalesce(_payment_method, '') || '|' ||
    _invoice_date::text || '|' ||
    v_lines::text || '|' ||
    v_ht::text || '|' || v_tva::text || '|' || v_ttc::text
  );

  SELECT i.id, i.invoice_number, i.payload_fingerprint, i.status
    INTO v_id, v_num, v_existing_fp, v_existing_status
  FROM public.invoices i
  WHERE i.idempotency_key = _idempotency_key;

  IF v_id IS NOT NULL THEN
    IF v_existing_fp IS NOT NULL AND v_existing_fp <> v_fp THEN
      RAISE EXCEPTION 'Cette clé d''idempotence a déjà été utilisée avec des données différentes.';
    END IF;

    SELECT count(*) INTO v_line_count FROM public.invoice_lines il WHERE il.invoice_id = v_id;

    IF v_line_count = 0 AND v_existing_status = 'generation_failed'::public.invoice_status THEN
      INSERT INTO public.invoice_lines (
        invoice_id, position, type, description, unit_price_ht, quantity, tva,
        line_total_ht, line_total_tva, line_total_ttc
      )
      SELECT
        v_id,
        (l->>'position')::int,
        l->>'type',
        l->>'description',
        (l->>'unit_price_ht')::numeric,
        (l->>'quantity')::numeric,
        (l->>'tva')::numeric,
        round((l->>'unit_price_ht')::numeric * (l->>'quantity')::numeric, 2),
        round(round((l->>'unit_price_ht')::numeric * (l->>'quantity')::numeric, 2) * (l->>'tva')::numeric / 100, 2),
        round((l->>'unit_price_ht')::numeric * (l->>'quantity')::numeric, 2)
          + round(round((l->>'unit_price_ht')::numeric * (l->>'quantity')::numeric, 2) * (l->>'tva')::numeric / 100, 2)
      FROM jsonb_array_elements(v_lines) l;

      UPDATE public.invoices
         SET total_ht = v_ht, total_tva = v_tva, total_ttc = v_ttc,
             payload_fingerprint = v_fp, generation_error = NULL,
             status = 'generating'::public.invoice_status
       WHERE id = v_id;
    ELSIF v_existing_fp IS NULL THEN
      UPDATE public.invoices SET payload_fingerprint = v_fp WHERE id = v_id;
    END IF;

    invoice_id := v_id;
    invoice_number := v_num;
    reused := true;
    SELECT i.total_ht, i.total_tva, i.total_ttc INTO total_ht, total_tva, total_ttc
      FROM public.invoices i WHERE i.id = v_id;
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.invoice_counter (year, last_number)
  VALUES (v_year, 1)
  ON CONFLICT (year) DO UPDATE
    SET last_number = public.invoice_counter.last_number + 1,
        updated_at = now()
  RETURNING last_number INTO v_seq;

  v_num := 'FACT-' || v_year::text || '-' || lpad(v_seq::text, 4, '0');

  INSERT INTO public.invoices (
    invoice_number, created_by, client_name, client_address, client_email, client_phone,
    payment_method, invoice_date, total_ht, total_tva, total_ttc, pdf_storage_path,
    idempotency_key, status, artisan_snapshot, payload_fingerprint, source_quote_id
  ) VALUES (
    v_num, auth.uid(), _client_name, _client_address, _client_email, _client_phone,
    _payment_method, _invoice_date, v_ht, v_tva, v_ttc, NULL,
    _idempotency_key, 'generating'::public.invoice_status, _artisan_snapshot, v_fp, _source_quote_id
  )
  RETURNING id INTO v_id;

  INSERT INTO public.invoice_lines (
    invoice_id, position, type, description, unit_price_ht, quantity, tva,
    line_total_ht, line_total_tva, line_total_ttc
  )
  SELECT
    v_id,
    (l->>'position')::int,
    l->>'type',
    l->>'description',
    (l->>'unit_price_ht')::numeric,
    (l->>'quantity')::numeric,
    (l->>'tva')::numeric,
    round((l->>'unit_price_ht')::numeric * (l->>'quantity')::numeric, 2),
    round(round((l->>'unit_price_ht')::numeric * (l->>'quantity')::numeric, 2) * (l->>'tva')::numeric / 100, 2),
    round((l->>'unit_price_ht')::numeric * (l->>'quantity')::numeric, 2)
      + round(round((l->>'unit_price_ht')::numeric * (l->>'quantity')::numeric, 2) * (l->>'tva')::numeric / 100, 2)
  FROM jsonb_array_elements(v_lines) l;

  invoice_id := v_id;
  invoice_number := v_num;
  reused := false;
  total_ht := v_ht;
  total_tva := v_tva;
  total_ttc := v_ttc;
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_invoice_with_lines_for_idempotency(text, text, text, text, text, text, date, jsonb, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_invoice_with_lines_for_idempotency(text, text, text, text, text, text, date, jsonb, jsonb, uuid) TO authenticated, service_role;