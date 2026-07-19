# Plan — Pages SEO dédiées pour les 4 services

Créer 4 pages de service uniques, rendues côté serveur, avec contenu métier riche, JSON-LD, breadcrumb, FAQ, et maillage interne — sans casser l'existant.

## 1. Routes à créer

Convention TanStack déjà en place (fichiers plats à points) :

- `src/routes/services.depannage.tsx` → `/services/depannage`
- `src/routes/services.chauffage.tsx` → `/services/chauffage`
- `src/routes/services.sanitaire.tsx` → `/services/sanitaire`
- `src/routes/services.debouchage.tsx` → `/services/debouchage`

Chaque route utilise `createFileRoute("/services/<slug>")` avec un `head()` qui renvoie meta, canonical, OG, Twitter, et JSON-LD (Service + BreadcrumbList + FAQPage). Pas de loader, pas de server function : le contenu est statique, rendu SSR directement dans le composant. `routeTree.gen.ts` sera régénéré automatiquement.

## 2. Composant partagé pour la structure (pas pour le texte)

Créer `src/components/ServicePageLayout.tsx` : reçoit en props les données propres à chaque service (breadcrumb, hero, sections, FAQ, JSON-LD source). Il gère uniquement la mise en page commune :

- Fil d'Ariane accessible (`nav aria-label="Fil d'Ariane"`, liens `Accueil` → `Services` → service courant).
- Hero léger réutilisant le style de `PageHero` (H1 unique, intro, boutons "Demander un devis" vers `/devis` et "Appeler" via `tel:${site.phoneRaw}`).
- Wrappers des sections (situations, prestations, déroulement, zone, réassurance, FAQ, CTA final, services associés).
- Bloc "Services associés" qui liste automatiquement les 3 autres slugs avec liens `<Link to="/services/$slug">` et ancres descriptives.

Les textes de chaque section (titres H2/H3, paragraphes, listes, FAQ) sont écrits en dur dans chaque route et passés au layout via props. Aucun contenu n'est partagé ou dupliqué entre les 4 pages.

## 3. Contenu éditorial (par page, ~700–1 000 mots utiles)

Rédaction en français naturel, mots-clés locaux insérés naturellement dans H1, intro, quelques H2 et la FAQ. Communes citées avec parcimonie (Metz, Montigny-lès-Metz, Woippy, Marly, Maizières-lès-Metz, Eurométropole de Metz), pas de liste répétitive.

Sections communes à chaque page (contenu propre à chaque service) :

1. Situations où faire appel — cas concrets, symptômes.
2. Prestations proposées — liste précise et champ lexical demandé.
3. Déroulement d'une intervention — contact, diagnostic, solution, devis/tarif, réalisation, vérification.
4. Zone d'intervention — Metz et ~30 km, communes citées naturellement, référence à `site.zone`.
5. Réassurance — devis gratuit (installations/rénovations), tarifs de `site.pricing` mentionnés, facture détaillée, RC Pro + garantie décennale (uniquement quand pertinent, ex : chauffage/sanitaire), artisan plombier-chauffagiste.
6. FAQ — 4 à 6 questions spécifiques (listes fournies dans le prompt utilisées comme base, reformulées naturellement).
7. CTA final — appel, devis, rendez-vous.
8. Services associés — liens vers les 3 autres pages.

Aucun élément inventé (pas de certifications, ancienneté, nombre d'interventions, délai garanti, RGE, Qualibat, marques, avis, tarifs hors `site.pricing`). Aucun avis/note/prix ajouté dans JSON-LD.

H1 recommandés :

- Dépannage : "Dépannage plomberie en urgence à Metz"
- Chauffage : "Chauffagiste à Metz : chaudière, entretien et dépannage"
- Sanitaire : "Installation sanitaire et rénovation de salle de bain à Metz"
- Débouchage : "Débouchage de canalisation à Metz"

## 4. Métadonnées et données structurées (par page)

Dans `head()` de chaque route :

- `title` unique (variante de "<Service> à Metz | Plomberie Dupont", <60 caractères).
- `description` unique (~140–160 caractères).
- `og:title`, `og:description`, `og:type: "website"`, `og:url` absolu.
- `twitter:card: "summary_large_image"`, `twitter:title`, `twitter:description`.
- `<link rel="canonical">` absolu vers `https://plomberie-test.lovable.app/services/<slug>`.
- Pas de meta keywords.
- Pas de `og:image` (aucune image dédiée générée dans ce plan — l'hôte injecte la preview par défaut).

JSON-LD via `scripts` dans `head()`, un tableau par page :

- `Service` avec `name`, `description`, `provider` (LocalBusiness reprenant `site`), `areaServed` (Metz + communes de `site.zone`), `url`.
- `BreadcrumbList` avec 3 items (Accueil, Services, Service courant).
- `FAQPage` reprenant EXACTEMENT les questions/réponses affichées.

## 5. Maillage interne

- `src/routes/services.tsx` : chaque carte de service devient un `<Link to="/services/$slug">` (via slug de `site.ts`) avec ancre descriptive ("Découvrir <service>"). Le reste de la page (grille de tarifs, CTA) reste inchangé.
- `src/components/Footer.tsx` : la colonne "Nos Services" pointe désormais vers `/services/<slug>` au lieu de `/services`. Ancres descriptives conservées (le titre du service).
- Liens contextuels dans le corps des pages :
  - Dépannage → chauffage (chauffe-eau/chaudière) et débouchage (canalisation).
  - Chauffage → dépannage (pannes urgentes) et sanitaire (rénovation).
  - Sanitaire → chauffage (chauffe-eau/ballon) et débouchage (évacuations).
  - Débouchage → dépannage (fuite associée) et sanitaire (rénovation évacuations).

## 6. Sitemap

Mettre à jour `src/routes/sitemap[.]xml.ts` en ajoutant les 4 entrées :

```
/services/depannage
/services/chauffage
/services/sanitaire
/services/debouchage
```

Aucune autre modification de la route sitemap.

## 7. Performances & Safari iOS

- Aucun `blur-[...]`, `backdrop-blur`, filtre CSS lourd ni animation sur le hero/LCP.
- Icônes `lucide-react` déjà utilisées, aucune nouvelle dépendance.
- Pas d'images ajoutées dans ce plan (hero léger textuel). Si le user demande plus tard une image par service, elle sera générée en WebP avec dimensions explicites et `fetchpriority="high"` sur le LCP uniquement, les autres en `loading="lazy"`.
- Contenu SSR direct : pas d'`useEffect`, pas de rendu conditionnel côté client pour le contenu SEO.

## 8. Contraintes respectées

- Aucune modification de l'admin, des formulaires, de `routeTree.gen.ts`, du `client.ts` Supabase.
- Réutilisation stricte de `src/lib/site.ts` (nom, tel, adresse, zone, horaires, tarifs) — pas de duplication.
- TypeScript strict, pas de `any`, types dérivés de `site.ts` quand pertinent.
- Composants existants réutilisés (`Button`, `Link`, `PageHero`-like layout).

## 9. Fichiers touchés

Création :
- `src/routes/services.depannage.tsx`
- `src/routes/services.chauffage.tsx`
- `src/routes/services.sanitaire.tsx`
- `src/routes/services.debouchage.tsx`
- `src/components/ServicePageLayout.tsx`

Modification :
- `src/routes/services.tsx` (cartes → liens vers pages dédiées)
- `src/components/Footer.tsx` (liens services → pages dédiées)
- `src/routes/sitemap[.]xml.ts` (4 nouvelles entrées)

Aucune migration DB, aucune server function, aucune nouvelle dépendance.
