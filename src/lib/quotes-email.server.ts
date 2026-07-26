// Server-only email step for quotes: sends the client mail, persists its
// status immediately, then the artisan copy, then computes the global status.
// Kept out of *.functions.ts so the server-fn splitter never strips it.
import type { QuoteEmailResult, QuoteGlobalStatus } from "./quotes.types";

/** Never leak raw provider errors to the browser. */
function safeEmailError(err: unknown, scope: string): string {
  const raw = err instanceof Error ? err.message : String(err);
  console.error(`[quotes] ${scope} email failure: ${raw}`);
  return "L'envoi de l'e-mail a échoué. Réessayez depuis la liste des demandes.";
}

/**
 * Shared email step: sends the client mail, persists its status immediately,
 * then the artisan copy, then computes the global status. Never coerces a
 * pending status into failed.
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
  const [{ render }, ClientMod, ArtisanMod, { sendDocumentEmail }, { OWNER_EMAIL }] =
    await Promise.all([
      import("@react-email/components"),
      import("@/lib/email-templates/quote-document-client"),
      import("@/lib/email-templates/quote-document-artisan"),
      import("@/lib/invoice-email.server"),
      import("@/lib/email/dispatch.server"),
    ]);

  const [clientHtml, artisanHtml] = await Promise.all([
    render(
      ClientMod.default({ ...args.view, clientName: args.client.name }) as any,
    ),
    render(
      ArtisanMod.default({
        ...args.view,
        clientName: args.client.name,
        clientEmail: args.client.email,
        clientPhone: args.client.phone,
        clientAddress: args.client.address,
      }) as any,
    ),
  ]);

  await supabaseAdmin.from("quotes").update({ status: "sending" }).eq("id", args.quoteId);

  const pdfFilename = `${args.quoteNo}.pdf`;

  let emailClient: QuoteEmailResult;
  try {
    await sendDocumentEmail({
      to: args.client.email,
      subject: `Votre devis ${args.quoteNo} — Plomberie Dupont`,
      html: clientHtml,
      pdfBase64: args.pdfBase64,
      pdfFilename,
      replyTo: args.replyTo,
      idempotencyKey: `quote/${args.quoteId}/client/v1`,
    });
    emailClient = { status: "sent" };
  } catch (err) {
    emailClient = { status: "failed", error: safeEmailError(err, "client") };
  }
  const clientUpd = await supabaseAdmin
    .from("quotes")
    .update({
      email_client_status: emailClient.status,
      email_client_error: emailClient.error ?? null,
    })
    .eq("id", args.quoteId);
  if (clientUpd.error) {
    console.error(`[quotes] client status persist failed: ${clientUpd.error.message}`);
  }

  let emailArtisan: QuoteEmailResult;
  try {
    await sendDocumentEmail({
      to: OWNER_EMAIL,
      subject: `Devis émis : ${args.quoteNo}`,
      html: artisanHtml,
      pdfBase64: args.pdfBase64,
      pdfFilename,
      idempotencyKey: `quote/${args.quoteId}/artisan/v1`,
    });
    emailArtisan = { status: "sent" };
  } catch (err) {
    emailArtisan = { status: "failed", error: safeEmailError(err, "artisan") };
  }
  const artisanUpd = await supabaseAdmin
    .from("quotes")
    .update({
      email_artisan_status: emailArtisan.status,
      email_artisan_error: emailArtisan.error ?? null,
    })
    .eq("id", args.quoteId);
  if (artisanUpd.error) {
    console.error(`[quotes] artisan status persist failed: ${artisanUpd.error.message}`);
  }

  let status: QuoteGlobalStatus;
  if (emailClient.status === "sent" && emailArtisan.status === "sent") {
    status = "sent";
  } else if (emailClient.status === "failed" && emailArtisan.status === "failed") {
    status = "send_failed";
  } else if (emailClient.status === "sent" || emailArtisan.status === "sent") {
    status = "partially_sent";
  } else {
    status = "sending";
  }

  await supabaseAdmin
    .from("quotes")
    .update({
      status,
      sent_at: status === "sent" ? new Date().toISOString() : null,
    })
    .eq("id", args.quoteId);

  return { emailClient, emailArtisan, status };
}

