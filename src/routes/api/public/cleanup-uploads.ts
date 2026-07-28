import { createFileRoute } from '@tanstack/react-router'

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Scheduled purge of abandoned temporary uploads (pg_cron, hourly).
 * Caller must present the dedicated cleanup secret as a bearer token.
 */
async function handle(request: Request) {
  const provided = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  const expected = (process.env.UPLOAD_CLEANUP_SECRET || '').trim()
  if (!expected || !provided || !safeEqual(provided, expected)) {
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
