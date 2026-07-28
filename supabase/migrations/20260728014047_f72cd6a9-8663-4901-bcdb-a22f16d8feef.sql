-- 1. Extended status vocabulary
ALTER TABLE public.uploaded_files DROP CONSTRAINT IF EXISTS uploaded_files_status_check;
ALTER TABLE public.uploaded_files ADD CONSTRAINT uploaded_files_status_check
  CHECK (status = ANY (ARRAY[
    'reserved','uploading','temporary','confirming','confirmed',
    'deleting','deleted','delete_failed','upload_failed'
  ]));

-- 2. Lifecycle bookkeeping columns
ALTER TABLE public.uploaded_files
  ADD COLUMN IF NOT EXISTS temporary_storage_path text,
  ADD COLUMN IF NOT EXISTS delete_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_delete_error text,
  ADD COLUMN IF NOT EXISTS next_delete_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS reservation_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_uploaded_files_session_status
  ON public.uploaded_files (upload_session_id, status);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_retry
  ON public.uploaded_files (status, next_delete_retry_at);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_temp_residue
  ON public.uploaded_files (next_delete_retry_at)
  WHERE temporary_storage_path IS NOT NULL;

-- 3. Idempotent attachment rows
CREATE UNIQUE INDEX IF NOT EXISTS request_attachments_storage_path_key
  ON public.request_attachments (storage_path);

-- 4. Transactional reservation (concurrency-safe 2-file limit)
CREATE OR REPLACE FUNCTION public.reserve_upload_files(
  _upload_session_id uuid,
  _files jsonb,
  _max_files integer DEFAULT 2,
  _ttl_minutes integer DEFAULT 30
)
RETURNS TABLE(id uuid, storage_path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_used integer;
  v_file jsonb;
  v_ext text;
  v_id uuid;
  v_path text;
BEGIN
  IF _upload_session_id IS NULL THEN
    RAISE EXCEPTION 'upload_session_id requis';
  END IF;
  v_count := coalesce(jsonb_array_length(_files), 0);
  IF v_count = 0 THEN
    RETURN;
  END IF;
  IF v_count > _max_files THEN
    RAISE EXCEPTION 'too_many_files';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_upload_session_id::text, 42));

  -- Expired reservations no longer occupy a slot.
  SELECT count(*) INTO v_used
  FROM public.uploaded_files f
  WHERE f.upload_session_id = _upload_session_id
    AND (
      f.status IN ('temporary','confirming','confirmed','deleting')
      OR (f.status IN ('reserved','uploading')
          AND coalesce(f.reservation_expires_at, f.created_at + interval '30 minutes') > now())
    );

  IF v_used + v_count > _max_files THEN
    RAISE EXCEPTION 'too_many_files';
  END IF;

  FOR v_file IN SELECT * FROM jsonb_array_elements(_files) LOOP
    v_ext := coalesce(nullif(regexp_replace(coalesce(v_file->>'ext',''), '[^a-z0-9]', '', 'g'), ''), 'bin');
    v_id := gen_random_uuid();
    v_path := 'temporary/' || _upload_session_id::text || '/' || v_id::text || '.' || v_ext;

    INSERT INTO public.uploaded_files (
      id, storage_path, original_filename, mime_type, size_bytes,
      upload_session_id, status, reservation_expires_at
    ) VALUES (
      v_id, v_path,
      left(coalesce(nullif(btrim(v_file->>'filename'), ''), 'photo'), 120),
      nullif(v_file->>'mime', ''),
      nullif(v_file->>'size', '')::bigint,
      _upload_session_id, 'reserved',
      now() + make_interval(mins => greatest(_ttl_minutes, 1))
    );

    id := v_id;
    storage_path := v_path;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_upload_files(uuid, jsonb, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_upload_files(uuid, jsonb, integer, integer) TO service_role;

-- 5. Transactional finalization: confirmed only if the attachment row exists
CREATE OR REPLACE FUNCTION public.finalize_uploaded_file(
  _file_id uuid,
  _final_path text,
  _temporary_path text,
  _entity_type text,
  _entity_id uuid,
  _legacy_request_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.uploaded_files;
BEGIN
  UPDATE public.uploaded_files f
     SET storage_path = _final_path,
         temporary_storage_path = _temporary_path,
         status = 'confirmed',
         entity_type = _entity_type,
         entity_id = _entity_id,
         confirmed_at = now()
   WHERE f.id = _file_id
     AND f.status = 'confirming'
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RETURN false;
  END IF;

  IF _legacy_request_type IS NOT NULL THEN
    INSERT INTO public.request_attachments (
      request_id, request_type, storage_path, original_filename, mime_type, size_bytes
    ) VALUES (
      _entity_id, _legacy_request_type, _final_path,
      v_row.original_filename,
      coalesce(v_row.mime_type, 'application/octet-stream'),
      coalesce(v_row.size_bytes, 0)::integer
    )
    ON CONFLICT (storage_path) DO UPDATE
      SET request_id = EXCLUDED.request_id,
          request_type = EXCLUDED.request_type,
          original_filename = EXCLUDED.original_filename,
          mime_type = EXCLUDED.mime_type,
          size_bytes = EXCLUDED.size_bytes;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_uploaded_file(uuid, text, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_uploaded_file(uuid, text, text, text, uuid, text) TO service_role;

-- 6. Cleanup cron now authenticates with a dedicated vault secret (no key literal here)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT jobname FROM cron.job WHERE command ILIKE '%cleanup-uploads%' LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cleanup-temporary-uploads',
  '17 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--2ac8cc8b-f0c9-4b74-9068-10830844fc7a.lovable.app/api/public/cleanup-uploads',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce((
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'upload_cleanup_secret'
      ), '')
    ),
    body := '{}'::jsonb
  );
  $cron$
);