import React from 'react'
import { Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { COLORS, DetailTable, EmailLayout, h2, paragraph } from './_brand'

interface Props {
  name?: string
  email?: string
  phone?: string
  subject?: string
  message?: string
  ip?: string
  server_ip?: string
  user_agent?: string
}

const Email = ({ name, email, phone, subject, message, ip, server_ip, user_agent }: Props) => (
  <EmailLayout
    preview={`Nouveau message de ${name || 'un visiteur'}`}
    badge="Nouveau contact"
    badgeColor={COLORS.teal}
  >
    <Text style={h2}>Nouvelle demande de contact</Text>
    <Text style={paragraph}>
      Un visiteur vient de remplir le formulaire de contact sur votre site.
    </Text>
    <DetailTable
      rows={[
        { label: 'Nom', value: name },
        { label: 'E-mail', value: email },
        { label: 'Téléphone', value: phone },
        { label: 'Sujet', value: subject },
        { label: 'Adresse IPv4', value: ip },
        { label: 'IP connexion (serveur)', value: server_ip },
        { label: 'Appareil', value: user_agent },
      ]}
    />
    <Text style={{ ...paragraph, margin: '20px 0 6px', fontWeight: 700, color: COLORS.navy }}>
      Message
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
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Nouveau contact — ${d.name || 'Site'}${d.subject ? ` · ${d.subject}` : ''}`,
  displayName: 'Contact — Notification gérant',
  previewData: {
    name: 'Jean Dupont',
    email: 'jean@email.fr',
    phone: '06 12 34 56 78',
    subject: 'Fuite sous évier',
    message: "Bonjour, j'ai une fuite sous mon évier de cuisine depuis ce matin.",
    ip: '92.184.105.12',
    server_ip: '2a01:cb11:9c6:bc00:18d1:e3ab:2405:ce55',
    user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)',
  },
} satisfies TemplateEntry

export default Email