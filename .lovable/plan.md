# Phase A — Supprimer les affirmations de conformité non démontrées

Objectif : plus aucune facture ne peut être présentée comme conforme Factur-X tant qu'une validation officielle n'a pas réellement été exécutée. Aucun changement de rendu PDF, de règles métier, d'e-mails ni des anciennes factures dans cette phase.

## Ce qui change pour vous

- L'historique n'affichera plus « Prête pour plateforme agréée ». Il affichera un statut honnête : « Auto-contrôles réussis », « Auto-contrôles en échec », « Validation externe non exécutée », etc.
- Les factures enregistrent la version Factur-X réelle (1.09) au lieu de « 1.0 ».
- Un contrôle qualité automatique (CI) est ajouté : il échoue franchement si les outils de validation officiels sont absents, au lieu de laisser croire à un succès.

## 1. Libellés de l'historique

Dans `src/routes/admin/historique.tsx` (lignes ~360-380) : retirer le badge « Prête pour plateforme agréée ». Le badge de format reste (`Factur-X EN 16931`), complété par un badge d'état dérivé des nouveaux statuts :

```text
Auto-contrôles réussis        (runtime_validation_status = passed)
Auto-contrôles en échec       (failed)
Auto-contrôles en attente     (pending)
Validation externe réussie / échouée / non exécutée
```

`src/lib/history.functions.ts` remonte les nouveaux champs au lieu du seul `facturx_validation_status`. Les détails d'erreur restent résumés côté serveur (pas de fuite de contenu technique au client).

## 2. Statuts de validation séparés (migration additive)

Nouvelles colonnes sur `invoices`, toutes avec une valeur par défaut sûre pour les lignes existantes :

```text
runtime_validation_status        pending | passed | failed        (défaut pending)
generator_qualification_status   unqualified | qualified | qualification_failed
external_validation_status       not_run | valid | invalid        (défaut not_run)
generator_version                text
document_schema_version          text
validation_artifacts_version     text
```

`facturx_validation_status` est conservé tel quel pour ne rien casser, mais n'est plus la source d'affichage. Aucune donnée existante n'est modifiée ; les factures `invoice_format = classic_pdf` restent intactes.

## 3. Versions Factur-X correctement distinguées

`src/lib/facturx/facturx-config.server.ts` devient la source unique :

```ts
specificationVersion: "1.09"   // spécification Factur-X
zugferdVersion: "2.5"
profile: "EN16931"
xmpVersion: "1.0"              // valeur XMP officielle, distincte de la spec
generatorVersion: "normalweb-facturx-1"
documentSchemaVersion: "facturx-1"
```

Correction du bug de persistance dans `src/lib/invoices-pdf.server.ts` : `facturx_version` reçoit aujourd'hui `FACTURX_CONFIG.xmpVersion` (« 1.0 ») ; il recevra `specificationVersion` (« 1.09 »). `generator_version` et `document_schema_version` sont persistés en même temps. Plus aucune version codée en dur ailleurs.

Note : le passage réel aux artefacts XSD/Schematron 1.09 et au namespace officiel relève de la Phase B. Ici on corrige uniquement l'étiquetage et la persistance ; le statut runtime signifie « auto-contrôles internes », jamais « conforme ».

## 4. Script de qualification bloquant

`scripts/validate-facturx.ts` : un outil manquant (`ENOENT` sur `verapdf` ou `java`) devient un échec, plus un avertissement ignoré. Le script échoue aussi si le JAR du validateur, la facture de référence ou l'extraction du XML embarqué manquent. Il n'imprime « Qualification Factur-X réussie » que si toutes les étapes prévues ont réellement tourné, et affiche un résumé :

```text
XML well-formedness: PASS
XSD: SKIPPED (Phase B)
Schematron EN 16931: SKIPPED (Phase B)
Factur-X rules (internes): PASS
PDF/A-3B VeraPDF: PASS
Embedded XML consistency: PASS
```

avec les versions exactes des validateurs exécutés. Toute étape SKIPPED est comptée comme non exécutée et empêche le statut `qualified`.

## 5. Workflow CI dédié

`.github/workflows/facturx-validation.yml`, déclenché sur `src/lib/facturx/**`, `src/lib/documents.server.ts`, `src/lib/invoices*.ts`, `scripts/validate-facturx.ts`, `supabase/migrations/**`, `package.json`, `bun.lock`.

Étapes : install → typecheck → tests unitaires → génération de la facture de référence → installation d'une version **figée et vérifiée par SHA-256** de Java, VeraPDF et du validateur Factur-X → exécution VeraPDF en profil PDF/A-3B → extraction et comparaison du XML → échec au premier résultat invalide → rapports conservés en artifacts CI.

Scripts `package.json` corrigés et complétés :

```json
"typecheck": "tsc --noEmit",
"test:unit:watch": "vitest",
"test:e2e:ui": "playwright test --ui",
"validate:facturx": "bun run scripts/validate-facturx.ts",
"verify": "bun run typecheck && bun run lint && bun run test:unit && bun run build"
```

(les clés actuelles `test;unit:watch` et `test:e2e;ui` sont fautives et remplacées)

## Hors périmètre de cette phase

Artefacts officiels 1.09, vraie validation XSD/Schematron, mapping TVA explicite, identité fiscale vendeur structurée, modèle structuré comme source unique du PDF, finalisation atomique, immuabilité, corpus de 30 fixtures, UX réglementaire. Ces points restent planifiés pour les phases B, C et D.

## Points à confirmer plus tard

Les données fiscales réelles de l'artisan (SIREN, SIRET, TVA, IBAN/BIC) et le régime de TVA ne sont pas encore connus. En Phase B, le code bloquera l'émission d'une facture Factur-X réelle tant que la configuration contient des valeurs de démonstration, avec un mode test explicite réservé aux fixtures CI.