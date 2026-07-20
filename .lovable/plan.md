Sur la page d'accueil (`src/routes/index.tsx`), la carte de chaque service affiche un lien "En savoir plus" qui pointe actuellement vers `/services`. Je vais le faire pointer vers la page dédiée du service correspondant.

Changement :
- Dans `src/routes/index.tsx`, remplacer `<Link to="/services">` (dans la boucle `services.map`) par un lien typé vers la route dynamique du service, en utilisant `s.slug` :

```tsx
<Link
  to="/services/$service"
  params={{ service: s.slug }}
  ...
>En savoir plus <ArrowRight ... /></Link>
```

Note technique : les routes existantes sont `services.depannage.tsx`, `services.chauffage.tsx`, `services.sanitaire.tsx`, `services.debouchage.tsx` (routes statiques, pas dynamiques). TanStack Router n'accepte pas une interpolation de chaîne dans `to`. Deux options :
1. Utiliser un petit map slug → route littérale et un `switch`/objet pour passer `to` correctement typé (préféré, garde la sécurité de types).
2. Caster via `to={\`/services/${s.slug}\` as any}` (rapide mais perd le typage).

Je retiens l'option 1 : un objet `{ depannage: "/services/depannage", chauffage: "/services/chauffage", sanitaire: "/services/sanitaire", debouchage: "/services/debouchage" } as const`, puis `<Link to={serviceRoutes[s.slug]}>`.

Aucune autre modification (pas de changement de contenu, de style, ni des pages services).