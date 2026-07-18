
-- 1. Table request_attachments
CREATE TABLE public.request_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('quote','appointment')),
  storage_path TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_request_attachments_request ON public.request_attachments(request_type, request_id);

-- Grants: server-only, no anon/authenticated exposure.
GRANT ALL ON public.request_attachments TO service_role;

ALTER TABLE public.request_attachments ENABLE ROW LEVEL SECURITY;

-- Restrictive: block all non-service access outright.
CREATE POLICY "block_all_client_access" ON public.request_attachments
  AS RESTRICTIVE FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- 2. Storage.objects policies for the request-attachments bucket:
-- deny anon/authenticated all operations. Only service_role (which bypasses RLS) can touch it.
CREATE POLICY "request_attachments_block_client_access" ON storage.objects
  AS RESTRICTIVE FOR ALL
  TO anon, authenticated
  USING (bucket_id <> 'request-attachments')
  WITH CHECK (bucket_id <> 'request-attachments');
