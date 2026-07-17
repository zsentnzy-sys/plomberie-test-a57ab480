# Optimiser les polices et nettoyer les dépendances

Objectif : réduire la taille du bundle et accélérer le chargement en (1) simplifiant le chargement des polices et (2) supprimant les paquets npm et fichiers UI qui ne sont jamais importés dans le code applicatif.

## 1. Polices

Actuellement `src/routes/__root.tsx` importe 4 fichiers CSS statiques Inter (400, 500, 600, 700), chacun embarquant tous les sous-ensembles (latin, latin-ext, cyrillic, greek, vietnamese…), plus Sora Variable complet.

Changements :
- Remplacer les 4 imports `@fontsource/inter/{400,500,600,700}.css` par un unique `@fontsource-variable/inter/wght.css` (une seule police variable, un seul fichier).
- Restreindre Sora au sous-ensemble latin : `@fontsource-variable/sora/latin.css` au lieu de `/index.css`.
- Ajouter `@fontsource-variable/inter` dans package.json (Sora est déjà présent).
- Retirer `@fontsource/inter` de package.json (plus utilisé).

Résultat attendu : ~6–8 fichiers de polices en moins téléchargés, LCP plus rapide, aucun changement visuel (mêmes familles, mêmes graisses).

## 2. Dépendances npm inutilisées

Aucune référence dans `src/` (hors composants shadcn eux-mêmes non importés) → à retirer de `package.json` :

- `cmdk`, `vaul`, `embla-carousel-react`, `recharts`, `react-resizable-panels`, `input-otp`, `react-day-picker`, `date-fns`
- Radix non utilisés : `@radix-ui/react-accordion`, `react-aspect-ratio`, `react-avatar`, `react-checkbox`, `react-collapsible`, `react-context-menu`, `react-dropdown-menu`, `react-hover-card`, `react-menubar`, `react-navigation-menu`, `react-popover`, `react-progress`, `react-radio-group`, `react-scroll-area`, `react-slider`, `react-switch`, `react-tabs`, `react-toggle`, `react-toggle-group`

Conservés parce qu'utilisés (directement ou par `sidebar` du dashboard admin) : `react-alert-dialog`, `react-dialog`, `react-label`, `react-select`, `react-slot`, `react-separator`, `react-tooltip`, plus `sonner`, `lucide-react`, `zod`, etc.

## 3. Fichiers shadcn/ui inutilisés à supprimer

Correspondants aux paquets retirés, aucun `import` dans le code applicatif :

`accordion.tsx`, `alert.tsx`, `aspect-ratio.tsx`, `avatar.tsx`, `badge.tsx`, `breadcrumb.tsx`, `calendar.tsx`, `carousel.tsx`, `chart.tsx`, `checkbox.tsx`, `collapsible.tsx`, `command.tsx`, `context-menu.tsx`, `drawer.tsx`, `dropdown-menu.tsx`, `form.tsx`, `hover-card.tsx`, `input-otp.tsx`, `menubar.tsx`, `navigation-menu.tsx`, `pagination.tsx`, `popover.tsx`, `progress.tsx`, `radio-group.tsx`, `resizable.tsx`, `scroll-area.tsx`, `slider.tsx`, `switch.tsx`, `tabs.tsx`, `toggle.tsx`, `toggle-group.tsx`.

Conservés : `alert-dialog`, `button`, `card`, `dialog`, `input`, `label`, `select`, `sonner`, `table`, `textarea`, plus la chaîne utilisée par le dashboard admin (`sidebar`, `sheet`, `separator`, `skeleton`, `tooltip`).

## Vérification

- `bun run build` doit passer.
- Vérifier le rendu de l'accueil (typo Inter/Sora), du header, et du dashboard `/admin` (sidebar intacte).

## Hors périmètre

Aucune modification de logique métier, de style, de couleurs ou de contenu.
