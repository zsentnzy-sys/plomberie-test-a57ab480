ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS runtime_validation_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS generator_qualification_status text NOT NULL DEFAULT 'unqualified',
  ADD COLUMN IF NOT EXISTS external_validation_status text NOT NULL DEFAULT 'not_run',
  ADD COLUMN IF NOT EXISTS generator_version text,
  ADD COLUMN IF NOT EXISTS document_schema_version text,
  ADD COLUMN IF NOT EXISTS validation_artifacts_version text;

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_runtime_validation_status_check,
  DROP CONSTRAINT IF EXISTS invoices_generator_qualification_status_check,
  DROP CONSTRAINT IF EXISTS invoices_external_validation_status_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_runtime_validation_status_check
    CHECK (runtime_validation_status IN ('not_applicable','pending','passed','failed')),
  ADD CONSTRAINT invoices_generator_qualification_status_check
    CHECK (generator_qualification_status IN ('unqualified','qualified','qualification_failed')),
  ADD CONSTRAINT invoices_external_validation_status_check
    CHECK (external_validation_status IN ('not_applicable','not_run','valid','invalid'));

-- Backfill: classic PDFs are out of scope for Factur-X checks.
UPDATE public.invoices
   SET runtime_validation_status = 'not_applicable',
       generator_qualification_status = 'unqualified',
       external_validation_status = 'not_applicable'
 WHERE coalesce(invoice_format, 'classic_pdf') <> 'facturx';

-- Backfill: hybrid invoices keep only what the old field actually proves.
UPDATE public.invoices
   SET runtime_validation_status = CASE facturx_validation_status
         WHEN 'valid' THEN 'passed'
         WHEN 'invalid' THEN 'failed'
         ELSE 'pending'
       END,
       generator_qualification_status = 'unqualified',
       external_validation_status = 'not_run'
 WHERE coalesce(invoice_format, 'classic_pdf') = 'facturx';

COMMENT ON COLUMN public.invoices.facturx_validation_status IS
  'DEPRECATED (Phase A) : conservé pour compatibilité. Ne pas utiliser comme preuve de conformité ni comme source d''affichage. Utiliser runtime_validation_status / generator_qualification_status / external_validation_status.';
COMMENT ON COLUMN public.invoices.runtime_validation_status IS
  'Auto-contrôles internes de génération uniquement (not_applicable|pending|passed|failed). Ne vaut pas validation officielle Factur-X.';
COMMENT ON COLUMN public.invoices.generator_qualification_status IS
  'Qualification CI du moteur de génération (unqualified|qualified|qualification_failed).';
COMMENT ON COLUMN public.invoices.external_validation_status IS
  'Validation externe individuelle du document (not_applicable|not_run|valid|invalid).';

CREATE OR REPLACE FUNCTION public.set_invoice_validation_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(NEW.invoice_format, 'classic_pdf') = 'facturx' THEN
    NEW.runtime_validation_status := 'pending';
    NEW.external_validation_status := 'not_run';
  ELSE
    NEW.runtime_validation_status := 'not_applicable';
    NEW.external_validation_status := 'not_applicable';
  END IF;
  NEW.generator_qualification_status := 'unqualified';
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_invoice_validation_defaults() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS set_invoice_validation_defaults_trg ON public.invoices;
CREATE TRIGGER set_invoice_validation_defaults_trg
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_invoice_validation_defaults();