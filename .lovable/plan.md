## Objectif

Ajouter une page **Politique de confidentialité** accessible depuis le footer, conforme au RGPD, dans le même style que la page Mentions légales existante.

## Ce qui sera fait

### 1. Nouvelle route `/politique-de-confidentialite`
Créer `src/routes/politique-de-confidentialite.tsx` sur le modèle visuel de `src/routes/mentions-legales.tsx` (mêmes composants `LegalSection` / `LegalInformation`, même mise en page, `noindex, follow`).

### 2. Contenu RGPD couvert
Sections rédigées en français, adaptées au site (formulaires contact / devis / rendez-vous, dashboard admin, emails transactionnels via `notify.normalweb.cloud`, IP collectée pour anti-spam) :

1. Responsable du traitement (réutilise les infos `site.ts` — nom, adresse, email, SIRET)
2. Données collectées
   - Formulaires : nom, email, téléphone, message, type de demande
   - Techniques : adresse IP, user-agent (anti-spam / rate limiting)
   - Compte admin : email d'authentification
3. Finalités du traitement
   - Répondre aux demandes de contact / devis / rendez-vous
   - Envoi d'emails de confirmation et de notification
   - Prévention des abus (rate limiting par IP)
   - Gestion administrative interne
4. Bases légales (art. 6 RGPD)
   - Mesures précontractuelles (devis / RDV) — art. 6.1.b
   - Intérêt légitime (anti-spam, sécurité, gestion admin) — art. 6.1.f
   - Consentement pour les communications non essentielles — art. 6.1.a
5. Destinataires
   - L'artisan et personnel autorisé
   - Sous-traitants : hébergeur, fournisseur de base de données, prestataire d'envoi d'emails (mentionnés génériquement, sans nommer Lovable/Supabase/Resend)
6. Durées de conservation
   - Demandes de contact : 3 ans après le dernier échange
   - Devis / rendez-vous : 3 ans (prospects) / 10 ans (obligations comptables si contrat)
   - Logs techniques et rate-limit : 12 mois maximum
   - Compte admin : durée d'activité du compte
7. Transferts hors UE — indiqué "aucun transfert hors UE" par défaut, à confirmer
8. Sécurité — HTTPS, RLS, authentification admin, rate limiting
9. Droits des personnes (art. 15 à 22 RGPD) : accès, rectification, effacement, limitation, opposition, portabilité, retrait du consentement, directives post-mortem — avec l'email de contact du site
10. Réclamation auprès de la CNIL (mention obligatoire + lien cnil.fr)
11. Cookies — mention que le site n'utilise que des cookies strictement nécessaires (pas d'analytics tiers actuellement) ; renvoi vers cette section depuis les mentions légales
12. Modifications de la politique + date de dernière mise à jour

### 3. Lien dans le footer
Dans `src/components/Footer.tsx`, ajouter dans la colonne « Navigation », juste sous « Mentions légales » :
```
{ to: "/politique-de-confidentialite", label: "Politique de confidentialité" }
```

### 4. Détails techniques
- Head : `title`, `description`, `robots: noindex, follow`
- Ajouter le lien vers `/politique-de-confidentialite` depuis la section « Données personnelles » de `mentions-legales.tsx`
- Pas d'ajout au `sitemap.xml` ni au `llms.txt` (page utilitaire non promotionnelle, cohérent avec le traitement actuel des mentions légales)
- Aucune modification base de données, aucun nouveau composant partagé

## Points à confirmer (valeurs par défaut sinon)
- **Transfert hors UE** : je pars sur « aucun transfert hors UE ». Ok ?
- **Cookies** : je déclare uniquement des cookies strictement nécessaires (session admin). Ok ?
- **Email dédié RGPD** : j'utilise `site.email` du fichier `src/lib/site.ts`. Ok ou tu veux un email dédié `rgpd@…` ?
