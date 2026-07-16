import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error("Vérification du rôle impossible.");
  if (!data) throw new Error("Accès refusé.");
}

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabase } = context;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [apptMonth, quotesPending, contactsUnread, apptRecent] = await Promise.all([
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startOfMonth),
      supabase
        .from("quote_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("contact_requests")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false),
      supabase
        .from("appointments")
        .select("created_at")
        .gte("created_at", since30.toISOString()),
    ]);

    // Group recent appointments into weekly buckets (last 30 days)
    const buckets: { label: string; count: number }[] = [];
    for (let i = 4; i >= 0; i--) {
      const end = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      const count = (apptRecent.data ?? []).filter((r: { created_at: string }) => {
        const d = new Date(r.created_at);
        return d >= start && d < end;
      }).length;
      buckets.push({
        label: end.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
        count,
      });
    }

    return {
      appointmentsThisMonth: apptMonth.count ?? 0,
      quotesPending: quotesPending.count ?? 0,
      contactsUnread: contactsUnread.count ?? 0,
      weekly: buckets,
    };
  });

export const listAppointments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("appointments")
      .select("*")
      .order("preferred_date", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listQuotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("quote_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("contact_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const updateAppointmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; status: string }) => data)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("appointments")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateQuoteStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; status: string }) => data)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("quote_requests")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setContactRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; isRead: boolean }) => data)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("contact_requests")
      .update({ is_read: data.isRead })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { table: "appointments" | "quote_requests" | "contact_requests"; id: string }) => data)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const allowed = ["appointments", "quote_requests", "contact_requests"];
    if (!allowed.includes(data.table)) throw new Error("Table non autorisée.");
    const { error } = await context.supabase.from(data.table).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });