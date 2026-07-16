import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const emailSchema = z.object({
  email: z.string().trim().email().max(255),
  origin: z.string().url().max(2048),
});

/**
 * Envoie un email de réinitialisation de mot de passe UNIQUEMENT si l'adresse
 * correspond à un compte possédant le rôle admin. Retourne toujours { ok: true }
 * pour ne pas révéler quelle adresse est l'administrateur.
 */
export const requestAdminPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((data) => emailSchema.parse(data))
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Retrouver l'utilisateur par email
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const user = usersData?.users.find((u) => u.email?.toLowerCase() === email);
    if (!user) return { ok: true };

    // Vérifier le rôle admin (service_role contourne la RLS)
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return { ok: true };

    // Envoyer l'email de réinitialisation via le client admin (clé service_role
    // fiablement injectée côté serveur). Évite toute dépendance à
    // SUPABASE_PUBLISHABLE_KEY dans le worker déployé.
    const redirectTo = `${data.origin}/admin/reset-password`;
    await supabaseAdmin.auth.resetPasswordForEmail(email, { redirectTo });

    return { ok: true };
  });