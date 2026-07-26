## Objectif

Corriger trois défauts de pagination/débordement restants dans le moteur PDF partagé `src/lib/documents.server.ts`. Aucun changement de design, de couleurs, de marges, de règles métier ou d'envoi d'e-mails.

## 1. Bloc client : plus de dépassement vertical

Dans `drawClientBlock()`, chaque ligne est actuellement dessinée sans contrôle d'espace (label, nom, adresse multi-lignes, e-mail, téléphone).

Correction : pré-calculer la hauteur du bloc « identité » (label 14 + nom 13 + lignes d'adresse wrappées ×12 + lignes e-mail ×12 + téléphone 12 + 14 de marge) et appeler `ensureSpace()` une fois pour garder le bloc groupé, puis un `ensureSpace(ctx, 12)` défensif avant chaque ligne dessinée pour couvrir le cas d'un bloc plus haut qu'une page entière (adresse très longue).

Le bloc `notice` conserve sa logique actuelle (déjà protégée).

## 2. Wrapping des e-mails et des lignes longues du bloc client

`client.email`, `client.name` et `client.phone` sont dessinés directement et peuvent sortir de la page.

Correction : passer ces valeurs par `wrapByWidth()` avec la largeur disponible du bloc client (`ctx.width - 2*M - 180`), avec la bonne police et la bonne taille pour chacun. `wrapByWidth` gère déjà le hard-split des chaînes sans espace, donc une adresse e-mail très longue sera coupée proprement au lieu de déborder.

## 3. Pré-calcul du footer basé sur les lignes réellement wrappées

Dans `drawFooterBlock()`, `firstChunk` compte `footerLines.length` et la ligne IBAN comme une ligne chacune, alors qu'elles sont ensuite wrappées.

Correction : wrapper d'abord toutes les lignes (footer, IBAN/BIC, légal) dans des tableaux, puis calculer `firstChunk` à partir du nombre réel de lignes obtenues (séparateur 16 + n_footer×12 + n_iban×12 + min(n_legal, 2)×10) avant l'`ensureSpace()` initial. Le rendu ensuite itère sur ces tableaux déjà calculés — pas de double wrapping.

## Détails techniques

- Fichier touché : `src/lib/documents.server.ts` uniquement (helpers privés `drawClientBlock` et `drawFooterBlock`).
- Aucun changement de signature publique, aucun impact sur `invoices.server.ts` / `quotes.server.ts` / `document-config.server.ts`.

## Vérification

Génération et contrôle visuel (conversion en images) de scénarios ciblés :
- client avec adresse très longue sur 6+ lignes en bas de page ;
- e-mail client très long sans espace ;
- client sans téléphone ;
- facture avec IBAN + BIC longs et mentions légales longues en fin de page ;
- devis avec footer long + zone de signature ;
- contrôle de non-régression : facture simple 1 ligne et devis multi-pages inchangés visuellement.
