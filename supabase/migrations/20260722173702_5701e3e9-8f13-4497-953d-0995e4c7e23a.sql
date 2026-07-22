
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  client_name text NOT NULL,
  client_address text NOT NULL,
  client_email text NOT NULL,
  client_phone text,
  payment_method text NOT NULL,
  invoice_date date NOT NULL,
  total_ht numeric(12,2) NOT NULL,
  total_tva numeric(12,2) NOT NULL,
  total_ttc numeric(12,2) NOT NULL,
  pdf_storage_path text NOT NULL,
  email_client_status text NOT NULL DEFAULT 'pending',
  email_client_error text,
  email_artisan_status text NOT NULL DEFAULT 'pending',
  email_artisan_error text,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view invoices"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  position int NOT NULL,
  type text NOT NULL,
  description text NOT NULL,
  unit_price_ht numeric(12,2) NOT NULL,
  quantity numeric(12,2) NOT NULL,
  tva numeric(4,2) NOT NULL,
  line_total_ht numeric(12,2) NOT NULL,
  line_total_ttc numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX invoice_lines_invoice_id_idx ON public.invoice_lines(invoice_id);

GRANT SELECT ON public.invoice_lines TO authenticated;
GRANT ALL ON public.invoice_lines TO service_role;

ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view invoice lines"
  ON public.invoice_lines FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
