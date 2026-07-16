import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Trash2, Mail, MailOpen } from "lucide-react";
import { toast } from "sonner";

import { formatDate } from "@/lib/utils";
import { listContacts, setContactRead, deleteRecord } from "@/lib/admin.functions";
import { useAdminRealtime } from "@/hooks/use-admin-realtime";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

type Contact = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
};

const contactsQuery = queryOptions({
  queryKey: ["admin", "contacts"],
  queryFn: () => listContacts(),
});

export const Route = createFileRoute("/admin/messages")({
  loader: ({ context }) => context.queryClient.ensureQueryData(contactsQuery),
  component: MessagesPage,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive" role="alert">{error.message}</p>
  ),
});

function MessagesPage() {
  const { data } = useSuspenseQuery(contactsQuery);
  useAdminRealtime("contact_requests", ["admin", "contacts"]);
  const queryClient = useQueryClient();

  const readFn = useServerFn(setContactRead);
  const deleteFn = useServerFn(deleteRecord);
  const [search, setSearch] = useState("");

  const toggleRead = useMutation({
    mutationFn: (vars: { id: string; isRead: boolean }) => readFn({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { table: "contact_requests", id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      toast.success("Message supprimé");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (data as Contact[]).filter(
    (r) => !search || r.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Messages de contact</h1>
      <Input
        placeholder="Rechercher par nom..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-xs"
      />

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Message</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Aucun message.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id} className={r.is_read ? "" : "font-medium"}>
                <TableCell>
                  {!r.is_read && <span className="block h-2 w-2 rounded-full bg-primary" />}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatDate(r.created_at)}
                </TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.email}</TableCell>
                <TableCell className="max-w-[24rem]">
                  {r.subject && <div className="text-xs text-muted-foreground">{r.subject}</div>}
                  <div className="truncate" title={r.message}>{r.message}</div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    title={r.is_read ? "Marquer non lu" : "Marquer lu"}
                    onClick={() => toggleRead.mutate({ id: r.id, isRead: !r.is_read })}
                  >
                    {r.is_read ? <Mail className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer ce message ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action est irréversible. Le message de {r.name} sera définitivement supprimé.
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