import React from 'react'
import { Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailLayout, h2, paragraph } from './_brand'

interface Props {
  clientName?: string
  invoiceNumber?: string
  totalTTC?: string
  invoiceDate?: string
}

const Email = ({ clientName, invoiceNumber, totalTTC, invoiceDate }: Props) => (
  <EmailLayout preview={`Votre facture ${invoiceNumber ?? ''}`} badge="Facture">
    <Text style={h2}>Bonjour{clientName ? ` ${clientName}` : ''},</Text>
    <Text style={paragraph}>
      Veuillez trouver ci-joint votre facture <strong>{invoiceNumber}</strong>
      {invoiceDate ? ` datée du ${invoiceDate}` : ''} pour un montant total de{' '}
      <strong>{totalTTC}</strong> TTC.
    </Text>
    <Text style={paragraph}>
      Le PDF de votre facture est joint à cet e-mail.
    </Text>
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
  },
} satisfies TemplateEntry

export default Email