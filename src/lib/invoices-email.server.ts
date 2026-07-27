// Server-only email step for invoices. Mirrors quotes-email.server.ts:
// acquires a "sending" lock, only mails recipients that aren't already
// 'sent', persists each status right after its attempt, then recomputes the
// global status FROM THE DATABASE (never from in-memory values alone).
import type { EmailStatus, InvoiceEmailResult, InvoiceGlobalStatus } from "./invoices.types";

function safeEmailError(err: unknown, scope: string): string {
  const raw = err instanceof Error ? err.message : String(err);
  console.error(`[invoices] ${scope} email failure: ${raw}`);
  return "L'envoi de l'e-mail a échoué. Réessayez depuis la liste des factures.";
}

export interface InvoiceEmailView {
  invoiceNumber: string;
  invoiceDate: string;
  totalHT: string;
  totalTVA: string;
  totalTTC: string;
}

/**
 * Acquire the send lock: flip status to 'sending' only if it isn't already.
 * Returns false when another send is in flight.
 */
async function acquireSendLock(invoiceId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("invoices")
    .update({ status: "sending" })
    .eq("id", invoiceId)
    .neq("status", "sending")
    .select("id");
  if (error) {
    console.error(`[invoices] send lock failed: ${error.message}`);
    return false;
  }
  return !!data && data.length > 0;
}

/** Recompute the global status from the persisted per-recipient statuses. */
async function recomputeGlobalStatus(invoiceId: string): Promise<{
  status: InvoiceGlobalStatus;
  emailClient: InvoiceEmailResult;
  emailArtisan: InvoiceEmailResult;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("invoices")
    .select("email_client_status, email_client_error, email_artisan_status, email_artisan_error")
    .eq("id", invoiceId)
    .single();

  const emailClient: InvoiceEmailResult = {
    status: ((row?.email_client_status as EmailStatus) ?? "pending"),
    error: row?.email_client_error ?? undefined,
  };
  const emailArtisan: InvoiceEmailResult = {
    status: ((row?.email_artisan_status as EmailStatus) ?? "pending"),
    error: row?.email_artisan_error ?? undefined,
  };

  let status: InvoiceGlobalStatus;
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
    .from("invoices")
    .update({
      status,
      sent_at: status === "sent" ? new Date().toISOString() : null,
    })
    .eq("id", invoiceId);

  return { status, emailClient, emailArtisan };
}

/**
 * Send the invoice PDF to the recipients that are not already 'sent'.
 * Never regenerates or touches the PDF; never overwrites a 'sent' status.
 */
export async function sendInvoiceEmails(args: {
  invoiceId: string;
  invoiceNo: string;
  pdfBase64: string;
  view: InvoiceEmailView;
  client: { name: string; email: string; phone?: string; address: string };
  paymentMethod: string;
  replyTo?: string;
}): Promise<{
  emailClient: InvoiceEmailResult;
  emailArtisan: InvoiceEmailResult;
  status: InvoiceGlobalStatus;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: current, error: curErr } = await supabaseAdmin
    .from("invoices")
    .select("email_client_status, email_artisan_status")
    .eq("id", args.invoiceId)
    .single();
  if (curErr || !current) throw new Error("Facture introuvable.");

  const needClient = current.email_client_status !== "sent";
  const needArtisan = current.email_artisan_status !== "sent";

  if (!needClient && !needArtisan) {
    return await recomputeGlobalStatus(args.invoiceId);
  }

  const locked = await acquireSendLock(args.invoiceId);
  if (!locked) {
    throw new Error("Un envoi est déjà en cours pour cette facture. Réessayez dans un instant.");
  }

  try {
    const [{ render }, ClientMod, ArtisanMod, { sendDocumentEmail }, { OWNER_EMAIL }] =
      await Promise.all([
        import("@react-email/components"),
        import("@/lib/email-templates/invoice-client"),
        import("@/lib/email-templates/invoice-artisan"),
        import("@/lib/invoice-email.server"),
        import("@/lib/email/dispatch.server"),
      ]);

    const pdfFilename = `${args.invoiceNo}.pdf`;

    if (needClient) {
      let result: InvoiceEmailResult;
      try {
        const html = await render(
          ClientMod.default({ ...args.view, clientName: args.client.name }) as any,
        );
        await sendDocumentEmail({
          to: args.client.email,
          subject: `Votre facture ${args.invoiceNo} — Plomberie Dupont`,
          html,
          pdfBase64: args.pdfBase64,
          pdfFilename,
          replyTo: args.replyTo,
          idempotencyKey: `invoice/${args.invoiceId}/client/v1`,
        });
        result = { status: "sent" };
      } catch (err) {
        result = { status: "failed", error: safeEmailError(err, "client") };
      }
      const upd = await supabaseAdmin
        .from("invoices")
        .update({
          email_client_status: result.status,
          email_client_error: result.error ?? null,
        })
        .eq("id", args.invoiceId);
      if (upd.error) {
        console.error(`[invoices] client status persist failed: ${upd.error.message}`);
      }
    }

    if (needArtisan) {
      let result: InvoiceEmailResult;
      try {
        const html = await render(
          ArtisanMod.default({
            ...args.view,
            clientName: args.client.name,
            clientEmail: args.client.email,
            clientPhone: args.client.phone,
            clientAddress: args.client.address,
            paymentMethod: args.paymentMethod,
          }) as any,
        );
        await sendDocumentEmail({
          to: OWNER_EMAIL,
          subject: `Facture émise : ${args.invoiceNo}`,
          html,
          pdfBase64: args.pdfBase64,
          pdfFilename,
          idempotencyKey: `invoice/${args.invoiceId}/artisan/v1`,
        });
        result = { status: "sent" };
      } catch (err) {
        result = { status: "failed", error: safeEmailError(err, "artisan") };
      }
      const upd = await supabaseAdmin
        .from("invoices")
        .update({
          email_artisan_status: result.status,
          email_artisan_error: result.error ?? null,
        })
        .eq("id", args.invoiceId);
      if (upd.error) {
        console.error(`[invoices] artisan status persist failed: ${upd.error.message}`);
      }
    }

    return await recomputeGlobalStatus(args.invoiceId);
  } catch (err) {
    // Always release the lock so a retry is possible.
    await recomputeGlobalStatus(args.invoiceId).catch(() => undefined);
    throw err;
  }
}
