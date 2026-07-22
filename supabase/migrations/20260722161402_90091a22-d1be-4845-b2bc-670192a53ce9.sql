-- Invoice number counter (per year). Only the sequential number is persisted;
-- invoice contents are generated on demand and never stored server-side.

CREATE TABLE public.invoice_counter (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.invoice_counter TO service_role;

ALTER TABLE public.invoice_counter ENABLE ROW LEVEL SECURITY;
-- No policy: only service_role (bypasses RLS) may touch the counter.

-- Reserve the next invoice number for the current year, atomically.
-- SECURITY DEFINER so authenticated admins can call it without needing
-- direct table privileges. Admin check is enforced inside the function.
CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM now())::int;
  v_num INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  INSERT INTO public.invoice_counter (year, last_number)
  VALUES (v_year, 1)
  ON CONFLICT (year) DO UPDATE
    SET last_number = public.invoice_counter.last_number + 1,
        updated_at = now()
  RETURNING last_number INTO v_num;

  RETURN 'FACT-' || v_year::text || '-' || lpad(v_num::text, 4, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_invoice_number() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO authenticated;