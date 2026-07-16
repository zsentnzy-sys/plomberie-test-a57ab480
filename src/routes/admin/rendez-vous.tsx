import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { formatDate } from "@/lib/utils";
import {
  listAppointments,
  updateAppointmentStatus,
  deleteRecord,
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

type Appointment = {
  id: string;
  name: string;
  phone: string;
  email: string;
  service_type: string;
  preferred_date: string;
  time_slot: string;
  status: string;
  notes: string | null;
};

const appointmentsQuery = queryOptions({
  queryKey: ["admin", "appointments"],
  queryFn: () => listAppointments(),
});

export const Route = createFileRoute("/admin/rendez-vous")({
  loader: ({ context }) => context.queryClient.ensureQueryData(appointmentsQuery),
  component: AppointmentsPage,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive" role="alert">{error.message}</p>
  ),
});

const STATUS = {
  pending: { label: "En attente", cls: "bg-amber-500/15 text-amber-500" },
  confirmed: { label: "Confirmé", cls: "bg-emerald-500/15 text-emerald-500" },
  cancelled: { label: "Annulé", cls: "bg-destructive/15 text-destructive" },
} as const;

function AppointmentsPage() {
  const { data } = useSuspenseQuery(appointmentsQuery);
  useAdminRealtime("appointments", ["admin", "appointments"]);
  const queryClient = useQueryClient();

  const updateFn = useServerFn(updateAppointmentStatus);
  const deleteFn = useServerFn(deleteRecord);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");

  const updateStatus = useMutation({
    mutationFn: (vars: { id: string; status: string }) => updateFn({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      toast.success("Statut mis à jour");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { table: "appointments", id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      toast.success("Rendez-vous supprimé");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (data as Appointment[]).filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (dateFilter && r.preferred_date !== dateFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Rendez-vous</h1>
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Rechercher par nom..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="confirmed">Confirmé</SelectItem>
            <SelectItem value="cancelled">Annulé</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-44" />
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date & créneau</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Prestation</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Aucun rendez-vous.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{formatDate(r.preferred_date)}</div>
                  <div className="text-xs text-muted-foreground">{r.time_slot}</div>
                </TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.phone}</TableCell>
                <TableCell className="max-w-[14rem] truncate">{r.service_type}</TableCell>
                <TableCell>
                  <Select
                    value={r.status}
                    onValueChange={(status) => updateStatus.mutate({ id: r.id, status })}
                  >
                    <SelectTrigger className={`h-7 w-32 border-0 text-xs ${STATUS[r.status as keyof typeof STATUS]?.cls ?? ""}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="confirmed">Confirmé</SelectItem>
                      <SelectItem value="cancelled">Annulé</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer ce rendez-vous ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action est irréversible. Le rendez-vous de {r.name} sera définitivement supprimé.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove.mutate(r.id)}>Supprimer</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}