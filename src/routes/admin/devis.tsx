import { createFileRoute } from "@tanstack/react-router";
import {
  queryOptions,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  CheckCircle2,
  Clock3,
  FileText,
  Mail,
  Phone,
  RotateCcw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { formatDate } from "@/lib/utils";
import {
  deleteRecord,
  listQuotes,
  updateQuoteStatus,
} from "@/lib/admin.functions";
import { useAdminRealtime } from "@/hooks/use-admin-realtime";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type QuoteStatus = "pending" | "confirmed" | "cancelled";

type Quote = {
  id: string;
  name: string;
  phone: string;
  email: string;
  service_type: string;
  description: string;
  status: QuoteStatus;
  created_at: string;
};

const quotesQuery = queryOptions({
  queryKey: ["admin", "quotes"],
  queryFn: () => listQuotes(),
});

const statusConfig: Record<
  QuoteStatus,
  { label: string; className: string; icon: typeof Clock3 }
> = {
  pending: {
    label: "En attente",
    className:
      "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    icon: Clock3,
  },
  confirmed: {
    label: "Traité",
    className:
      "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Refusé",
    className:
      "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-400",
    icon: XCircle,
  },
};

export const Route = createFileRoute("/admin/devis")({
  loader: ({ context }) => context.queryClient.ensureQueryData(quotesQuery),
  component: QuotesPage,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive" role="alert">
      {error.message}
    </p>
  ),
});

function QuotesPage() {
  const { data } = useSuspenseQuery(quotesQuery);
  useAdminRealtime("quote_requests", ["admin", "quotes"]);

  const queryClient = useQueryClient();
  const updateFn = useServerFn(updateQuoteStatus);
  const deleteFn = useServerFn(deleteRecord);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const quotes = data as Quote[];
  const normalizedSearch = search.trim().toLowerCase();

  const rows = quotes.filter((quote) => {
    if (statusFilter !== "all" && quote.status !== statusFilter) return false;

    if (
      normalizedSearch &&
      ![quote.name, quote.email, quote.phone, quote.service_type].some((value) =>
        value.toLowerCase().includes(normalizedSearch),
      )
    ) {
      return false;
    }

    return true;
  });

  const counters = {
    pending: quotes.filter((quote) => quote.status === "pending").length,
    confirmed: quotes.filter((quote) => quote.status === "confirmed").length,
    cancelled: quotes.filter((quote) => quote.status === "cancelled").length,
  };

  const filtersAreActive = Boolean(search) || statusFilter !== "all";

  const updateStatus = useMutation({
    mutationFn: (vars: { id: string; status: QuoteStatus }) =>
      updateFn({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "quotes"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      toast.success("Statut mis à jour");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      deleteFn({ data: { table: "quote_requests", id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "quotes"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      toast.success("Demande supprimée");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-sm font-medium text-primary">Gestion commerciale</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Demandes de devis
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Retrouvez les besoins de vos prospects et suivez leur traitement en
            temps réel.
          </p>
        </div>

        <div className="inline-flex w-fit items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Données synchronisées en temps réel
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="En attente"
          description="À examiner ou rappeler"
          value={counters.pending}
          icon={Clock3}
          iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        />
        <SummaryCard
          label="Traités"
          description="Demandes prises en charge"
          value={counters.confirmed}
          icon={CheckCircle2}
          iconClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />
        <SummaryCard
          label="Refusés"
          description="Demandes non retenues"
          value={counters.cancelled}
          icon={XCircle}
          iconClassName="bg-rose-500/10 text-rose-600 dark:text-rose-400"
        />
      </section>

      <Card className="overflow-hidden border-border/60 shadow-sm">
        <CardHeader className="gap-4 border-b bg-muted/20">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                Liste des demandes
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {rows.length} demande{rows.length > 1 ? "s" : ""} affichée
                {rows.length > 1 ? "s" : ""} sur {quotes.length}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative sm:w-72">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  placeholder="Nom, email, téléphone, service..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-9"
                  aria-label="Rechercher une demande de devis"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="confirmed">Traité</SelectItem>
                  <SelectItem value="cancelled">Refusé</SelectItem>
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
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Besoin</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48">
                      <EmptyState filtersAreActive={filtersAreActive} />
                    </TableCell>
                  </TableRow>
                )}

                {rows.map((quote) => (
                  <TableRow
                    key={quote.id}
                    className={
                      quote.status === "pending" ? "bg-amber-500/[0.025]" : undefined
                    }
                  >
                    <TableCell className="whitespace-nowrap pl-6 align-top text-sm text-muted-foreground">
                      {formatDate(quote.created_at)}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="font-medium">{quote.name}</div>
                      <div className="mt-1 flex flex-col gap-1 text-xs text-muted-foreground">
                        <a
                          href={`mailto:${quote.email}`}
                          className="inline-flex w-fit items-center gap-1.5 hover:text-foreground"
                        >
                          <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                          {quote.email}
                        </a>
                        <a
                          href={`tel:${quote.phone}`}
                          className="inline-flex w-fit items-center gap-1.5 hover:text-foreground"
                        >
                          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                          {quote.phone}
                        </a>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md align-top">
                      <span className="inline-flex rounded-md border bg-muted/50 px-2 py-1 text-xs font-medium">
                        {quote.service_type}
                      </span>
                      <p
                        className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground"
                        title={quote.description}
                      >
                        {quote.description}
                      </p>
                    </TableCell>
                    <TableCell className="align-top">
                      <StatusSelect
                        quote={quote}
                        disabled={updateStatus.isPending}
                        onChange={(status) =>
                          updateStatus.mutate({ id: quote.id, status })
                        }
                      />
                    </TableCell>
                    <TableCell className="pr-6 text-right align-top">
                      <DeleteQuoteButton
                        quote={quote}
                        disabled={remove.isPending}
                        onDelete={() => remove.mutate(quote.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="divide-y md:hidden">
            {rows.length === 0 ? (
              <div className="px-6 py-14">
                <EmptyState filtersAreActive={filtersAreActive} />
              </div>
            ) : (
              rows.map((quote) => (
                <article key={quote.id} className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{quote.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(quote.created_at)}
                      </p>
                    </div>
                    <DeleteQuoteButton
                      quote={quote}
                      disabled={remove.isPending}
                      onDelete={() => remove.mutate(quote.id)}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <a
                      href={`tel:${quote.phone}`}
                      className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-muted-foreground"
                    >
                      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                      {quote.phone}
                    </a>
                    <a
                      href={`mailto:${quote.email}`}
                      className="inline-flex min-w-0 items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-muted-foreground"
                    >
                      <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{quote.email}</span>
                    </a>
                  </div>

                  <div>
                    <span className="inline-flex rounded-md border bg-muted/50 px-2 py-1 text-xs font-medium">
                      {quote.service_type}
                    </span>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {quote.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t pt-4">
                    <span className="text-xs font-medium text-muted-foreground">
                      Statut de la demande
                    </span>
                    <StatusSelect
                      quote={quote}
                      disabled={updateStatus.isPending}
                      onChange={(status) =>
                        updateStatus.mutate({ id: quote.id, status })
                      }
                    />
                  </div>
                </article>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  description,
  value,
  icon: Icon,
  iconClassName,
}: {
  label: string;
  description: string;
  value: number;
  icon: typeof Clock3;
  iconClassName: string;
}) {
  return (
    <Card className="group relative overflow-hidden border-border/60 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {label}
          </CardTitle>
          <p className="text-xs text-muted-foreground/80">{description}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${iconClassName}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight sm:text-4xl">{value}</div>
      </CardContent>
    </Card>
  );
}

function StatusSelect({
  quote,
  disabled,
  onChange,
}: {
  quote: Quote;
  disabled: boolean;
  onChange: (status: QuoteStatus) => void;
}) {
  const config = statusConfig[quote.status];

  return (
    <Select
      value={quote.status}
      disabled={disabled}
      onValueChange={(status) => onChange(status as QuoteStatus)}
    >
      <SelectTrigger
        className={`h-8 w-32 border text-xs font-medium shadow-none ${config.className}`}
        aria-label={`Modifier le statut de la demande de ${quote.name}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="pending">En attente</SelectItem>
        <SelectItem value="confirmed">Traité</SelectItem>
        <SelectItem value="cancelled">Refusé</SelectItem>
      </SelectContent>
    </Select>
  );
}

function DeleteQuoteButton({
  quote,
  disabled,
  onDelete,
}: {
  quote: Quote;
  disabled: boolean;
  onDelete: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Supprimer la demande de ${quote.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer cette demande ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est irréversible. La demande de {quote.name} sera
            définitivement supprimée.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={onDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function EmptyState({ filtersAreActive }: { filtersAreActive: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div className="mb-3 rounded-xl bg-muted p-3 text-muted-foreground">
        <FileText className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="font-medium">
        {filtersAreActive ? "Aucun résultat trouvé" : "Aucune demande de devis"}
      </p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {filtersAreActive
          ? "Modifiez votre recherche ou vos filtres pour afficher d’autres demandes."
          : "Les nouvelles demandes reçues depuis le site apparaîtront ici."}
      </p>
    </div>
  );
}