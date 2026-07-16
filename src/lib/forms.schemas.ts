import { z } from "zod";

const ipv4 = z.string().trim().max(45).optional().or(z.literal(""));

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Votre nom est requis").max(100),
  email: z.string().trim().email("Adresse e-mail invalide").max(255),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  subject: z.string().trim().max(150).optional().or(z.literal("")),
  message: z.string().trim().min(10, "Décrivez votre besoin (10 caractères min.)").max(2000),
  client_ipv4: ipv4,
});

export const quoteSchema = z.object({
  name: z.string().trim().min(2, "Votre nom est requis").max(100),
  email: z.string().trim().email("Adresse e-mail invalide").max(255),
  phone: z.string().trim().min(6, "Téléphone requis").max(30),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  service_type: z.string().trim().min(1, "Sélectionnez une prestation").max(120),
  description: z.string().trim().min(10, "Décrivez vos travaux (10 caractères min.)").max(2000),
  urgency: z.string().trim().max(60).optional().or(z.literal("")),
  client_ipv4: ipv4,
});

export const appointmentSchema = z.object({
  name: z.string().trim().min(2, "Votre nom est requis").max(100),
  email: z.string().trim().email("Adresse e-mail invalide").max(255),
  phone: z.string().trim().min(6, "Téléphone requis").max(30),
  service_type: z.string().trim().min(1, "Sélectionnez une prestation").max(120),
  preferred_date: z.string().trim().min(1, "Choisissez une date"),
  time_slot: z.string().trim().min(1, "Choisissez un créneau").max(60),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  client_ipv4: ipv4,
});

export type ContactInput = z.infer<typeof contactSchema>;
export type QuoteInput = z.infer<typeof quoteSchema>;
export type AppointmentInput = z.infer<typeof appointmentSchema>;