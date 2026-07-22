import React from 'react'
import { Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { DetailTable, EmailLayout, h2, paragraph } from './_brand'

interface Props {
  invoiceNumber?: string
  invoiceDate?: string
  clientName?: string
  clientEmail?: string
  clientPhone?: string
  clientAddress?: string
  paymentMethod?: string
  totalHT?: string
  totalTVA?: string
  totalTTC?: string
}

const Email = (p: Props) => (
  <EmailLayout preview={`Facture émise ${p.invoiceNumber ?? ''}`} badge="Facture émise">
    <Text style={h2}>Nouvelle facture générée</Text>
    <Text style={paragraph}>
      La facture <strong>{p.invoiceNumber}</strong> a été envoyée au client
      {p.clientName ? ` ${p.clientName}` : ''}.
    </Text>
    <DetailTable
      rows={[
        { label: 'N° facture', value: p.invoiceNumber },
        { label: 'Date', value: p.invoiceDate },
        { label: 'Client', value: p.clientName },
        { label: 'Email', value: p.clientEmail },
        { label: 'Téléphone', value: p.clientPhone },
        { label: 'Adresse', value: p.clientAddress },
        { label: 'Paiement', value: p.paymentMethod },
        { label: 'Total HT', value: p.totalHT },
        { label: 'Total TVA', value: p.totalTVA },
        { label: 'Total TTC', value: p.totalTTC },
      ]}
    />
    <Text style={{ ...paragraph, marginTop: '18px' }}>
      Le PDF de la facture est joint à cet e-mail.
    </Text>
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Facture émise : ${d.invoiceNumber ?? ''}`,
  displayName: 'Facture — Artisan',
  previewData: {
    invoiceNumber: 'FACT-2026-0001',
    invoiceDate: '22/07/2026',
    clientName: 'Jean Dupont',
    clientEmail: 'jean@example.com',
    clientPhone: '+33 6 12 34 56 78',
    clientAddress: '10 rue Exemple, 57000 Metz',
    paymentMethod: 'Virement bancaire',
    totalHT: '300,00 EUR',
    totalTVA: '60,00 EUR',
    totalTTC: '360,00 EUR',
  },
} satisfies TemplateEntry

export default Email