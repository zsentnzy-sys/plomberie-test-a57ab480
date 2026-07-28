CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('purge-temporary-uploads');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'purge-temporary-uploads',
  '17 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--2ac8cc8b-f0c9-4b74-9068-10830844fc7a.lovable.app/api/public/cleanup-uploads',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpydmRyenJsc2Fhc2hxdnNoeWVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMzUyMjksImV4cCI6MjA5NzcxMTIyOX0.tuJLJRluwkEdo_vjaPQ1roh_HBgXWnFgmGmStqVWARM"}'::jsonb,
    body := '{}'::jsonb
  );
  $cron$
);