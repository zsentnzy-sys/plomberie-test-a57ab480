## Diagnostic

L'erreur `Cannot destructure property '__extends' of '__toESM(...).default' as it is undefined` vient de `pdf-lib` : la lib est écrite en TypeScript ancien et importe `tslib` (qui fournit `__extends`) via un pattern CommonJS. Quand le bundler du runtime serverless (Cloudflare Worker) transforme `tslib` en ESM, `default.__extends` devient `undefined` et pdf-lib crash au premier `class X extends Y`.

C'est un problème d'interop bien connu de `pdf-lib` en environnement Workers/edge — pas un bug de notre code.

## Solution

Remplacer `pdf-lib` par **`@cantoo/pdf-lib`**, un fork maintenu, drop-in compatible (même API, mêmes imports nommés), reconstruit en ESM propre et utilisé spécifiquement pour Cloudflare Workers / edge runtimes.

## Étapes

1. **Dépendances**
   - Retirer `pdf-lib` et `@pdf-lib/fontkit` (fontkit n'est pas utilisé — on n'embarque que les polices standard `Helvetica`).
   - Ajouter `@cantoo/pdf-lib`.

2. **Code**
   - Dans `src/lib/invoices.server.ts`, remplacer l'unique ligne :
     ```ts
     import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
     ```
     par :
     ```ts
     import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "@cantoo/pdf-lib";
     ```
   - Aucun autre changement de code : l'API est strictement identique.

3. **Vérification**
   - Rebuild, puis test réel depuis `/admin/factures` : générer une facture et confirmer que le PDF est bien créé, envoyé par email et téléchargé.
   - Vérifier les logs server-function en cas d'erreur résiduelle.

## Hors périmètre

- Pas de changement de layout PDF, de contenu, ni du flux d'envoi email.
- Pas de migration base de données.
