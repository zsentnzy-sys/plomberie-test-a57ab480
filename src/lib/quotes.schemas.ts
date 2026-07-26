// Client-safe Zod schemas for the quotes module.
import { z } from "zod";

export const lineSchema = z.object({
  type: z.enum(["Service", "Matériel", "Taux horaire"]),
  description: z.string().trim().min(1, "Description requise").max(300),
  unit_price_ht: z.number().min(0).max(1_000_000),
  quantity: z.number().min(0.01).max(10_000),
  tva: z.union([z.literal(0), z.literal(5.5), z.literal(10), z.literal(20)]),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (YYYY-MM-DD)");

export const quoteSchema = z
  .object({
    quote_request_id: z.string().uuid().optional(),
    client_name: z.string().trim().min(2, "Nom requis").max(120),
    client_address: z.string().trim().min(4, "Adresse requise").max(400),
    client_email: z.string().trim().email("Email invalide").max(255),
    client_phone: z.string().trim().max(30).optional().or(z.literal("")),
    quote_date: isoDate,
    valid_until: isoDate,
    notes: z.string().trim().max(1000).optional().or(z.literal("")),
    lines: z.array(lineSchema).min(1, "Ajoutez au moins une ligne").max(50),
    idempotency_key: z.string().uuid("Clé d'idempotence invalide"),
  })
  .refine((d) => d.valid_until >= d.quote_date, {
    message: "La date de validité doit être postérieure à la date du devis",
    path: ["valid_until"],
  });

