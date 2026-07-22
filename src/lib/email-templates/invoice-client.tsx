import React from 'react'
import { Button, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { COLORS, EmailLayout, h2, paragraph } from './_brand'

interface Props {
  clientName?: string
  invoiceNumber?: string
  totalTTC?: string
  invoiceDate?: string
  pdfUrl?: string
}

const Email = ({ clientName, invoiceNumber, totalTTC, invoiceDate, pdfUrl }: Props) => (
  <EmailLayout preview={`Votre facture ${invoiceNumber ?? ''}`} badge="Facture">
    <Text style={h2}>Bonjour{clientName ? ` ${clientName}` : ''},</Text>
    <Text style={paragraph}>
      Veuillez trouver ci-joint votre facture <strong>{invoiceNumber}</strong>
      {invoiceDate ? ` datée du ${invoiceDate}` : ''} pour un montant total de{' '}
      <strong>{totalTTC}</strong> TTC.
    </Text>
    {pdfUrl ? (
      <>
        <Text style={paragraph}>
          Cliquez sur le bouton ci-dessous pour télécharger votre facture (lien
          valable 7 jours).
        </Text>
        <Button
          href={pdfUrl}
          style={{
            backgroundColor: COLORS.teal,
            color: '#ffffff',
            padding: '12px 22px',
            borderRadius: '10px',
            fontWeight: 700,
            textDecoration: 'none',
            fontSize: '14px',
          }}
        >
          Télécharger ma facture (PDF)
        </Button>
      </>
    ) : null}
    <Text style={{ ...paragraph, marginTop: '24px' }}>
      Nous vous remercions pour votre confiance et restons à votre disposition
      pour toute question.
    </Text>
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Votre facture ${d.invoiceNumber ?? ''} — Plomberie Dupont`,
  displayName: 'Facture — Client',
  previewData: {
    clientName: 'Jean Dupont',
    invoiceNumber: 'FACT-2026-0001',
    invoiceDate: '22/07/2026',
    totalTTC: '360,00 EUR',
    pdfUrl: 'https://example.com/facture.pdf',
  },
} satisfies TemplateEntry

export default Email