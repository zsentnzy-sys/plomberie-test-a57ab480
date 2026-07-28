# Objectif

Rendre la confirmation, la suppression et la purge des photos jointes atomiques, idempotentes et sans orphelins, sans modifier le design ni les anciens fichiers déjà rattachés.

État vérifié dans `src/lib/attachments.server.ts` :

- `confirmSessionFiles` supprime le temporaire avant la réussite de la mise à jour SQL ;
- les erreurs d’insertion dans `request_attachments` sont ignorées ;
- il n’existe pas de statut `confirming` ;
- la purge ignore définitivement les fichiers `delete_failed` ;
- la limite de deux photos par session est vérifiée hors transaction avec `countSessionFiles`, puis l’upload est effectué séparément ;
- `/api/public/cleanup-uploads` utilise `SUPABASE_PUBLISHABLE_KEY` comme secret alors que cette clé est publique ;
- après le passage au chemin définitif, aucun mécanisme ne conserve le chemin temporaire si sa suppression échoue.

# 1. Migration additive

## Table `uploaded_files`

Ajouter les statuts nécessaires à la contrainte existante :

- `reserved` ;
- `uploading` ;
- `temporary` ;
- `confirming` ;
- `confirmed` ;
- `deleting` ;
- `deleted` ;
- `delete_failed` ;
- `upload_failed`.

Ajouter les colonnes :

```text
temporary_storage_path text
delete_attempts integer not null default 0
last_delete_error text
next_delete_retry_at timestamptz
reservation_expires_at timestamptz

```

`temporary_storage_path` conserve le chemin temporaire jusqu’à sa suppression effective. Il ne doit être mis à `null` qu’après confirmation de la suppression dans Storage.

Ajouter les index utiles :

```text
(upload_session_id, status)
(status, created_at)
(status, next_delete_retry_at)
(entity_type, entity_id)

```

Ajouter un index partiel pour les suppressions à reprendre :

```text
status = 'delete_failed'
OR temporary_storage_path IS NOT NULL

```

## Table `request_attachments`

Ajouter une contrainte ou un index unique sur `storage_path` afin de permettre une création idempotente.

Si des doublons existent déjà, les dédupliquer dans la migration avant de créer la contrainte, sans supprimer les fichiers Storage correspondants ni modifier les pièces jointes valides.

## RPC de réservation d’upload

Créer une RPC transactionnelle, par exemple :

```text
reserve_upload_files(
  _upload_session_id uuid,
  _file_count integer,
  _max_files integer
)

```

Cette RPC doit :

1. prendre un advisory lock transactionnel basé sur `upload_session_id` ;
2. compter toutes les lignes occupant un emplacement :

```text
reserved
uploading
temporary
confirming
confirmed
deleting

```

3. refuser si la nouvelle réservation dépasse deux fichiers ;
4. créer immédiatement une ligne `uploaded_files` par fichier avec :
  - un `id` généré côté serveur ;
  - un chemin Storage généré ;
  - le statut `reserved` ou `uploading` ;
  - une expiration de réservation ;
5. retourner les IDs et chemins réservés.

La RPC ne doit pas simplement retourner une autorisation booléenne : la réservation doit être persistée dans la même transaction afin que le verrou reste utile après la fin de la RPC.

Exécution autorisée uniquement avec le rôle serveur approprié.

## RPC de finalisation

Créer une RPC transactionnelle, par exemple :

```text
finalize_uploaded_file(...)

```

Elle doit réaliser atomiquement :

1. la vérification que le fichier est encore en statut `confirming` ;
2. le passage de `uploaded_files` à `confirmed` ;
3. la mise à jour de :
  - `storage_path` ;
  - `temporary_storage_path` ;
  - `entity_type` ;
  - `entity_id` ;
  - `confirmed_at` ;
4. l’insertion ou l’upsert de `request_attachments`.

Si l’écriture dans `request_attachments` échoue, aucune des modifications SQL ne doit être validée.

Aucune donnée existante ne doit être modifiée en dehors du dédoublonnage strictement nécessaire à la création de la contrainte unique.

# 2. Upload temporaire et limite concurrente

Dans `POST /api/attachments/upload` :

1. valider la session et les fichiers ;
2. appeler `reserve_upload_files` avant toute écriture Storage ;
3. utiliser exclusivement les IDs et chemins retournés par la RPC ;
4. faire passer chaque réservation de `reserved` à `uploading` si nécessaire ;
5. écrire chaque objet dans Storage ;
6. après réussite, passer la ligne à `temporary` ;
7. en cas d’échec Storage :
  - marquer la ligne `upload_failed` ou `deleted` ;
  - enregistrer l’erreur côté serveur ;
  - supprimer tout objet partiellement créé ;
  - libérer effectivement l’emplacement pour la limite de deux fichiers.

Une réservation expirée ou un upload interrompu doit être récupérable automatiquement par la purge.

Deux requêtes simultanées sur la même session ne doivent jamais pouvoir réserver plus de deux fichiers au total.

# 3. Confirmation atomique dans `confirmSessionFiles`

Pour chaque fichier, appliquer cet ordre strict.

## Étape 1 : réclamation atomique

Faire une transition conditionnelle :

```text
temporary → confirming

```

avec `UPDATE ... WHERE status = 'temporary' RETURNING ...`.

Si aucune ligne n’est retournée, le fichier est déjà traité ou en cours de traitement : passer au suivant.

Un fichier en `confirming` ne doit jamais être supprimé par l’abandon ou la purge.

## Étape 2 : mémorisation du temporaire

Conserver :

```text
temporaryPath = storage_path

```

et enregistrer ce chemin dans :

```text
temporary_storage_path

```

avant de remplacer `storage_path` par le chemin définitif.

## Étape 3 : copie Storage

Copier le fichier vers le chemin définitif :

```text
quote-requests/<requestId>/<fileId>.<ext>

```

ou :

```text
appointments/<requestId>/<fileId>.<ext>

```

## Étape 4 : vérification de la copie

Vérifier réellement que l’objet définitif existe et est accessible dans le bucket privé.

Une simple génération d’URL signée ne doit être utilisée comme vérification que si elle garantit effectivement l’existence de l’objet dans Supabase Storage. Sinon, utiliser une méthode de vérification plus fiable.

## Étape 5 : finalisation SQL transactionnelle

Appeler la RPC `finalize_uploaded_file`.

Cette RPC doit atomiquement :

- vérifier `status = 'confirming'` ;
- passer la ligne à `confirmed` ;
- définir le chemin définitif ;
- conserver `temporary_storage_path` ;
- définir `entity_type`, `entity_id` et `confirmed_at` ;
- créer ou mettre à jour `request_attachments`.

Le fichier ne doit jamais apparaître comme `confirmed` si la relation `request_attachments` n’a pas été créée.

## Étape 6 : suppression du temporaire

Supprimer l’ancien objet temporaire uniquement après la réussite complète de la transaction SQL.

En cas de réussite :

```text
temporary_storage_path = null
delete_attempts = 0
last_delete_error = null
next_delete_retry_at = null

```

En cas d’échec :

- ne pas annuler la confirmation ;
- conserver `temporary_storage_path` ;
- enregistrer l’erreur ;
- programmer une nouvelle tentative de suppression ;
- laisser la purge reprendre ce résidu.

Le commentaire « le résidu sera purgé plus tard » n’est valide que si son chemin est encore enregistré en base.

## Gestion des échecs avant finalisation

En cas d’échec avant la réussite de `finalize_uploaded_file` :

1. logger l’erreur ;
2. supprimer l’objet définitif éventuellement créé ;
3. remettre conditionnellement :

```text
confirming → temporary

```

4. restaurer le chemin temporaire si nécessaire ;
5. ne jamais faire échouer la soumission du formulaire déjà enregistrée.

La fonction doit rester idempotente : un nouvel appel doit pouvoir reprendre proprement le traitement.

# 4. Suppression individuelle et abandon

`deleteTemporaryFile` et `abandonUploadSession` ne doivent traiter que les fichiers réellement supprimables.

Réclamer atomiquement chaque fichier avec :

```text
temporary → deleting

```

Les statuts suivants ne doivent jamais être supprimés par ces fonctions :

```text
reserved
uploading
confirming
confirmed

```

Comportement attendu :

- ligne absente : succès idempotent ;
- statut `deleted` : succès idempotent ;
- statut `temporary` : réclamation puis suppression ;
- statut `deleting` : traitement déjà en cours, réponse idempotente ou conflit contrôlé ;
- statut `confirming` ou `confirmed` : conflit HTTP propre, sans suppression ;
- l’interface ne retire l’aperçu qu’après confirmation du serveur.

En cas d’échec de suppression :

```text
status = 'delete_failed'
delete_attempts = delete_attempts + 1
last_delete_error = erreur
next_delete_retry_at = date calculée

```

# 5. Purge avec réessais

`purgeExpiredTemporaryFiles` doit traiter plusieurs catégories.

## Uploads temporaires abandonnés

Sélectionner :

```text
status = 'temporary'
AND created_at < seuil de rétention

```

## Réservations et uploads interrompus

Sélectionner les lignes :

```text
status IN ('reserved', 'uploading', 'upload_failed')
AND reservation_expires_at < now()

```

Elles doivent être nettoyées et libérer leur emplacement dans la session.

## Suppressions échouées

Sélectionner :

```text
status = 'delete_failed'
AND next_delete_retry_at <= now()
AND delete_attempts < 5

```

## Résidus temporaires après confirmation

Sélectionner également :

```text
status = 'confirmed'
AND temporary_storage_path IS NOT NULL
AND next_delete_retry_at <= now()
AND delete_attempts < 5

```

Pour ces lignes, supprimer uniquement l’objet indiqué par `temporary_storage_path`. Ne jamais supprimer l’objet définitif indiqué par `storage_path`.

## Délais de réessai

Utiliser un délai progressif :

```text
1er échec : 15 minutes
2e échec : 1 heure
3e échec : 4 heures
4e échec : 12 heures
5e échec : 24 heures

```

Chaque échec doit :

- incrémenter `delete_attempts` ;
- enregistrer `last_delete_error` ;
- mettre à jour `next_delete_retry_at`.

Après réussite :

- passer à `deleted` pour un fichier temporaire abandonné ;
- ou mettre seulement `temporary_storage_path = null` pour un fichier déjà `confirmed`.

Les fichiers en `confirming` ne doivent jamais être touchés par la purge normale.

Prévoir néanmoins une stratégie distincte pour récupérer un fichier bloqué en `confirming` depuis anormalement longtemps, par exemple après plusieurs heures, en vérifiant d’abord l’existence du fichier final et l’état de `request_attachments`. Ne pas le supprimer aveuglément.

# 6. Sécurisation de la purge

`/api/public/cleanup-uploads` doit exiger :

```text
Authorization: Bearer <UPLOAD_CLEANUP_SECRET>

```

Supprimer tout usage de :

```text
SUPABASE_PUBLISHABLE_KEY

```

comme mécanisme d’authentification.

La comparaison du secret doit être réalisée de manière sûre et la route doit refuser l’appel si la variable est absente.

Le secret ne doit jamais être :

- écrit en clair dans une migration ;
- commité dans Git ;
- inclus dans le bundle client ;
- enregistré dans un fichier public.

Utiliser :

- une variable d’environnement serveur ;
- ou Supabase Vault si le cron est déclenché depuis PostgreSQL.

Si `pg_cron` et `pg_net` sont utilisés, le job doit lire le secret depuis Supabase Vault ou une autre source sécurisée. La migration peut créer la structure du job, mais ne doit contenir aucune valeur secrète réelle.

# 7. Compatibilité et idempotence

Garanties obligatoires :

- aucune course entre `pagehide`, suppression et soumission ;
- aucun fichier `confirming` supprimé par abandon ou purge ;
- aucun objet final laissé sans ligne `uploaded_files` et `request_attachments` ;
- aucun chemin temporaire perdu si sa suppression échoue ;
- limite de deux fichiers garantie côté base, même sous concurrence ;
- confirmation relançable sans créer de doublon ;
- suppression relançable sans erreur ;
- purge relançable sans supprimer deux fois le même objet ;
- anciens fichiers et anciennes lignes `request_attachments` préservés ;
- aucune modification visuelle du composant `PhotoUploader`.

# Détails techniques

Fichiers concernés :

```text
nouvelle migration SQL
src/lib/attachments.server.ts
src/routes/api/attachments/upload.ts
src/routes/api/public/cleanup-uploads.ts
src/integrations/supabase/types.ts

```

`src/components/PhotoUploader.tsx` et les routes de formulaire ne doivent être modifiés que si une adaptation technique est indispensable au nouveau protocole de réservation. Aucun changement de design ou de comportement visible non demandé.

# Vérifications finales

Exécuter :

```text
typecheck TypeScript
build de production

```

Tester au minimum :

1. upload d’une photo ;
2. upload de deux photos ;
3. tentative d’une troisième photo ;
4. deux uploads simultanés sur la même session ;
5. suppression individuelle ;
6. abandon complet d’une session ;
7. soumission pendant le déclenchement de `pagehide` ;
8. confirmation normale ;
9. échec de copie Storage ;
10. échec de la transaction de finalisation ;
11. échec de suppression du temporaire après confirmation ;
12. reprise d’un `delete_failed` ;
13. purge d’une réservation expirée ;
14. double appel de confirmation ;
15. double appel de suppression ;
16. appel de la purge sans secret, avec mauvais secret et avec secret valide.

Ne modifier aucun fichier sans rapport avec ce correctif.