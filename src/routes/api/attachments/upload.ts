import { createFileRoute } from '@tanstack/react-router'
import { getRequestIP } from '@tanstack/react-start/server'

const UUID_RE = /^[0-9a-f-]{36}$/i
const MAX_FILES_PER_SESSION = 2

function badRequest(message: string, status = 400) {
  return Response.json({ error: message }, { status })
}

/**
 * Public endpoint handling the temporary lifecycle of request photos.
 * Files land in a private bucket under temporary/<uploadSessionId>/ and are
 * only attached to a request once the form submission confirms them.
 */
export const Route = createFileRoute('/api/attachments/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const contentLength = Number(request.headers.get('content-length') || '0')
          if (contentLength > 12 * 1024 * 1024) {
            return badRequest('Payload trop volumineux.', 413)
          }
          const ct = request.headers.get('content-type') || ''
          if (!ct.toLowerCase().includes('multipart/form-data')) {
            return badRequest('Content-Type invalide.')
          }

          const form = await request.formData()
          const rawSession = form.get('upload_session_id')
          const files = form.getAll('files').filter((f): f is File => f instanceof File)
          const sessionId = typeof rawSession === 'string' ? rawSession.trim() : ''

          if (!UUID_RE.test(sessionId)) {
            return badRequest('Session d\u2019envoi invalide.')
          }
          if (files.length === 0) {
            return badRequest('Aucun fichier fourni.')
          }

          const {
            validateFiles,
            storeTemporaryFiles,
            countSessionFiles,
            AttachmentValidationError,
          } = await import('@/lib/attachments.server')
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

          // Rate limit by IP (reuses form_rate_limit)
          let ip: string | null = null
          try {
            ip = getRequestIP({ xForwardedFor: true }) ?? null
          } catch {
            ip = null
          }
          if (ip) {
            const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
            const { count } = await supabaseAdmin
              .from('form_rate_limit')
              .select('id', { count: 'exact', head: true })
              .eq('ip_address', ip)
              .eq('form_type', 'attachment')
              .gte('created_at', tenMinAgo)
            if ((count ?? 0) >= 10) {
              return badRequest('Trop d\u2019envois. R\u00e9essayez plus tard.', 429)
            }
            await supabaseAdmin.from('form_rate_limit').insert({ ip_address: ip, form_type: 'attachment' })
          }

          const existing = await countSessionFiles(supabaseAdmin, sessionId)
          if (existing + files.length > MAX_FILES_PER_SESSION) {
            return badRequest(`Vous pouvez joindre ${MAX_FILES_PER_SESSION} photos maximum.`)
          }

          let validated
          try {
            validated = await validateFiles(files)
          } catch (err) {
            if (err instanceof AttachmentValidationError) {
              return badRequest(err.message)
            }
            throw err
          }

          const stored = await storeTemporaryFiles(supabaseAdmin, {
            uploadSessionId: sessionId,
            files: validated,
          })
          return Response.json({ ok: true, files: stored })
        } catch (err) {
          console.error('attachment upload failed', err)
          return badRequest('L\u2019envoi des photos a \u00e9chou\u00e9.', 500)
        }
      },

      DELETE: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => null)) as {
            upload_session_id?: unknown
            file_id?: unknown
          } | null

          const sessionId =
            typeof body?.upload_session_id === 'string' ? body.upload_session_id.trim() : ''
          const fileId = typeof body?.file_id === 'string' ? body.file_id.trim() : ''

          if (!UUID_RE.test(sessionId)) {
            return badRequest('Session d\u2019envoi invalide.')
          }

          const { deleteTemporaryFile, abandonUploadSession } = await import(
            '@/lib/attachments.server'
          )
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

          if (fileId) {
            if (!UUID_RE.test(fileId)) return badRequest('Fichier invalide.')
            const ok = await deleteTemporaryFile(supabaseAdmin, {
              uploadSessionId: sessionId,
              fileId,
            })
            if (!ok) return badRequest('Ce fichier ne peut plus \u00eatre supprim\u00e9.', 409)
            return Response.json({ ok: true, deleted: 1 })
          }

          const deleted = await abandonUploadSession(supabaseAdmin, sessionId)
          return Response.json({ ok: true, deleted })
        } catch (error) {
          console.error('attachment deletion failed', error)
          return badRequest('La suppression des photos a \u00e9chou\u00e9.', 500)
        }
      },
    },
  },
})
