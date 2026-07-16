import type { ComponentType } from 'react'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
import { template as contactNotification } from './contact-notification'
import { template as contactConfirmation } from './contact-confirmation'
import { template as appointmentNotification } from './appointment-notification'
import { template as appointmentConfirmation } from './appointment-confirmation'
import { template as quoteNotification } from './quote-notification'
import { template as quoteConfirmation } from './quote-confirmation'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'contact-notification': contactNotification,
  'contact-confirmation': contactConfirmation,
  'appointment-notification': appointmentNotification,
  'appointment-confirmation': appointmentConfirmation,
  'quote-notification': quoteNotification,
  'quote-confirmation': quoteConfirmation,
}
