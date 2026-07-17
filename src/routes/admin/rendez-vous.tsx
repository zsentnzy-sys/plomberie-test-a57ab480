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
  CalendarDays,
  CheckCircle2,
  Clock3,
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
  listAppointments,
  updateAppointmentStatus,
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

type AppointmentStatus = "pending" | "confirmed" | "cancelled";

type Appointment = {
  id: string;
  name: string;
  phone: string;
  email: string;
  service_type: string;
  preferred_date: string;
  time_slot: string;
  status: AppointmentStatus;
  notes: string | null;
};

const appointmentsQuery = queryOptions({
  queryKey: ["admin", "appointments"],
  queryFn: () => listAppointments(),
});

const statusConfig: Record<
  AppointmentStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "En attente",
    className:
      "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  confirmed: {
    label: "Confirmé",
    className:
      "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  cancelled: {
    label: "Annulé",
    className:
      "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  },
};

export const Route = createFileRoute("/admin/rendez-vous")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(appointmentsQuery),
  component: AppointmentsPage,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive" role="alert">
      {error.message}
    </p>
  ),
});

function AppointmentsPage() {
  const { data } = useSuspenseQuery(appointmentsQuery);
  useAdminRealtime("appointments", ["admin", "appointments"]);

  const queryClient = useQueryClient();
  const updateFn = useServerFn(updateAppointmentStatus);
  const deleteFn = useServerFn(deleteRecord);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");

  const appointments = data as Appointment[];
  const normalizedSearch = search.trim().toLowerCase();

  const rows = appointments.filter((appointment) => {
    if (statusFilter !== "all" && appointment.status !== statusFilter) {
      return false;
    }

    if (dateFilter && appointment.preferred_date !== dateFilter) return false;

    if (
      normalizedSearch &&
      ![
        appointment.name,
        appointment.email,
        appointment.phone,
        appointment.service_type,
        appointment.notes ?? "",
      ].some((value) => value.toLowerCase().includes(normalizedSearch))
    ) {
      return false;
    }

    return true;
  });

  const counters = {
    pending: appointments.filter(
      (appointment) => appointment.status === "pending",
    ).length,
    confirmed: appointments.filter(
      (appointment) => appointment.status === "confirmed",
    ).length,
    cancelled: appointments.filter(
      (appointment) => appointment.status === "cancelled",
    ).length,
  };

  const filtersAreActive =
    Boolean(search) || statusFilter !== "all" || Boolean(dateFilter);

  const updateStatus = useMutation({
    mutationFn: (vars: { id: string; status: AppointmentStatus }) =>
      updateFn({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      toast.success("Statut mis à jour");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      deleteFn({ data: { table: "appointments", id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      toast.success("Rendez-vous supprimé");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setDateFilter("");
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-sm font-medium text-primary">
            Gestion du planning
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Rendez-vous
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Consultez les demandes, organisez les créneaux et suivez leur
            confirmation en temps réel.
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
          description="À confirmer ou rappeler"
          value={counters.pending}
          icon={Clock3}
          iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        />
        <SummaryCard
          label="Confirmés"
          description="Créneaux validés"
          value={counters.confirmed}
          icon={CheckCircle2}
          iconClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />
        <SummaryCard
          label="Annulés"
          description="Rendez-vous non maintenus"
          value={counters.cancelled}
          icon={XCircle}
          iconClassName="bg-rose-500/10 text-rose-600 dark:text-rose-400"
        />
      </section>

      <Card className="overflow-hidden border-border/60 shadow-sm">
        <CardHeader className="gap-4 border-b bg-muted/20">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                Liste des rendez-vous
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {rows.length} rendez-vous affiché{rows.length > 1 ? "s" : ""}{" "}
                sur {appointments.length}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="relative sm:w-72">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  placeholder="Nom, email, téléphone, prestation..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-9"
                  aria-label="Rechercher un rendez-vous"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="confirmed">Confirmé</SelectItem>
                  <SelectItem value="cancelled">Annulé</SelectItem>
                </SelectContent>
              </Select>

              <Input
                type="date"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
                className="w-full sm:w-44"
                aria-label="Filtrer par date"
              />

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
                  <TableHead className="pl-6">Date et créneau</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Prestation</TableHead>
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

                {rows.map((appointment) => (
                  <TableRow
                    key={appointment.id}
                    className={
                      appointment.status === "pending"
                        ? "bg-amber-500/[0.025]"
                        : undefined
                    }
                  >
                    <TableCell className="whitespace-nowrap pl-6 align-top">
                      <div className="font-medium">
                        {formatDate(appointment.preferred_date)}
                      </div>
                      <div className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                        {appointment.time_slot}
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      <div className="font-medium">{appointment.name}</div>
                      <div className="mt-1 flex flex-col gap-1 text-xs text-muted-foreground">
                        <a
                          href={`mailto:${appointment.email}`}
                          className="inline-flex w-fit items-center gap-1.5 hover:text-foreground"
                        >
                          <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                          {appointment.email}
                        </a>
                        <a
                          href={`tel:${appointment.phone}`}
                          className="inline-flex w-fit items-center gap-1.5 hover:text-foreground"
                        >
                          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                          {appointment.phone}
                        </a>
                      </div>
                    </TableCell>

                    <TableCell className="max-w-md align-top">
                      <span className="inline-flex rounded-md border bg-muted/50 px-2 py-1 text-xs font-medium">
                        {appointment.service_type}
                      </span>
                      {appointment.notes && (
                        <p
                          className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground"
                          title={appointment.notes}
                        >
                          {appointment.notes}
                        </p>
                      )}
                    </TableCell>

                    <TableCell className="align-top">
                      <StatusSelect
                        appointment={appointment}
                        disabled={updateStatus.isPending}
                        onChange={(status) =>
                          updateStatus.mutate({ id: appointment.id, status })
                        }
                      />
                    </TableCell>

                    <TableCell className="pr-6 text-right align-top">
                      <DeleteAppointmentButton
                        appointment={appointment}
                        disabled={remove.isPending}
                        onDelete={() => remove.mutate(appointment.id)}
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
              rows.map((appointment) => (
                <article key={appointment.id} className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {appointment.name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          {formatDate(appointment.preferred_date)}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                          {appointment.time_slot}
                        </span>
                      </div>
                    </div>

                    <DeleteAppointmentButton
                      appointment={appointment}
                      disabled={remove.isPending}
                      onDelete={() => remove.mutate(appointment.id)}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <a
                      href={`tel:${appointment.phone}`}
                      className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-muted-foreground"
                    >
                      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                      {appointment.phone}
                    </a>
                    <a
                      href={`mailto:${appointment.email}`}
                      className="inline-flex min-w-0 items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-muted-foreground"
                    >
                      <Mail
                        className="h-3.5 w-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="truncate">{appointment.email}</span>
                    </a>
                  </div>

                  <div>
                    <span className="inline-flex rounded-md border bg-muted/50 px-2 py-1 text-xs font-medium">
                      {appointment.service_type}
                    </span>
                    {appointment.notes && (
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {appointment.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t pt-4">
                    <span className="text-xs font-medium text-muted-foreground">
                      Statut du rendez-vous
                    </span>
                    <StatusSelect
                      appointment={appointment}
                      disabled={updateStatus.isPending}
                      onChange={(status) =>
                        updateStatus.mutate({ id: appointment.id, status })
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
        <div className="text-3xl font-bold tracking-tight sm:text-4xl">
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusSelect({
  appointment,
  disabled,
  onChange,
}: {
  appointment: Appointment;
  disabled: boolean;
  onChange: (status: AppointmentStatus) => void;
}) {
  const config = statusConfig[appointment.status];

  return (
    <Select
      value={appointment.status}
      disabled={disabled}
      onValueChange={(status) => onChange(status as AppointmentStatus)}
    >
      <SelectTrigger
        className={`h-8 w-32 border text-xs font-medium shadow-none ${config.className}`}
        aria-label={`Modifier le statut du rendez-vous de ${appointment.name}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="pending">En attente</SelectItem>
        <SelectItem value="confirmed">Confirmé</SelectItem>
        <SelectItem value="cancelled">Annulé</SelectItem>
      </SelectContent>
    </Select>
  );
}

function DeleteAppointmentButton({
  appointment,
  disabled,
  onDelete,
}: {
  appointment: Appointment;
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
          aria-label={`Supprimer le rendez-vous de ${appointment.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer ce rendez-vous ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est irréversible. Le rendez-vous de {appointment.name}
            sera définitivement supprimé.
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
        <CalendarDays className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="font-medium">
        {filtersAreActive ? "Aucun résultat trouvé" : "Aucun rendez-vous"}
      </p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {filtersAreActive
          ? "Modifiez votre recherche ou vos filtres pour afficher d’autres rendez-vous."
          : "Les nouvelles demandes de rendez-vous reçues depuis le site apparaîtront ici."}
      </p>
    </div>
  );
}