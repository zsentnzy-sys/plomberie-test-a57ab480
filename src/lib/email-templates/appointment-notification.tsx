import React from 'react'
import { Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { COLORS, DetailTable, EmailLayout, h2, paragraph } from './_brand'

interface Props {
  name?: string
  email?: string
  phone?: string
  service_type?: string
  preferred_date?: string
  time_slot?: string
  notes?: string
  ip?: string
  server_ip?: string
  user_agent?: string
}

const Email = ({
  name,
  email,
  phone,
  service_type,
  preferred_date,
  time_slot,
  notes,
  ip,
  server_ip,
  user_agent,
}: Props) => (
  <EmailLayout
    preview={`Demande de rendez-vous de ${name || 'un client'}`}
    badge="Nouveau rendez-vous"
    badgeColor={COLORS.teal}
  >
    <Text style={h2}>Nouvelle demande de rendez-vous</Text>
    <Text style={paragraph}>
      Un client souhaite réserver une intervention. Pensez à confirmer le
      créneau par téléphone ou e-mail.
    </Text>
    <DetailTable
      rows={[
        { label: 'Nom', value: name },
        { label: 'E-mail', value: email },
        { label: 'Téléphone', value: phone },
        { label: 'Prestation', value: service_type },
        { label: 'Date souhaitée', value: preferred_date },
        { label: 'Créneau', value: time_slot },
        { label: 'Précisions', value: notes },
        { label: 'Adresse IPv4', value: ip },
        { label: 'IP connexion (serveur)', value: server_ip },
        { label: 'Appareil', value: user_agent },
      ]}
    />
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Rendez-vous — ${d.name || 'Client'}${d.preferred_date ? ` · ${d.preferred_date}` : ''}`,
  displayName: 'Rendez-vous — Notification gérant',
  previewData: {
    name: 'Sophie Martin',
    email: 'sophie@email.fr',
    phone: '06 98 76 54 32',
    service_type: 'Entretien chaudière',
    preferred_date: '2025-03-12',
    time_slot: 'Matin (8h – 12h)',
    notes: '3e étage, code porte 1234.',
    ip: '92.184.105.12',
    server_ip: '2a01:cb11:9c6:bc00:18d1:e3ab:2405:ce55',
    user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)',
  },
} satisfies TemplateEntry

export default Email