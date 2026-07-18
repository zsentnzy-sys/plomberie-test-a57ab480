## Objectif

Ajouter aux formulaires **Devis** et **Rendez-vous** la possibilité de joindre jusqu’à **2 photos** :

- JPEG / JPG / PNG / WebP ;
- 5 Mo maximum par photo ;
- stockage sécurisé dans Supabase Storage ;
- envoi prioritaire comme véritables pièces jointes dans les e-mails destinés à l’artisan ;
- utilisation de liens signés temporaires uniquement comme solution de secours.

## Principes retenus

- Composant `PhotoUploader` unique et réutilisable.
- Bucket privé Supabase Storage nommé `request-attachments`.
- Validation stricte côté serveur.
- Aucune clé `service_role` exposée côté client.
- Notifications orchestrées et garanties côté serveur.
- Le navigateur ne doit pas être l’unique responsable du déclenchement final de l’e-mail.
- Les photos ne sont jamais envoyées dans l’e-mail de confirmation adressé au client.
- Les pièces jointes sont le comportement principal.
- Les liens signés sont uniquement un fallback.

---

# 1. Backend Supabase

Créer un bucket privé :

```text
request-attachments

```

Configuration :

- `public: false` ;
- taille maximale cohérente avec la limite applicative ;
- aucun accès direct pour `anon` ou `authenticated` ;
- accès exclusivement depuis le serveur avec le client Supabase privilégié.

Créer une migration contenant la table :

```text
public.request_attachments

```

Colonnes :

```text
id uuid primary key
request_id uuid not null
request_type text not null
storage_path text not null
original_filename text not null
mime_type text not null
size_bytes integer not null
created_at timestamptz not null default now()

```

Ajouter une contrainte :

```text
request_type in ('quote', 'appointment')

```

Ajouter un index sur :

```text
(request_type, request_id)

```

Activer la RLS.

Ne créer aucune politique permettant l’accès à `anon` ou `authenticated`.

Accorder uniquement les droits nécessaires au rôle serveur.

---

# 2. Statut des notifications

Ajouter aux tables `quote_requests` et `appointments`, ou dans une table commune dédiée, les informations nécessaires au suivi de la notification.

Statuts recommandés :

```text
pending_attachments
ready_to_notify
notification_queued
notification_sent
notification_failed

```

Ajouter si nécessaire :

```text
notification_status
notification_attempts
notification_last_error
notification_queued_at
notification_sent_at

```

Objectif :

- empêcher qu’une demande enregistrée reste définitivement sans notification ;
- permettre une reprise automatique ;
- rendre les traitements idempotents ;
- éviter les doubles e-mails.

---

# 3. Validation partagée côté serveur

Créer :

```text
src/lib/attachments.server.ts

```

Constantes :

```ts
MAX_FILES = 2
MAX_SIZE = 5 * 1024 * 1024
MAX_TOTAL_SIZE = 10 * 1024 * 1024
ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
]

```

Créer une fonction :

```text
validateAndStoreAttachments(requestType, requestId, files)

```

Elle doit :

- vérifier qu’il y a au maximum 2 fichiers ;
- refuser les fichiers vides ;
- vérifier la taille de chaque fichier ;
- vérifier la taille totale ;
- ne pas faire confiance uniquement à l’extension ou au type MIME fourni par le navigateur ;
- détecter le type réel par signatures binaires ;
- prendre en charge :
  - JPEG : `FF D8 FF`
  - PNG : `89 50 4E 47`
  - WebP : `RIFF....WEBP`
- refuser toute incohérence entre contenu détecté et extension ;
- assainir le nom original ;
- utiliser le nom original uniquement pour l’affichage ;
- générer un chemin unique et non prédictible.

Organisation :

```text
quote/<request-id>/<uuid>.<extension>
appointment/<request-id>/<uuid>.<extension>

```

Pour chaque fichier :

1. valider ;
2. uploader dans Supabase Storage ;
3. insérer la ligne dans `request_attachments`.

En cas d’échec partiel :

- supprimer les objets déjà uploadés ;
- supprimer les lignes déjà insérées ;
- retourner une erreur claire ;
- ne pas laisser de fichier orphelin.

Ne jamais renvoyer au navigateur les chemins internes du bucket.

---

# 4. Route serveur multipart

Créer une route serveur unique pour recevoir les photos :

```text
src/routes/api/attachments/upload.ts

```

Elle doit :

- accepter `multipart/form-data` ;
- recevoir :
  - `request_type`
  - `request_id`
  - `files[]`
- limiter la taille totale de la requête ;
- appliquer le rate limiting existant ;
- vérifier que la demande existe ;
- vérifier que la demande peut encore recevoir des fichiers ;
- refuser une demande déjà finalisée ou trop ancienne ;
- appeler `validateAndStoreAttachments` ;
- mettre à jour le statut de la demande ;
- déclencher côté serveur la finalisation ou la mise en file de la notification.

Réponse :

```json
{
  "ok": true,
  "count": 2
}

```

Ne jamais retourner :

- le chemin Storage ;
- une URL signée ;
- une information privilégiée.

---

# 5. Workflow de soumission robuste

Modifier le workflow actuel afin que l’envoi de l’e-mail ne dépende pas uniquement d’un dernier appel effectué par le navigateur.

## Cas sans photo

1. Le formulaire appelle `submitQuote` ou `submitAppointment`.
2. La demande est insérée.
3. Son statut passe directement à :

```text
ready_to_notify

```

4. Le serveur met immédiatement la notification en file.
5. La réponse renvoie le succès au navigateur.

## Cas avec photos

1. Le formulaire appelle `submitQuote` ou `submitAppointment`.
2. La demande est insérée avec :

```text
pending_attachments

```

3. Le serveur renvoie le `request_id`.
4. Le client envoie les photos à la route multipart.
5. La route serveur valide et stocke les photos.
6. La route passe la demande à :

```text
ready_to_notify

```

7. La route serveur met elle-même la notification en file.
8. Elle renvoie le résultat au navigateur.

Le navigateur ne doit pas avoir besoin d’appeler une seconde fonction `finalizeSubmission` pour garantir l’envoi.

---

# 6. Mécanisme de reprise

Prévoir un mécanisme de reprise serveur pour les cas suivants :

- l’utilisateur ferme la page après la création de la demande ;
- l’upload ne démarre jamais ;
- l’upload réussit mais la mise en file échoue ;
- le serveur est interrompu après l’enregistrement ;
- l’e-mail échoue temporairement.

Comportement recommandé :

- toute demande restée en `pending_attachments` au-delà d’un délai court est notifiée sans photo ;
- toute demande en `ready_to_notify` mais non mise en file doit être reprise ;
- toute demande en `notification_failed` peut être retentée ;
- limiter le nombre de tentatives ;
- journaliser la dernière erreur.

Exemple :

```text
pending_attachments depuis plus de 10 minutes
→ passer à ready_to_notify
→ envoyer la notification sans photo

```

L’artisan ne doit jamais perdre la notification d’une demande parce que l’utilisateur a fermé son navigateur.

---

# 7. Préparation des pièces jointes

Créer un module serveur partagé, par exemple :

```text
src/lib/email/prepare-attachments.server.ts

```

Créer une fonction :

```text
prepareEmailAttachments(requestType, requestId)

```

Elle doit :

1. récupérer les lignes de `request_attachments` ;
2. télécharger les fichiers depuis le bucket privé ;
3. vérifier que le nombre et les tailles correspondent aux métadonnées ;
4. construire les pièces jointes dans le format attendu par le fournisseur d’e-mail ;
5. conserver :
  - un nom de fichier lisible ;
  - le type MIME ;
  - le contenu binaire ou Base64 selon l’API utilisée.

Noms recommandés :

```text
photo-1.jpg
photo-2.webp

```

Ne pas envoyer les chemins internes du bucket au fournisseur d’e-mail.

---

# 8. Stratégie pièces jointes avec fallback

Les photos doivent être envoyées comme véritables pièces jointes lorsque cela est possible.

Définir une limite prudente spécifique à l’e-mail, par exemple :

```text
MAX_EMAIL_ATTACHMENTS_RAW_SIZE = 7 Mo

```

Cette limite est inférieure aux 10 Mo autorisés à l’upload afin de prendre en compte :

- l’encodage Base64 ;
- les en-têtes MIME ;
- le contenu HTML ;
- les limites du fournisseur d’e-mail.

## Comportement principal

Si :

- le fournisseur supporte les pièces jointes ;
- le téléchargement réussit ;
- le poids total reste sous la limite ;

alors envoyer les images comme véritables pièces jointes.

## Fallback

Utiliser des liens signés temporaires uniquement si :

- le poids total dépasse la limite ;
- le fournisseur refuse les pièces jointes ;
- le téléchargement d’une pièce jointe échoue ;
- l’ajout des pièces jointes provoque une erreur ;
- une contrainte technique empêche l’envoi.

Dans ce cas :

- générer des URLs signées ;
- durée recommandée : 30 jours, sauf contrainte contraire ;
- indiquer clairement leur expiration ;
- ne jamais rendre le bucket public ;
- ne jamais annuler complètement l’e-mail à cause des photos.

Exemple dans l’e-mail :

```text
Les photos n’ont pas pu être intégrées comme pièces jointes.
Vous pouvez les consulter via les liens sécurisés ci-dessous.
Ces liens expirent dans 30 jours.

```

---

# 9. Journalisation des e-mails

Modifier `email_send_log` ou la structure équivalente pour enregistrer :

```text
attachment_delivery_mode
attachment_count
attachment_total_size
attachment_error

```

Valeurs possibles pour `attachment_delivery_mode` :

```text
none
attached
signed_links
partial_fallback

```

Journaliser :

- envoi avec pièces jointes ;
- envoi avec liens ;
- échec de téléchargement ;
- dépassement de taille ;
- erreur du fournisseur ;
- nombre de fichiers inclus.

Ne jamais journaliser :

- le contenu Base64 ;
- une clé secrète ;
- une URL signée complète si elle doit rester confidentielle.

---

# 10. Adaptation du système d’e-mails

Avant l’implémentation :

- vérifier quel fournisseur d’e-mail est actuellement utilisé ;
- vérifier sa documentation actuelle ;
- confirmer le format attendu pour les pièces jointes ;
- confirmer la limite maximale réelle ;
- confirmer si la file d’e-mails existante accepte du contenu Base64 ou binaire ;
- éviter de stocker le contenu complet des fichiers dans PostgreSQL.

La queue doit stocker de préférence :

```text
request_type
request_id
attachment_ids ou storage_paths

```

Le worker d’envoi télécharge les fichiers au moment du traitement.

Ne pas placer directement plusieurs mégaoctets de Base64 dans la table de queue, sauf nécessité démontrée.

---

# 11. Templates d’e-mails

Modifier :

```text
src/lib/email-templates/quote-notification.tsx
src/lib/email-templates/appointment-notification.tsx

```

Ajouter les informations nécessaires :

```ts
attachments?: {
  filename: string
  size: number
  deliveryMode: 'attached' | 'signed_link'
  url?: string
}[]

```

## Si les photos sont jointes

Afficher une mention simple :

```text
2 photos sont jointes à cet e-mail.

```

Ne pas afficher de liens inutiles.

## Si les liens signés sont utilisés

Afficher une section :

```text
Photos de la demande

```

Avec :

- nom ;
- taille ;
- lien ;
- date ou durée d’expiration.

Ne modifier que les e-mails de notification destinés à l’artisan.

Ne pas joindre ou renvoyer les photos dans l’e-mail de confirmation adressé au client.

---

# 12. Composant client PhotoUploader

Créer :

```text
src/components/PhotoUploader.tsx

```

Fonctionnalités :

- `<input type="file" multiple />` ;
- formats acceptés :
  - JPEG
  - PNG
  - WebP
- maximum 2 photos ;
- 5 Mo maximum par photo ;
- aperçu miniature ;
- affichage du nom ;
- affichage de la taille ;
- suppression avant envoi ;
- validation côté client ;
- messages d’erreur accessibles ;
- nettoyage des `URL.createObjectURL` ;
- utilisation au clavier ;
- compatibilité mobile ;
- possibilité d’utiliser l’appareil photo.

Ajouter :

```html
accept="image/jpeg,image/png,image/webp"

```

L’attribut `capture="environment"` peut être proposé sur mobile, mais ne doit pas empêcher le choix depuis la galerie.

Le composant doit exposer les fichiers sélectionnés via une prop contrôlée ou un callback.

Éviter une API complexe avec `ref` si un état parent simple suffit.

---

# 13. Intégration Devis et Rendez-vous

Modifier :

```text
src/routes/devis.tsx
src/routes/rendez-vous.tsx

```

Ajouter une section :

```text
Photos du problème ou de l’installation — facultatif

```

Processus :

1. valider le formulaire ;
2. enregistrer la demande ;
3. récupérer `request_id` ;
4. s’il y a des photos, envoyer le `FormData` ;
5. laisser la route serveur déclencher la notification ;
6. afficher le résultat à l’utilisateur.

## Si l’upload échoue

Afficher :

```text
Votre demande a bien été enregistrée, mais les photos n’ont pas pu être transmises. L’artisan recevra tout de même votre demande.

```

Le serveur doit garantir que la notification sera quand même envoyée sans photo.

Ne pas demander au client de relancer toute la demande.

État de chargement :

```text
enregistrement
upload des photos
finalisation serveur

```

Empêcher les doubles soumissions.

---

# 14. Sécurité

Les vérifications suivantes sont obligatoires :

- validation côté serveur ;
- bucket privé ;
- clé `service_role` uniquement côté serveur ;
- aucune variable secrète préfixée par `VITE_` ;
- aucune URL publique permanente ;
- aucun chemin Storage envoyé au navigateur ;
- nombre de fichiers contrôlé côté serveur ;
- taille totale contrôlée ;
- type MIME contrôlé par contenu ;
- noms générés côté serveur ;
- rate limiting ;
- vérification que la demande existe ;
- vérification que la demande n’est pas déjà finalisée ;
- idempotence des uploads et notifications ;
- protection contre les doubles envois.

---

# 15. Données personnelles et conservation

Ajouter près du champ :

```text
Les photos transmises sont utilisées uniquement pour analyser votre demande et préparer l’intervention. N’envoyez pas de document d’identité ni d’image contenant des informations sensibles.

```

Mettre à jour la politique de confidentialité :

- photos facultatives ;
- finalité ;
- accès limité à l’artisan et aux services techniques nécessaires ;
- durée de conservation ;
- droit de suppression ;
- coordonnées de contact.

Durée proposée :

```text
12 mois maximum

```

Cependant, ne pas annoncer une suppression automatique tant qu’elle n’est pas réellement implémentée.

Soit :

- implémenter dès maintenant un cron de purge ;
- soit indiquer une suppression manuelle/procédurale réelle ;
- soit réduire la promesse dans la politique.

Ne pas déclarer qu’un mécanisme automatique existe s’il est hors scope.

---

# 16. Purge automatique

Idéalement, inclure dans ce développement une tâche planifiée qui :

- recherche les pièces jointes de plus de 12 mois ;
- supprime les objets Storage ;
- supprime les lignes `request_attachments` ;
- journalise les erreurs ;
- traite les suppressions par lots ;
- ne bloque pas les autres traitements.

Si le cron reste hors scope :

- créer une issue explicite ;
- ne pas présenter la purge comme déjà active ;
- documenter la procédure temporaire.

---

# Contraintes finales

- Les photos doivent être jointes directement aux e-mails de l’artisan par défaut.
- Les liens signés ne sont qu’une solution de secours.
- Une erreur liée aux photos ne doit jamais empêcher l’artisan de recevoir la demande.
- L’envoi de la notification ne doit pas dépendre exclusivement du navigateur.
- Le bucket reste privé.
- Aucun secret Supabase ne doit apparaître côté client.
- Le traitement doit être idempotent.
- Les fichiers orphelins doivent être nettoyés.
- La conservation annoncée doit correspondre au comportement réellement implémenté.