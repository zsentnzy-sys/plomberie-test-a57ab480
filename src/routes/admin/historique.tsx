import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  ExternalLink,
  FileText,
  Loader2,
  Receipt,
  RotateCcw,
  Search,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { formatDate } from "@/lib/utils";
import {
  listDocuments,
  type DocumentKind,
  type HistoryRow,
} from "@/lib/history.functions";
import { getInvoicePdfSignedUrl, resendInvoiceEmail } from "@/lib/invoices.functions";
import { getQuotePdfSignedUrl, resendQuoteEmail } from "@/lib/quotes.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/historique")({
  component: HistoryPage,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive" role="alert">
      {error.message}
    </p>
  ),
});

const statusLabels: Record<string, { label: string; className: string }> = {
  sent: {
    label: "Envoyé",
    className:
      "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  partially_sent: {
    label: "Envoi partiel",
    className:
      "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  send_failed: {
    label: "Échec d'envoi",
    className:
      "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  },
  ready: {
    label: "Prêt à envoyer",
    className: "border-border bg-muted/60 text-muted-foreground",
  },
  sending: {
    label: "Envoi en cours",
    className: "border-border bg-muted/60 text-muted-foreground",
  },
  generating: {
    label: "Génération…",
    className: "border-border bg-muted/60 text-muted-foreground",
  },
  generation_failed: {
    label: "Échec de génération",
    className:
      "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  },
  cancelled: {
    label: "Annulé",
    className: "border-border bg-muted/60 text-muted-foreground",
  },
  accepted: {
    label: "Accepté",
    className:
      "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  refused: {
    label: "Refusé",
    className:
      "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  },
  expired: {
    label: "Expiré",
    className: "border-border bg-muted/60 text-muted-foreground",
  },
};

const RESENDABLE = new Set(["ready", "send_failed", "partially_sent"]);

function StatusBadge({ status }: { status: string }) {
  const cfg = statusLabels[status] ?? {
    label: status,
    className: "border-border bg-muted/60 text-muted-foreground",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

function fmtEUR(n: number) {
  return `${n.toFixed(2).replace(".", ",")} EUR`;
}

function HistoryPage() {
  const [kind, setKind] = useState<DocumentKind>("invoice");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [convertTarget, setConvertTarget] = useState<HistoryRow | null>(null);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const list = useServerFn(listDocuments);
  const invoicePdf = useServerFn(getInvoicePdfSignedUrl);
  const quotePdf = useServerFn(getQuotePdfSignedUrl);
  const resendInvoice = useServerFn(resendInvoiceEmail);
  const resendQuote = useServerFn(resendQuoteEmail);

  const queryKey = ["admin", "history", kind, search, status, page] as const;
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: () =>
      list({ data: { kind, search: search.trim() || undefined, status, page } }),
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 25;
  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  const filtersAreActive = Boolean(search) || status !== "all";

  function switchKind(next: DocumentKind) {
    setKind(next);
    setPage(0);
    setStatus("all");
  }

  function resetFilters() {
    setSearch("");
    setStatus("all");
    setPage(0);
  }

  async function openPdf(row: HistoryRow) {
    if (busyId) return;
    setBusyId(row.id);
    try {
      const res =
        row.kind === "invoice"
          ? await invoicePdf({ data: { invoiceId: row.id } })
          : await quotePdf({ data: { quoteId: row.id } });
      window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF indisponible.");
    } finally {
      setBusyId(null);
    }
  }

  async function resend(row: HistoryRow) {
    if (busyId) return;
    setBusyId(row.id);
    try {
      const res =
        row.kind === "invoice"
          ? await resendInvoice({ data: { invoiceId: row.id } })
          : await resendQuote({ data: { quoteId: row.id } });
      const failed: string[] = [];
      if (res.emailClient.status !== "sent")
        failed.push(`client (${res.emailClient.error ?? "erreur"})`);
      if (res.emailArtisan.status !== "sent")
        failed.push(`artisan (${res.emailArtisan.error ?? "erreur"})`);
      if (failed.length === 0) toast.success(`${row.number} : e-mails envoyés.`);
      else
        toast.warning(`${row.number} : échec d'envoi ${failed.join(" · ")}`, {
          duration: 10000,
        });
      queryClient.invalidateQueries({ queryKey: ["admin", "history"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Renvoi impossible.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <p className="mb-1 text-sm font-medium text-primary">Suivi documentaire</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Historique des devis et factures
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Retrouvez tous les documents générés, leur état d'envoi et les actions
          associées.
        </p>
      </section>

      <Card className="overflow-hidden border-border/60 shadow-sm">
        <CardHeader className="gap-4 border-b bg-muted/20">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                {kind === "invoice" ? "Factures" : "Devis"}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {total} document{total > 1 ? "s" : ""} au total
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="inline-flex w-fit rounded-md border bg-card p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={kind === "invoice" ? "secondary" : "ghost"}
                  onClick={() => switchKind("invoice")}
                >
                  <Receipt className="h-4 w-4" /> Factures
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={kind === "quote" ? "secondary" : "ghost"}
                  onClick={() => switchKind("quote")}
                >
                  <FileText className="h-4 w-4" /> Devis
                </Button>
              </div>

              <div className="relative sm:w-64">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  placeholder="Nom, e-mail, numéro..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  className="pl-9"
                  aria-label="Rechercher un document"
                />
              </div>

              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v);
                  setPage(0);
                }}
              >
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="sent">Envoyé</SelectItem>
                  <SelectItem value="partially_sent">Envoi partiel</SelectItem>
                  <SelectItem value="send_failed">Échec d'envoi</SelectItem>
                  <SelectItem value="ready">Prêt à envoyer</SelectItem>
                </SelectContent>
              </Select>

              {filtersAreActive && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={resetFilters}
                  title="Réinitialiser les filtres"
                  aria-label="Réinitialiser les filtres"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isError ? (
            <div className="flex flex-col items-center gap-3 py-16 text-sm">
              <p className="text-destructive" role="alert">
                {error instanceof Error ? error.message : "Erreur de chargement."}
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Réessayer
              </Button>
            </div>
          ) : isPending ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Document</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="whitespace-nowrap">Créé le</TableHead>
                  <TableHead className="text-right">Total TTC</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-40 text-center text-sm text-muted-foreground">
                      {filtersAreActive
                        ? "Aucun document ne correspond à votre recherche."
                        : "Aucun document pour le moment."}
                    </TableCell>
                  </TableRow>
                )}

                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="pl-6 align-top">
                      <div className="font-medium">{row.number}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.kind === "invoice" ? "Facture" : "Devis"}
                      </div>
                      {row.kind === "invoice" && (
                        <div className="mt-1 space-y-1">
                          <span
                            className={
                              row.format === "facturx"
                                ? "inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                                : "inline-block rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                            }
                          >
                            {row.format === "facturx"
                              ? `Factur-X ${row.facturxProfile ?? "EN 16931"}`
                              : "PDF classique"}
                          </span>
                          {row.format === "facturx" &&
                            (() => {
                              const runtime = row.runtimeValidationStatus ?? "pending";
                              return (
                                <div className="space-y-0.5">
                                  <div
                                    className={
                                      runtime === "failed"
                                        ? "text-[11px] text-destructive"
                                        : "text-[11px] text-muted-foreground"
                                    }
                                  >
                                    {runtime === "passed"
                                      ? "Auto-contrôles réussis"
                                      : runtime === "failed"
                                        ? `Auto-contrôles en échec : ${row.validationSummary ?? "erreur interne"}`
                                        : runtime === "not_applicable"
                                          ? "Auto-contrôles non applicables"
                                          : "Auto-contrôles en attente"}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {row.generatorQualificationStatus === "qualified"
                                      ? "Moteur qualifié en CI"
                                      : row.generatorQualificationStatus === "qualification_failed"
                                        ? "Qualification du moteur en échec"
                                        : "Moteur non qualifié"}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {row.externalValidationStatus === "valid"
                                      ? "Validation externe réussie"
                                      : row.externalValidationStatus === "invalid"
                                        ? "Validation externe échouée"
                                        : row.externalValidationStatus === "not_applicable"
                                          ? "Validation externe non applicable"
                                          : "Validation externe non exécutée"}
                                  </div>
                                </div>
                              );
                            })()}
                        </div>
                      )}
                      {row.linkedInvoiceNumber && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Facturé : {row.linkedInvoiceNumber}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs align-top">
                      <div className="font-medium">{row.clientName}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.clientEmail}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {row.clientAddress}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap align-top text-sm text-muted-foreground">
                      {formatDate(row.createdAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap align-top text-right font-medium">
                      {fmtEUR(row.totalTTC)}
                    </TableCell>
                    <TableCell className="align-top">
                      <StatusBadge status={row.status} />
                      {row.sentAt && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Envoyé le {formatDate(row.sentAt)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="pr-6 align-top">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!row.hasPdf || busyId === row.id}
                          title={row.hasPdf ? "Ouvrir le PDF" : "PDF non disponible"}
                          onClick={() => openPdf(row)}
                        >
                          {busyId === row.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ExternalLink className="h-4 w-4" />
                          )}
                          Ouvrir
                        </Button>

                        {RESENDABLE.has(row.status) && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busyId === row.id}
                            onClick={() => resend(row)}
                          >
                            <Send className="h-4 w-4" />
                            Renvoyer
                          </Button>
                        )}

                        {row.kind === "quote" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={!row.convertible}
                            title={row.convertBlockedReason ?? "Transformer en facture"}
                            onClick={() => setConvertTarget(row)}
                          >
                            <Receipt className="h-4 w-4" />
                            Transformer en facture
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {total > pageSize && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page + 1} sur {lastPage + 1}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0 || isFetching}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= lastPage || isFetching}
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}

      <AlertDialog
        open={Boolean(convertTarget)}
        onOpenChange={(open) => !open && setConvertTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transformer en facture ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le devis {convertTarget?.number} restera inchangé. Le formulaire de
              facture s'ouvrira prérempli : vous pourrez tout modifier avant
              validation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const target = convertTarget;
                setConvertTarget(null);
                if (target)
                  navigate({
                    to: "/admin/factures",
                    search: { depuisDevis: target.id },
                  });
              }}
            >
              Continuer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
