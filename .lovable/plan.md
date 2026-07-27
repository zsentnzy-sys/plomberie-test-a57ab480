## 1. Réinitialisation admin — origine imposée par le serveur

`src/lib/auth.functions.ts` accepte aujourd'hui `origin` depuis le client et l'utilise pour construire `redirectTo`.

- Supprimer `origin` du schéma d'entrée (ne garder que `email`).
- Ajouter une constante serveur d'origine canonique (URL publiée du site), lue dans le handler, avec fallback sur une valeur fixe si la variable d'environnement est absente.
- Construire `redirectTo = ${ORIGIN}/admin/reset-password`.
- Mettre à jour l'appel dans `src/routes/admin/login.tsx` pour ne plus envoyer `window.location.origin`.

## 2. Renvoi des e-mails de facture (`resendInvoiceEmail`)

Nouvelle fonction serveur admin `resendInvoiceEmail({ invoiceId })` dans `src/lib/invoices.functions.ts` :

- Charge la facture + son snapshot artisan + ses lignes ; conserve le numéro existant.
- Utilise le PDF stocké (`pdf_storage_path`) ; ne le régénère que s'il est absent/illisible — et dans ce cas ne met à jour **que** `pdf_storage_path` et `generation_error`, jamais les colonnes `email_*_status` ni `sent_at`.
- N'envoie qu'aux destinataires dont le statut n'est pas `sent` (client et/ou artisan).
- Verrou anti-double-envoi : passage conditionnel du statut à `sending` via un `UPDATE ... WHERE status <> 'sending'` (garde optimiste) ; si le verrou n'est pas acquis, retour d'une erreur explicite « envoi déjà en cours ». Libération du verrou dans tous les cas (succès comme échec).
- Recalcule le statut global **depuis les colonnes en base** après les tentatives (`sent`, `partially_sent`, `send_failed`), pas depuis les seules valeurs en mémoire.

Le chemin `reused` de `generateInvoice` délègue à cette logique : au lieu de retourner immédiatement, il relance l'envoi pour les destinataires non `sent`.

Côté UI (`src/routes/admin/factures.tsx`) : le bouton existant continue de fonctionner ; en cas de statut partiel/échoué, il déclenche le renvoi ciblé et affiche le résultat par destinataire. Aucun changement de design.

Le même correctif est appliqué symétriquement aux devis (`src/lib/quotes.functions.ts` / `quotes.server.ts`), qui ont exactement le même chemin `reused`.

## 3. Création atomique des factures, devis et lignes

Créer une nouvelle migration additive introduisant deux RPC transactionnelles distinctes :  
create_invoice_with_lines_for_idempotency(...)  
create_quote_with_lines_for_idempotency(...)  
Chaque RPC doit créer le document et toutes ses lignes dans une seule transaction.

Éviter les états partiels tels que :  
facture ou devis créé  
→ numéro réservé  
→ insertion des lignes échouée  
→ document sans lignes en état generation_failed

Avec le nouveau flux, si l’insertion d’une seule ligne échoue, toute la transaction doit être annulée :  
- aucun document partiel ;  
- aucune ligne partielle ;  
- aucun numéro définitivement réservé ;  
- aucun compteur laissé dans un état incohérent.

RPC facture  
Créer : public.create_invoice_with_lines_for_idempotency(...)

La fonction reçoit au minimum :  
- la clé d’idempotence ;  
- les informations client ;  
- la date de facture ;  
- le mode de paiement ;  
- le snapshot artisan ;  
- les lignes au format jsonb.

Dans une seule transaction, elle doit :  
1) vérifier que l’utilisateur authentifié possède le rôle admin ;  
2) rechercher une facture existante avec la même clé d’idempotence ;  
3) si elle existe :  
- vérifier que le payload correspond bien à la facture existante ;  
- retourner invoice_id, invoice_number et reused = true;  
4) sinon :  
- valider le tableau JSON des lignes ;  
- réserver le prochain numéro de facture ;  
- calculer les montants de chaque ligne côté SQL ;  
- calculer les totaux globaux depuis les lignes ;  
- insérer la facture ;  
- insérer toutes les lignes ;  
- retourner invoice_id, invoice_number et reused = false.

RPC devis  
Créer : public.create_quote_with_lines_for_idempotency(...)  
  
La fonction reçoit au minimum :  
- la clé d’idempotence ;  
- l’identifiant éventuel de la demande de devis ;  
- les informations client ;  
- la date du devis ;  
- la date de validité ;  
- les notes ou conditions particulières ;  
- le snapshot artisan ;  
- les lignes au format jsonb.

Dans une seule transaction, elle doit :  
1) vérifier que l’utilisateur authentifié possède le rôle admin ;  
2) rechercher un devis existant avec la même clé d’idempotence ;  
3) si le devis existe :  
- vérifier que le payload correspond bien au devis existant ;  
- retourner quote_id, quote_number et reused = true;  
4) sinon :  
- valider le tableau JSON des lignes ;  
- vérifier que valid_until >= quote_date;  
- réserver le prochain numéro de devis ;  
- calculer les montants de chaque ligne côté SQL ;  
- calculer les totaux globaux depuis les lignes ;  
- insérer le devis ;  
- insérer toutes les lignes ;  
- retourner quote_id, quote_number et reused = false.	

Validation SQL des lignes

Ne pas accepter directement les totaux calculés par le navigateur ou le serveur TypeScript comme source de vérité.

Pour chaque ligne, la RPC doit vérifier :  
- tableau JSON non vide ;  
- nombre maximal de lignes respecté ;  
- position >= 1;  
- positions uniques ;  
- type autorisé ;  
- description non vide ;  
- quantité strictement positive ;  
- prix unitaire HT positif ou nul ;  
- TVA appartenant à 0, 5.5, 10 ou 20.

Les montants doivent être recalculés côté SQL :  
line_total_ht  = arrondi(unit_price_ht × quantity)  
line_total_tva = arrondi(line_total_ht × tva / 100)  
line_total_ttc = line_total_ht + line_total_tva

Les totaux du document doivent ensuite être obtenus par agrégation des lignes calculées.

Cohérence de l’idempotence

Lorsqu’une clé d’idempotence existe déjà, ne pas retourner automatiquement le document sans vérifier la cohérence du nouvel appel.

Comparer au minimum :  
Pour une facture :  
- client ;  
- date ;  
- mode de paiement ;  
- lignes ;  
- montants calculés.

Pour un devis :  
- client ;  
- demande de devis liée ;  
- date ;  
- validité ;  
- notes ;  
- lignes ;  
- montants calculés.

En cas de réutilisation de la même clé avec un payload différent, lever une erreur explicite côté serveur, sans modifier le document existant.

Une empreinte déterministe du payload peut être enregistrée pour simplifier cette vérification.

Adaptation des handlers TypeScript

Dans generateInvoice :  
- remplacer l’appel à create_invoice_for_idempotency;  
- supprimer l’insertion séparée dans invoice_lines;  
- appeler uniquement create_invoice_with_lines_for_idempotency;  
- continuer ensuite avec la génération du PDF, le stockage et les e-mails.

Dans generateQuote :  
- remplacer l’appel à create_quote_for_idempotency;  
- supprimer l’insertion séparée dans quote_lines;  
- appeler uniquement create_quote_with_lines_for_idempotency;  
- continuer ensuite avec la génération du PDF, le stockage et les e-mails.

Les handlers TypeScript conservent leur validation Zod, mais la base reste la source de vérité pour les montants persistés.

Compatibilité avec les anciens documents incomplets

Le nouveau flux ne doit plus permettre la création d’un document sans lignes.

Pour les factures ou devis créés avant cette migration et déjà incomplets, prévoir une reprise strictement encadrée :  
- uniquement si aucune ligne n’existe ;  
- uniquement si le statut est generation_failed;  
- uniquement avec les données validées de la tentative d’origine ;  
- ne jamais remplacer les lignes d’un document déjà complet ;  
- ne jamais accepter un payload différent sous la même clé d’idempotence.

Ce mécanisme est une compatibilité temporaire et ne doit pas être utilisé pour les documents créés par les nouvelles RPC.

Sécurité SQL

Les deux RPC doivent utiliser : SECURITY DEFINER

avec :  
- search_path fixé explicitement ;  
- toutes les tables qualifiées avec le schéma public;  
- contrôle has_role(auth.uid(), 'admin');  
- EXECUTE révoqué pour PUBLIC et anon;  
- EXECUTE accordé uniquement à authenticated et, si nécessaire, service_role.

Ne modifier aucune migration existante : créer uniquement une nouvelle migration additive.

## 4. Formulaires publics : ne plus échouer après enregistrement

Dans `src/lib/forms.functions.ts` (contact, devis, rendez-vous) :

- Une fois la ligne insérée en base, la mise en file des e-mails ne peut plus faire échouer la réponse : remplacement de `Promise.all` par `Promise.allSettled`, journalisation des échecs.
- Retour enrichi : `{ ok: true, request_id, email_queued: boolean }` — le visiteur reçoit toujours une confirmation dès que sa demande est enregistrée.
- Les échecs de mise en file sont tracés dans `email_send_log` avec le statut `failed` (déjà supporté par `dispatch.server.ts`), ce qui laisse une trace exploitable côté admin.
- Idempotence renforcée : les clés d'idempotence restent dérivées de l'`id` de la demande, donc un renvoi ultérieur ne duplique pas l'e-mail.
- Les messages UI des trois formulaires restent inchangés (succès), avec une mention discrète seulement si l'accusé de réception n'a pas pu être mis en file.

## Détails techniques

- Migrations SQL : une seule migration ajoutant les RPC transactionnelles (factures + devis) avec GRANT/REVOKE explicites.
- Pas de changement du moteur PDF (`documents.server.ts`) ni du design admin.
- Vérification : typecheck, puis test manuel du parcours « générer → simuler échec e-mail → recliquer » et d'une soumission de formulaire.