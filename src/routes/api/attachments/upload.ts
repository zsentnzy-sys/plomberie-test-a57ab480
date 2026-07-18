import { createFileRoute } from '@tanstack/react-router'
import { getRequestIP } from '@tanstack/react-start/server'

// Public multipart upload endpoint for request photos.
// Files are stored in a private bucket; the URL never yields the object back.
// Client generates a random `upload_token` (UUID) and later passes it to
// submitQuote/submitAppointment so the server can associate the staged files
// with the newly-created request.
export const Route = createFileRoute('/api/attachments/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const contentLength = Number(request.headers.get('content-length') || '0')
          if (contentLength > 12 * 1024 * 1024) {
            return Response.json({ error: 'Payload trop volumineux.' }, { status: 413 })
          }
          const ct = request.headers.get('content-type') || ''
          if (!ct.toLowerCase().includes('multipart/form-data')) {
            return Response.json({ error: 'Content-Type invalide.' }, { status: 400 })
          }

          const form = await request.formData()
          const rawToken = form.get('upload_token')
          const rawType = form.get('request_type')
          const files = form.getAll('files').filter((f): f is File => f instanceof File)
          const token = typeof rawToken === 'string' ? rawToken.trim() : ''
          const requestType = rawType === 'quote' || rawType === 'appointment' ? rawType : null

          if (!/^[0-9a-f-]{36}$/i.test(token)) {
            return Response.json({ error: 'Jeton d\u2019upload invalide.' }, { status: 400 })
          }
          if (!requestType) {
            return Response.json({ error: 'Type de demande invalide.' }, { status: 400 })
          }
          if (files.length === 0) {
            return Response.json({ error: 'Aucun fichier fourni.' }, { status: 400 })
          }

          const { validateFiles, storeAttachments, AttachmentValidationError } = await import(
            '@/lib/attachments.server'
          )
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
            if ((count ?? 0) >= 5) {
              return Response.json(
                { error: 'Trop d\u2019uploads. R\u00e9essayez plus tard.' },
                { status: 429 },
              )
            }
            await supabaseAdmin.from('form_rate_limit').insert({ ip_address: ip, form_type: 'attachment' })
          }

          let validated
          try {
            validated = await validateFiles(files)
          } catch (err) {
            if (err instanceof AttachmentValidationError) {
              return Response.json({ error: err.message }, { status: 400 })
            }
            throw err
          }

          // Store under staging/<token>/... — we use the token as the "request_id"
          // slot until the submit call associates it with a real request.
          await storeAttachments(supabaseAdmin, {
            requestType,
            requestId: token,
            files: validated,
          })
          return Response.json({ ok: true, count: validated.length })
        } catch (err) {
          console.error('attachment upload failed', err)
          return Response.json({ error: 'L\u2019envoi des photos a \u00e9chou\u00e9.' }, { status: 500 })
        }
      },
      DELETE: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => null)) as {
            upload_token?: unknown;
            request_type?: unknown;
          } | null

          const token = 
            typeof body?.upload_token === "string"
              ? body.upload_token.trim()
              : "";
          
          const requestType =
            body?.request_type === "quote" ||
            body?.request_type === "appointment"
              ? body.request_type
              : null;

          if (!/^[0-9a-f-]{36}$/i.test(token)) {
            return Response.json(
              { error: "Jeton d\u2019upload invalide." },
              { status: 400 }
            );
          }
          if (!requestType) {
            return Response.json(
              { error: "Type de demande invalide." },
              { status: 400 },
            );
          }
          const {deleteStagedAttachments} = await import('@/lib/attachments.server');
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          const deleted = await deleteStagedAttachments(supabaseAdmin, {
            uploadToken: token,
            requestType,
          });
          return Response.json({
            ok: true,
            deleted,
          });
        } catch (error) {
          console.error('attachment deletion failed', error);
          return Response.json({ error: 'La suppression des photos a échoué.' }, { status: 500 });
        }
      },
    },
  },
})