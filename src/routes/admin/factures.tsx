import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileDown, Send, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { generateInvoice, resendInvoiceEmail } from "@/lib/invoices.functions";
import { getQuoteForInvoice } from "@/lib/history.functions";
import {
  LineItemsEditor,
  TotalsCard,
  computeEditorTotals,
  downloadBase64Pdf,
  newLine,
  parseNum,
  type EditableLine,
} from "@/components/admin/LineItemsEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Payment = "Carte bancaire" | "Virement bancaire" | "Chèque" | "Espèces";
type CustomerType = "individual" | "company" | "public_sector";

/** Lightweight collapsible section, styled like the existing cards. */
function OptionalSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-6 text-left"
      >
        <span>
          <span className="block text-base font-semibold leading-none">{title}</span>
          <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && <CardContent className="grid gap-4 pt-0 md:grid-cols-2">{children}</CardContent>}
    </Card>
  );
}

export const Route = createFileRoute("/admin/factures")({
  validateSearch: (search: Record<string, unknown>) => ({
    depuisDevis:
      typeof search.depuisDevis === "string" ? search.depuisDevis : undefined,
  }),
  component: FacturesPage,
});

function FacturesPage() {
  const { depuisDevis } = Route.useSearch();
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [payment, setPayment] = useState<Payment>("Virement bancaire");
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [lines, setLines] = useState<EditableLine[]>([newLine()]);
  // Factur-X regulatory block — optional, defaults cover a B2C invoice.
  const [customerType, setCustomerType] = useState<CustomerType>("individual");
  const [countryCode, setCountryCode] = useState("FR");
  const [siren, setSiren] = useState("");
  const [siret, setSiret] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [operationCategory, setOperationCategory] = useState<
    "goods" | "services" | "mixed"
  >("services");
  const [vatOnDebits, setVatOnDebits] = useState(true);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [orderReference, setOrderReference] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    crypto.randomUUID(),
  );
  // Kept after a partial email failure so a future targeted-resend UI can
  // reference the exact invoice without creating a new one.
  const [lastInvoiceId, setLastInvoiceId] = useState<string | null>(null);

  const submit = useServerFn(generateInvoice);
  const resend = useServerFn(resendInvoiceEmail);
  const [resending, setResending] = useState(false);
  const loadQuote = useServerFn(getQuoteForInvoice);
  const [sourceQuote, setSourceQuote] = useState<{
    id: string;
    number: string;
  } | null>(null);
  const [prefilling, setPrefilling] = useState(Boolean(depuisDevis));
  const prefilledFor = useRef<string | null>(null);

  // Quote → invoice conversion: prefill the existing form, nothing else changes.
  useEffect(() => {
    if (!depuisDevis || prefilledFor.current === depuisDevis) return;
    prefilledFor.current = depuisDevis;
    let cancelled = false;
    setPrefilling(true);
    loadQuote({ data: { quoteId: depuisDevis } })
      .then((q) => {
        if (cancelled) return;
        setSourceQuote({ id: q.quoteId, number: q.quoteNumber });
        setClientName(q.clientName);
        setClientAddress(q.clientAddress);
        setClientEmail(q.clientEmail);
        setClientPhone(q.clientPhone);
        setLines(
          q.lines.length
            ? q.lines.map((l) => ({
                id: crypto.randomUUID(),
                type: l.type,
                description: l.description,
                unit_price_ht: String(l.unit_price_ht).replace(".", ","),
                quantity: String(l.quantity).replace(".", ","),
                tva: l.tva,
              }))
            : [newLine()],
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        toast.error(
          err instanceof Error ? err.message : "Devis introuvable.",
        );
      })
      .finally(() => {
        if (!cancelled) setPrefilling(false);
      });
    return () => {
      cancelled = true;
    };
  }, [depuisDevis, loadQuote]);

  async function handleResend() {
    if (!lastInvoiceId || resending) return;
    setResending(true);
    try {
      const res = await resend({ data: { invoiceId: lastInvoiceId } });
      const clientOk = res.emailClient.status === "sent";
      const artisanOk = res.emailArtisan.status === "sent";
      if (clientOk && artisanOk) {
        toast.success(`Facture ${res.invoiceNumber} : e-mails envoyés.`);
        setLines([newLine()]);
        setIdempotencyKey(crypto.randomUUID());
        setLastInvoiceId(null);
      } else {
        const failed: string[] = [];
        if (!clientOk) failed.push(`client (${res.emailClient.error ?? "erreur"})`);
        if (!artisanOk) failed.push(`artisan (${res.emailArtisan.error ?? "erreur"})`);
        toast.warning(
          `Facture ${res.invoiceNumber} : échec d'envoi ${failed.join(" · ")}`,
          { duration: 10000 },
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(`Renvoi impossible : ${msg}`);
    } finally {
      setResending(false);
    }
  }

  const totals = useMemo(() => computeEditorTotals(lines), [lines]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    // Client-side validation
    if (clientName.trim().length < 2) return toast.error("Nom du client requis.");
    if (clientAddress.trim().length < 4)
      return toast.error("Adresse du client requise.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clientEmail))
      return toast.error("Email du client invalide.");
    const parsedLines = lines.map((l) => {
      const pu = parseNum(l.unit_price_ht);
      const qty = parseNum(l.quantity);
      return {
        type: l.type,
        description: l.description.trim(),
        unit_price_ht: Number.isFinite(pu) ? pu : NaN,
        quantity: Number.isFinite(qty) ? qty : NaN,
        tva: l.tva,
      };
    });
    for (const [i, l] of parsedLines.entries()) {
      if (!l.description) return toast.error(`Ligne ${i + 1} : description requise.`);
      if (!Number.isFinite(l.unit_price_ht) || l.unit_price_ht < 0)
        return toast.error(`Ligne ${i + 1} : prix unitaire invalide.`);
      if (!Number.isFinite(l.quantity) || l.quantity <= 0)
        return toast.error(`Ligne ${i + 1} : quantité invalide.`);
    }

    setSubmitting(true);
    try {
      const res = await submit({
        data: {
          client_name: clientName.trim(),
          client_address: clientAddress.trim(),
          client_email: clientEmail.trim(),
          client_phone: clientPhone.trim() || undefined,
          payment_method: payment,
          invoice_date: invoiceDate,
          lines: parsedLines,
          idempotency_key: idempotencyKey,
          source_quote_id: sourceQuote?.id,
          customer_type: customerType,
          customer_siren: siren.trim(),
          customer_siret: siret.trim(),
          customer_vat_number: vatNumber.trim(),
          customer_country_code: countryCode.trim().toUpperCase() || "FR",
          operation_category: operationCategory,
          vat_on_debits: vatOnDebits,
          delivery_address: deliveryAddress.trim(),
          delivery_date: deliveryDate,
          payment_due_date: dueDate,
          payment_reference: paymentReference.trim(),
          purchase_order_reference: orderReference.trim(),
          service_period_start: periodStart,
          service_period_end: periodEnd,
        },
      });
      setLastInvoiceId(res.invoiceId);
      // Download in the browser
      downloadBase64Pdf(res.pdfBase64, `${res.invoiceNumber}.pdf`);
      const clientOk = res.emailClient.status === "sent";
      const artisanOk = res.emailArtisan.status === "sent";
      if (clientOk && artisanOk) {
        toast.success(
          res.reused
            ? `Facture ${res.invoiceNumber} déjà générée — PDF retéléchargé.`
            : `Facture ${res.invoiceNumber} générée et envoyée au client et à l'artisan.`,
        );
        // Full success: rotate the idempotency key so the next click starts a
        // brand-new invoice, and reset the line editor.
        setLines([newLine()]);
        setIdempotencyKey(crypto.randomUUID());
        setLastInvoiceId(null);
        setSourceQuote(null);
      } else {
        const failed: string[] = [];
        if (!clientOk)
          failed.push(`client (${res.emailClient.error ?? "erreur"})`);
        if (!artisanOk)
          failed.push(`artisan (${res.emailArtisan.error ?? "erreur"})`);
        const allFailed = !clientOk && !artisanOk;
        const msg = `Facture ${res.invoiceNumber} enregistrée, PDF téléchargé, mais échec d'envoi : ${failed.join(" · ")}`;
        if (allFailed) {
          toast.error(msg, { duration: 10000 });
        } else {
          toast.warning(msg, { duration: 10000 });
        }
        // Partial/full email failure: KEEP the idempotency key and the form
        // state so retrying reuses the same invoice instead of creating a new
        // number/row.
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(`Échec : ${msg}`);
      // Do not rotate the idempotency key: the server may have marked the
      // invoice as generation_failed but kept the number reserved, and the
      // user can retry against the same row.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Générer une facture</h1>
        <p className="text-sm text-muted-foreground">
          Facture Factur-X (PDF/A-3 avec XML EN 16931 intégré) : le document est
          envoyé au client et à l'artisan puis téléchargé.
        </p>
      </div>

      {prefilling && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement du devis…
        </p>
      )}

      {sourceQuote && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6 text-sm">
            Facture créée à partir du devis <strong>{sourceQuote.number}</strong>.
            Le devis d'origine reste inchangé.
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Client & paiement</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cname">Nom / Prénom *</Label>
              <Input
                id="cname"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cemail">Email *</Label>
              <Input
                id="cemail"
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                required
                maxLength={255}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="caddr">Adresse *</Label>
              <Textarea
                id="caddr"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                required
                rows={2}
                maxLength={400}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cphone">Téléphone</Label>
              <Input
                id="cphone"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                maxLength={30}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cdate">Date de facture *</Label>
              <Input
                id="cdate"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Mode de paiement *</Label>
              <Select
                value={payment}
                onValueChange={(v) => setPayment(v as Payment)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Carte bancaire">Carte bancaire</SelectItem>
                  <SelectItem value="Virement bancaire">
                    Virement bancaire
                  </SelectItem>
                  <SelectItem value="Chèque">Chèque</SelectItem>
                  <SelectItem value="Espèces">Espèces</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <LineItemsEditor
          title="Lignes facturées"
          lines={lines}
          onChange={setLines}
        />

        <OptionalSection
          title="Informations réglementaires"
          description="Requises pour une facture professionnelle (Factur-X / EN 16931)."
        >
          <div className="space-y-2">
            <Label>Type de client</Label>
            <Select
              value={customerType}
              onValueChange={(v) => setCustomerType(v as CustomerType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">Particulier</SelectItem>
                <SelectItem value="company">Entreprise</SelectItem>
                <SelectItem value="public_sector">Secteur public</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Pays du client (ISO)</Label>
            <Input
              id="country"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
              maxLength={2}
            />
          </div>
          {customerType !== "individual" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="siren">SIREN {countryCode === "FR" ? "*" : ""}</Label>
                <Input
                  id="siren"
                  value={siren}
                  onChange={(e) => setSiren(e.target.value)}
                  maxLength={9}
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="siret">SIRET</Label>
                <Input
                  id="siret"
                  value={siret}
                  onChange={(e) => setSiret(e.target.value)}
                  maxLength={14}
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tvaintra">N° TVA intracommunautaire</Label>
                <Input
                  id="tvaintra"
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value.toUpperCase())}
                  maxLength={20}
                />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label>Nature de l'opération</Label>
            <Select
              value={operationCategory}
              onValueChange={(v) =>
                setOperationCategory(v as "goods" | "services" | "mixed")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="services">Prestations de services</SelectItem>
                <SelectItem value="goods">Livraisons de biens</SelectItem>
                <SelectItem value="mixed">Mixte</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>TVA sur les débits</Label>
            <Select
              value={vatOnDebits ? "oui" : "non"}
              onValueChange={(v) => setVatOnDebits(v === "oui")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="oui">Oui</SelectItem>
                <SelectItem value="non">Non</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </OptionalSection>

        <OptionalSection
          title="Livraison"
          description="Adresse et date de livraison si différentes de la facturation."
        >
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="daddr">Adresse de livraison</Label>
            <Textarea
              id="daddr"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              rows={2}
              maxLength={400}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ddate">Date de livraison</Label>
            <Input
              id="ddate"
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
          </div>
        </OptionalSection>

        <OptionalSection
          title="Paiement et références"
          description="Échéance, référence de paiement et bon de commande client."
        >
          <div className="space-y-2">
            <Label htmlFor="due">Date d'échéance</Label>
            <Input
              id="due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pref">Référence de paiement</Label>
            <Input
              id="pref"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              maxLength={60}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="oref">Référence de commande client</Label>
            <Input
              id="oref"
              value={orderReference}
              onChange={(e) => setOrderReference(e.target.value)}
              maxLength={60}
            />
          </div>
        </OptionalSection>

        <OptionalSection
          title="Période de prestation"
          description="Période couverte par les travaux facturés."
        >
          <div className="space-y-2">
            <Label htmlFor="pstart">Début</Label>
            <Input
              id="pstart"
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pend">Fin</Label>
            <Input
              id="pend"
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
          </div>
        </OptionalSection>

        <TotalsCard totals={totals} />

        <div className="flex justify-end gap-3">
          {lastInvoiceId && (
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={handleResend}
              disabled={resending || submitting}
            >
              {resending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Renvoi en cours…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Renvoyer les e-mails
                </>
              )}
            </Button>
          )}
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Envoi en cours…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Générer et envoyer
                <FileDown className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
