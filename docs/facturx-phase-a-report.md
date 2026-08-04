# Rapport final — Phase A Factur-X

Date : 2026-08-04. Périmètre : Phase A uniquement (honnêteté des statuts,
auto-contrôles internes, CI bloquante). Aucun élément de Phase B n'est
implémenté.

## 1. Fichiers

### Créés (clôture Phase A)

- `src/lib/facturx/runtime-status.server.ts` — cycle des statuts d'auto-contrôle.
- `src/lib/facturx/__tests__/runtime-status.test.ts` — tests du cycle runtime.
- `scripts/lib/qualification-core.ts` — cœur décisionnel testable du script.
- `scripts/lib/qualification-core.test.ts` — tests comportementaux du script.
- `docs/facturx-phase-a-report.md` — le présent rapport.

### Modifiés

- `src/lib/invoices-pdf.server.ts` — ouverture explicite du cycle runtime,
  `FacturxPipelineError`, marquage `failed` unifié en best effort.
- `scripts/validate-facturx.ts` — réduit aux accès système ; délègue les
  décisions au cœur testable.
- `src/lib/facturx/__tests__/phase-a-status.test.ts` — assertions textuelles sur
  le script supprimées (remplacées par des tests comportementaux).
- `.github/workflows/facturx-validation.yml` — déclencheurs élargis à `scripts/**`.

### Supprimés

Aucun fichier supprimé.

### Migrations

Aucune nouvelle migration dans cette intervention. La migration Phase A
existante est `supabase/migrations/20260803170508_fd679877-0347-42a5-bd11-d9e322c6ecdc.sql`.

## 2. Base de données (migration Phase A existante)

Colonnes ajoutées sur `public.invoices` :

| Colonne | Défaut |
| --- | --- |
| `runtime_validation_status` | `pending` |
| `generator_qualification_status` | `unqualified` |
| `external_validation_status` | `not_run` |
| `generator_version` | `null` |
| `document_schema_version` | `null` |
| `validation_artifacts_version` | `null` |

Contraintes de valeurs :

- `runtime_validation_status IN ('not_applicable','pending','passed','failed')`
- `generator_qualification_status IN ('unqualified','qualified','qualification_failed')`
- `external_validation_status IN ('not_applicable','not_run','valid','invalid')`

Backfill :

- PDF classiques → `not_applicable` / `unqualified` / `not_applicable`.
- Factures Factur-X existantes → statut runtime dérivé de l'ancienne colonne,
  générateur `unqualified`, validation externe `not_run`.

`facturx_validation_status` est marquée DEPRECATED par un `COMMENT` : elle ne
doit plus servir ni de preuve de conformité ni de source d'affichage.

Un trigger `BEFORE INSERT` initialise les statuts selon le format et force
toujours `generator_qualification_status = 'unqualified'`.

## 3. Cycle des statuts (corrigé dans cette intervention)

Le trigger d'insertion ne couvre pas une régénération. `ensureInvoicePdf`
ouvre donc explicitement le cycle pour toute facture Factur-X :

```text
début de génération/régénération : pending / unqualified / not_run, erreurs = null
succès complet                   : passed  / unqualified / not_run
échec du pipeline                : failed  / unqualified / not_run + détails
```

Les factures classiques conservent `not_applicable` / `unqualified` /
`not_applicable` et n'exécutent aucun contrôle Factur-X.

Contraintes respectées et vérifiées par test :

- aucune colonne d'envoi n'est jamais écrite par ce cycle (`status`, `sent_at`,
  `email_client_status`, `email_client_error`, `email_artisan_status`,
  `email_artisan_error`) ;
- l'écriture du `pending` initial vérifie l'erreur Supabase et échoue
  explicitement ;
- le marquage `failed` est best effort et ne masque jamais l'erreur d'origine ;
  en cas de double échec, l'erreur initiale et l'erreur de persistance sont
  journalisées ensemble, sans récursion, et l'utilisateur reçoit un message
  générique.

Cas d'échec couverts : incohérence de montants, règles métier internes, XML mal
formé, erreur de génération PDF, structure PDF/A-3 interne invalide, upload XML
échoué, métadonnées manquantes, persistance finale échouée.

## 4. Interface administrateur

Trois badges distincts (auto-contrôles, moteur, validation externe). Aucune des
mentions suivantes n'est présente dans le code : « Prête pour plateforme
agréée », « Conforme Factur-X », « Factur-X validée », « Prête à transmettre »,
« Conforme EN 16931 » en tant qu'affirmation de conformité.

## 5. Versions réellement persistées

| Élément | Valeur |
| --- | --- |
| Spécification implémentée et persistée | `1.0.07` |
| Cible Phase B | `1.09` |
| Cible ZUGFeRD Phase B | `2.5` |
| Version du générateur | `1.0.0` |
| Version du schéma interne | `1.0` |
| Version des artefacts de validation officiels | `null` |
| Version XMP (distincte d'une version de spécification) | `1.0` |

`validationArtifactsVersion = null` ⇒ `GENERATOR_QUALIFICATION = "unqualified"`.

## 6. Validation exécutée

Auto-contrôles internes : cohérence des montants, règles métier, syntaxe XML par
parseur, structure PDF/A-3 interne, extraction du XML embarqué, comparaison
XML généré / XML externe / XML embarqué, interprétation machine-readable du
rapport veraPDF.

Non intégrés : validation officielle XSD, Schematron EN 16931.

## 7. Intégration continue

- Workflow : `.github/workflows/facturx-validation.yml`
  (« Factur-X Phase A structural checks »).
- Déclencheurs : `pull_request` et `push` sur `main` limités aux chemins
  Factur-X, `scripts/**`, migrations, `package.json`, `bun.lock`, le workflow
  lui-même ; plus `workflow_dispatch`.
- Bun : `1.2.21` (`oven-sh/setup-bun`). Bun local utilisé pour ce rapport : `1.3.3`.
- Java : `21` (temurin).
- Verrouillage veraPDF : empreinte SHA-256 obligatoire de l'installeur, comparée
  à la variable de dépôt `VERAPDF_SHA256` ; le job échoue si la variable est
  absente ou si l'empreinte diffère.
- Rapports conservés en artifact : `facturx-report.txt` et
  `/tmp/facturx-qualification/**`.
- Version exacte de veraPDF : NON VÉRIFIÉ DANS L'ENVIRONNEMENT ACTUEL
  (l'URL de l'installeur est roulante ; aucune sortie réelle de l'outil n'est
  disponible ici).
- État du workflow sur ce dépôt : NON VÉRIFIÉ DANS L'ENVIRONNEMENT ACTUEL
  (pas d'accès aux exécutions GitHub Actions depuis cet environnement).

## 8. Résultats des commandes

```text
bun run typecheck        exit 0   (tsc --noEmit, aucune erreur)
bun run test:unit        exit 0   (8 fichiers, 71 tests, 0 échec)
bun run build            exit 0   (vite + nitro, build terminé)
bun run validate:facturx exit 1   (java et verapdf absents de l'environnement)
```

Sortie du script `validate:facturx` dans cet environnement :

```text
--- Résumé Phase A ---
Java availability: FAIL (java est obligatoire pour cette vérification et n'est pas installé.)
VeraPDF availability: FAIL (verapdf est obligatoire pour cette vérification et n'est pas installé.)
Reference invoice: PASS
Internal business rules: PASS
XML well-formedness: PASS
Internal PDF/A-3 self-checks: PASS
Embedded XML extraction: PASS
Embedded XML consistency: PASS
PDF/A-3B VeraPDF: FAIL (VeraPDF n'a produit aucun rapport. Code de sortie : inconnu.)
XSD Factur-X 1.09: NOT IMPLEMENTED
Schematron EN 16931: NOT IMPLEMENTED
Generator qualification: UNQUALIFIED
```

Un passage complet du script avec veraPDF et Java installés :
NON VÉRIFIÉ DANS L'ENVIRONNEMENT ACTUEL — il relève de la CI.

## 9. Preuves négatives (tests automatisés)

`scripts/lib/qualification-core.test.ts` démontre, sur les fonctions réelles :

- veraPDF absent → `success = false`, `exitCode = 1` ;
- Java absent → `success = false`, `exitCode = 1` ;
- facture de référence absente → échec ;
- rapport veraPDF vide → échec ;
- rapport veraPDF illisible → échec ;
- rapport veraPDF non conforme → échec ;
- veraPDF au code non nul malgré un rapport conforme → échec ;
- XML externe absent / différent → échec ;
- XML embarqué absent / différent → échec ;
- règles métier, syntaxe XML ou structure PDF/A-3 en erreur → échec ;
- scénario Phase A complet réussi → `success = true`, `exitCode = 0`, toutes les
  étapes en `PASS`, `Generator qualification: UNQUALIFIED`, XSD et Schematron en
  `NOT IMPLEMENTED`, et absence de la mention « Qualification Factur-X réussie ».

`src/lib/facturx/__tests__/runtime-status.test.ts` démontre le cycle
`pending → passed`, le cycle `pending → failed`, l'échec explicite de
l'écriture initiale, l'absence de boucle et la journalisation conjointe des deux
erreurs, ainsi que l'absence de toute colonne d'envoi dans les mises à jour.

Le script `validate:facturx` exécuté ici constitue une preuve directe
supplémentaire : sans veraPDF ni Java, il sort en code 1.

## 10. Limites laissées à la Phase B

Ne sont pas intégrés : Factur-X 1.09 réel, XSD officiel, Schematron EN 16931
officiel, règles et listes de codes officielles, qualification officielle du
générateur, validation externe par document, source unique PDF/XML, refonte du
modèle fiscal, RPC de finalisation atomique, immutabilité complète, corpus de
qualification étendu, connexion à une plateforme agréée, Chorus Pro.

## 11. Conclusion

Les affirmations de conformité non démontrées ont été supprimées.
Les auto-contrôles sont désormais distingués d'une qualification officielle.
Le générateur reste non qualifié jusqu'à l'intégration des validations officielles en Phase B.