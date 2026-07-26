import React from 'react'
import { Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { DetailTable, EmailLayout, h2, paragraph } from './_brand'

interface Props {
  clientName?: string
  quoteNumber?: string
  quoteDate?: string
  validUntil?: string
  totalTTC?: string
}

const Email = ({ clientName, quoteNumber, quoteDate, validUntil, totalTTC }: Props) => (
  <EmailLayout preview={`Votre devis ${quoteNumber ?? ''}`} badge="Devis">
    <Text style={h2}>Bonjour{clientName ? ` ${clientName}` : ''},</Text>
    <Text style={paragraph}>
      Suite à votre demande, veuillez trouver ci-joint votre devis{' '}
      <strong>{quoteNumber}</strong>. Ce document est un devis gratuit et sans
      engagement : il ne constitue pas une facture.
    </Text>
    <DetailTable
      rows={[
        { label: 'Numéro de devis', value: quoteNumber },
        { label: 'Date du devis', value: quoteDate },
        { label: 'Valable jusqu’au', value: validUntil },
        { label: 'Montant total TTC', value: totalTTC },
      ]}
    />
    <Text style={{ ...paragraph, marginTop: '20px' }}>
      Pour accepter ce devis, il vous suffit de <strong>répondre à cet e-mail</strong>{' '}
      en indiquant votre accord, ou de nous retourner le PDF signé avec la mention
      « Bon pour accord ». Si vous souhaitez une modification, répondez également à
      cet e-mail en précisant votre demande.
    </Text>
    <Text style={paragraph}>
      Nous restons à votre disposition pour toute question et vous remercions de
      votre confiance.
    </Text>
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Votre devis ${d.quoteNumber ?? ''} — Plomberie Dupont`,
  displayName: 'Devis — Client',
  previewData: {
    clientName: 'Jean Dupont',
    quoteNumber: 'DEV-2026-0001',
    quoteDate: '26/07/2026',
    validUntil: '25/08/2026',
    totalTTC: '1 260,00 EUR',
  },
} satisfies TemplateEntry

export default Email
