# Historique unifié des devis et factures

Nouvelle page `/admin/historique` dans l'espace admin, réutilisant les tables, fonctions d'envoi et de PDF existantes. Aucun changement de design global : mêmes composants (Card, Table, Badge, Button, Select, Input) et même mise en page que les pages admin actuelles.

## 1. Base de données (migration additive)

- Ajout de `source_quote_id uuid` (référence vers `quotes`, `ON DELETE SET NULL`) dans `invoices`.
- Index unique partiel sur `invoices(source_quote_id) WHERE source_quote_id IS NOT NULL` : un devis ne peut donner qu'une seule facture → double conversion impossible au niveau base.
- Mise à jour de la fonction transactionnelle `create_invoice_with_lines_for_idempotency` avec un paramètre optionnel `_source_quote_id` (valeur par défaut nulle, appels existants inchangés). En cas de violation d'unicité, message clair : « Ce devis a déjà été transformé en facture ».

## 2. Lecture serveur (nouveau fichier `src/lib/history.functions.ts`)

Toutes les fonctions sont protégées par `requireSupabaseAuth` + le garde `assertAdmin` déjà utilisé par les devis/factures.

- `listDocuments` : renvoie une page de devis **ou** de factures (type demandé), avec recherche (nom, e-mail, numéro), filtre de statut, tri décroissant sur la date de création, pagination serveur (25 par page). Colonnes renvoyées : type, numéro, client, adresse, e-mail, date de création, total TTC, statut, date d'envoi, présence d'un PDF, et pour les devis le numéro de la facture liée s'il existe.
- `getQuoteForInvoice` : renvoie les données d'un devis (client, adresse, e-mail, téléphone, lignes avec quantités, prix unitaires, TVA) pour préremplir le formulaire de facture, et signale si une facture existe déjà pour ce devis.

Aucun chemin Storage n'est renvoyé au client. Les fonctions existantes `getQuotePdfSignedUrl` / `getInvoicePdfSignedUrl` (URL signée 10 min) sont réutilisées telles quelles pour le bouton **Ouvrir**, et `resendQuoteEmail` / `resendInvoiceEmail` pour le bouton **Renvoyer** (logique idempotente déjà en place, aucun nouveau document créé).

## 3. Page `/admin/historique`

- Entrée « Historique » ajoutée à la barre latérale admin (icône `History`), même style que les autres liens.
- Deux onglets : **Factures** / **Devis**.
- Barre d'outils : champ de recherche (nom, e-mail, numéro), sélecteur de statut (Tous, Envoyé, Échec d'envoi, Envoi partiel, Prêt à envoyer), pagination précédent/suivant.
- Tableau : numéro, client (nom + adresse + e-mail), date de création (JJ/MM/AAAA), total TTC, badge de statut, date d'envoi.
- Badges : Envoyé (vert), Envoi partiel (ambre), Échec d'envoi (rouge/destructive), Prêt à envoyer (neutre), plus les autres statuts existants affichés de façon lisible.
- États gérés : chargement (spinner cohérent avec les autres pages), liste vide (« Aucun document »), erreur affichée proprement avec bouton Réessayer.

### Actions par ligne

- **Ouvrir** : appelle la fonction serveur d'URL signée puis ouvre le PDF dans un nouvel onglet. Si le document n'a pas de PDF, le bouton est désactivé avec l'info « PDF non disponible ».
- **Renvoyer** : visible uniquement pour les statuts `ready`, `send_failed`, `partially_sent`. Réutilise les fonctions de renvoi existantes, affiche le résultat par destinataire et rafraîchit la liste.
- **Transformer en facture** (devis uniquement) : ouvre une boîte de dialogue de confirmation, puis redirige vers le formulaire de facture prérempli. Aucun envoi ni création automatique. Si une facture liée existe déjà, l'action est remplacée par le numéro de la facture affiché dans la ligne.

## 4. Conversion devis → facture

- `/admin/factures` accepte un paramètre d'URL `?depuisDevis=<id>` : le formulaire existant est préchargé (client, adresse, e-mail, téléphone, lignes avec descriptions, quantités, prix unitaires, TVA) via `getQuoteForInvoice`. Le design du formulaire reste inchangé ; un simple bandeau indique « Facture créée à partir du devis DEV-XXXX-XXXX ».  
  
La conversion ne doit pouvoir se faire uniquement si la demande de devis (correspoquote_request id) a le status 'confirmed' afin de ne pas crée de facture pour un devis qui n'a pas été accepté.
- L'administrateur peut tout modifier avant validation. À la validation, la facture est créée par la fonction transactionnelle habituelle avec son propre numéro `FACT-AAAA-XXXX` et `source_quote_id` renseigné.
- Le devis d'origine n'est jamais modifié. Une seconde tentative de conversion est bloquée côté serveur.

## 5. Vérifications

Typecheck TypeScript et build de production, puis tests sur l'application : affichage des quatre statuts, ouverture d'un PDF, renvoi après échec, envoi partiel, conversion d'un devis, tentative de double conversion, devis sans PDF, document introuvable, accès par un utilisateur non administrateur.

## Détails techniques

- Fichiers créés : `src/lib/history.functions.ts`, `src/routes/admin/historique.tsx`, une migration SQL additive.
- Fichiers modifiés : `src/routes/admin/route.tsx` (lien de navigation), `src/routes/admin/factures.tsx` (préremplissage via search param), `src/lib/invoices.functions.ts` (champ optionnel `source_quote_id` transmis à la RPC), types Supabase régénérés.
- Recherche serveur via `ilike` sur `client_name`, `client_email` et le numéro de document ; pagination via `range()` avec `count: "exact"`.
- Aucune duplication de logique métier : génération PDF, envoi d'e-mails et URLs signées restent dans les modules existants.