# Phase A — Supprimer les affirmations de conformité Factur-X non démontrées

## Objectif

Cette phase doit empêcher toute présentation trompeuse de la conformité Factur-X actuelle.

À l’issue de cette phase :

- aucune facture ne doit être présentée comme « conforme Factur-X » sur la seule base des auto-contrôles internes ;
- aucune facture ne doit être présentée comme « prête pour plateforme agréée » ;
- les résultats des auto-contrôles, de la qualification du générateur et d’une éventuelle validation externe doivent être séparés ;
- les outils de validation réellement requis par la CI doivent être obligatoires ;
- un outil absent ou une validation échouée doit provoquer un échec explicite ;
- la version Factur-X enregistrée doit rester la version réellement implémentée par le générateur ;
- Factur-X 1.09 reste la version cible de la Phase B, mais ne doit pas encore être attribuée aux documents produits par l’implémentation actuelle.

Cette phase ne modifie pas :

- le rendu visuel des PDF ;
- le contenu XML produit ;
- la syntaxe CII actuelle ;
- les règles fiscales ;
- les calculs et arrondis ;
- les e-mails ;
- l’idempotence ;
- la conversion devis vers facture ;
- les anciennes factures ;
- les artefacts XSD ou Schematron ;
- la transmission à une plateforme agréée.

---

# 1. Principes de statut

Les notions suivantes doivent être séparées.

## 1.1 Auto-contrôles de la facture

Les auto-contrôles correspondent uniquement aux vérifications internes réalisées lors de la génération :

- cohérence des montants ;
- contrôles métier internes ;
- syntaxe XML interne actuellement disponible ;
- présence du XML embarqué ;
- présence des métadonnées attendues ;
- présence de `/AF` ;
- relation `AFRelationship = Alternative` ;
- présence de l’OutputIntent ;
- absence détectée de police standard non incorporée.

Ces contrôles ne constituent pas une validation officielle Factur-X.

Créer le statut :

```text
runtime_validation_status

```

Valeurs autorisées :

```text
not_applicable
pending
passed
failed

```

Signification :

- `not_applicable` : document non concerné, notamment une facture PDF classique ;
- `pending` : auto-contrôles non encore terminés ;
- `passed` : auto-contrôles internes réussis ;
- `failed` : au moins un auto-contrôle interne a échoué.

---

## 1.2 Qualification du générateur

La qualification du générateur désigne le passage d’une version précise du moteur dans la CI complète.

Créer le statut :

```text
generator_qualification_status

```

Valeurs autorisées :

```text
unqualified
qualified
qualification_failed

```

En Phase A, le générateur doit rester :

```text
unqualified

```

Même si VeraPDF réussit, le générateur ne peut pas être qualifié Factur-X puisque les validations XSD et Schematron officielles ne sont pas encore intégrées.

Une qualification future devra être liée exactement à :

```text
generator_version
validation_artifacts_version

```

Une nouvelle version qualifiée du générateur ne doit jamais qualifier automatiquement les anciennes factures générées par une version différente.

---

## 1.3 Validation externe de la facture

La validation externe représente une validation individuelle éventuellement effectuée par un validateur externe ou un futur service dédié.

Créer le statut :

```text
external_validation_status

```

Valeurs autorisées :

```text
not_applicable
not_run
valid
invalid

```

En Phase A :

- les factures PDF classiques utilisent `not_applicable` ;
- les factures Factur-X utilisent `not_run` ;
- aucune facture ne doit recevoir `valid`, car aucune validation externe individuelle n’est encore exécutée.

---

# 2. Migration additive de la base

Créer une nouvelle migration additive sur `public.invoices`.

Ajouter les colonnes suivantes :

```sql
runtime_validation_status text;
generator_qualification_status text;
external_validation_status text;
generator_version text;
document_schema_version text;
validation_artifacts_version text;

```

Ajouter des contraintes `CHECK` ou des types enum adaptés afin de limiter les valeurs autorisées.

Valeurs autorisées :

```text
runtime_validation_status:
not_applicable | pending | passed | failed

generator_qualification_status:
unqualified | qualified | qualification_failed

external_validation_status:
not_applicable | not_run | valid | invalid

```

## Initialisation des lignes existantes

Ne pas appliquer `pending` indistinctement à toutes les factures.

Pour les factures existantes avec :

```text
invoice_format = classic_pdf

```

initialiser :

```text
runtime_validation_status = not_applicable
generator_qualification_status = unqualified
external_validation_status = not_applicable

```

Pour les factures existantes avec :

```text
invoice_format = facturx

```

initialiser :

```text
generator_qualification_status = unqualified
external_validation_status = not_run

```

Pour `runtime_validation_status` :

- utiliser `passed` uniquement lorsqu’un ancien statut prouve que les auto-contrôles internes ont réussi ;
- utiliser `failed` lorsqu’un ancien statut ou une erreur de validation prouve un échec ;
- utiliser `pending` lorsqu’il est impossible de déterminer le résultat avec certitude.

Ne pas déduire une qualification officielle à partir de l’ancien champ `facturx_validation_status`.

---

# 3. Dépréciation de `facturx_validation_status`

Conserver la colonne existante :

```text
facturx_validation_status

```

uniquement pour préserver la compatibilité avec les données et le code historique.

Elle ne doit plus être utilisée comme source d’affichage ni comme preuve de conformité.

À partir de cette phase :

- ne plus utiliser `facturx_validation_status` dans l’historique ;
- ne plus décider qu’une facture est conforme à partir de ce champ ;
- ne plus lui attribuer `valid` après de simples auto-contrôles internes ;
- documenter ce champ comme déprécié ;
- migrer progressivement toutes les lectures vers les nouveaux statuts.

Le champ peut continuer à être alimenté temporairement pour compatibilité technique, mais aucune valeur `valid` ne doit être interprétée ou présentée comme une validation officielle.

---

# 4. Gestion des versions

## 4.1 Ne pas étiqueter prématurément les factures en version 1.09

La Phase A ne met pas encore à jour :

- la syntaxe CII ;
- les namespaces ;
- les schémas XSD ;
- les règles Schematron ;
- les listes de codes ;
- le mapping fiscal ;
- les artefacts officiels de Factur-X 1.09.

Par conséquent, cette phase ne doit pas persister :

```text
facturx_version = 1.09

```

sur les factures générées par l’implémentation actuelle.

La colonne `facturx_version` doit continuer à contenir la version réellement implémentée par le générateur actuel.

Le passage réel à Factur-X 1.09 sera effectué en Phase B, en même temps que l’adaptation complète du générateur et de ses validateurs.

---

## 4.2 Configuration centralisée

Modifier :

```text
src/lib/facturx/facturx-config.server.ts

```

afin de distinguer clairement :

```ts
export const FACTURX_CONFIG = {
  implementedSpecificationVersion: "1.0.07",
  targetSpecificationVersion: "1.09",
  targetZugferdVersion: "2.5",

  profile: "EN16931",
  profileLabel: "EN 16931",
  profileUrn: "urn:cen.eu:en16931:2017",

  attachmentFileName: "factur-x.xml",
  attachmentMimeType: "application/xml",

  xmpDocumentType: "INVOICE",
  xmpVersion: "1.0",
  xmpConformanceLevel: "EN 16931",

  pdfaPart: "3",
  pdfaConformance: "B",

  generatorVersion: "normalweb-facturx-1",
  documentSchemaVersion: "facturx-legacy-1",

  validationArtifactsVersion: null,
} as const;

```

Les noms exacts peuvent être adaptés à la convention du projet, mais les concepts doivent rester distincts.

Ne pas coder ces valeurs en dur dans :

- la migration ;
- le générateur PDF ;
- la génération XML ;
- l’historique ;
- les tests ;
- le script de qualification.

---

## 4.3 Persistance

Lors de la génération d’une facture Factur-X, enregistrer :

```text
facturx_version = implementedSpecificationVersion
generator_version = generatorVersion
document_schema_version = documentSchemaVersion
validation_artifacts_version = null
generator_qualification_status = unqualified
external_validation_status = not_run

```

Ne pas utiliser :

```text
xmpVersion

```

pour remplir `facturx_version`.

Les factures classiques doivent utiliser :

```text
runtime_validation_status = not_applicable
external_validation_status = not_applicable
generator_qualification_status = unqualified

```

Les valeurs de version peuvent rester nulles pour les PDF classiques lorsque cela est cohérent avec le schéma existant.

---

# 5. Mise à jour du pipeline runtime

Modifier :

```text
src/lib/invoices-pdf.server.ts

```

et les autres fichiers concernés afin que les auto-contrôles alimentent uniquement :

```text
runtime_validation_status

```

## Au début de la génération Factur-X

Définir :

```text
runtime_validation_status = pending
generator_qualification_status = unqualified
external_validation_status = not_run

```

## En cas de réussite des auto-contrôles

Définir :

```text
runtime_validation_status = passed

```

Ne pas définir :

```text
generator_qualification_status = qualified
external_validation_status = valid

```

## En cas d’échec

Définir :

```text
runtime_validation_status = failed

```

et persister un résumé technique côté serveur dans le champ d’erreurs existant ou dans une structure compatible.

Conserver un message générique côté interface.

## Factures classiques

Ne pas exécuter les contrôles Factur-X.

Utiliser :

```text
runtime_validation_status = not_applicable
external_validation_status = not_applicable

```

---

# 6. Historique et interface administrateur

Modifier :

```text
src/lib/history.functions.ts
src/routes/admin/historique.tsx

```

## 6.1 Données retournées

Remonter les champs :

```text
invoice_format
facturx_profile
facturx_version
runtime_validation_status
generator_qualification_status
external_validation_status
facturx_validation_errors
generator_version
validation_artifacts_version

```

Ne plus utiliser `facturx_validation_status` pour déterminer le texte affiché.

Les détails techniques complets ne doivent pas être envoyés au client.

Le serveur doit produire un résumé lisible et sans stack trace.

---

## 6.2 Badges de format

Conserver :

```text
PDF classique

```

pour les anciennes factures.

Pour les nouvelles factures hybrides, afficher par exemple :

```text
Factur-X EN 16931

```

Ce badge décrit le format ciblé et le profil déclaré, mais ne doit pas être interprété comme une preuve de validation officielle.

Lorsque la version est affichée, utiliser la version effectivement implémentée et persistée.

Ne pas afficher `1.09` avant la Phase B.

---

## 6.3 Badge d’auto-contrôle

Afficher selon `runtime_validation_status` :

```text
not_applicable → Auto-contrôles non applicables
pending        → Auto-contrôles en attente
passed         → Auto-contrôles réussis
failed         → Auto-contrôles en échec

```

---

## 6.4 Badge de qualification du moteur

Afficher selon `generator_qualification_status` :

```text
unqualified          → Moteur non qualifié
qualified            → Moteur qualifié en CI
qualification_failed → Qualification du moteur en échec

```

En Phase A, toutes les factures Factur-X doivent afficher :

```text
Moteur non qualifié

```

---

## 6.5 Badge de validation externe

Afficher selon `external_validation_status` :

```text
not_applicable → Validation externe non applicable
not_run        → Validation externe non exécutée
valid          → Validation externe réussie
invalid        → Validation externe échouée

```

En Phase A, aucune nouvelle facture Factur-X ne doit afficher :

```text
Validation externe réussie

```

---

## 6.6 Libellés interdits

Supprimer totalement :

```text
Prête pour plateforme agréée

```

Ne pas le remplacer par :

```text
Conforme Factur-X
Factur-X validée
Prête à transmettre
Conforme EN 16931

```

tant qu’une validation complète et démontrée n’a pas été mise en place.

Exemple d’affichage attendu en Phase A :

```text
Factur-X EN 16931
Auto-contrôles réussis
Moteur non qualifié
Validation externe non exécutée

```

---

# 7. Script de qualification

Modifier :

```text
scripts/validate-facturx.ts

```

## 7.1 Outils obligatoires

L’absence d’un outil réellement requis par la Phase A doit provoquer un échec.

Le comportement suivant est interdit :

```ts
if (e.code === "ENOENT") {
  console.warn("outil indisponible, validation ignorée");
  return true;
}

```

Utiliser un comportement bloquant :

```ts
if (e.code === "ENOENT") {
  console.error(`${cmd} est obligatoire pour cette vérification.`);
  return false;
}

```

Le script doit retourner un code différent de zéro lorsque :

- VeraPDF est absent ;
- Java est absent alors qu’une étape Java est exécutée ;
- la facture de référence n’est pas produite ;
- l’XML embarqué ne peut pas être extrait ;
- l’XML externe et l’XML embarqué diffèrent ;
- VeraPDF retourne une non-conformité PDF/A-3B ;
- une étape obligatoire échoue.

---

## 7.2 Étapes réellement exécutées en Phase A

Le script doit exécuter et afficher :

```text
XML well-formedness
Internal business rules
PDF/A-3B VeraPDF
Embedded XML extraction
Embedded XML consistency

```

La comparaison de l’XML doit vérifier que :

```text
XML généré
=
XML externe écrit
=
XML embarqué dans le PDF

```

La comparaison doit être effectuée sur les octets ou sur leurs empreintes SHA-256.

---

## 7.3 Étapes non encore implémentées

Les validations suivantes sont hors périmètre de la Phase A :

```text
XSD Factur-X 1.09
Schematron EN 16931
Règles officielles Factur-X 1.09
Listes de codes officielles 1.09

```

Le script doit les afficher comme :

```text
NOT IMPLEMENTED

```

ou :

```text
SKIPPED — Phase B

```

Mais il ne doit pas conclure que le générateur est qualifié.

Le résultat global doit être :

```text
Generator qualification: UNQUALIFIED

```

tant que ces validations ne sont pas mises en place.

---

## 7.4 Message final

Le script ne doit plus afficher en Phase A :

```text
Qualification Factur-X réussie

```

Utiliser plutôt :

```text
Vérifications Phase A réussies.
Le générateur reste non qualifié tant que les validations officielles XSD et Schematron ne sont pas intégrées.

```

En cas d’échec :

```text
Vérifications Phase A en échec.

```

---

## 7.5 Résumé attendu

Exemple :

```text
XML well-formedness: PASS
Internal business rules: PASS
PDF/A-3B VeraPDF: PASS
Embedded XML extraction: PASS
Embedded XML consistency: PASS
XSD Factur-X 1.09: NOT IMPLEMENTED
Schematron EN 16931: NOT IMPLEMENTED
Generator qualification: UNQUALIFIED

```

Afficher également les versions des outils réellement exécutés :

```text
VeraPDF version: ...
Java version: ...

```

Ne pas inventer de version lorsque l’outil ne permet pas de la récupérer.

---

# 8. Workflow GitHub Actions

Créer :

```text
.github/workflows/facturx-validation.yml

```

## 8.1 Déclenchement

Déclencher le workflow sur les modifications de :

```text
src/lib/facturx/**
src/lib/documents.server.ts
src/lib/invoices.server.ts
src/lib/invoices-pdf.server.ts
src/lib/invoices.functions.ts
scripts/validate-facturx.ts
supabase/migrations/**
package.json
bun.lock
.github/workflows/facturx-validation.yml

```

Prévoir un déclenchement sur :

- pull request ;
- push sur la branche principale ;
- déclenchement manuel.

---

## 8.2 Étapes

Le workflow doit :

1. récupérer le dépôt ;
2. installer Bun avec une version figée ;
3. installer les dépendances avec le lockfile ;
4. exécuter le typecheck ;
5. exécuter les tests unitaires ;
6. exécuter le build ;
7. installer Java avec une version majeure figée ;
8. installer VeraPDF avec une version figée ;
9. vérifier l’empreinte SHA-256 du paquet VeraPDF téléchargé ;
10. exécuter `validate:facturx` ;
11. conserver les fichiers générés et les rapports comme artifacts ;
12. échouer lorsque l’une des étapes obligatoires échoue.

Ne pas utiliser silencieusement une version `latest`.

---

## 8.3 Validation Factur-X officielle

La CI de Phase A ne doit pas prétendre effectuer :

- validation XSD Factur-X 1.09 ;
- validation Schematron EN 16931 complète ;
- qualification officielle du générateur.

Ces contrôles seront ajoutés en Phase B.

Le nom et les messages du workflow doivent refléter cette limite, par exemple :

```text
Factur-X Phase A structural checks

```

et non :

```text
Factur-X compliance certification

```

---

# 9. Scripts package.json

Ajouter ou corriger :

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "validate:facturx": "bun run scripts/validate-facturx.ts",
    "verify": "bun run typecheck && bun run lint && bun run test:unit && bun run build"
  }
}

```

Remplacer les clés fautives :

```text
test;unit:watch
test:e2e;ui

```

par :

```text
test:unit:watch
test:e2e:ui

```

Ne pas supprimer les scripts existants utiles.

---

# 10. Tests

Ajouter ou adapter des tests couvrant la Phase A.

## Statuts

Tester :

- facture classique → statuts `not_applicable` appropriés ;
- facture Factur-X avant génération → `pending` ;
- auto-contrôles réussis → `passed` ;
- auto-contrôles échoués → `failed` ;
- qualification du moteur → toujours `unqualified` en Phase A ;
- validation externe → `not_run` pour Factur-X ;
- aucune facture Factur-X de Phase A ne reçoit `qualified` ou `valid`.

## Versions

Tester :

- `facturx_version` utilise la version réellement implémentée ;
- `facturx_version` n’utilise pas `xmpVersion` ;
- aucune facture ne reçoit `1.09` avant la Phase B ;
- `generator_version` est persistée ;
- `document_schema_version` est persistée ;
- `validation_artifacts_version` reste null ou explicitement non défini.

## Script de qualification

Tester, dans la mesure du possible :

- VeraPDF absent → échec ;
- Java absent lorsqu’il est requis → échec ;
- facture de référence absente → échec ;
- XML embarqué absent → échec ;
- XML embarqué différent → échec ;
- VeraPDF en échec → échec ;
- toutes les étapes Phase A réussies → code de sortie 0, mais générateur toujours `UNQUALIFIED`.

## Historique

Tester qu’aucun rendu ne contient :

```text
Prête pour plateforme agréée

```

Tester les nouveaux libellés.

---

# 11. Sécurité et confidentialité

Conserver les protections existantes :

- authentification Supabase ;
- contrôle administrateur ;
- bucket privé ;
- URLs signées ;
- absence de chemins Storage exposés ;
- absence de stack trace côté client.

Les erreurs détaillées de validation restent côté serveur.

L’historique ne renvoie qu’un résumé lisible.

Les nouvelles migrations et fonctions SQL doivent conserver :

```sql
SECURITY DEFINER
SET search_path TO public

```

lorsque cela est applicable.

Les droits doivent rester limités :

```sql
REVOKE ALL FROM PUBLIC, anon;
GRANT EXECUTE TO authenticated, service_role;

```

avec contrôle du rôle administrateur dans la fonction.

---

# 12. Compatibilité et non-régression

Ne pas modifier le comportement des :

- devis ;
- anciennes factures PDF ;
- pièces jointes ;
- e-mails ;
- renvois d’e-mails ;
- URLs signées ;
- numérotation ;
- idempotence ;
- conversion devis vers facture ;
- statuts d’envoi ;
- historique hors libellés de validation.

Les anciennes factures restent :

```text
invoice_format = classic_pdf

```

Elles ne doivent pas être converties automatiquement.

Les factures existantes ne doivent pas être régénérées par cette phase.

Le rendu graphique ne doit pas changer.

---

# 13. Hors périmètre

Ne pas implémenter dans cette phase :

- passage réel du générateur à Factur-X 1.09 ;
- artefacts XSD 1.09 ;
- Schematron 1.09 ;
- listes de codes officielles 1.09 ;
- validation officielle complète ;
- mapping TVA explicite ;
- franchise en base ;
- autoliquidation ;
- export ;
- livraison intracommunautaire ;
- identité fiscale structurée du vendeur ;
- validation du SIREN/SIRET réel ;
- blocage des données artisan fictives ;
- modèle structuré comme source unique du PDF ;
- unification des arrondis ;
- finalisation atomique ;
- immutabilité ;
- hash XML ;
- corpus complet de fixtures ;
- refonte UX réglementaire ;
- connexion à une plateforme agréée ;
- transmission réglementaire ;
- Chorus Pro.

Ces éléments seront traités dans les phases B, C et D.

---

# 14. Critères d’acceptation

La Phase A est terminée uniquement si :

- « Prête pour plateforme agréée » a disparu ;
- aucun nouveau libellé ne présente les fichiers comme officiellement conformes ;
- les trois familles de statuts sont séparées ;
- `not_applicable` est géré pour les PDF classiques ;
- les anciennes données sont migrées sans faux statut ;
- `facturx_validation_status` n’est plus utilisé dans l’interface ;
- `facturx_validation_status` n’est plus présenté comme preuve de conformité ;
- la version XMP n’est plus persistée comme version de spécification ;
- les factures ne sont pas étiquetées `1.09` avant la Phase B ;
- la version réellement implémentée est persistée ;
- `generator_version` est persistée ;
- `document_schema_version` est persistée ;
- `validation_artifacts_version` reste cohérente avec l’absence d’artefacts officiels ;
- toutes les factures Factur-X restent `unqualified` ;
- toutes les factures Factur-X restent `external_validation_status = not_run` ;
- l’absence de VeraPDF fait échouer le script ;
- l’absence d’un outil requis fait échouer le script ;
- un échec VeraPDF fait échouer le script ;
- une incohérence entre XML externe et XML embarqué fait échouer le script ;
- le script n’affiche jamais « Qualification Factur-X réussie » ;
- le workflow GitHub Actions existe ;
- la CI exécute le typecheck, les tests, le build et VeraPDF ;
- le workflow conserve les rapports ;
- les anciennes factures restent fonctionnelles ;
- les devis restent fonctionnels ;
- les e-mails et les renvois restent fonctionnels ;
- le rendu PDF reste inchangé.

---