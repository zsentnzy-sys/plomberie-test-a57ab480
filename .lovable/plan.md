## Diagnostic

### 1. Devis et rendez-vous : erreur confirmée (bug de code)

Dans `src/lib/forms.functions.ts`, les fonctions `submitQuote` et `submitAppointment` importent seulement `OWNER_EMAIL` depuis le module d'envoi :

```
const { enqueueTransactionalEmail, OWNER_EMAIL } = await import(".../dispatch.server");
```

…mais elles utilisent ensuite `PUBLIC_REPLY_TO_MAIL` (pour l'accusé de réception au client). Cette variable n'existe donc pas dans leur portée → `ReferenceError` levée juste après l'enregistrement en base.

Conséquence exacte de ce que vous observez :

- la demande **est bien enregistrée** en base,
- mais aucun e-mail n'est mis en file,
- et le visiteur voit « Une erreur est survenue » — puis reclique, créant des doublons.

`submitContact` importe correctement les deux constantes, donc ce bug ne la touche pas.

## Corrections proposées

1. **Import manquant** — ajouter `PUBLIC_REPLY_TO_MAIL` aux imports dynamiques de `submitQuote` et `submitAppointment`. C'est le correctif principal.
2. **Vérification** — test de bout en bout des trois formulaires (soumission réelle en préversion), contrôle que la ligne est créée une seule fois et que les e-mails partent bien.

## Détails techniques

- Fichiers concernés : `src/lib/forms.functions.ts` (import), `src/routes/contact.tsx`, `src/routes/devis.tsx`, `src/routes/rendez-vous.tsx` (lecture du nouveau retour).
- Aucun changement de design, de schéma de base de données ni de contenu des e-mails.