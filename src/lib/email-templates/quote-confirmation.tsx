import React from 'react'
import { Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { DetailTable, EmailLayout, h2, paragraph } from './_brand'

interface Props {
  name?: string
  service_type?: string
  description?: string
}

const Email = ({ name, service_type, description }: Props) => (
  <EmailLayout
    preview="Votre demande de devis est bien arrivée"
    badge="Demande reçue"
  >
    <Text style={h2}>Merci{name ? `, ${name}` : ''} !</Text>
    <Text style={paragraph}>
      Votre demande de devis a bien été enregistrée. Nous l'étudions et vous
      recontactons rapidement avec une estimation personnalisée.
    </Text>
    <Text style={{ ...paragraph, marginBottom: '8px', fontWeight: 700 }}>
      Récapitulatif de votre demande
    </Text>
    <DetailTable
      rows={[
        { label: 'Prestation', value: service_type },
        { label: 'Description', value: description },
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
  subject: 'Votre demande de devis — Plomberie Dupont',
  displayName: 'Devis — Confirmation client',
  previewData: {
    name: 'Sophie Martin',
    service_type: 'Rénovation salle de bain',
    description: 'Remplacement complet de la robinetterie et du chauffe-eau.',
  },
} satisfies TemplateEntry

export default Email