## Objectif

Remplacer les URL relatives (`/`, `/contact`, `/services`, etc.) utilisées dans `canonical` et `og:url` par des URL absolues basées sur le domaine de production `https://plomberie-test.lovable.app`.

## Changements

Dans chaque route qui définit `head()`, préfixer les valeurs par `https://plomberie-test.lovable.app` :

- `src/routes/index.tsx` → `/`
- `src/routes/services.tsx` → `/services`
- `src/routes/avis.tsx` → `/avis`
- `src/routes/contact.tsx` → `/contact`
- `src/routes/a-propos.tsx` → `/a-propos`
- `src/routes/devis.tsx` → `/devis`
- `src/routes/rendez-vous.tsx` → `/rendez-vous`
- `src/routes/mentions-legales.tsx` → `/mentions-legales`
- `src/routes/politique-de-confidentialite.tsx` → `/politique-de-confidentialite`

Pour chaque route, mettre à jour :
- `meta` : `{ property: "og:url", content: "https://plomberie-test.lovable.app<path>" }`
- `links` : `{ rel: "canonical", href: "https://plomberie-test.lovable.app<path>" }`

## Détails techniques

- Introduire une constante `SITE_URL = "https://plomberie-test.lovable.app"` dans `src/lib/site.ts` pour éviter la duplication et faciliter un futur changement de domaine.
- Chaque route importe `site` déjà : réutiliser `site.url` pour construire l'URL absolue.
- `unsubscribe.tsx` : conserver `noindex` (pas de canonical à changer si absent).
- Ne pas toucher au sitemap ni au `__root.tsx` (déjà absolus).

## Vérification

Après build, inspecter le HTML rendu de 2-3 routes pour confirmer les balises absolues.