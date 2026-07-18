import React from 'react'
import { Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { COLORS, DetailTable, EmailLayout, h2, paragraph, AttachmentList } from './_brand'

interface Props {
  name?: string
  email?: string
  phone?: string
  address?: string
  service_type?: string
  urgency?: string
  description?: string
  ip?: string
  server_ip?: string
  user_agent?: string
  attachments?: Array<{ url: string; filename: string; size: number; mime: string }>
}

const Email = ({
  name,
  email,
  phone,
  address,
  service_type,
  urgency,
  description,
  ip,
  server_ip,
  user_agent,
  attachments,
}: Props) => (
  <EmailLayout
    preview={`Demande de devis de ${name || 'un client'}`}
    badge="Nouveau devis"
    badgeColor={COLORS.teal}
  >
    <Text style={h2}>Nouvelle demande de devis</Text>
    <Text style={paragraph}>
      Un client souhaite obtenir un devis. Recontactez-le pour préciser les
      détails et établir une estimation.
    </Text>
    <DetailTable
      rows={[
        { label: 'Nom', value: name },
        { label: 'E-mail', value: email },
        { label: 'Téléphone', value: phone },
        { label: 'Adresse', value: address },
        { label: 'Prestation', value: service_type },
        { label: 'Urgence', value: urgency },
        { label: 'Description', value: description },
        { label: 'Adresse IPv4', value: ip },
        { label: 'IP connexion (serveur)', value: server_ip },
        { label: 'Appareil', value: user_agent },
      ]}
    />
    <AttachmentList attachments={attachments} />
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Devis — ${d.name || 'Client'}${d.service_type ? ` · ${d.service_type}` : ''}`,
  displayName: 'Devis — Notification gérant',
  previewData: {
    name: 'Sophie Martin',
    email: 'sophie@email.fr',
    phone: '06 98 76 54 32',
    address: '12 rue de la République, Metz',
    service_type: 'Rénovation salle de bain',
    urgency: 'Sous 2 semaines',
    description: 'Remplacement complet de la robinetterie et du chauffe-eau.',
    ip: '92.184.105.12',
    server_ip: '2a01:cb11:9c6:bc00:18d1:e3ab:2405:ce55',
    user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)',
  },
} satisfies TemplateEntry

export default Email