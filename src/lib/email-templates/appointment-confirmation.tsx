import React from 'react'
import { Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { DetailTable, EmailLayout, h2, paragraph } from './_brand'

interface Props {
  name?: string
  service_type?: string
  preferred_date?: string
  time_slot?: string
}

const Email = ({ name, service_type, preferred_date, time_slot }: Props) => (
  <EmailLayout
    preview="Votre demande de rendez-vous est bien arrivée"
    badge="Demande reçue"
  >
    <Text style={h2}>Merci{name ? `, ${name}` : ''} !</Text>
    <Text style={paragraph}>
      Votre demande de rendez-vous a bien été enregistrée. Nous vous
      recontactons rapidement pour confirmer le créneau définitif.
    </Text>
    <Text style={{ ...paragraph, marginBottom: '8px', fontWeight: 700 }}>
      Récapitulatif de votre demande
    </Text>
    <DetailTable
      rows={[
        { label: 'Prestation', value: service_type },
        { label: 'Date souhaitée', value: preferred_date },
        { label: 'Créneau', value: time_slot },
      ]}
    />
    <Text style={{ ...paragraph, marginTop: '20px' }}>
      Besoin d'une intervention en urgence ? Appelez-nous au
      <strong> +33 6 00 00 00 00</strong>, disponibles 24h/24 et 7j/7.
    </Text>
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: 'Votre demande de rendez-vous — Plomberie Dupont',
  displayName: 'Rendez-vous — Confirmation client',
  previewData: {
    name: 'Sophie Martin',
    service_type: 'Entretien chaudière',
    preferred_date: '2025-03-12',
    time_slot: 'Matin (8h – 12h)',
  },
} satisfies TemplateEntry

export default Email