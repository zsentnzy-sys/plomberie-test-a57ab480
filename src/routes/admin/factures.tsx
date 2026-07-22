import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Plus, Trash2, FileDown, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { generateInvoice } from "@/lib/invoices.functions";
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

// ============================================================
// Informations artisan — modifier ici pour changer l'entête PDF
// ============================================================
const ARTISAN_INFO = {
  company: "Plomberie Dupont",
  fullName: "Jean Dupont",
  address: "12 rue des Artisans\n57000 Metz",
  phone: "+33 6 00 00 00 00",
  email: "contact@plomberie-dupont.fr",
  siret: "SIRET 000 000 000 00000 - APE 4322A",
  iban: "FR76 0000 0000 0000 0000 0000 000",
  bic: "AGRIFRPP",
  legal:
    "Assurance décennale et responsabilité civile professionnelle souscrites. TVA sur les débits. En cas de retard de paiement, indemnité forfaitaire de 40 EUR (art. L441-6 du Code de commerce). Facture payable à réception.",
} as const;

type TvaRate = 0 | 5.5 | 10 | 20;
type LineType = "Service" | "Matériel" | "Taux horaire";
type Payment = "Carte bancaire" | "Virement bancaire" | "Chèque" | "Espèces";

interface Line {
  id: string;
  type: LineType;
  description: string;
  unit_price_ht: string;
  quantity: string;
  tva: TvaRate;
}

function newLine(): Line {
  return {
    id: crypto.randomUUID(),
    type: "Service",
    description: "",
    unit_price_ht: "",
    quantity: "1",
    tva: 20,
  };
}

function fmtEUR(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} EUR`;
}

export const Route = createFileRoute("/admin/factures")({
  component: FacturesPage,
});

function FacturesPage() {
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [payment, setPayment] = useState<Payment>("Virement bancaire");
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    crypto.randomUUID(),
  );

  const submit = useServerFn(generateInvoice);

  const totals = useMemo(() => {
    let totalHT = 0;
    let totalTVA = 0;
    for (const l of lines) {
      const pu = parseFloat(l.unit_price_ht.replace(",", ".")) || 0;
      const qty = parseFloat(l.quantity.replace(",", ".")) || 0;
      const ht = pu * qty;
      totalHT += ht;
      totalTVA += ht * (l.tva / 100);
    }
    return {
      totalHT: Math.round(totalHT * 100) / 100,
      totalTVA: Math.round(totalTVA * 100) / 100,
      totalTTC: Math.round((totalHT + totalTVA) * 100) / 100,
    };
  }, [lines]);

  function updateLine(id: string, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }
  function removeLine(id: string) {
    setLines((ls) => (ls.length === 1 ? ls : ls.filter((l) => l.id !== id)));
  }

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
      const pu = parseFloat(l.unit_price_ht.replace(",", "."));
      const qty = parseFloat(l.quantity.replace(",", "."));
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
          artisan: ARTISAN_INFO,
        },
      });
      // Download in the browser
      downloadBase64Pdf(res.pdfBase64, `${res.invoiceNumber}.pdf`);
      toast.success(
        `Facture ${res.invoiceNumber} générée et envoyée au client et à l'artisan.`,
      );
      // Reset lines only
      setLines([newLine()]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(`Échec : ${msg}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Générer une facture</h1>
        <p className="text-sm text-muted-foreground">
          Le PDF est envoyé au client et à l'artisan puis téléchargé. Aucun
          contenu de facture n'est conservé côté serveur.
        </p>
      </div>

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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Lignes facturées</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLines((ls) => [...ls, newLine()])}
            >
              <Plus className="h-4 w-4" /> Ajouter une ligne
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {lines.map((l, i) => {
              const pu = parseFloat(l.unit_price_ht.replace(",", ".")) || 0;
              const qty = parseFloat(l.quantity.replace(",", ".")) || 0;
              const ttc = pu * qty * (1 + l.tva / 100);
              return (
                <div
                  key={l.id}
                  className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-12"
                >
                  <div className="md:col-span-2">
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={l.type}
                      onValueChange={(v) =>
                        updateLine(l.id, { type: v as LineType })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Service">Service</SelectItem>
                        <SelectItem value="Matériel">Matériel</SelectItem>
                        <SelectItem value="Taux horaire">Taux horaire</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-4">
                    <Label className="text-xs">Description</Label>
                    <Input
                      value={l.description}
                      onChange={(e) =>
                        updateLine(l.id, { description: e.target.value })
                      }
                      placeholder="Ex : Remplacement mitigeur cuisine"
                      maxLength={300}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">PU HT</Label>
                    <Input
                      inputMode="decimal"
                      value={l.unit_price_ht}
                      onChange={(e) =>
                        updateLine(l.id, { unit_price_ht: e.target.value })
                      }
                      placeholder="0,00"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <Label className="text-xs">Qté</Label>
                    <Input
                      inputMode="decimal"
                      value={l.quantity}
                      onChange={(e) =>
                        updateLine(l.id, { quantity: e.target.value })
                      }
                    />
                  </div>
                  <div className="md:col-span-1">
                    <Label className="text-xs">TVA</Label>
                    <Select
                      value={String(l.tva)}
                      onValueChange={(v) =>
                        updateLine(l.id, { tva: parseFloat(v) as TvaRate })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0%</SelectItem>
                        <SelectItem value="5.5">5,5%</SelectItem>
                        <SelectItem value="10">10%</SelectItem>
                        <SelectItem value="20">20%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">Prix TTC</Label>
                    <div className="flex items-center gap-2">
                      <Input readOnly value={fmtEUR(ttc)} className="bg-muted" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLine(l.id)}
                        disabled={lines.length === 1}
                        aria-label={`Supprimer ligne ${i + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid gap-2 pt-6 md:grid-cols-3">
            <TotalBox label="Total HT" value={fmtEUR(totals.totalHT)} />
            <TotalBox label="Total TVA" value={fmtEUR(totals.totalTVA)} />
            <TotalBox
              label="Total TTC"
              value={fmtEUR(totals.totalTTC)}
              accent
            />
          </CardContent>
        </Card>

        <div className="flex justify-end">
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

function TotalBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        accent
          ? "border-primary bg-primary/10"
          : "border-border bg-muted/30"
      }`}
    >
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 text-xl font-bold ${accent ? "text-primary" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function downloadBase64Pdf(base64: string, filename: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}