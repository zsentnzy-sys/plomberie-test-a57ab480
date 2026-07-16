import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { formatDate } from "@/lib/utils";
import { listQuotes, updateQuoteStatus, deleteRecord } from "@/lib/admin.functions";
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

type Quote = {
  id: string;
  name: string;
  phone: string;
  email: string;
  service_type: string;
  description: string;
  status: string;
  created_at: string;
};

const quotesQuery = queryOptions({
  queryKey: ["admin", "quotes"],
  queryFn: () => listQuotes(),
});

export const Route = createFileRoute("/admin/devis")({
  loader: ({ context }) => context.queryClient.ensureQueryData(quotesQuery),
  component: QuotesPage,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive" role="alert">{error.message}</p>
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

  const updateStatus = useMutation({
    mutationFn: (vars: { id: string; status: string }) => updateFn({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "quotes"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      toast.success("Statut mis à jour");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { table: "quote_requests", id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "quotes"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      toast.success("Demande supprimée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (data as Quote[]).filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Demandes de devis</h1>
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
            <SelectItem value="confirmed">Traité</SelectItem>
            <SelectItem value="cancelled">Refusé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Besoin</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Aucune demande de devis.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">
                  {formatDate(r.created_at)}
                </TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.phone}</TableCell>
                <TableCell className="max-w-[20rem]">
                  <div className="truncate" title={r.description}>{r.description}</div>
                  <div className="text-xs text-muted-foreground">{r.service_type}</div>
                </TableCell>
                <TableCell>
                  <Select
                    value={r.status}
                    onValueChange={(status) => updateStatus.mutate({ id: r.id, status })}
                  >
                    <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="confirmed">Traité</SelectItem>
                      <SelectItem value="cancelled">Refusé</SelectItem>
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
                        <AlertDialogTitle>Supprimer cette demande ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action est irréversible. La demande de {r.name} sera définitivement supprimée.
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