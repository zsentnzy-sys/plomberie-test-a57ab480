// Server-only email step for quotes: acquires a "sending" lock, mails only
// the recipients that aren't already 'sent', persists each status right
// after its attempt, then recomputes the global status FROM THE DATABASE.
import type { QuoteEmailResult, QuoteEmailStatus, QuoteGlobalStatus } from "./quotes.types";

/** Never leak raw provider errors to the browser. */
function safeEmailError(err: unknown, scope: string): string {
  const raw = err instanceof Error ? err.message : String(err);
  console.error(`[quotes] ${scope} email failure: ${raw}`);
  return "L'envoi de l'e-mail a échoué. Réessayez depuis la liste des demandes.";
}

async function acquireSendLock(quoteId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("quotes")
    .update({ status: "sending" })
    .eq("id", quoteId)
    .neq("status", "sending")
    .select("id");
  if (error) {
    console.error(`[quotes] send lock failed: ${error.message}`);
    return false;
  }
  return !!data && data.length > 0;
}

async function recomputeGlobalStatus(quoteId: string): Promise<{
  status: QuoteGlobalStatus;
  emailClient: QuoteEmailResult;
  emailArtisan: QuoteEmailResult;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("quotes")
    .select("email_client_status, email_client_error, email_artisan_status, email_artisan_error")
    .eq("id", quoteId)
    .single();

  const emailClient: QuoteEmailResult = {
    status: ((row?.email_client_status as QuoteEmailStatus) ?? "pending"),
    error: row?.email_client_error ?? undefined,
  };
  const emailArtisan: QuoteEmailResult = {
    status: ((row?.email_artisan_status as QuoteEmailStatus) ?? "pending"),
    error: row?.email_artisan_error ?? undefined,
  };

  let status: QuoteGlobalStatus;
  if (emailClient.status === "sent" && emailArtisan.status === "sent") {
    status = "sent";
  } else if (emailClient.status === "failed" && emailArtisan.status === "failed") {
    status = "send_failed";
  } else if (emailClient.status === "sent" || emailArtisan.status === "sent") {
    status = "partially_sent";
  } else {
    status = "ready";
  }

  await supabaseAdmin
    .from("quotes")
    .update({
      status,
      sent_at: status === "sent" ? new Date().toISOString() : null,
    })
    .eq("id", quoteId);

  return { status, emailClient, emailArtisan };
}

/**
 * Shared email step: only mails recipients whose status isn't 'sent'.
 * Never coerces a pending status into failed, never touches the PDF.
 */
export async function sendQuoteEmails(args: {
  quoteId: string;
  quoteNo: string;
  pdfBase64: string;
  view: {
    quoteNumber: string;
    quoteDate: string;
    validUntil: string;
    totalHT: string;
    totalTVA: string;
    totalTTC: string;
  };
  client: { name: string; email: string; phone?: string; address: string };
  replyTo?: string;
}): Promise<{
  emailClient: QuoteEmailResult;
  emailArtisan: QuoteEmailResult;
  status: QuoteGlobalStatus;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: current, error: curErr } = await supabaseAdmin
    .from("quotes")
    .select("email_client_status, email_artisan_status")
    .eq("id", args.quoteId)
    .single();
  if (curErr || !current) throw new Error("Devis introuvable.");

  const needClient = current.email_client_status !== "sent";
  const needArtisan = current.email_artisan_status !== "sent";
  if (!needClient && !needArtisan) return await recomputeGlobalStatus(args.quoteId);

  const locked = await acquireSendLock(args.quoteId);
  if (!locked) {
    throw new Error("Un envoi est déjà en cours pour ce devis. Réessayez dans un instant.");
  }

  try {
    const [{ render }, ClientMod, ArtisanMod, { sendDocumentEmail }, { OWNER_EMAIL }] =
      await Promise.all([
        import("@react-email/components"),
        import("@/lib/email-templates/quote-document-client"),
        import("@/lib/email-templates/quote-document-artisan"),
        import("@/lib/invoice-email.server"),
        import("@/lib/email/dispatch.server"),
      ]);

    const pdfFilename = `${args.quoteNo}.pdf`;

    if (needClient) {
      let emailClient: QuoteEmailResult;
      try {
        const html = await render(
          ClientMod.default({ ...args.view, clientName: args.client.name }) as any,
        );
        await sendDocumentEmail({
          to: args.client.email,
          subject: `Votre devis ${args.quoteNo} — Plomberie Dupont`,
          html,
          pdfBase64: args.pdfBase64,
          pdfFilename,
          replyTo: args.replyTo,
          idempotencyKey: `quote/${args.quoteId}/client/v1`,
        });
        emailClient = { status: "sent" };
      } catch (err) {
        emailClient = { status: "failed", error: safeEmailError(err, "client") };
      }
      const upd = await supabaseAdmin
        .from("quotes")
        .update({
          email_client_status: emailClient.status,
          email_client_error: emailClient.error ?? null,
        })
        .eq("id", args.quoteId);
      if (upd.error) {
        console.error(`[quotes] client status persist failed: ${upd.error.message}`);
      }
    }

    if (needArtisan) {
      let emailArtisan: QuoteEmailResult;
      try {
        const html = await render(
          ArtisanMod.default({
            ...args.view,
            clientName: args.client.name,
            clientEmail: args.client.email,
            clientPhone: args.client.phone,
            clientAddress: args.client.address,
          }) as any,
        );
        await sendDocumentEmail({
          to: OWNER_EMAIL,
          subject: `Devis émis : ${args.quoteNo}`,
          html,
          pdfBase64: args.pdfBase64,
          pdfFilename,
          idempotencyKey: `quote/${args.quoteId}/artisan/v1`,
        });
        emailArtisan = { status: "sent" };
      } catch (err) {
        emailArtisan = { status: "failed", error: safeEmailError(err, "artisan") };
      }
      const upd = await supabaseAdmin
        .from("quotes")
        .update({
          email_artisan_status: emailArtisan.status,
          email_artisan_error: emailArtisan.error ?? null,
        })
        .eq("id", args.quoteId);
      if (upd.error) {
        console.error(`[quotes] artisan status persist failed: ${upd.error.message}`);
      }
    }

    return await recomputeGlobalStatus(args.quoteId);
  } catch (err) {
    await recomputeGlobalStatus(args.quoteId).catch(() => undefined);
    throw err;
  }
}
