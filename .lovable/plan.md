## Problème

Dans `drawTotalsBlock()` (`src/lib/documents.server.ts`), l'encadré turquoise du « Total TTC » est dessiné trop haut : après la ligne « Total TVA », le curseur ne descend que de 20 pt, alors que le rectangle démarre 6 pt sous la ligne de base et fait 22 pt de haut. Son bord supérieur se retrouve donc à seulement 4 pt sous la ligne de base du « Total TVA » — les jambages de ce texte touchent/chevauchent le bloc coloré.

## Correction

Uniquement dans `drawTotalsBlock()` :

- augmenter l'espacement avant l'encadré (descente de 20 → 28 pt) afin de laisser une respiration nette sous la ligne « Total TVA » ;
- garder l'encadré de 22 pt de haut, positionné pour que le texte « Total TTC » reste centré verticalement comme aujourd'hui ;
- mettre à jour le pré-calcul de hauteur `h` du bloc (constante 34 → 42) pour que la protection anti-coupure de page reste exacte.

Aucun changement de couleurs, de largeur d'encadré, d'alignement à droite des montants, ni de la structure du bloc.