import React from 'react'
import { Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { DetailTable, EmailLayout, h2, paragraph } from './_brand'

interface Props {
  quoteNumber?: string
  quoteDate?: string
  validUntil?: string
  totalHT?: string
  totalTVA?: string
  totalTTC?: string
  clientName?: string
  clientEmail?: string
  clientPhone?: string
  clientAddress?: string
}

const Email = (p: Props) => (
  <EmailLayout preview={`Devis émis ${p.quoteNumber ?? ''}`} badge="Copie devis">
    <Text style={h2}>Devis {p.quoteNumber} émis</Text>
    <Text style={paragraph}>
      Copie du devis envoyé au client. Le PDF est joint à cet e-mail.
    </Text>
    <DetailTable
      rows={[
        { label: 'Numéro', value: p.quoteNumber },
        { label: 'Date', value: p.quoteDate },
        { label: 'Valable jusqu’au', value: p.validUntil },
        { label: 'Client', value: p.clientName },
        { label: 'Email', value: p.clientEmail },
        { label: 'Téléphone', value: p.clientPhone },
        { label: 'Adresse', value: p.clientAddress },
        { label: 'Total HT', value: p.totalHT },
        { label: 'Total TVA', value: p.totalTVA },
        { label: 'Total TTC', value: p.totalTTC },
      ]}
    />
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Devis émis : ${d.quoteNumber ?? ''}`,
  displayName: 'Devis — Artisan',
  previewData: {
    quoteNumber: 'DEV-2026-0001',
    quoteDate: '26/07/2026',
    validUntil: '25/08/2026',
    clientName: 'Jean Dupont',
    clientEmail: 'jean@example.com',
    clientPhone: '+33 6 12 34 56 78',
    clientAddress: '1 rue de la Paix, 57000 Metz',
    totalHT: '1 050,00 EUR',
    totalTVA: '210,00 EUR',
    totalTTC: '1 260,00 EUR',
  },
} satisfies TemplateEntry

export default Email
