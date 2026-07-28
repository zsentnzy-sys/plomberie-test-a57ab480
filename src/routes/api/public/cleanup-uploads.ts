import { createFileRoute } from '@tanstack/react-router'

/**
 * Scheduled purge of abandoned temporary uploads (pg_cron, hourly).
 * Caller is authenticated with the project publishable key.
 */
async function handle(request: Request) {
  const provided =
    request.headers.get('apikey') ||
    (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const expected = process.env.SUPABASE_PUBLISHABLE_KEY || ''
  if (!expected || provided !== expected) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const { purgeExpiredTemporaryFiles } = await import('@/lib/attachments.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const result = await purgeExpiredTemporaryFiles(supabaseAdmin, { limit: 100 })
    return Response.json({ ok: true, ...result })
  } catch (err) {
    console.error('cleanup-uploads failed', err)
    return Response.json({ ok: false, error: 'cleanup_failed' }, { status: 500 })
  }
}

export const Route = createFileRoute('/api/public/cleanup-uploads')({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
})
