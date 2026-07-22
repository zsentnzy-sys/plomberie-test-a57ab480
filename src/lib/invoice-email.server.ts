// Server-only: send a single invoice email through Resend (via the Lovable
// connector gateway) with the PDF attached. Kept isolated from the queued
// transactional email pipeline because that pipeline doesn't support
// attachments.

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend'

export interface SendInvoiceEmailParams {
  to: string
  subject: string
  html: string
  pdfBase64: string
  pdfFilename: string
  replyTo?: string
  from?: string
  // Per-recipient idempotency key forwarded to Resend so retries don't
  // duplicate the delivery (e.g. invoice/<invoiceId>/client/v1).
  idempotencyKey?: string
}

// Default sender. The domain part MUST be verified in the Resend dashboard,
// otherwise the API returns 403. Adjust FROM_ADDRESS if the verified domain
// differs.
const FROM_ADDRESS = 'Plomberie Dupont <facturation@normalweb.cloud>'

export async function sendInvoiceEmail(params: SendInvoiceEmailParams): Promise<void> {
  const lovableKey = process.env.LOVABLE_API_KEY
  const resendKey = process.env.RESEND_API_KEY
  if (!lovableKey) throw new Error('LOVABLE_API_KEY manquant.')
  if (!resendKey) throw new Error('RESEND_API_KEY manquant (connexion Resend non liée).')

  const body: Record<string, unknown> = {
    from: params.from ?? FROM_ADDRESS,
    to: [params.to],
    subject: params.subject,
    html: params.html,
    attachments: [
      {
        filename: params.pdfFilename,
        content: params.pdfBase64,
      },
    ],
  }
  if (params.replyTo) body.reply_to = params.replyTo

  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${lovableKey}`,
      'X-Connection-Api-Key': resendKey,
      ...(params.idempotencyKey ? { 'Idempotency-Key': params.idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errorBody = await res.text()
    console.error(`Resend send failed [${res.status}]: ${errorBody}`)
    throw new Error(`Envoi email facture échoué [${res.status}]: ${errorBody}`)
  }
}