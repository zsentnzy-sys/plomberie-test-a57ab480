## Objectif
Envoyer le PDF de facture directement en pièce jointe au client et à l'artisan, au lieu d'un lien signé.

## Contexte
Le système de mails Lovable actuel (file d'attente + React Email) ne supporte pas les pièces jointes. On garde ce système pour tous les autres emails (devis, contact, rendez-vous, auth) et on isole l'envoi de facture via **Resend**, qui supporte nativement les attachments base64.

## Étapes

### 1. Connecter Resend
- Utiliser `standard_connectors--connect` avec `connector_id: resend`.
- L'utilisateur devra choisir/créer une connexion avec sa clé API Resend.
- Vérifier son domaine `normalweb.cloud` (ou un autre sous-domaine que `notify.*`, déjà délégué à Lovable) dans Resend — sinon les envois seront limités à l'adresse propriétaire du compte Resend.

### 2. Nouveau service d'envoi de facture
Créer `src/lib/invoice-email.server.ts` :
- Fonction `sendInvoiceEmail({ to, subject, html, pdfBase64, pdfFilename, replyTo? })`.
- POST vers `https://connector-gateway.lovable.dev/resend/emails` avec headers `Authorization: Bearer ${LOVABLE_API_KEY}` et `X-Connection-Api-Key: ${RESEND_API_KEY}`.
- Body : `{ from, to, subject, html, reply_to?, attachments: [{ filename, content: pdfBase64 }] }`.
- Gestion d'erreurs : log status + body du provider, throw explicite.

### 3. Rendu HTML des emails facture
- Réutiliser les templates React Email existants (`invoice-client.tsx`, `invoice-artisan.tsx`) mais les rendre côté serveur avec `render()` de `@react-email/components` pour obtenir du HTML statique (au lieu de passer par la file).
- Supprimer les props `downloadUrl` / bouton "Télécharger" devenu inutile ; garder le récapitulatif et remplacer le CTA par une mention "PDF en pièce jointe".

### 4. Modifier `src/lib/invoices.functions.ts`
- Retirer l'upload du PDF vers le bucket `request-attachments` et la génération du lien signé.
- Rendre les deux HTML (client + artisan) via `render()`.
- Appeler `sendInvoiceEmail` deux fois (client + artisan) avec le même buffer PDF encodé base64.
- Conserver le retour `{ invoiceNumber, pdfBase64 }` pour le téléchargement navigateur côté admin.
- Conserver la réservation du numéro via `next_invoice_number()`.

### 5. Nettoyage
- Retirer l'enregistrement des templates facture du registry Lovable Emails (`src/lib/email-templates/registry.ts`) puisqu'ils ne passent plus par la file.
- Garder les fichiers `.tsx` comme sources de rendu HTML.

## Détails techniques
- `from` : `"Plomberie Dupont <facturation@<domaine-verifié-resend>>"`. À confirmer selon le domaine que vous vérifierez dans Resend.
- Attachments Resend : format `{ filename: "FACT-YYYY-XXXX.pdf", content: "<base64>" }` (sans data-URI prefix).
- Taille max Resend : 40 Mo par email ; nos PDF < 100 Ko, aucun souci.
- Aucun changement de schéma DB.

## Question ouverte
Quel domaine/adresse d'expéditeur voulez-vous utiliser pour les factures ? (ex. `facturation@normalweb.cloud` si vous vérifiez `normalweb.cloud` chez Resend). Je peux commencer avec un placeholder et vous l'ajusterez.
