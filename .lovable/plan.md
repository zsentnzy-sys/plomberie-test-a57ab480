## Objectif

Fiabiliser le module de facturation : persistance des factures, stockage privé du PDF, résilience des envois d'emails et idempotence des soumissions.

## 1. Persistance des factures et lignes

Nouvelles tables (migration Supabase) :

- `public.invoices`
  - `id uuid pk`, `invoice_number text unique not null`
  - `created_by uuid not null` (auth.uid de l'admin)
  - `client_name`, `client_address`, `client_email`, `client_phone`
  - `payment_method`, `invoice_date date`
  - `total_ht numeric(12,2)`, `total_tva numeric(12,2)`, `total_ttc numeric(12,2)`
  - `pdf_storage_path text` (chemin dans le bucket)
  - `email_client_status text` (`pending|sent|failed`), `email_client_error text`
  - `email_artisan_status text`, `email_artisan_error text`
  - `idempotency_key text unique` (voir §4)
  - `created_at`, `updated_at` + trigger `update_updated_at`

- `public.invoice_lines`
  - `id uuid pk`, `invoice_id uuid fk → invoices(id) on delete cascade`
  - `position int`, `type`, `description`, `unit_price_ht`, `quantity`, `tva`
  - `line_total_ht`, `line_total_ttc`

RLS :
- `GRANT` habituels à `authenticated` + `service_role`.
- Policies `SELECT` restreintes aux admins via `has_role(auth.uid(), 'admin')` sur les deux tables.
- Pas de policy `INSERT/UPDATE/DELETE` côté client — écritures uniquement via server function (service_role / admin RPC).

## 2. Stockage privé du PDF

- Réutiliser le bucket privé existant `request-attachments` avec un préfixe dédié `invoices/YYYY/FACT-YYYY-XXXX.pdf`, plutôt que créer un nouveau bucket (les policies restrictives sont déjà en place).
- Upload via `supabaseAdmin.storage` dans la server function (service_role) après génération du PDF.
- Chemin stocké dans `invoices.pdf_storage_path`. Aucun lien signé n'est envoyé par email (les emails gardent le PDF en pièce jointe via Resend).
- Nouvelle server function `getInvoicePdfSignedUrl({ invoiceId })` (admin-gated) pour retélécharger un PDF depuis un futur écran d'historique — pas de UI dans ce plan, juste l'endpoint.

## 3. Gestion des échecs partiels d'e-mail

Aujourd'hui : si l'email client réussit et l'email artisan échoue, l'exception fait échouer toute la server function alors que la facture (numéro + PDF) est déjà générée.

Nouveau comportement dans `generateInvoice` :
1. Réserver le numéro, générer le PDF, uploader dans le bucket, insérer `invoices` + `invoice_lines` (statuts email = `pending`).
2. Envoyer email client → mettre à jour `email_client_status` (`sent` ou `failed` + message).
3. Envoyer email artisan → même chose.
4. Retourner au front `{ invoiceNumber, pdfBase64, emailClient: {...}, emailArtisan: {...} }` sans throw si un seul email échoue.
5. Le front (`src/routes/admin/factures.tsx`) affiche :
   - toast succès complet si les deux OK,
   - toast d'avertissement listant l'email en échec sinon,
   - toast d'erreur uniquement si la facture elle-même n'a pas pu être créée/persistée.

Un futur bouton "renvoyer l'email" pourra s'appuyer sur les statuts persistés (hors scope de ce plan).

## 4. Idempotence

Objectif : un double-clic ou un retry réseau ne doit pas créer deux factures ni renvoyer deux fois les emails.

- Le front génère une `idempotencyKey` (UUID v4) au chargement du formulaire, la renvoie dans le payload, et la régénère après un succès (ou après un reset explicite).
- Le schéma Zod accepte `idempotency_key: z.string().uuid()`.
- Dans la server function, avant toute action coûteuse :
  - `SELECT` sur `invoices` par `idempotency_key`.
  - Si trouvé : re-télécharger le PDF depuis le bucket (`supabaseAdmin.storage.download`), le ré-encoder en base64, et retourner le même résultat qu'à la première exécution (mêmes statuts email persistés). Aucun nouvel envoi d'email, aucun nouveau numéro.
- Contrainte `unique(idempotency_key)` en garde-fou base de données contre les races.

## Fichiers touchés

- Nouvelle migration : `invoices`, `invoice_lines`, policies, grants, trigger updated_at.
- `src/lib/invoices.functions.ts` : refonte du handler (persistance, upload, gestion partielle, idempotence) + nouvelle server function `getInvoicePdfSignedUrl`.
- `src/lib/invoices.server.ts` : ajout d'un helper `uploadInvoicePdf(path, bytes)` utilisant `supabaseAdmin`.
- `src/routes/admin/factures.tsx` : génération de l'`idempotencyKey`, gestion des retours partiels (toasts adaptés), reset de la clé après succès.

## Détails techniques

- `supabaseAdmin` importé dynamiquement dans le handler (règle du template TanStack).
- Les policies sur les nouvelles tables interdisent tout accès client hors admins — la @security-memory sera mise à jour pour documenter ces invariants après implémentation.
- Aucune modification du flux Resend ni des templates emails.
- Aucun impact sur les autres formulaires (contact, devis, RDV).

## Hors scope

- Écran d'historique des factures (liste, recherche, renvoi manuel) — les endpoints existeront mais pas l'UI.
- Purge / archivage automatique des PDF.
