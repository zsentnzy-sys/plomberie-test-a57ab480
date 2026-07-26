// Server-only admin guard shared by the quote server functions.
export async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error("Vérification du rôle impossible.");
  if (!isAdmin) throw new Error("Accès refusé.");
}
