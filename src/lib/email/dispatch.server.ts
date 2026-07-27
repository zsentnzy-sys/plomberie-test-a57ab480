import * as React from 'react'
import { render } from '@react-email/components'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'Plomberie Dupont'
const SENDER_DOMAIN = 'notify.normalweb.cloud'
const FROM_DOMAIN = 'normalweb.cloud'
const FROM_LOCAL_PART = 'contact'

/** Owner notifications always go here. */
export const OWNER_EMAIL = 'sentnzy@gmail.com'

export const PUBLIC_REPLY_TO_MAIL = 'contact@normalweb.cloud'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Render a registered transactional template and enqueue it for delivery.
 * Safe to call from public server functions — uses the service-role client.
 * Never throws; failures are logged (and traced in email_send_log) so they
 * don't block form submission. Returns true when the email was queued.
 */
export async function enqueueTransactionalEmail(params: {
  templateName: string
  recipientEmail: string
  idempotencyKey: string
  templateData?: Record<string, unknown>
  replyTo?: string
}): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const template = TEMPLATES[params.templateName]
    if (!template) {
      console.error('Unknown email template', params.templateName)
      return false
    }

    const recipient = (template.to || params.recipientEmail).trim()
    if (!recipient) return false
    const normalizedEmail = recipient.toLowerCase()
    const messageId = crypto.randomUUID()

    // Suppression check (fail-closed)
    const { data: suppressed, error: suppErr } = await supabaseAdmin
      .from('suppressed_emails')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle()
    if (suppErr) {
      console.error('Suppression check failed, skipping send', suppErr)
      return false
    }
    if (suppressed) {
      await supabaseAdmin.from('email_send_log').insert({
        message_id: messageId,
        template_name: params.templateName,
        recipient_email: recipient,
        status: 'suppressed',
      })
      return false
    }

    // Get or create an unsubscribe token (one per email)
    let unsubscribeToken: string
    const { data: existingToken } = await supabaseAdmin
      .from('email_unsubscribe_tokens')
      .select('token, used_at')
      .eq('email', normalizedEmail)
      .maybeSingle()
    if (existingToken && !existingToken.used_at) {
      unsubscribeToken = existingToken.token
    } else {
      unsubscribeToken = generateToken()
      await supabaseAdmin
        .from('email_unsubscribe_tokens')
        .upsert(
          { token: unsubscribeToken, email: normalizedEmail },
          { onConflict: 'email', ignoreDuplicates: true },
        )
      const { data: stored } = await supabaseAdmin
        .from('email_unsubscribe_tokens')
        .select('token')
        .eq('email', normalizedEmail)
        .maybeSingle()
      if (stored?.token) unsubscribeToken = stored.token
    }

    const element = React.createElement(template.component, params.templateData || {})
    const html = await render(element)
    const text = await render(element, { plainText: true })
    const subject =
      typeof template.subject === 'function'
        ? template.subject(params.templateData || {})
        : template.subject

    await supabaseAdmin.from('email_send_log').insert({
      message_id: messageId,
      template_name: params.templateName,
      recipient_email: recipient,
      status: 'pending',
    })

    const { error: enqueueError } = await supabaseAdmin.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        message_id: messageId,
        to: recipient,
        from: `${SITE_NAME} <${FROM_LOCAL_PART}@${FROM_DOMAIN}>`,
        reply_to: params.replyTo,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        purpose: 'transactional',
        label: params.templateName,
        idempotency_key: params.idempotencyKey,
        unsubscribe_token: unsubscribeToken,
        queued_at: new Date().toISOString(),
      },
    })
    if (enqueueError) {
      console.error('Failed to enqueue email', enqueueError)
      await supabaseAdmin.from('email_send_log').insert({
        message_id: messageId,
        template_name: params.templateName,
        recipient_email: recipient,
        status: 'failed',
        error_message: 'Failed to enqueue email',
      })
      return false
    }
    return true
  } catch (err) {
    console.error('enqueueTransactionalEmail crashed', err)
    return false
  }
}