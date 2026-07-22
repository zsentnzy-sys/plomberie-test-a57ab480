## Objectif

Fiabiliser le module de facturation via une nouvelle migration corrective et une refonte du handler serveur, sans toucher au design ni aux validations du formulaire.

## 1. Nouvelle migration SQL (corrective, additive uniquement)

Fichier : `supabase/migrations/<timestamp>_invoices_hardening.sql`. Aucune migration existante n'est modifiée.

### `public.invoices`
- Nouveau type enum `invoice_status` : `generating | generation_failed | ready | sending | sent | partially_sent | send_failed | cancelled`.
- Ajouts : `status invoice_status not null default 'generating'`, `generation_error text`, `sent_at timestamptz`, `cancelled_at timestamptz`, `artisan_snapshot jsonb not null default '{}'::jsonb` (backfill pour lignes existantes puis suppression du default).
- `alter column pdf_storage_path drop not null`.
- Contraintes CHECK :
  - `email_client_status` / `email_artisan_status` ∈ `{pending, sent, failed}` (défaut `pending`).
  - `total_ht >= 0`, `total_tva >= 0`, `total_ttc >= 0`.
  - `abs(total_ttc - (total_ht + total_tva)) < 0.01`.
- Conservation des contraintes uniques existantes `invoice_number` et `idempotency_key` (aucun `DROP`).

### `public.invoice_lines`
- Ajout `line_total_tva numeric(12,2) not null default 0` (backfill = `line_total_ttc - line_total_ht`, puis retrait du default).
- Contrainte unique `(invoice_id, position)`.
- Index conservé sur `invoice_id` (créé si absent).
- CHECK : `position >= 1`, `quantity > 0`, `unit_price_ht >= 0`, `tva in (0, 5.5, 10, 20)`, `line_total_ht >= 0`, `line_total_tva >= 0`, `abs(line_total_ttc - (line_total_ht + line_total_tva)) < 0.01`.

### RPC transactionnelle `public.create_invoice_for_idempotency`
- Arguments : `_idempotency_key uuid`, `_client_name`, `_client_address`, `_client_email`, `_client_phone`, `_payment_method`, `_invoice_date date`, `_total_ht`, `_total_tva`, `_total_ttc`, `_artisan_snapshot jsonb`.
- `SECURITY DEFINER`, `search_path = public`.
- Étapes atomiques :
  1. `has_role(auth.uid(), 'admin')` sinon `RAISE EXCEPTION`.
  2. `SELECT id, invoice_number FROM invoices WHERE idempotency_key = _idempotency_key` — si présent, renvoie `(id, invoice_number, reused=true)`.
  3. Sinon appelle `next_invoice_number()` et fait un `INSERT` avec `status='generating'`, `created_by = auth.uid()`, `pdf_storage_path = null`.
  4. Retourne `(id, invoice_number, reused=false)`.
- GRANT `EXECUTE` à `authenticated`.

Aucun `DELETE`/`UPDATE` sur les données existantes hors backfills décrits ci-dessus.

## 2. Séparation stricte des informations artisan

- Nouveau fichier `src/lib/artisan.server.ts` (server-only) exportant `ARTISAN_INFO` (company, fullName, address, phone, email, siret, iban, bic, legal) et une fonction `buildArtisanSnapshot()` retournant l'objet à persister dans `artisan_snapshot`.
- Suppression du bloc `ARTISAN_INFO` dans `src/routes/admin/factures.tsx` et retrait du champ `artisan` du payload envoyé au serveur.
- Schéma Zod `invoiceSchema` dans `src/lib/invoices.functions.ts` : suppression du sous-objet `artisan`. Le client n'envoie plus SIRET/IBAN/BIC/mentions légales.
- Le PDF utilise l'artisan lu côté serveur ; le rendu et l'entête PDF sont inchangés visuellement.

## 3. Refonte de `generateInvoice` (`src/lib/invoices.functions.ts`)

Nouveau flux (l'ordre remplace l'ancien `SELECT idempotency_key → next_invoice_number → INSERT`) :

1. Vérification admin (inchangée).
2. Calcul des totaux serveur (`computeTotals`).
3. Construction de `artisan_snapshot` via `buildArtisanSnapshot()`.
4. `context.supabase.rpc('create_invoice_for_idempotency', {...})` — retourne `{ invoiceId, invoiceNumber, reused }`.
5. Chemin `reused = true` :
   - Charge la facture (`status`, `pdf_storage_path`, totaux persistés, statuts e-mails, `artisan_snapshot`, lignes).
   - Si `pdf_storage_path` présent : télécharge et retourne comme aujourd'hui.
   - Sinon : régénère le PDF **depuis les données persistées** (invoices + invoice_lines + artisan_snapshot), sans réattribuer de numéro ; upload, `UPDATE invoices SET pdf_storage_path=..., status='ready'`.
   - Ne renvoie pas d'e-mail automatiquement pour un reused (les statuts e-mails restent tels que persistés).
6. Chemin `reused = false` :
   1. `INSERT` des `invoice_lines` (avec `line_total_tva`). Sur erreur : `UPDATE invoices SET status='generation_failed', generation_error=<msg>` et throw.
   2. Génération PDF depuis les données persistées.
   3. Upload PDF dans `request-attachments` (`invoices/YYYY/FACT-YYYY-XXXX.pdf`).
   4. `UPDATE invoices SET pdf_storage_path=..., status='ready'`.
   5. Toute erreur dans 6.2/6.3/6.4 : `UPDATE invoices SET status='generation_failed', generation_error=<msg>` puis throw (pas de suppression de la facture ni de rollback du numéro).
7. Envoi e-mails (uniquement si `!reused` ou si les statuts persistés valent `pending`) :
   - Passe `status='sending'`.
   - Envoie l'e-mail client, puis `UPDATE email_client_status/error` immédiatement, vérifie l'erreur Supabase (log + poursuite).
   - Idem artisan.
   - Recharge les deux statuts effectifs et calcule le statut global :
     - `sent` si les deux `sent`.
     - `partially_sent` si un `sent` et un `failed`.
     - `send_failed` si les deux `failed`.
     - Si l'un est encore `pending`, ne pas convertir en `failed` — laisser `sending` et remonter l'erreur.
   - `UPDATE invoices SET status=<global>, sent_at = case when 'sent' then now() end`.
8. Idempotence Resend par destinataire (nouveaux headers) : `sendInvoiceEmail` accepte `idempotencyKey` et envoie `Idempotency-Key: invoice/<invoiceId>/client/v1` (resp. `.../artisan/v1`) au gateway Resend.
9. Retour au front : `{ invoiceId, invoiceNumber, pdfBase64, totals, emailClient, emailArtisan, reused, status }`.

## 4. `getInvoicePdfSignedUrl`

Inchangé fonctionnellement ; toujours admin-gated et scoping RLS via `supabaseAdmin` + bucket privé.

## 5. Front `src/routes/admin/factures.tsx`

Modifications minimales, aucune retouche visuelle :
- Retrait du bloc `ARTISAN_INFO` et du champ `artisan` dans le payload.
- Ajout d'un `invoiceIdRef` (state) qui stocke `res.invoiceId` après la première tentative.
- Après un **échec partiel d'e-mail** (`partially_sent` / `send_failed`) : **ne pas** régénérer `idempotencyKey` ni réinitialiser les lignes. Un nouveau clic sur "Générer et envoyer" réutilise donc la même facture (branche `reused=true`, futur bouton de renvoi ciblé pourra pointer sur `invoiceId`).
- Après un succès complet (`sent`) : reset des lignes et rotation de `idempotencyKey` (comportement actuel).
- Après un throw serveur (`generation_failed`) : conserver la clé pour permettre le retry sur la même facture ; afficher l'erreur.
- Toasts : conserver les libellés actuels, ajouter un cas explicite `send_failed` (tous les e-mails ont échoué).

## 6. Sécurité conservée

- Authentification `requireSupabaseAuth` inchangée.
- `has_role(auth.uid(), 'admin')` vérifié dans la RPC + dans le handler.
- Zod : schéma resserré (suppression `artisan`) mais toutes les autres validations préservées.
- RLS admin-only sur `invoices` / `invoice_lines` : inchangées, la RPC est `SECURITY DEFINER`.
- Bucket privé `request-attachments` et téléchargement via `createSignedUrl` : inchangés.

## Fichiers touchés

- **Nouvelle migration** : `supabase/migrations/<timestamp>_invoices_hardening.sql` (colonnes, contraintes, enum, RPC).
- **Nouveau** : `src/lib/artisan.server.ts`.
- **Modifié** : `src/lib/invoices.functions.ts` (schéma sans artisan, refonte du handler, appel RPC, régénération PDF, statuts globaux).
- **Modifié** : `src/lib/invoice-email.server.ts` (paramètre `idempotencyKey` → header `Idempotency-Key`).
- **Modifié** : `src/lib/invoices.server.ts` si nécessaire pour accepter des lignes hydratées depuis la base (mêmes calculs, aucune modification visuelle du PDF).
- **Modifié** : `src/routes/admin/factures.tsx` (retrait artisan, conservation de la clé/idempotence après échec partiel, gestion `invoiceId`).

## Hors scope

- UI de renvoi ciblé d'un e-mail ou d'annulation (`status='cancelled'`) — le schéma les supporte, l'écran viendra plus tard.
- Historique/liste des factures.
- Migration de purge du bucket.
