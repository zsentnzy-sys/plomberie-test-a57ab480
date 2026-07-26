## Objectif

Fiabiliser le moteur PDF commun aux factures et devis (pagination, débordements, libellés, duplications) sans toucher au design, aux règles métier, aux RPC, aux e-mails ni à la base.

## Changements prévus, fichier par fichier

### 1. `src/lib/document-config.server.ts` (nouveau)

Configuration commerciale/juridique, exclusivement serveur :

- `invoiceLegal` (reprend le texte actuel de `ARTISAN_INFO.legal`)
- `quoteLegal`, `quoteNotice`, `quoteSignatureLabel` (textes déplacés depuis `quotes.server.ts`)
- Libellés de bloc client : `invoiceClientLabel = "Facturé à"`, `quoteClientLabel = "Devis adressé à"`

### 2. `src/lib/artisan.server.ts`

- Reste la **seule** définition de `ArtisanInfo` (type source).
- `ARTISAN_INFO` et `buildArtisanSnapshot()` inchangés, snapshot toujours compatible avec les données déjà persistées.

### 3. `src/lib/documents.server.ts` (cœur du travail)

- Supprimer l'interface locale `ArtisanInfo` ; importer le type depuis `artisan.server.ts` et le réexporter pour ne rien casser. (import type { ArtisanInfo } from "./artisan.server";)
- `RenderDocumentParams` : ajout de `clientBlockLabel` (obligatoire), `documentTypeLabel` et `continuationLabel` (optionnels).
- Découpage de `renderDocumentPdf()` en helpers privés : `drawPageHeader`, `drawClientBlock`, `drawTableHeader`, `drawDocumentLine`, `drawTotalsBlock`, `drawNotesBlock`, `drawFooterBlock`, `drawSignatureBlock`, `addContinuationPage`. Un petit contexte de rendu interne (page, y, fonts, couleurs, marges, `ensureSpace(h)`) évite toute duplication.
- Pagination : hauteur de chaque ligne calculée **avant** dessin (nombre de lignes de description) ; nouvelle page si elle ne tient pas ; jamais de ligne coupée.
- Chaque page de continuation : mêmes marges, rappel discret « TYPE N° XXX (suite) », puis en-tête de tableau redessiné.
- Totaux : hauteur calculée selon le nombre de taux de TVA, bloc gardé groupé sur une page.
- Notes, footer, IBAN/BIC, mentions légales, signature : contrôle d'espace avant chaque bloc, continuation automatique, zone « Bon pour accord » jamais scindée.
- `wrapText` : mesure réelle via `font.widthOfTextAtSize()` (largeur en points + taille), découpe des mots très longs sans espace, sanitisation WinAnsi conservée. L'ancienne signature par nombre de caractères est remplacée en interne ; export conservé si nécessaire.

### 4. `src/lib/invoices.server.ts`

- Importe `ArtisanInfo` depuis `artisan.server.ts` ; garde les réexports existants.
- `generateInvoicePdf` passe `clientBlockLabel` et `documentTypeLabel = "Facture"`, `legal` depuis la config serveur (fallback sur `artisan.legal` du snapshot pour les documents anciens).

### 5. `src/lib/quotes.server.ts`

- `QUOTE_NOTICE` / `QUOTE_LEGAL` deviennent de simples réexports lisant `document-config.server.ts` (aucun texte commercial en dur dans le moteur).
- Passe `clientBlockLabel = "Devis adressé à"`, `documentTypeLabel = "Devis"`, `signatureBlock` avec libellé configurable.

### 6. `src/lib/invoices.functions.ts`

- Suppression des définitions locales `round2` et `bytesToBase64` ; import des versions partagées (comme le fait déjà `quotes.functions.ts`).

### 7. `src/lib/quotes.functions.ts`

- Ajustement d'imports uniquement si le renommage des constantes l'impose.

## Vérifications

Script de génération hors-ligne (`/tmp`) appelant directement le moteur, puis contrôle visuel via `pdftoppm` :

Factures : 1 ligne · plusieurs taux de TVA · description longue · 20–50 lignes (multi-pages) · avec/sans téléphone client · avec/sans IBAN-BIC.

Devis : simple · avec notes · description longue · multi-pages · plusieurs taux de TVA · zone de signature · mentions légales longues.

Contrôles par document : aucune ligne coupée, aucun texte hors page, en-tête de tableau répété, totaux groupés et visibles, footer lisible, libellé client correct, titre + numéro corrects, PDF ouvrable. Les scénarios réellement vérifiés seront listés à la fin.

## Contraintes respectées

Aucun changement de statuts, RPC, idempotence, envoi d'e-mails, tables, ni du design du dashboard. Un seul moteur PDF (`documents.server.ts`). Les informations artisan restent strictement serveur.