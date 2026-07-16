import React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Hr,
} from '@react-email/components'

export const COLORS = {
  navy: '#1e2a38',
  navySoft: '#33485c',
  teal: '#1ba3ad',
  tealSoft: '#e7f6f7',
  urgent: '#d6452b',
  border: '#e4e8ec',
  muted: '#64748b',
  bg: '#ffffff',
  panel: '#f6f8fa',
  text: '#1e2a38',
}

export const SITE_NAME = 'Plomberie Dupont'

const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  margin: 0,
  padding: '24px 0',
}

const container: React.CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
  border: `1px solid ${COLORS.border}`,
  borderRadius: '16px',
  overflow: 'hidden',
}

const header: React.CSSProperties = {
  backgroundColor: COLORS.navy,
  padding: '28px 32px',
}

const brandText: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '20px',
  fontWeight: 700,
  margin: 0,
  letterSpacing: '-0.01em',
}

const tagline: React.CSSProperties = {
  color: '#9fb3c8',
  fontSize: '13px',
  margin: '4px 0 0',
}

const content: React.CSSProperties = {
  padding: '32px',
}

const footer: React.CSSProperties = {
  padding: '20px 32px 28px',
  backgroundColor: COLORS.panel,
}

const footerText: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: '12px',
  lineHeight: '18px',
  margin: 0,
}

export function EmailLayout({
  preview,
  badge,
  badgeColor,
  children,
}: {
  preview: string
  badge?: string
  badgeColor?: string
  children: React.ReactNode
}) {
  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading as="h1" style={brandText}>
              {SITE_NAME}
            </Heading>
            <Text style={tagline}>Plombier chauffagiste · Metz et alentours</Text>
          </Section>
          <Section style={content}>
            {badge ? (
              <Text
                style={{
                  display: 'inline-block',
                  backgroundColor: badgeColor || COLORS.tealSoft,
                  color: badgeColor ? '#ffffff' : COLORS.teal,
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  padding: '6px 12px',
                  borderRadius: '999px',
                  margin: '0 0 16px',
                }}
              >
                {badge}
              </Text>
            ) : null}
            {children}
          </Section>
          <Hr style={{ borderColor: COLORS.border, margin: 0 }} />
          <Section style={footer}>
            <Text style={footerText}>
              {SITE_NAME} — 12 rue des Artisans, 57000 Metz · +33 6 00 00 00 00
            </Text>
            <Text style={{ ...footerText, marginTop: '6px' }}>
              Cet e-mail vous a été envoyé automatiquement suite à une demande
              effectuée sur notre site.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export function DetailTable({
  rows,
}: {
  rows: Array<{ label: string; value?: string | null }>
}) {
  return (
    <Section
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: '12px',
        overflow: 'hidden',
        marginTop: '8px',
      }}
    >
      {rows
        .filter((r) => r.value)
        .map((r, i) => (
          <table
            key={r.label}
            width="100%"
            cellPadding={0}
            cellSpacing={0}
            style={{
              borderTop: i === 0 ? 'none' : `1px solid ${COLORS.border}`,
            }}
          >
            <tbody>
              <tr>
                <td
                  style={{
                    padding: '12px 16px',
                    width: '40%',
                    color: COLORS.muted,
                    fontSize: '13px',
                    fontWeight: 600,
                    verticalAlign: 'top',
                    backgroundColor: COLORS.panel,
                  }}
                >
                  {r.label}
                </td>
                <td
                  style={{
                    padding: '12px 16px',
                    color: COLORS.text,
                    fontSize: '14px',
                    lineHeight: '20px',
                  }}
                >
                  {r.value}
                </td>
              </tr>
            </tbody>
          </table>
        ))}
    </Section>
  )
}

export const h2: React.CSSProperties = {
  color: COLORS.navy,
  fontSize: '20px',
  fontWeight: 700,
  margin: '0 0 8px',
}

export const paragraph: React.CSSProperties = {
  color: COLORS.navySoft,
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0 0 16px',
}