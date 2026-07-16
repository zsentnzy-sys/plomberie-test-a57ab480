import React from 'react'
import { Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { COLORS, EmailLayout, h2, paragraph } from './_brand'

interface Props {
  name?: string
  message?: string
}

const Email = ({ name, message }: Props) => (
  <EmailLayout preview="Nous avons bien reçu votre message" badge="Message reçu">
    <Text style={h2}>Merci{name ? `, ${name}` : ''} !</Text>
    <Text style={paragraph}>
      Nous avons bien reçu votre message et nous vous répondrons dans les
      meilleurs délais, généralement sous quelques heures ouvrées.
    </Text>
    <Text style={paragraph}>
      Pour une urgence (fuite, panne de chauffage, dégât des eaux), n'hésitez
      pas à nous appeler directement au <strong>+33 6 00 00 00 00</strong> —
      nous intervenons 24h/24 et 7j/7.
    </Text>
    {message ? (
      <>
        <Text style={{ ...paragraph, margin: '20px 0 6px', fontWeight: 700, color: COLORS.navy }}>
          Votre message
        </Text>
        <Text
          style={{
            ...paragraph,
            whiteSpace: 'pre-wrap',
            backgroundColor: COLORS.panel,
            border: `1px solid ${COLORS.border}`,
            borderRadius: '12px',
            padding: '14px 16px',
            margin: 0,
          }}
        >
          {message}
        </Text>
      </>
    ) : null}
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: 'Nous avons bien reçu votre message — Plomberie Dupont',
  displayName: 'Contact — Confirmation client',
  previewData: {
    name: 'Jean Dupont',
    message: "Bonjour, j'ai une fuite sous mon évier de cuisine depuis ce matin.",
  },
} satisfies TemplateEntry

export default Email