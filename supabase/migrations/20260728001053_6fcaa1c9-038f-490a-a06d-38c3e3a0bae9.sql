CREATE TABLE public.uploaded_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path text NOT NULL UNIQUE,
  original_filename text NOT NULL,
  mime_type text,
  size_bytes bigint,
  upload_session_id uuid NOT NULL,
  owner_user_id uuid,
  entity_type text,
  entity_id uuid,
  status text NOT NULL DEFAULT 'temporary',
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  deleted_at timestamptz,
  CONSTRAINT uploaded_files_status_check CHECK (status IN ('temporary','confirmed','deleting','deleted','delete_failed')),
  CONSTRAINT uploaded_files_entity_check CHECK (
    (entity_type IS NULL AND entity_id IS NULL) OR (entity_type IS NOT NULL AND entity_id IS NOT NULL)
  )
);

GRANT ALL ON public.uploaded_files TO service_role;

ALTER TABLE public.uploaded_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "block_all_client_access_uploaded_files"
  ON public.uploaded_files
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE INDEX idx_uploaded_files_session ON public.uploaded_files (upload_session_id);
CREATE INDEX idx_uploaded_files_status_created ON public.uploaded_files (status, created_at);
CREATE INDEX idx_uploaded_files_entity ON public.uploaded_files (entity_type, entity_id);