## Objectif

Rendre le cycle de vie des photos jointes explicite et récupérable : un fichier n'est « attaché » que lorsque le serveur l'a confirmé, et tout fichier abandonné est purgé automatiquement côté serveur, sans dépendre du navigateur.

État actuel vérifié : les fichiers sont écrits directement sous `quote/<token>/…` ou `appointment/<token>/…`, suivis dans `request_attachments`, et re-tagués à la soumission (`associateAndBuildLinks`). Il n'existe aucun statut, aucune expiration, aucune purge : un formulaire abandonné laisse les objets et les lignes en place indéfiniment. L'uploader est présent sur les formulaires Devis et Rendez-vous (le formulaire Contact n'a pas d'upload aujourd'hui — je ne l'ajoute pas, mais la nouvelle structure le supportera).

## 1. Base de données (migration additive)

Nouvelle table `public.uploaded_files` :
- `id`, `storage_path` (unique), `original_filename`, `mime_type`, `size_bytes`
- `upload_session_id` (uuid), `owner_user_id` (nullable)
- `entity_type` / `entity_id` (nullables)
- `status` : `temporary | confirmed | deleting | deleted | delete_failed` (contrainte)
- `created_at`, `confirmed_at`, `deleted_at`
- Index : `upload_session_id`, `(status, created_at)`, `(entity_type, entity_id)`
- RLS activée, aucune policy pour `anon`/`authenticated` : accès serveur uniquement (service role). `request_attachments` est conservée telle quelle pour les demandes déjà enregistrées.

## 2. Upload temporaire

Route `POST /api/attachments/upload` réécrite :
- validation serveur inchangée dans son esprit (MIME sniffé, taille, nombre max 2) + vérification du nombre de fichiers déjà présents pour la session
- chemin généré serveur : `temporary/<uploadSessionId>/<uuid>.<ext>` — le nom d'origine n'est plus jamais utilisé comme chemin
- insertion immédiate dans `uploaded_files` avec `status = 'temporary'`
- si l'insertion échoue après l'upload : suppression immédiate de l'objet pour éviter l'orphelin
- réponse : `{ id, filename, size, mime, previewUrl }` (URL signée courte, ~10 min), jamais de chemin brut

## 3. Suppression avant envoi

`DELETE /api/attachments/upload` prend `{ fileId, uploadSessionId }` :
- vérifie l'appartenance à la session et le statut `temporary`
- `deleting` → suppression Storage → `deleted` + `deleted_at`
- idempotent : fichier déjà supprimé ou absent ⇒ succès
- l'UI ne retire l'aperçu qu'après confirmation serveur

## 4. Confirmation à la soumission

Dans `submitQuote` / `submitAppointment` : après insertion de la demande,
- récupérer les fichiers de la session (`status = 'temporary'`, non rattachés)
- copier vers `quote-requests/<requestId>/<fileId>.<ext>` (ou `appointments/…`), vérifier le succès, puis supprimer le temporaire
- seulement alors : `status = 'confirmed'`, `entity_type`, `entity_id`, `confirmed_at`, `storage_path` définitif, et création de la ligne `request_attachments` correspondante pour l'e-mail artisan
- une copie échouée laisse le fichier en `temporary` (il sera purgé) et n'empêche jamais l'enregistrement de la demande
- suppression du temporaire échouée après copie réussie : le fichier est quand même `confirmed`, le résidu part à la purge

## 5. Abandon du formulaire

- bouton « Tout retirer » / reset : appel explicite de suppression
- `pagehide` : `fetch(..., { keepalive: true })` vers un endpoint « abandon de session » — pure optimisation, jamais le seul mécanisme

## 6. Purge serveur

Route `GET/POST /api/public/cleanup-uploads` :
- sélectionne par lots (max ~100) les `temporary` de plus de 24 h
- verrou d'exécution (advisory lock) contre les exécutions concurrentes
- passage conditionnel `temporary → deleting`, suppression Storage, puis `deleted` ou `delete_failed` + log
- authentification par en-tête `apikey` (clé publique), planification via `pg_cron` toutes les heures
- ne touche jamais aux `confirmed`, ni aux fichiers sans ligne dans `uploaded_files` (anciens fichiers préservés)

## 7. Interface (sans changement de design)

`PhotoUploader` : état par fichier (envoi / prêt / erreur), réessai d'un upload échoué, suppression individuelle et globale, soumission bloquée tant qu'un upload est en cours, messages d'erreur génériques, état local nettoyé après succès.

## Détails techniques

- Fichiers touchés : nouvelle migration ; `src/lib/attachments.server.ts` (helpers session/confirmation/purge) ; `src/routes/api/attachments/upload.ts` ; nouvelle route de purge ; `src/lib/forms.functions.ts` ; `src/lib/forms.schemas.ts` (`upload_token` → `upload_session_id`) ; `src/components/PhotoUploader.tsx` ; `src/routes/devis.tsx`, `src/routes/rendez-vous.tsx`.
- Rate limiting IP existant sur l'upload conservé.
- Aucune erreur Supabase brute renvoyée au visiteur.
