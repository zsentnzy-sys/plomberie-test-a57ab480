import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowLeft, FileDown, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { formatDate } from "@/lib/utils";
import { generateQuote, getQuoteRequestDetail } from "@/lib/quotes.functions";
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

const VALIDITY_DAYS = 30;

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const detailQuery = (requestId: string) =>
  queryOptions({
    queryKey: ["admin", "quote-request", requestId],
    queryFn: () => getQuoteRequestDetail({ data: { requestId } }),
  });

export const Route = createFileRoute("/admin/devis_/$id")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(detailQuery(params.id)),
  component: QuoteEditorPage,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive" role="alert">
      {error.message}
    </p>
  ),
  notFoundComponent: () => (
    <p className="text-sm text-muted-foreground">Demande introuvable.</p>
  ),
});

function QuoteEditorPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(detailQuery(id));
  const request = data.request as {
    id: string;
    name: string;
    email: string;
    phone: string;
    address: string | null;
    service_type: string;
    description: string;
    urgency: string | null;
    created_at: string;
  };
  const existingQuote = data.quote as {
    id: string;
    quote_number: string;
    status: string;
  } | null;

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const submit = useServerFn(generateQuote);

  const today = new Date().toISOString().slice(0, 10);
  const [clientName, setClientName] = useState(request.name);
  const [clientEmail, setClientEmail] = useState(request.email);
  const [clientPhone, setClientPhone] = useState(request.phone ?? "");
  const [clientAddress, setClientAddress] = useState(request.address ?? "");
  const [quoteDate, setQuoteDate] = useState(today);
  const [validUntil, setValidUntil] = useState(addDays(today, VALIDITY_DAYS));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<EditableLine[]>([
    { ...newLine(), description: request.service_type },
  ]);
  const [submitting, setSubmitting] = useState(false);
  // Kept stable across retries so a double-click or a network retry reuses the
  // very same quote instead of creating a new number.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const totals = useMemo(() => computeEditorTotals(lines), [lines]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    if (clientName.trim().length < 2) return toast.error("Nom du client requis.");
    if (clientAddress.trim().length < 4)
      return toast.error("Adresse du client requise.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clientEmail))
      return toast.error("Email du client invalide.");
    if (validUntil < quoteDate)
      return toast.error("La date de validité doit suivre la date du devis.");

    const parsedLines = lines.map((l) => ({
      type: l.type,
      description: l.description.trim(),
      unit_price_ht: parseNum(l.unit_price_ht),
      quantity: parseNum(l.quantity),
      tva: l.tva,
    }));
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
          quote_request_id: request.id,
          client_name: clientName.trim(),
          client_address: clientAddress.trim(),
          client_email: clientEmail.trim(),
          client_phone: clientPhone.trim() || undefined,
          quote_date: quoteDate,
          valid_until: validUntil,
          notes: notes.trim() || undefined,
          lines: parsedLines,
          idempotency_key: idempotencyKey,
        },
      });

      downloadBase64Pdf(res.pdfBase64, `${res.quoteNumber}.pdf`);
      queryClient.invalidateQueries({ queryKey: ["admin", "quotes"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "quote-request", id] });

      if (res.emailClient.status === "sent") {
        toast.success(
          res.reused
            ? `Devis ${res.quoteNumber} déjà généré — PDF retéléchargé.`
            : `Devis ${res.quoteNumber} généré et envoyé à ${clientEmail.trim()}.`,
        );
        navigate({ to: "/admin/devis" });
      } else {
        toast.warning(
          `Devis ${res.quoteNumber} généré et enregistré, mais l'e-mail au client n'est pas parti. Utilisez « Renvoyer » depuis la liste.`,
          { duration: 10000 },
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(`Échec : ${msg}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
            <Link to="/admin/devis">
              <ArrowLeft className="h-4 w-4" /> Retour aux demandes
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            Traiter la demande de {request.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Complétez les informations, ajoutez les prestations puis envoyez le
            devis PDF au client.
          </p>
        </div>
      </div>

      {existingQuote && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-6 text-sm">
            Un devis <strong>{existingQuote.quote_number}</strong> existe déjà pour
            cette demande (statut : {existingQuote.status}). Générer à nouveau créera
            un devis distinct.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Demande d'origine</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <Detail label="Reçue le" value={formatDate(request.created_at)} />
          <Detail label="Service" value={request.service_type} />
          <Detail label="Téléphone" value={request.phone} />
          <Detail label="Email" value={request.email} />
          {request.urgency && <Detail label="Urgence" value={request.urgency} />}
          {request.address && <Detail label="Adresse" value={request.address} />}
          <div className="md:col-span-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Description
            </p>
            <p className="mt-1 whitespace-pre-line leading-relaxed">
              {request.description}
            </p>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Client & validité</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="qname">Nom / Prénom *</Label>
              <Input
                id="qname"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qemail">Email *</Label>
              <Input
                id="qemail"
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                required
                maxLength={255}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="qaddr">Adresse *</Label>
              <Textarea
                id="qaddr"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                required
                rows={2}
                maxLength={400}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qphone">Téléphone</Label>
              <Input
                id="qphone"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                maxLength={30}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qdate">Date du devis *</Label>
              <Input
                id="qdate"
                type="date"
                value={quoteDate}
                onChange={(e) => {
                  setQuoteDate(e.target.value);
                  if (e.target.value) setValidUntil(addDays(e.target.value, VALIDITY_DAYS));
                }}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qvalid">Valable jusqu'au *</Label>
              <Input
                id="qvalid"
                type="date"
                value={validUntil}
                min={quoteDate}
                onChange={(e) => setValidUntil(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Par défaut : {VALIDITY_DAYS} jours après la date du devis.
              </p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="qnotes">Notes / conditions particulières</Label>
              <Textarea
                id="qnotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Ex : Intervention sous 15 jours après accord. Acompte de 30 % à la commande."
              />
            </div>
          </CardContent>
        </Card>

        <LineItemsEditor title="Prestations du devis" lines={lines} onChange={setLines} />

        <TotalsCard totals={totals} />

        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Génération et envoi…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Générer et envoyer le devis
                <FileDown className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}
