
-- Invoices hardening: statuses, artisan snapshot, checks, and transactional idempotent creation.

-- 1) Status enum
DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM (
    'generating','generation_failed','ready','sending','sent','partially_sent','send_failed','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) invoices: new columns
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS status public.invoice_status NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS generation_error text,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS artisan_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Drop default so future rows must set snapshot explicitly.
ALTER TABLE public.invoices ALTER COLUMN artisan_snapshot DROP DEFAULT;
-- Default 'ready' is only used to backfill existing rows; new rows will pass status='generating' explicitly.
ALTER TABLE public.invoices ALTER COLUMN status SET DEFAULT 'generating';

-- Allow pdf to be missing during generation / after failures.
ALTER TABLE public.invoices ALTER COLUMN pdf_storage_path DROP NOT NULL;

-- 3) invoices CHECK constraints
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_email_client_status_chk,
  DROP CONSTRAINT IF EXISTS invoices_email_artisan_status_chk,
  DROP CONSTRAINT IF EXISTS invoices_totals_nonneg_chk,
  DROP CONSTRAINT IF EXISTS invoices_totals_coherent_chk;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_email_client_status_chk
    CHECK (email_client_status IN ('pending','sent','failed')),
  ADD CONSTRAINT invoices_email_artisan_status_chk
    CHECK (email_artisan_status IN ('pending','sent','failed')),
  ADD CONSTRAINT invoices_totals_nonneg_chk
    CHECK (total_ht >= 0 AND total_tva >= 0 AND total_ttc >= 0),
  ADD CONSTRAINT invoices_totals_coherent_chk
    CHECK (abs(total_ttc - (total_ht + total_tva)) < 0.01);

-- 4) invoice_lines: new column + checks + unique(position)
ALTER TABLE public.invoice_lines
  ADD COLUMN IF NOT EXISTS line_total_tva numeric(12,2) NOT NULL DEFAULT 0;

UPDATE public.invoice_lines
  SET line_total_tva = round((line_total_ttc - line_total_ht)::numeric, 2)
  WHERE line_total_tva = 0 AND line_total_ttc <> line_total_ht;

ALTER TABLE public.invoice_lines ALTER COLUMN line_total_tva DROP DEFAULT;

-- Unique position per invoice.
DO $$ BEGIN
  ALTER TABLE public.invoice_lines
    ADD CONSTRAINT invoice_lines_invoice_position_unique UNIQUE (invoice_id, position);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

-- Ensure index exists (idempotent).
CREATE INDEX IF NOT EXISTS invoice_lines_invoice_id_idx
  ON public.invoice_lines(invoice_id);

ALTER TABLE public.invoice_lines
  DROP CONSTRAINT IF EXISTS invoice_lines_position_chk,
  DROP CONSTRAINT IF EXISTS invoice_lines_quantity_chk,
  DROP CONSTRAINT IF EXISTS invoice_lines_unit_price_chk,
  DROP CONSTRAINT IF EXISTS invoice_lines_tva_chk,
  DROP CONSTRAINT IF EXISTS invoice_lines_totals_nonneg_chk,
  DROP CONSTRAINT IF EXISTS invoice_lines_totals_coherent_chk;

ALTER TABLE public.invoice_lines
  ADD CONSTRAINT invoice_lines_position_chk CHECK (position >= 1),
  ADD CONSTRAINT invoice_lines_quantity_chk CHECK (quantity > 0),
  ADD CONSTRAINT invoice_lines_unit_price_chk CHECK (unit_price_ht >= 0),
  ADD CONSTRAINT invoice_lines_tva_chk CHECK (tva IN (0, 5.5, 10, 20)),
  ADD CONSTRAINT invoice_lines_totals_nonneg_chk
    CHECK (line_total_ht >= 0 AND line_total_tva >= 0 AND line_total_ttc >= 0),
  ADD CONSTRAINT invoice_lines_totals_coherent_chk
    CHECK (abs(line_total_ttc - (line_total_ht + line_total_tva)) < 0.01);

-- 5) Transactional idempotent creation RPC.
CREATE OR REPLACE FUNCTION public.create_invoice_for_idempotency(
  _idempotency_key text,
  _client_name text,
  _client_address text,
  _client_email text,
  _client_phone text,
  _payment_method text,
  _invoice_date date,
  _total_ht numeric,
  _total_tva numeric,
  _total_ttc numeric,
  _artisan_snapshot jsonb
)
RETURNS TABLE (invoice_id uuid, invoice_number text, reused boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_num text;
  v_year int := EXTRACT(YEAR FROM _invoice_date)::int;
  v_seq int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  -- Existing? Return it.
  SELECT i.id, i.invoice_number INTO v_id, v_num
  FROM public.invoices i
  WHERE i.idempotency_key = _idempotency_key;

  IF v_id IS NOT NULL THEN
    invoice_id := v_id;
    invoice_number := v_num;
    reused := true;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Reserve number atomically for the invoice year.
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
    idempotency_key, status, artisan_snapshot
  ) VALUES (
    v_num, auth.uid(), _client_name, _client_address, _client_email, _client_phone,
    _payment_method, _invoice_date, _total_ht, _total_tva, _total_ttc, NULL,
    _idempotency_key, 'generating', _artisan_snapshot
  )
  RETURNING id INTO v_id;

  invoice_id := v_id;
  invoice_number := v_num;
  reused := false;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.create_invoice_for_idempotency(text,text,text,text,text,text,date,numeric,numeric,numeric,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_invoice_for_idempotency(text,text,text,text,text,text,date,numeric,numeric,numeric,jsonb) TO authenticated;
