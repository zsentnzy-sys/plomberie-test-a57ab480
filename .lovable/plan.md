## Contexte

- L'adresse email admin **n'est pas dans le code** : elle est stockée dans l'authentification du backend (utilisateur d'auth), associée au rôle `admin` via la table `user_roles`. Aujourd'hui : `sentnzy@gmail.com`.
- **Pour la changer** : Lovable Cloud → Users → ouvrir l'utilisateur admin → modifier son email (ou via une future page Paramètres si tu le souhaites plus tard). Aucune modification de code n'est requise pour ce changement.

Cette demande ajuste deux points sur le flux "Mot de passe oublié" déjà implémenté.

---

## 1. Restreindre "Mot de passe oublié" aux seuls emails admin

Problème : aujourd'hui `resetPasswordForEmail` est appelé côté client et enverrait un email à n'importe quelle adresse. On veut que **seul un email possédant le rôle admin** déclenche un envoi.

Solution : déplacer l'envoi vers une **server function** sécurisée.

**Nouveau fichier** `src/lib/auth.functions.ts`
- `requestAdminPasswordReset` (`createServerFn`, POST, validé par Zod : `{ email }`).
- Dans le handler :
  - Charger `supabaseAdmin` via `await import("@/integrations/supabase/client.server")`.
  - Retrouver l'utilisateur par email et vérifier qu'il a le rôle admin (`has_role` / lecture `user_roles`).
  - **Si admin** : envoyer l'email de réinitialisation (génération du lien de récupération côté admin, redirigé vers `/admin/reset-password`).
  - **Si non-admin / inconnu** : ne rien envoyer.
  - Retourner toujours la même réponse générique `{ ok: true }` (ne pas révéler si l'adresse existe ou est admin — bonne pratique de sécurité).

**Page de connexion** `src/routes/admin/login.tsx`
- Remplacer l'appel direct `supabase.auth.resetPasswordForEmail(...)` par l'appel à la server function via `useServerFn`.
- Garder le même message de confirmation générique : "Si cette adresse correspond au compte administrateur, un email de réinitialisation a été envoyé."

> Note : le message reste volontairement générique pour ne pas divulguer quelle adresse est l'admin. Le comportement réel = seul l'email admin reçoit le lien.

---

## 2. Vérifier le wiring server function

- `requestAdminPasswordReset` est **public** (pas de session quand on a oublié son mot de passe) → pas de `requireSupabaseAuth`. La sécurité vient de la vérification du rôle admin côté serveur avant tout envoi.
- Aucune migration backend nécessaire.

---

## Fichiers touchés
- `src/lib/auth.functions.ts` — **nouveau** (envoi de reset restreint aux admins).
- `src/routes/admin/login.tsx` — utiliser la server function au lieu de l'appel client direct.

## Pour changer l'email admin (hors code)
Lovable Cloud → Users → utilisateur admin → modifier l'email. Le rôle `admin` reste attaché au même compte, donc le dashboard continue de fonctionner avec la nouvelle adresse.
