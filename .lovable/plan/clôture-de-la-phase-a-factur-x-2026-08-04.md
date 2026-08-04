# Clôture de la Phase A Factur-X

## Objectif

Clôturer les derniers écarts de la Phase A sans commencer les travaux de conformité Factur-X 1.09 prévus en Phase B.

L’intervention reste limitée à trois lots :

1. corriger le cycle du statut runtime lors d’une génération ou régénération Factur-X ;
2. ajouter des tests comportementaux au script de qualification ;
3. produire le rapport final de Phase A.

Aucune nouvelle migration n’est prévue.

Ne pas modifier :

- le rendu visuel des PDF ;
- le contenu XML CII ;
- les devis ;
- les anciennes factures PDF classiques ;
- les e-mails et renvois d’e-mails ;
- la numérotation ;
- l’idempotence ;
- la conversion devis vers facture ;
- la transmission à une plateforme agréée.

Ne pas commencer la Phase B.

---

# Audit préalable

Les éléments suivants sont déjà présents et doivent être conservés :

- statuts séparés :
  - `runtime_validation_status`
  - `generator_qualification_status`
  - `external_validation_status`
- migration additive et contraintes de valeurs ;
- configuration centralisée distinguant :
  - version réellement implémentée `1.0.07`
  - cible Phase B `1.09`
  - version XMP
  - version du générateur
  - version du schéma interne
- générateur maintenu `unqualified` ;
- validation externe laissée à `not_run` pour les factures Factur-X ;
- libellés administrateur non trompeurs ;
- workflow GitHub Actions dédié ;
- VeraPDF obligatoire dans la CI ;
- contrôle SHA-256 obligatoire de l’installeur VeraPDF ;
- interprétation machine-readable du rapport VeraPDF ;
- comparaison SHA-256 entre XML généré et XML embarqué ;
- vrai contrôle de syntaxe XML ;
- vérification explicite de plusieurs écritures Supabase ;
- tests comportementaux des métadonnées persistées ;
- tests comportementaux des libellés d’historique.

Ne pas réimplémenter ces éléments.

---

# Lot 1 — Corriger le cycle du statut runtime

## Fichiers concernés

Analyser et modifier principalement :

```text
src/lib/invoices-pdf.server.ts
src/lib/facturx/facturx-persistence.server.ts
src/lib/supabase-write.server.ts

```

Créer un nouveau helper uniquement si cela réduit réellement la duplication et reste limité à ce lot.

---

## 1.1 Statut initial lors d’une génération Factur-X

Au début de toute génération ou régénération d’une facture Factur-X, persister explicitement :

```text
runtime_validation_status = pending
generator_qualification_status = unqualified
external_validation_status = not_run
facturx_validation_errors = null

```

Ne pas dépendre uniquement du trigger SQL d’insertion, car celui-ci ne couvre pas la régénération d’une facture existante.

Cette écriture doit :

- vérifier l’erreur Supabase ;
- échouer explicitement si elle ne peut pas être enregistrée ;
- ne modifier aucune colonne d’envoi ;
- ne modifier ni `status`, ni `sent_at` ;
- ne modifier aucun statut e-mail client ou artisan ;
- ne modifier aucun chemin Storage existant à cette étape.

Les factures classiques conservent leur comportement actuel avec :

```text
runtime_validation_status = not_applicable
generator_qualification_status = unqualified
external_validation_status = not_applicable

```

---

## 1.2 Statut final en cas de réussite

Le statut ne doit passer à `passed` qu’après la réussite de toutes les étapes nécessaires au pipeline Factur-X concerné :

- contrôle de cohérence des montants ;
- règles métier internes ;
- construction de l’XML ;
- contrôle de syntaxe XML ;
- génération du PDF ;
- conversion PDF/A-3 ;
- auto-contrôles PDF/A-3 internes ;
- upload du PDF ;
- upload du XML ;
- construction des métadonnées ;
- persistance finale réussie.

En cas de succès complet, persister :

```text
runtime_validation_status = passed
generator_qualification_status = unqualified
external_validation_status = not_run
facturx_validation_errors = null

```

Ne jamais persister :

```text
generator_qualification_status = qualified
external_validation_status = valid
facturx_validation_status = valid

```

---

## 1.3 Statut en cas d’échec

Toute erreur appartenant au pipeline Factur-X doit tenter de persister :

```text
runtime_validation_status = failed
generator_qualification_status = unqualified
external_validation_status = not_run

```

et enregistrer un résumé technique côté serveur.

Couvrir notamment :

- incohérence de montants ;
- règles métier internes échouées ;
- XML mal formé ;
- erreur de génération PDF ;
- structure PDF/A-3 interne échouée ;
- upload PDF échoué ;
- upload XML échoué ;
- métadonnées manquantes ;
- persistance finale échouée.

Les erreurs techniques complètes restent dans les logs serveur ou le champ technique existant.

Le message retourné au client doit rester générique.

---

## 1.4 Gestion des doubles erreurs Supabase

Lorsqu’une erreur initiale se produit, puis que l’écriture du statut `failed` échoue également :

- ne pas créer de boucle ou de récursion ;
- ne pas rappeler indéfiniment la même fonction de persistance ;
- conserver l’erreur initiale comme cause principale ;
- journaliser ensemble :
  - l’erreur initiale ;
  - l’erreur secondaire de persistance ;
  - l’identifiant de la facture ;
  - l’opération concernée ;
- renvoyer un message utilisateur générique.

La tentative de persister `failed` après une erreur Supabase doit être effectuée uniquement en best effort.

L’échec secondaire ne doit jamais remplacer ni masquer l’erreur initiale.

---

## 1.5 Organisation du bloc `try/catch`

Encadrer le pipeline Factur-X avec une structure lisible permettant de couvrir également les erreurs actuellement situées après le bloc principal, notamment :

- upload XML ;
- construction des métadonnées ;
- mise à jour finale Supabase.

Éviter un `try/catch` global qui modifierait le comportement des PDF classiques.

La branche classique doit rester isolée autant que possible.

---

## 1.6 Tests du cycle runtime

Ajouter des tests comportementaux couvrant au minimum :

1. facture Factur-X au début de la génération :
  - `pending`
  - `unqualified`
  - `not_run`
  - erreurs remises à `null`
2. génération réussie :
  - passage à `passed`
3. échec des règles internes :
  - passage à `failed`
4. échec de l’upload XML :
  - passage à `failed`
5. échec de la persistance finale :
  - tentative best effort de passage à `failed`
  - erreur initiale conservée
6. échec de persistance du statut d’échec :
  - les deux erreurs sont journalisées
  - aucune boucle
  - message client générique
7. facture classique :
  - aucune exécution des contrôles Factur-X
  - statuts `not_applicable` conservés

Les tests doivent vérifier que les colonnes d’envoi ne sont jamais présentes dans les objets de mise à jour utilisés par ce pipeline.

---

# Lot 2 — Tests comportementaux du script de qualification

## Fichiers concernés

Analyser notamment :

```text
scripts/validate-facturx.ts
scripts/lib/verapdf-report.ts
src/lib/facturx/__tests__/phase-a-status.test.ts

```

Créer si nécessaire :

```text
scripts/lib/qualification-core.ts
scripts/lib/qualification-core.test.ts

```

Le nom exact peut être adapté aux conventions du dépôt.

---

## 2.1 Principe de refactorisation

Extraire uniquement le cœur décisionnel nécessaire pour rendre le script testable.

Le script `validate-facturx.ts` doit rester responsable des opérations système réelles :

- détection de Java ;
- détection de VeraPDF ;
- lancement de VeraPDF ;
- génération du PDF de référence ;
- écriture des fichiers ;
- extraction de l’XML embarqué ;
- récupération des sorties des outils ;
- affichage console ;
- choix final du code de sortie du processus.

Le cœur testable doit recevoir des résultats structurés et ne pas exécuter directement les outils système.

Ne pas transformer le script en architecture abstraite excessive.

---

## 2.2 Entrées structurées recommandées

Le cœur peut recevoir une structure équivalente à :

```ts
interface ToolExecutionResult {
  available: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  errorMessage?: string;
}

interface QualificationInputs {
  java: ToolExecutionResult;
  verapdf: ToolExecutionResult;

  referencePdfExists: boolean;

  veraPdfReportXml?: string;

  generatedXml: Uint8Array;
  externalXml?: Uint8Array;
  embeddedXml?: Uint8Array;
}

```

Les noms exacts peuvent être adaptés.

Le cœur doit pouvoir distinguer :

- outil absent ;
- outil disponible mais en échec ;
- rapport absent ;
- rapport illisible ;
- rapport non conforme ;
- PDF de référence absent ;
- XML externe absent ;
- XML embarqué absent ;
- différence entre XML généré, externe et embarqué.

---

## 2.3 Résultat structuré recommandé

Le cœur doit retourner un résultat équivalent à :

```ts
interface QualificationStep {
  name: string;
  status: "PASS" | "FAIL" | "NOT IMPLEMENTED";
  detail?: string;
}

interface QualificationResult {
  success: boolean;
  exitCode: 0 | 1;
  steps: QualificationStep[];
  generatorQualification: "UNQUALIFIED";
}

```

Le résumé final doit toujours inclure :

```text
XSD Factur-X 1.09: NOT IMPLEMENTED
Schematron EN 16931: NOT IMPLEMENTED
Generator qualification: UNQUALIFIED

```

Même lorsque toutes les étapes Phase A réussissent.

---

## 2.4 Étapes Phase A réellement évaluées

Le cœur doit produire des résultats pour :

```text
Java availability
VeraPDF availability
Reference invoice
XML well-formedness
Internal business rules
Internal PDF/A-3 self-checks
Embedded XML extraction
Embedded XML consistency
PDF/A-3B VeraPDF

```

Les noms peuvent conserver ceux déjà utilisés par le script afin d’éviter une modification inutile des rapports CI.

---

## 2.5 Comparaison XML

La comparaison doit vérifier :

```text
XML généré
=
XML externe écrit
=
XML embarqué dans le PDF

```

La comparaison doit porter sur les octets ou leurs empreintes SHA-256.

Les tests doivent couvrir séparément :

- XML externe absent ;
- XML embarqué absent ;
- XML externe différent ;
- XML embarqué différent ;
- correspondance complète.

---

## 2.6 Scénarios de tests obligatoires

Ajouter des tests comportementaux démontrant réellement que :

1. VeraPDF absent entraîne :
  - `success = false`
  - `exitCode = 1`
2. Java absent entraîne :
  - `success = false`
  - `exitCode = 1`
3. la facture de référence absente entraîne un échec ;
4. un rapport VeraPDF vide entraîne un échec ;
5. un rapport VeraPDF illisible entraîne un échec ;
6. un rapport VeraPDF valide syntaxiquement mais non conforme entraîne un échec ;
7. VeraPDF retournant un code non nul entraîne un échec, même si un rapport est présent ;
8. l’XML externe absent entraîne un échec ;
9. l’XML embarqué absent entraîne un échec ;
10. l’XML externe différent de l’XML généré entraîne un échec ;
11. l’XML embarqué différent de l’XML généré entraîne un échec ;
12. le scénario complet réussi produit :
  - `success = true`
  - `exitCode = 0`
  - étapes Phase A en `PASS`
  - XSD en `NOT IMPLEMENTED`
  - Schematron en `NOT IMPLEMENTED`
  - générateur `UNQUALIFIED`
13. aucun résultat réussi ne contient :

```text
Qualification Factur-X réussie

```

14. le résumé réussi contient bien :

```text
Vérifications Phase A réussies
Generator qualification: UNQUALIFIED

```

---

## 2.7 Tests existants

Dans :

```text
src/lib/facturx/__tests__/phase-a-status.test.ts

```

supprimer uniquement les assertions textuelles sur `validate-facturx.ts` qui sont devenues redondantes grâce aux nouveaux tests comportementaux.

Conserver les tests encore utiles concernant :

- les versions ;
- la distinction version implémentée / cible ;
- l’absence d’artefacts officiels ;
- le générateur `unqualified` ;
- les écritures Supabase tant qu’elles ne sont pas remplacées par une meilleure couverture.

Ne pas supprimer un test avant qu’un nouveau test comportemental ne couvre effectivement le même risque.

---

# Lot 3 — Rapport final de Phase A

## Fichier à créer

Créer :

```text
docs/facturx-phase-a-report.md

```

Le rapport doit être fondé sur l’état réel du dépôt et sur les sorties réelles des commandes.

Ne rien inventer.

---

## 3.1 Contenu obligatoire

Le rapport doit contenir :

### Fichiers

- fichiers créés ;
- fichiers modifiés ;
- fichiers supprimés le cas échéant ;
- migration Phase A ajoutée ;
- absence de nouvelle migration dans ce lot.

### Base de données

- colonnes ajoutées :
  - `runtime_validation_status`
  - `generator_qualification_status`
  - `external_validation_status`
  - `generator_version`
  - `document_schema_version`
  - `validation_artifacts_version`
- contraintes de valeurs ;
- règles de backfill ;
- comportement des PDF classiques ;
- comportement des factures Factur-X existantes ;
- dépréciation de `facturx_validation_status`.

### Statuts

- signification des trois familles de statuts ;
- cycle `pending → passed` ;
- cycle `pending → failed` ;
- maintien du générateur à `unqualified` ;
- maintien de la validation externe à `not_run`.

### Interface

- libellés administrateur ;
- suppression des affirmations de conformité non démontrées ;
- absence de :
  - `Prête pour plateforme agréée`
  - `Conforme Factur-X`
  - `Factur-X validée`
  - `Prête à transmettre`
  - `Conforme EN 16931`

### Versions

- version réellement implémentée et persistée :
  - `1.0.07`
- cible Phase B :
  - `1.09`
- cible ZUGFeRD :
  - `2.5`
- version du générateur :
  - `1.0.0`
- version du schéma interne :
  - `1.0`
- version des artefacts :
  - `null`
- distinction avec la version XMP.

### Validation

- contrôles internes exécutés ;
- contrôle XML par parseur ;
- PDF/A-3B VeraPDF ;
- extraction XML ;
- comparaison XML généré, externe et embarqué ;
- parsing machine-readable du rapport VeraPDF ;
- absence actuelle de validation officielle XSD ;
- absence actuelle de validation officielle Schematron.

### CI

- nom du workflow ;
- déclencheurs ;
- version Bun :
  - `1.2.21`
- version Java configurée :
  - `21`
- méthode de verrouillage de VeraPDF :
  - empreinte SHA-256 obligatoire
- rapports conservés comme artifacts.

### Résultats

Inclure les résultats exacts de :

```bash
bun run typecheck
bun run test:unit
bun run build
bun run validate:facturx

```

Inclure également les résultats des nouveaux tests négatifs.

Ne pas écrire `PASS` si une commande n’a pas été exécutée.

Lorsque l’environnement ne permet pas l’exécution, écrire exactement :

```text
NON VÉRIFIÉ DANS L’ENVIRONNEMENT ACTUEL

```

### Preuves négatives

Inclure des preuves que :

- VeraPDF absent provoque un échec ;
- Java absent provoque un échec ;
- rapport VeraPDF non conforme provoque un échec ;
- rapport VeraPDF illisible provoque un échec ;
- XML embarqué absent provoque un échec ;
- XML embarqué différent provoque un échec ;
- le succès Phase A laisse le générateur `UNQUALIFIED`.

### Limites Phase B

Indiquer clairement que ne sont pas encore intégrés :

- Factur-X 1.09 réel ;
- XSD officiel ;
- Schematron EN 16931 officiel ;
- règles officielles Factur-X 1.09 ;
- listes de codes officielles ;
- qualification officielle du générateur ;
- validation externe individuelle.

---

## 3.2 Version exacte de VeraPDF

La version exacte doit être extraite d’une sortie réelle de l’outil ou d’un rapport CI.

Si elle ne peut pas être déduite avec certitude, écrire :

```text
NON VÉRIFIÉ DANS L’ENVIRONNEMENT ACTUEL

```

Ne pas déduire une version à partir de l’URL roulante.

---

## 3.3 Conclusion obligatoire

La conclusion doit être strictement limitée à :

```text
Les affirmations de conformité non démontrées ont été supprimées.
Les auto-contrôles sont désormais distingués d’une qualification officielle.
Le générateur reste non qualifié jusqu’à l’intégration des validations officielles en Phase B.

```

Ne pas ajouter une phrase déclarant que le pipeline est conforme Factur-X.

---

# Validation finale

Avant de déclarer le lot terminé, exécuter :

```bash
bun run typecheck
bun run test:unit
bun run build
bun run validate:facturx

```

Exécuter également les nouveaux tests comportementaux négatifs.

Restituer la sortie exacte ou un résumé fidèle contenant :

- commande ;
- code de sortie ;
- nombre de tests ;
- nombre d’échecs ;
- raison de tout échec.

Ne pas déclarer le lot terminé si :

- `typecheck` échoue ;
- un test unitaire échoue ;
- le build échoue ;
- le script Phase A échoue dans un environnement où les outils requis sont installés ;
- le workflow GitHub Actions devient rouge.

---

# Workflow GitHub Actions

Conserver le workflow existant :

```text
.github/workflows/facturx-validation.yml

```

Le compléter uniquement si nécessaire pour exécuter les nouveaux tests ou conserver un rapport utile.

Ne pas créer de second workflow concurrent.

Vérifier que la CI continue de :

- installer Bun avec une version figée ;
- installer avec le lockfile ;
- lancer le typecheck ;
- lancer les tests unitaires ;
- lancer le build ;
- installer Java 21 ;
- vérifier l’empreinte VeraPDF ;
- exécuter le script Phase A ;
- conserver les rapports ;
- échouer lorsqu’une étape obligatoire échoue.

---

# Interdictions strictes

Ne pas implémenter dans ce lot :

- passage réel à Factur-X 1.09 ;
- intégration XSD officielle ;
- intégration Schematron ;
- listes de codes officielles ;
- nouveau mapping TVA ;
- identité fiscale vendeur structurée ;
- source unique PDF/XML ;
- unification générale des arrondis ;
- remises et acomptes ;
- adresses structurées ;
- RPC de finalisation atomique ;
- immutabilité complète ;
- hash XML persisté ;
- refonte UX réglementaire ;
- corpus de qualification complet ;
- connexion à une plateforme agréée ;
- Chorus Pro.

Ne pas modifier arbitrairement :

- rendu PDF ;
- contenu XML ;
- devis ;
- e-mails ;
- renvois ;
- numérotation ;
- idempotence ;
- conversion devis vers facture ;
- anciennes factures.

---

# Livrable attendu

À la fin de l’intervention, fournir :

1. résumé de l’audit initial ;
2. liste exacte des fichiers créés ;
3. liste exacte des fichiers modifiés ;
4. liste exacte des fichiers supprimés ;
5. confirmation qu’aucune migration nouvelle n’a été ajoutée ;
6. description du cycle runtime corrigé ;
7. description de la gestion des doubles erreurs ;
8. liste des tests ajoutés ;
9. résultats exacts des commandes ;
10. état du workflow GitHub Actions ;
11. lien ou chemin du rapport final ;
12. limites restant à traiter en Phase B ;
13. diff limité aux trois lots demandés.

Ne pas déclarer :

- Factur-X 1.09 implémenté ;
- générateur qualifié ;
- validation officielle complète ;
- factures conformes ;
- factures prêtes pour une plateforme agréée.