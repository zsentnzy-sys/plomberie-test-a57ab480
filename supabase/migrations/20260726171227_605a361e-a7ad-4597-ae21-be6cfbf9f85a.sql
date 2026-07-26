-- ---------------------------------------------------------------
-- Quotes module
-- ---------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quote_status') THEN
    CREATE TYPE public.quote_status AS ENUM (
      'generating','generation_failed','ready','sending','sent',
      'partially_sent','send_failed','accepted','refused','expired','cancelled'
    );
  END IF;
END$$;

-- Annual counter -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quote_counter (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.quote_counter TO service_role;
ALTER TABLE public.quote_counter ENABLE ROW LEVEL SECURITY;

-- Quotes ---------------------------------------------------------
CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number TEXT NOT NULL UNIQUE,
  quote_request_id UUID REFERENCES public.quote_requests(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  client_name TEXT NOT NULL,
  client_address TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT,
  quote_date DATE NOT NULL,
  valid_until DATE NOT NULL,
  notes TEXT,
  total_ht NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_tva NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_ttc NUMERIC(12,2) NOT NULL DEFAULT 0,
  artisan_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  pdf_storage_path TEXT,
  status public.quote_status NOT NULL DEFAULT 'generating',
  generation_error TEXT,
  sent_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  email_client_status TEXT NOT NULL DEFAULT 'pending',
  email_client_error TEXT,
  email_artisan_status TEXT NOT NULL DEFAULT 'pending',
  email_artisan_error TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT quotes_email_client_status_chk CHECK (email_client_status IN ('pending','sent','failed')),
  CONSTRAINT quotes_email_artisan_status_chk CHECK (email_artisan_status IN ('pending','sent','failed')),
  CONSTRAINT quotes_totals_positive_chk CHECK (total_ht >= 0 AND total_tva >= 0 AND total_ttc >= 0),
  CONSTRAINT quotes_totals_coherent_chk CHECK (abs(total_ttc - (total_ht + total_tva)) < 0.01),
  CONSTRAINT quotes_validity_chk CHECK (valid_until >= quote_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage quotes"
ON public.quotes FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_quotes_request ON public.quotes (quote_request_id);

CREATE TRIGGER update_quotes_updated_at
BEFORE UPDATE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Quote lines ----------------------------------------------------
CREATE TABLE public.quote_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  unit_price_ht NUMERIC(12,2) NOT NULL,
  quantity NUMERIC(12,2) NOT NULL,
  tva NUMERIC(4,1) NOT NULL,
  line_total_ht NUMERIC(12,2) NOT NULL,
  line_total_tva NUMERIC(12,2) NOT NULL,
  line_total_ttc NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT quote_lines_position_chk CHECK (position >= 1),
  CONSTRAINT quote_lines_quantity_chk CHECK (quantity > 0),
  CONSTRAINT quote_lines_price_chk CHECK (unit_price_ht >= 0),
  CONSTRAINT quote_lines_tva_chk CHECK (tva IN (0, 5.5, 10, 20)),
  CONSTRAINT quote_lines_totals_chk CHECK (
    line_total_ht >= 0 AND line_total_tva >= 0
    AND abs(line_total_ttc - (line_total_ht + line_total_tva)) < 0.01
  ),
  CONSTRAINT quote_lines_unique_position UNIQUE (quote_id, position)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_lines TO authenticated;
GRANT ALL ON public.quote_lines TO service_role;
ALTER TABLE public.quote_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage quote lines"
ON public.quote_lines FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_quote_lines_quote ON public.quote_lines (quote_id);

-- Atomic idempotent creation ------------------------------------
CREATE OR REPLACE FUNCTION public.create_quote_for_idempotency(
  _idempotency_key text,
  _quote_request_id uuid,
  _client_name text,
  _client_address text,
  _client_email text,
  _client_phone text,
  _quote_date date,
  _valid_until date,
  _notes text,
  _total_ht numeric,
  _total_tva numeric,
  _total_ttc numeric,
  _artisan_snapshot jsonb
)
RETURNS TABLE(quote_id uuid, quote_number text, reused boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_num text;
  v_year int := EXTRACT(YEAR FROM _quote_date)::int;
  v_seq int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT q.id, q.quote_number INTO v_id, v_num
  FROM public.quotes q
  WHERE q.idempotency_key = _idempotency_key;

  IF v_id IS NOT NULL THEN
    quote_id := v_id;
    quote_number := v_num;
    reused := true;
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
    idempotency_key, status
  ) VALUES (
    v_num, _quote_request_id, auth.uid(), _client_name, _client_address,
    _client_email, _client_phone, _quote_date, _valid_until, _notes,
    _total_ht, _total_tva, _total_ttc, _artisan_snapshot, NULL,
    _idempotency_key, 'generating'
  )
  RETURNING id INTO v_id;

  quote_id := v_id;
  quote_number := v_num;
  reused := false;
  RETURN NEXT;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_quote_for_idempotency(text,uuid,text,text,text,text,date,date,text,numeric,numeric,numeric,jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.create_quote_for_idempotency(text,uuid,text,text,text,text,date,date,text,numeric,numeric,numeric,jsonb) TO authenticated;