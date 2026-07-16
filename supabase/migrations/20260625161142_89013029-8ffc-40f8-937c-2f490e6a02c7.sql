CREATE TABLE public.form_rate_limit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  form_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.form_rate_limit TO service_role;
ALTER TABLE public.form_rate_limit ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_form_rate_limit_ip_created ON public.form_rate_limit (ip_address, created_at);