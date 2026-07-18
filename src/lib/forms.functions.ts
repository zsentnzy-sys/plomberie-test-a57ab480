import { createServerFn } from "@tanstack/react-start";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import { contactSchema, quoteSchema, appointmentSchema } from "./forms.schemas";

async function associateAndBuildLinks(params: {
  uploadToken: string;
  requestType: "quote" | "appointment";
  requestId: string;
}): Promise<Array<{ url: string; filename: string; size: number; mime: string }>> {
  if (!params.uploadToken) return [];
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildSignedLinks } = await import("@/lib/attachments.server");
    // Re-tag staged rows: request_id was set to the token during upload.
    const { data: updated, error: updErr } = await supabaseAdmin
      .from("request_attachments")
      .update({ request_id: params.requestId })
      .eq("request_id", params.uploadToken)
      .eq("request_type", params.requestType)
      .select("storage_path, original_filename, mime_type, size_bytes");
    if (updErr) {
      console.error("Failed to associate attachments", updErr);
      return [];
    }
    if (!updated || updated.length === 0) return [];
    return await buildSignedLinks(supabaseAdmin, updated);
  } catch (err) {
    console.error("associateAndBuildLinks crashed", err);
    return [];
  }
}

function getClientMeta() {
  let ip: string | null = null;
  let userAgent: string | null = null;
  try {
    ip = getRequestIP({ xForwardedFor: true }) ?? null;
    userAgent = getRequestHeader("user-agent") ?? null;
  } catch {
    // request context unavailable (e.g. prerender) — ignore
  }
  return { ip: ip || "Non disponible", userAgent: userAgent || "Non disponible" };
}

const RATE_LIMIT_MESSAGE =
  "Trop de demandes envoyées. Merci de réessayer plus tard ou de nous appeler directement.";

const IPV4_RE = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

/** Returns a validated IPv4 string, or "Non disponible" if absent/invalid. */
function resolveClientIpv4(value?: string): string {
  const v = (value || "").trim();
  return IPV4_RE.test(v) ? v : "Non disponible";
}

/**
 * Per-IP rate limiting. Throws RATE_LIMIT_MESSAGE when a window is exceeded.
 * Skips silently when the IP is unavailable (preview/SSR) to avoid false positives.
 */
async function enforceRateLimit(ip: string, formType: string): Promise<void> {
  if (!ip || ip === "Non disponible") return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const now = Date.now();
  const tenMinAgo = new Date(now - 10 * 60 * 1000).toISOString();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const { count: shortCount } = await supabaseAdmin
    .from("form_rate_limit")
    .select("id", { count: "exact", head: true })
    .eq("ip_address", ip)
    .gte("created_at", tenMinAgo);
  if ((shortCount ?? 0) >= 3) throw new Error(RATE_LIMIT_MESSAGE);

  const { count: dayCount } = await supabaseAdmin
    .from("form_rate_limit")
    .select("id", { count: "exact", head: true })
    .eq("ip_address", ip)
    .gte("created_at", dayAgo);
  if ((dayCount ?? 0) >= 15) throw new Error(RATE_LIMIT_MESSAGE);

  await supabaseAdmin.from("form_rate_limit").insert({ ip_address: ip, form_type: formType });
}

export const submitContact = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => contactSchema.parse(data))
  .handler(async ({ data }) => {
    const meta = getClientMeta();
    await enforceRateLimit(meta.ip, "contact");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inserted, error } = await supabaseAdmin.from("contact_requests").insert({
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      subject: data.subject || null,
      message: data.message,
    }).select("id").single();
    if (error) throw new Error("Impossible d'enregistrer votre message.");
    const { enqueueTransactionalEmail, OWNER_EMAIL } = await import("@/lib/email/dispatch.server");
    const key = inserted?.id ?? data.email;
    await Promise.all([
      enqueueTransactionalEmail({
        templateName: "contact-notification",
        recipientEmail: OWNER_EMAIL,
        idempotencyKey: `contact-notif-${key}`,
        replyTo: data.email,
        templateData: {
          name: data.name,
          email: data.email,
          phone: data.phone || "",
          subject: data.subject || "",
          message: data.message,
          ip: resolveClientIpv4(data.client_ipv4),
          server_ip: meta.ip,
          user_agent: meta.userAgent,
        },
      }),
      enqueueTransactionalEmail({
        templateName: "contact-confirmation",
        recipientEmail: data.email,
        idempotencyKey: `contact-confirm-${key}`,
        replyTo: OWNER_EMAIL,
        templateData: { name: data.name, message: data.message },
      }),
    ]);
    return { ok: true };
  });

export const submitQuote = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => quoteSchema.parse(data))
  .handler(async ({ data }) => {
    const meta = getClientMeta();
    await enforceRateLimit(meta.ip, "quote");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inserted, error } = await supabaseAdmin.from("quote_requests").insert({
      name: data.name,
      email: data.email,
      phone: data.phone,
      address: data.address || null,
      service_type: data.service_type,
      description: data.description,
      urgency: data.urgency || null,
    }).select("id").single();
    if (error) throw new Error("Impossible d'enregistrer votre demande de devis.");
    const { enqueueTransactionalEmail, OWNER_EMAIL } = await import("@/lib/email/dispatch.server");
    const key = inserted?.id ?? data.email;
    const attachments = inserted?.id
      ? await associateAndBuildLinks({
          uploadToken: (data.upload_token || "").trim(),
          requestType: "quote",
          requestId: inserted.id,
        })
      : [];
    await Promise.all([
      enqueueTransactionalEmail({
        templateName: "quote-notification",
        recipientEmail: OWNER_EMAIL,
        idempotencyKey: `quote-notif-${key}`,
        replyTo: data.email,
        templateData: {
          name: data.name,
          email: data.email,
          phone: data.phone,
          address: data.address || "",
          service_type: data.service_type,
          urgency: data.urgency || "",
          description: data.description,
          ip: resolveClientIpv4(data.client_ipv4),
          server_ip: meta.ip,
          user_agent: meta.userAgent,
          attachments,
        },
      }),
      enqueueTransactionalEmail({
        templateName: "quote-confirmation",
        recipientEmail: data.email,
        idempotencyKey: `quote-confirm-${key}`,
        replyTo: OWNER_EMAIL,
        templateData: {
          name: data.name,
          service_type: data.service_type,
          description: data.description,
        },
      }),
    ]);
    return { ok: true, request_id: inserted?.id };
  });

export const submitAppointment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => appointmentSchema.parse(data))
  .handler(async ({ data }) => {
    const meta = getClientMeta();
    await enforceRateLimit(meta.ip, "appointment");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inserted, error } = await supabaseAdmin.from("appointments").insert({
      name: data.name,
      email: data.email,
      phone: data.phone,
      service_type: data.service_type,
      preferred_date: data.preferred_date,
      time_slot: data.time_slot,
      notes: data.notes || null,
    }).select("id").single();
    if (error) throw new Error("Impossible d'enregistrer votre rendez-vous.");
    const { enqueueTransactionalEmail, OWNER_EMAIL } = await import("@/lib/email/dispatch.server");
    const key = inserted?.id ?? data.email;
    const attachments = inserted?.id
      ? await associateAndBuildLinks({
          uploadToken: (data.upload_token || "").trim(),
          requestType: "appointment",
          requestId: inserted.id,
        })
      : [];
    await Promise.all([
      enqueueTransactionalEmail({
        templateName: "appointment-notification",
        recipientEmail: OWNER_EMAIL,
        idempotencyKey: `appointment-notif-${key}`,
        replyTo: data.email,
        templateData: {
          name: data.name,
          email: data.email,
          phone: data.phone,
          service_type: data.service_type,
          preferred_date: data.preferred_date,
          time_slot: data.time_slot,
          notes: data.notes || "",
          ip: resolveClientIpv4(data.client_ipv4),
          server_ip: meta.ip,
          user_agent: meta.userAgent,
          attachments,
        },
      }),
      enqueueTransactionalEmail({
        templateName: "appointment-confirmation",
        recipientEmail: data.email,
        idempotencyKey: `appointment-confirm-${key}`,
        replyTo: OWNER_EMAIL,
        templateData: {
          name: data.name,
          service_type: data.service_type,
          preferred_date: data.preferred_date,
          time_slot: data.time_slot,
        },
      }),
    ]);
    return { ok: true, request_id: inserted?.id };
  });