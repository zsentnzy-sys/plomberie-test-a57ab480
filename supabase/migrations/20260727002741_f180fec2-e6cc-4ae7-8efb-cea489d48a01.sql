-- Content fingerprints so an idempotency key can't be reused with a different payload.
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payload_fingerprint text;
ALTER TABLE public.quotes    ADD COLUMN IF NOT EXISTS payload_fingerprint text;

-- ============================================================
-- Shared line normalisation + validation helper (jsonb in, jsonb out)
-- ============================================================
CREATE OR REPLACE FUNCTION public.normalize_document_lines(_lines jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_lines jsonb;
  v_line jsonb;
  v_positions int[] := '{}';
  v_pos int;
  v_tva numeric;
  v_qty numeric;
  v_price numeric;
BEGIN
  IF _lines IS NULL OR jsonb_typeof(_lines) <> 'array' OR jsonb_array_length(_lines) = 0 THEN
    RAISE EXCEPTION 'Aucune ligne fournie.';
  END IF;
  IF jsonb_array_length(_lines) > 50 THEN
    RAISE EXCEPTION 'Trop de lignes (maximum 50).';
  END IF;

  SELECT jsonb_agg(l ORDER BY (l->>'position')::int) INTO v_lines
  FROM (
    SELECT jsonb_build_object(
      'position', COALESCE(NULLIF(e.value->>'position','')::int, e.ordinality::int),
      'type', btrim(coalesce(e.value->>'type','')),
      'description', btrim(coalesce(e.value->>'description','')),
      'unit_price_ht', round(coalesce(NULLIF(e.value->>'unit_price_ht','')::numeric, -1), 2),
      'quantity', round(coalesce(NULLIF(e.value->>'quantity','')::numeric, -1), 3),
      'tva', coalesce(NULLIF(e.value->>'tva','')::numeric, -1)
    ) AS l
    FROM jsonb_array_elements(_lines) WITH ORDINALITY AS e(value, ordinality)
  ) s;

  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
    v_pos := (v_line->>'position')::int;
    IF v_pos IS NULL OR v_pos < 1 THEN
      RAISE EXCEPTION 'Position de ligne invalide.';
    END IF;
    IF v_pos = ANY(v_positions) THEN
      RAISE EXCEPTION 'Positions de lignes dupliquées.';
    END IF;
    v_positions := array_append(v_positions, v_pos);

    IF (v_line->>'type') NOT IN ('Service', 'Matériel', 'Taux horaire') THEN
      RAISE EXCEPTION 'Type de ligne invalide.';
    END IF;
    IF length(v_line->>'description') = 0 OR length(v_line->>'description') > 300 THEN
      RAISE EXCEPTION 'Description de ligne invalide.';
    END IF;

    v_price := (v_line->>'unit_price_ht')::numeric;
    IF v_price < 0 OR v_price > 1000000 THEN
      RAISE EXCEPTION 'Prix unitaire invalide.';
    END IF;

    v_qty := (v_line->>'quantity')::numeric;
    IF v_qty <= 0 OR v_qty > 10000 THEN
      RAISE EXCEPTION 'Quantité invalide.';
    END IF;

    v_tva := (v_line->>'tva')::numeric;
    IF v_tva NOT IN (0, 5.5, 10, 20) THEN
      RAISE EXCEPTION 'Taux de TVA invalide.';
    END IF;
  END LOOP;

  RETURN v_lines;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.normalize_document_lines(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_document_lines(jsonb) TO authenticated, service_role;

-- ============================================================
-- Invoices: atomic create (invoice + lines) with idempotency
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_invoice_with_lines_for_idempotency(
  _idempotency_key text,
  _client_name text,
  _client_address text,
  _client_email text,
  _client_phone text,
  _payment_method text,
  _invoice_date date,
  _artisan_snapshot jsonb,
  _lines jsonb
)
RETURNS TABLE(
  invoice_id uuid,
  invoice_number text,
  reused boolean,
  total_ht numeric,
  total_tva numeric,
  total_ttc numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Accès refusé';
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

    -- Bounded repair for pre-migration rows left without lines.
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
    idempotency_key, status, artisan_snapshot, payload_fingerprint
  ) VALUES (
    v_num, auth.uid(), _client_name, _client_address, _client_email, _client_phone,
    _payment_method, _invoice_date, v_ht, v_tva, v_ttc, NULL,
    _idempotency_key, 'generating'::public.invoice_status, _artisan_snapshot, v_fp
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
$$;

REVOKE EXECUTE ON FUNCTION public.create_invoice_with_lines_for_idempotency(text, text, text, text, text, text, date, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_invoice_with_lines_for_idempotency(text, text, text, text, text, text, date, jsonb, jsonb) TO authenticated;

-- ============================================================
-- Quotes: atomic create (quote + lines) with idempotency
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_quote_with_lines_for_idempotency(
  _idempotency_key text,
  _quote_request_id uuid,
  _client_name text,
  _client_address text,
  _client_email text,
  _client_phone text,
  _quote_date date,
  _valid_until date,
  _notes text,
  _artisan_snapshot jsonb,
  _lines jsonb
)
RETURNS TABLE(
  quote_id uuid,
  quote_number text,
  reused boolean,
  total_ht numeric,
  total_tva numeric,
  total_ttc numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lines jsonb;
  v_ht numeric;
  v_tva numeric;
  v_ttc numeric;
  v_fp text;
  v_id uuid;
  v_num text;
  v_existing_fp text;
  v_existing_status public.quote_status;
  v_line_count int;
  v_year int := EXTRACT(YEAR FROM _quote_date)::int;
  v_seq int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF _valid_until < _quote_date THEN
    RAISE EXCEPTION 'La date de validité doit être postérieure à la date du devis.';
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
    coalesce(_quote_request_id::text, '') || '|' ||
    coalesce(btrim(_client_name), '') || '|' ||
    coalesce(btrim(_client_address), '') || '|' ||
    lower(coalesce(btrim(_client_email), '')) || '|' ||
    coalesce(btrim(_client_phone), '') || '|' ||
    _quote_date::text || '|' || _valid_until::text || '|' ||
    coalesce(btrim(_notes), '') || '|' ||
    v_lines::text || '|' ||
    v_ht::text || '|' || v_tva::text || '|' || v_ttc::text
  );

  SELECT q.id, q.quote_number, q.payload_fingerprint, q.status
    INTO v_id, v_num, v_existing_fp, v_existing_status
  FROM public.quotes q
  WHERE q.idempotency_key = _idempotency_key;

  IF v_id IS NOT NULL THEN
    IF v_existing_fp IS NOT NULL AND v_existing_fp <> v_fp THEN
      RAISE EXCEPTION 'Cette clé d''idempotence a déjà été utilisée avec des données différentes.';
    END IF;

    SELECT count(*) INTO v_line_count FROM public.quote_lines ql WHERE ql.quote_id = v_id;

    IF v_line_count = 0 AND v_existing_status = 'generation_failed'::public.quote_status THEN
      INSERT INTO public.quote_lines (
        quote_id, position, type, description, unit_price_ht, quantity, tva,
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

      UPDATE public.quotes
         SET total_ht = v_ht, total_tva = v_tva, total_ttc = v_ttc,
             payload_fingerprint = v_fp, generation_error = NULL,
             status = 'generating'::public.quote_status
       WHERE id = v_id;
    ELSIF v_existing_fp IS NULL THEN
      UPDATE public.quotes SET payload_fingerprint = v_fp WHERE id = v_id;
    END IF;

    quote_id := v_id;
    quote_number := v_num;
    reused := true;
    SELECT q.total_ht, q.total_tva, q.total_ttc INTO total_ht, total_tva, total_ttc
      FROM public.quotes q WHERE q.id = v_id;
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.quote_counter (year, last_number)
  VALUES (v_year, 1)
  ON CONFLICT (year) DO UPDATE
    SET last_number = public.quote_counter.last_number + 1,
        updated_at = now()
  RETURNING last_number INTO v_seq;

  v_num := 'DEV-' || v_year::text || '-' || lpad(v_seq::text, 4, '0');

  INSERT INTO public.quotes (
    quote_number, quote_request_id, created_by, client_name, client_address,
    client_email, client_phone, quote_date, valid_until, notes,
    total_ht, total_tva, total_ttc, artisan_snapshot, pdf_storage_path,
    idempotency_key, status, payload_fingerprint
  ) VALUES (
    v_num, _quote_request_id, auth.uid(), _client_name, _client_address,
    _client_email, _client_phone, _quote_date, _valid_until, _notes,
    v_ht, v_tva, v_ttc, _artisan_snapshot, NULL,
    _idempotency_key, 'generating'::public.quote_status, v_fp
  )
  RETURNING id INTO v_id;

  INSERT INTO public.quote_lines (
    quote_id, position, type, description, unit_price_ht, quantity, tva,
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

  quote_id := v_id;
  quote_number := v_num;
  reused := false;
  total_ht := v_ht;
  total_tva := v_tva;
  total_ttc := v_ttc;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_quote_with_lines_for_idempotency(text, uuid, text, text, text, text, date, date, text, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_quote_with_lines_for_idempotency(text, uuid, text, text, text, text, date, date, text, jsonb, jsonb) TO authenticated;