# Clôture de la Phase A Factur-X

Audit préalable : les statuts séparés, la migration additive, la configuration centralisée (1.0.07 implémenté / 1.09 cible), les libellés honnêtes, la CI VeraPDF avec empreinte SHA-256 et la comparaison XML embarqué/généré sont déjà en place. Trois écarts subsistent, traités ci-dessous. Aucune migration nouvelle, aucun travail de Phase B.

## Lot 1 — Cycle du statut runtime

Dans `src/lib/invoices-pdf.server.ts` :

- Appeler la fonction existante de persistance de statut **au début** de toute génération/régénération Factur-X pour poser `pending` / `unqualified` / `not_run` et remettre `facturx_validation_errors` à `null`. L'écriture passe par `assertSupabaseWriteSucceeded` et échoue explicitement.
- Ne toucher aucune colonne d'envoi : ni `status`, ni `sent_at`, ni les statuts e-mail client/artisan.
- Encadrer tout le pipeline Factur-X (montants, règles métier, XML, PDF/A-3, upload XML, métadonnées finales) pour que **toute** erreur écrive `failed` avec un résumé technique côté serveur. Aujourd'hui l'upload XML échoué et l'échec de persistance finale ne posent pas `failed`.
- En cas de succès complet : `passed` / `unqualified` / `not_run` via les métadonnées existantes.
- Si l'enregistrement de l'échec échoue lui-même : journaliser les deux erreurs (originale + secondaire) et renvoyer un message générique, sans masquer la cause initiale.

Les factures classiques gardent exactement leur comportement actuel (`not_applicable`).

## Lot 2 — Tests comportementaux du script de qualification

Extraire de `scripts/validate-facturx.ts` un cœur testable, par exemple `scripts/lib/qualification-core.ts`, exposant une fonction qui reçoit des dépendances injectables :

- exécution d'un outil externe (VeraPDF, Java) ;
- lecture du rapport VeraPDF (réutilise `scripts/lib/verapdf-report.ts`) ;
- fourniture des octets XML générés et embarqués.

Elle retourne un résumé structuré : liste d'étapes avec statut, code de sortie, et les lignes fixes `XSD Factur-X 1.09: NOT IMPLEMENTED`, `Schematron EN 16931: NOT IMPLEMENTED`, `Generator qualification: UNQUALIFIED`. Le script reste un mince wrapper qui branche les vraies dépendances système et imprime le résumé — sans changement de comportement observable.

Nouveau fichier de tests (`scripts/lib/qualification-core.test.ts`) couvrant : VeraPDF absent → échec ; Java absent → échec ; rapport non conforme → échec ; rapport vide/illisible → échec ; XML embarqué absent → échec ; XML embarqué différent → échec ; scénario complet réussi → succès avec `UNQUALIFIED` et sans la mention « Qualification Factur-X réussie ».

Les assertions textuelles redondantes de `src/lib/facturx/__tests__/phase-a-status.test.ts` sur le script sont supprimées uniquement là où les nouveaux tests couvrent le même risque ; les blocs sur les versions et sur les écritures Supabase sont conservés.

## Lot 3 — Rapport final

Créer `docs/facturx-phase-a-report.md`, rédigé à partir de l'état réel du dépôt : fichiers créés/modifiés, migration et colonnes ajoutées, règles de backfill, statuts, libellés admin, version persistée 1.0.07, cible 1.09, version du générateur 1.0.0, schéma interne 1.0, absence d'artefacts XSD/Schematron, workflow CI, Bun 1.2.21, Java 21, verrouillage VeraPDF par empreinte SHA-256 via variable de dépôt, commandes exécutées et leurs résultats exacts, preuves des scénarios négatifs (tests), limites laissées à la Phase B.

La version exacte de VeraPDF n'est pas déductible du dépôt (URL d'installateur roulante) : le rapport indiquera `NON VÉRIFIÉ DANS L'ENVIRONNEMENT ACTUEL`. Idem pour toute commande qui ne peut pas s'exécuter ici (VeraPDF/Java potentiellement absents du sandbox) — le résultat réel sera reporté tel quel, sans invention.

Conclusion du rapport strictement limitée aux trois phrases imposées.

## Validation

Exécution de `bun run typecheck`, `bun run test:unit`, `bun run build`, `bun run validate:facturx`, avec restitution de la sortie exacte de chacune. Le workflow GitHub Actions existant est conservé et complété si nécessaire (pas de second workflow).