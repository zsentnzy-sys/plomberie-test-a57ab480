Je vais corriger la structure de routage TanStack pour que les pages `/services/depannage`, `/services/chauffage`, `/services/sanitaire` et `/services/debouchage` affichent réellement leur contenu.

Constat vérifié dans le code :
- Les pages détaillées existent et contiennent bien les sections attendues : hero, prestations, déroulement, zone locale, réassurance, FAQ, CTA et services associés.
- Le composant `ServicePageLayout` rend bien la FAQ et les autres sections.
- Le problème vient de la route parent `src/routes/services.tsx` : elle affiche la page liste des services mais ne rend pas `<Outlet />`. Dans TanStack Router, les routes enfants `/services/...` ne peuvent donc pas s’afficher dans cette structure.

Plan d’implémentation :
1. Transformer `src/routes/services.tsx` en vraie route layout parent qui rend uniquement `<Outlet />`.
2. Déplacer la page actuelle “Services & tarifs” dans une nouvelle route index `src/routes/services.index.tsx`, afin que `/services` continue d’afficher exactement la page liste actuelle.
3. Conserver les métadonnées SEO existantes de `/services` sur la nouvelle route index.
4. Laisser les 4 routes détaillées existantes utiliser `ServicePageLayout`, ce qui rendra visibles leurs contenus longs et leurs FAQ.
5. Vérifier les URLs `/services/depannage`, `/services/chauffage`, `/services/sanitaire`, `/services/debouchage` dans le rendu navigateur pour confirmer que les sections et FAQ apparaissent.