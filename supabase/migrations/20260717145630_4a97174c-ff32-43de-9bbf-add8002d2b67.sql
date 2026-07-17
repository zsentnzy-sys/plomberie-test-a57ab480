
-- form_rate_limit: revoke all API access; only service_role uses it
REVOKE ALL ON public.form_rate_limit FROM anon, authenticated, public;
ALTER TABLE public.form_rate_limit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all access to form_rate_limit" ON public.form_rate_limit;
CREATE POLICY "Deny all access to form_rate_limit"
  ON public.form_rate_limit
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- storage.objects: deny anon/authenticated for the private admin export bucket
DROP POLICY IF EXISTS "Deny access to database_export_17_07_26 bucket" ON storage.objects;
CREATE POLICY "Deny access to database_export_17_07_26 bucket"
  ON storage.objects
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (bucket_id <> 'database_export_17_07_26')
  WITH CHECK (bucket_id <> 'database_export_17_07_26');
