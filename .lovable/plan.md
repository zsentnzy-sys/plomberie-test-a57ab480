## Objectif

Depuis `/admin/devis`, permettre de transformer une demande de devis en devis PDF numéroté, persisté, stocké dans le bucket privé et envoyé au client (avec copie artisan), sans toucher au design existant.

## 1. Migration SQL (nouvelle, additive)

### Enum `quote_status`

`generating | generation_failed | ready | sending | sent | partially_sent | send_failed | accepted | refused | expired | cancelled` 

### `public.quotes`

- `id uuid pk default gen_random_uuid()`
- `quote_number text not null unique`
- `quote_request_id uuid references public.quote_requests(id) on delete set null`
- `created_by uuid not null`
- `client_name`, `client_address`, `client_email`, `client_phone`
- `quote_date date not null`, `valid_until date not null`
- `notes text`
- `total_ht`, `total_tva`, `total_ttc` numeric(12,2) not null
- `artisan_snapshot jsonb not null`
- `pdf_storage_path text` (nullable)
- `status quote_status not null default 'generating'`, `generation_error text`, `sent_at timestamptz`
- `email_client_status text default 'pending'`, `email_client_error text`
- `email_artisan_status text default 'pending'`, `email_artisan_error text`
- `idempotency_key text not null unique`
- `created_at`, `updated_at` + trigger `update_updated_at_column`
- CHECK : statuts e-mail ∈ {pending,sent,failed}, totaux >= 0, `abs(total_ttc-(total_ht+total_tva)) < 0.01`, `valid_until >= quote_date`

### `public.quote_lines`

Même forme que `invoice_lines` : `quote_id`, `position`, `type`, `description`, `unit_price_ht`, `quantity`, `tva`, `line_total_ht`, `line_total_tva`, `line_total_ttc`, unique `(quote_id, position)`, index sur `quote_id`, CHECK montants/TVA/position.

### Grants + RLS

`GRANT ... TO authenticated`, `GRANT ALL TO service_role`, RLS activée, politiques admin-only via `has_role(auth.uid(),'admin')` (mêmes règles que `invoices`).

### Compteur et RPC

- `public.quote_counter(year, last_number)` (même modèle que `invoice_counter`).
- `public.create_quote_for_idempotency(...)` `SECURITY DEFINER` : vérifie le rôle admin, retourne le devis existant si la clé existe (`reused=true`), sinon réserve atomiquement `DEV-YYYY-XXXX` et insère la ligne en `status='generating'`. Retourne `(quote_id, quote_number, reused)`. `GRANT EXECUTE TO authenticated`.

## 2. Mutualisation avec les factures

Extraction dans un nouveau `src/lib/documents.server.ts` (server-only), utilisé par factures **et** devis :

- `computeTotals`, `round2`, `formatEUR`, `formatDateFR`, types `DocumentLine`/`Totals` (déplacés depuis `invoices.server.ts`, réexportés pour ne rien casser).
- `drawDocumentHeader()` — en-tête artisan + bloc titre paramétrable (`title`, `numberLabel`, lignes méta à droite).
- `drawLinesTable()` — tableau des prestations identique.
- `drawTotalsBlock()` — Total HT / TVA par taux / Total TTC.
- `drawFooter()` — IBAN/BIC + mentions légales passées en paramètre.
- `uploadDocumentPdf(path, bytes)` et `bytesToBase64` (déplacé depuis `invoices.functions.ts` vers un helper partagé).

Réutilisés sans copie : `src/lib/artisan.server.ts` (`buildArtisanSnapshot`), `src/lib/invoice-email.server.ts` renommé conceptuellement en envoi générique `sendDocumentEmail` (même fichier, signature élargie, alias `sendInvoiceEmail` conservé), bucket privé `request-attachments`.

`src/lib/invoices.server.ts` est refactorisé pour appeler ces primitives — le rendu PDF facture reste visuellement identique.

## 3. Spécifique aux devis

- `src/lib/quotes.server.ts` : `generateQuotePdf()` — titre « DEVIS », `N° DEV-YYYY-XXXX`, date du devis, `Valable jusqu'au JJ/MM/AAAA`, bloc notes/conditions particulières, mentions légales devis (« Devis gratuit et sans engagement. Bon pour accord, date et signature. Prix fermes pendant la durée de validité. TVA applicable selon la nature des travaux. »), et la mention explicite « Ce document est un devis et ne constitue pas une facture. », Mentions légales configurables coté serveur.
- `src/lib/email-templates/quote-document-client.tsx` et `quote-document-artisan.tsx` : e-mails avec nom du client, numéro, date, validité, montant TTC, invitation à répondre à l'e-mail pour accepter ou demander une modification. Enregistrés dans `registry.ts`.
- Numérotation, statut, libellés PDF : propres aux devis.

## 4. Server functions — `src/lib/quotes.functions.ts`

- `generateQuote` (`requireSupabaseAuth` + contrôle admin + Zod) :
  1. Zod : coordonnées client, `quote_date`, `valid_until`, `notes` (max 1000), `lines` (1..50), `quote_request_id` uuid optionnel, `idempotency_key` uuid. Aucune donnée artisan reçue du navigateur.
  2. Totaux calculés côté serveur.
  3. `artisan_snapshot` construit côté serveur.
  4. RPC `create_quote_for_idempotency` → `{quoteId, quoteNumber, reused}`.
  5. `reused` : renvoie le PDF stocké ; si absent, régénération depuis `quotes` + `quote_lines` + `artisan_snapshot`, sans nouveau numéro. Pas de renvoi d'e-mail automatique.
  6. Sinon : insert des lignes → PDF → upload `quotes/YYYY/DEV-YYYY-XXXX.pdf` → `status='ready'`. Toute erreur ⇒ `generation_failed` + `generation_error`, devis et numéro conservés.
  7. E-mails : `status='sending'`, envoi client puis persistance immédiate du statut, puis artisan idem, vérification des erreurs Supabase ; statut global `sent` / `partially_sent` / `send_failed` ; `pending` jamais converti en `failed`. Clés Resend `quote/<quoteId>/client/v1` et `quote/<quoteId>/artisan/v1`.
  8. Erreurs fournisseur loguées côté serveur, message générique renvoyé au navigateur.
- `getQuoteForRequest({ quoteRequestId })` : renvoie le devis existant (numéro, statut, totaux, date d'envoi).
- `getQuotePdfSignedUrl({ quoteId })` : URL signée 10 min, admin-only.
- `resendQuoteEmail({ quoteId })` : réutilise le PDF stocké, renvoie au client, met à jour les statuts (pas de nouveau devis).

`listQuotes` (`src/lib/admin.functions.ts`) est étendu pour joindre le devis associé (numéro + statut) à chaque demande.

## 5. Interface admin

### `/admin/devis` (modifié)

- Nouvelle colonne **Actions** (desktop) et bloc équivalent en carte mobile, dans le style actuel.
- Demande non traitée : bouton **Traiter** → navigation vers `/admin/devis/$id`.
- Demande déjà traitée : badge numéro + statut du devis, puis **Voir**, **Télécharger**, **Renvoyer**.
- Le bouton Supprimer existant reste en place ; la demande d'origine n'est jamais réinitialisée.

### `/admin/devis/$id` (nouvelle page)

Réutilise les composants d'édition de `/admin/factures` (extraits dans `src/components/admin/LineItemsEditor.tsx` + `ClientFieldsForm.tsx`, réutilisés par les deux pages sans changement visuel) :

- Rappel en lecture seule de la demande (service, description, date, pièces jointes éventuelles).
- Coordonnées client pré-remplies depuis la demande, éditables.
- Éditeur de lignes (type / description / PU HT / quantité / TVA), ajout et suppression.
- Date du devis (aujourd'hui par défaut) et validité (30 jours par défaut, date modifiable).
- Champ notes / conditions particulières.
- Totaux HT / TVA / TTC calculés en direct.
- Bouton « Générer et envoyer » : `Loader2` + bouton désactivé pendant le traitement, toast de succès, toast distinct si PDF généré mais e-mail échoué, téléchargement local du PDF, retour à la liste et mise à jour de la ligne (invalidation de la query `["admin","quotes"]`).

## 6. Idempotence et reprise

- Clé UUID générée à l'ouverture de la page d'édition, conservée tant que l'envoi n'est pas totalement réussi ⇒ double-clic ou retry réseau réutilisent le même devis (`reused=true`).
- Numéro attribué atomiquement dans la RPC, jamais réattribué.
- Échec PDF ⇒ `generation_failed`, un nouveau clic reprend le même devis.
- Échec e-mail ⇒ devis conservé en `send_failed` / `partially_sent`, action **Renvoyer** disponible depuis la liste.

## Fichiers

**Nouveaux** : migration SQL, `src/lib/documents.server.ts`, `src/lib/quotes.server.ts`, `src/lib/quotes.functions.ts`, `src/routes/admin/devis.$id.tsx`, `src/components/admin/LineItemsEditor.tsx`, `src/components/admin/ClientFieldsForm.tsx`, 2 templates e-mail devis.

**Modifiés** : `src/lib/invoices.server.ts` (utilise les primitives partagées), `src/lib/invoices.functions.ts` (helpers mutualisés), `src/lib/invoice-email.server.ts` (envoi générique), `src/lib/email-templates/registry.ts`, `src/lib/admin.functions.ts`, `src/routes/admin/devis.tsx`, `src/routes/admin/factures.tsx` (réutilisation des composants extraits, rendu inchangé).

## Hors scope

Interface de gestion `accepted` / `refused` / `expired` (schéma prêt), conversion devis → facture, historique des devis.