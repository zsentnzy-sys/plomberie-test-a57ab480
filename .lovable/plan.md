## Objectif

Ajouter une page `/admin/factures` permettant à l'artisan de composer une facture, la générer en PDF côté serveur, l'envoyer par email au client (avec copie à l'artisan) et la télécharger. Aucun PDF ni ligne de facture n'est stocké côté serveur ; seul un compteur de numérotation est persisté.

## Informations artisan (en dur en haut du fichier)

Un bloc `const ARTISAN_INFO = { ... }` en haut de `src/routes/admin/factures.tsx` reprenant : nom entreprise, nom/prénom artisan, adresse complète, SIRET, téléphone, email, IBAN/BIC (optionnel), mentions légales (assurance décennale, RC Pro), logo/couleur. Ces valeurs pourront ensuite être migrées vers `src/lib/site.ts` si souhaité.

## Formulaire (page admin)

**Client**
- Nom / Prénom (requis)
- Adresse (requis, textarea)
- Email client (requis) — pour l'envoi
- Téléphone (optionnel)

**Facture**
- Date de facture (par défaut aujourd'hui, format DD/MM/YYYY)
- Mode de paiement (select requis) : Carte bancaire · Virement bancaire · Chèque · Espèces

**Lignes facturées** (bouton "+ Ajouter une ligne", suppression par ligne)
- Type (select) : Service · Matériel · Taux horaire
- Description (texte libre)
- Prix unitaire HT (nombre)
- Quantité (nombre, défaut 1)
- TVA (select) : 0% · 5,5% · 10% · 20%
- Prix TTC (calculé auto = PU × Qté × (1 + TVA))

**Totaux** (calculés en direct)
- Total HT
- Total TVA (détaillé par taux si plusieurs)
- Total TTC

**Actions**
- Bouton "Générer et envoyer" → appelle la server function, affiche toast, propose le téléchargement.
- Bouton "Aperçu PDF" (optionnel, ouvre le PDF sans envoi email).

## Numérotation

Nouvelle table `public.invoice_counter` (single-row) avec `year INT PRIMARY KEY`, `last_number INT`. Fonction SQL `next_invoice_number()` (SECURITY DEFINER, admin only via `has_role`) qui incrémente et renvoie `FACT-YYYY-XXXX` (padding 4 chiffres, reset annuel). Seul le compteur est stocké — pas le contenu des factures.

## Server function

`src/lib/invoices.functions.ts` :
- `generateInvoice` (`createServerFn POST` + `requireSupabaseAuth` + assertAdmin)
- Validation Zod stricte de tout le payload (montants > 0, TVA dans la liste, min 1 ligne, email valide, longueurs bornées).
- Appelle `next_invoice_number()` via RPC.
- Génère le PDF via **pdf-lib** (WASM-compatible avec Cloudflare Workers, contrairement à pdfkit/puppeteer/sharp). Layout : en-tête artisan + logo, bloc client, tableau des lignes, totaux, mentions légales & mode de paiement en pied de page.
- Envoie 2 emails via le système `dispatch.server.ts` existant :
  1. Client : template `invoice-client` (PDF en pièce jointe base64)
  2. Artisan (sentnzy@gmail.com) : template `invoice-artisan` (même PDF)
- Retourne `{ invoiceNumber, pdfBase64 }` pour permettre le téléchargement immédiat côté client.

**Note technique** : vérifier que la fonction `sendLovableEmail` supporte les pièces jointes ; sinon, joindre un lien signé temporaire (mais l'utilisateur a demandé "aucun stockage" — on utilisera donc l'attachement base64 direct via l'API Resend sous-jacente ou on renverra seulement le PDF côté admin qui le transmettra manuellement). À confirmer en build en lisant `dispatch.server.ts`.

## Templates emails

- `src/lib/email-templates/invoice-client.tsx` — "Votre facture FACT-YYYY-XXXX"
- `src/lib/email-templates/invoice-artisan.tsx` — "Nouvelle facture émise : FACT-YYYY-XXXX"
- Enregistrement dans `src/lib/email-templates/registry.ts`.

## Navigation admin

Ajout de l'entrée "Factures" (icône `FileSpreadsheet`) dans `navItems` de `src/routes/admin/route.tsx`, entre "Devis" et "Messages".

## Fichiers créés / modifiés

**Créés**
- `src/routes/admin/factures.tsx` — page + formulaire (React Hook Form + Zod, composants shadcn existants)
- `src/lib/invoices.functions.ts` — server function
- `src/lib/invoices.server.ts` — helpers PDF (pdf-lib) et calculs totaux
- `src/lib/email-templates/invoice-client.tsx`
- `src/lib/email-templates/invoice-artisan.tsx`
- Migration : table `invoice_counter` + fonction `next_invoice_number()` (SECURITY DEFINER, admin only, GRANT EXECUTE authenticated, search_path fixé)

**Modifiés**
- `src/routes/admin/route.tsx` — nav item
- `src/lib/email-templates/registry.ts` — enregistrement templates
- `package.json` — ajout dépendance `pdf-lib`

## Points hors scope

- Pas de liste/historique des factures émises.
- Pas de rattachement automatique à un devis ou rendez-vous existant (peut être ajouté ensuite).
- Pas de personnalisation du logo via upload (logo statique dans le code).
