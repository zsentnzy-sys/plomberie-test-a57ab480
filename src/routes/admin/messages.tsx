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
  Inbox,
  Mail,
  MailOpen,
  Phone,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { formatDate } from "@/lib/utils";
import {
  deleteRecord,
  listContacts,
  setContactRead,
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
    <p className="text-sm text-destructive" role="alert">
      {error.message}
    </p>
  ),
});

function MessagesPage() {
  const { data } = useSuspenseQuery(contactsQuery);
  useAdminRealtime("contact_requests", ["admin", "contacts"]);

  const queryClient = useQueryClient();
  const readFn = useServerFn(setContactRead);
  const deleteFn = useServerFn(deleteRecord);

  const [search, setSearch] = useState("");
  const [readFilter, setReadFilter] = useState("all");

  const contacts = data as Contact[];
  const normalizedSearch = search.trim().toLowerCase();

  const rows = contacts.filter((contact) => {
    if (readFilter === "unread" && contact.is_read) return false;
    if (readFilter === "read" && !contact.is_read) return false;

    if (
      normalizedSearch &&
      ![
        contact.name,
        contact.email,
        contact.phone ?? "",
        contact.subject ?? "",
        contact.message,
      ].some((value) => value.toLowerCase().includes(normalizedSearch))
    ) {
      return false;
    }

    return true;
  });

  const counters = {
    unread: contacts.filter((contact) => !contact.is_read).length,
    read: contacts.filter((contact) => contact.is_read).length,
    total: contacts.length,
  };

  const filtersAreActive = Boolean(search) || readFilter !== "all";

  const toggleRead = useMutation({
    mutationFn: (vars: { id: string; isRead: boolean }) =>
      readFn({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      deleteFn({ data: { table: "contact_requests", id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      toast.success("Message supprimé");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const resetFilters = () => {
    setSearch("");
    setReadFilter("all");
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-sm font-medium text-primary">
            Boîte de réception
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Messages de contact
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Consultez les demandes reçues depuis le site et suivez rapidement
            les messages qui nécessitent encore une réponse.
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
          label="Non lus"
          description="Messages à traiter"
          value={counters.unread}
          icon={Mail}
          iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        />
        <SummaryCard
          label="Lus"
          description="Messages déjà consultés"
          value={counters.read}
          icon={MailOpen}
          iconClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />
        <SummaryCard
          label="Total"
          description="Messages reçus"
          value={counters.total}
          icon={Inbox}
          iconClassName="bg-primary/10 text-primary"
        />
      </section>

      <Card className="overflow-hidden border-border/60 shadow-sm">
        <CardHeader className="gap-4 border-b bg-muted/20">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                Liste des messages
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {rows.length} message{rows.length > 1 ? "s" : ""} affiché
                {rows.length > 1 ? "s" : ""} sur {contacts.length}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="relative sm:w-80">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  placeholder="Nom, email, téléphone, sujet..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-9"
                  aria-label="Rechercher un message"
                />
              </div>

              <Select value={readFilter} onValueChange={setReadFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les messages</SelectItem>
                  <SelectItem value="unread">Non lus</SelectItem>
                  <SelectItem value="read">Lus</SelectItem>
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
                  <TableHead className="w-10 pl-6" />
                  <TableHead>Date</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Message</TableHead>
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

                {rows.map((contact) => (
                  <TableRow
                    key={contact.id}
                    className={
                      contact.is_read
                        ? undefined
                        : "bg-primary/[0.025] font-medium"
                    }
                  >
                    <TableCell className="pl-6 align-top">
                      {!contact.is_read && (
                        <span
                          className="mt-1 block h-2.5 w-2.5 rounded-full bg-primary"
                          title="Message non lu"
                        />
                      )}
                    </TableCell>

                    <TableCell className="whitespace-nowrap align-top">
                      {formatDate(contact.created_at)}
                    </TableCell>

                    <TableCell className="align-top">
                      <div className="font-medium">{contact.name}</div>
                      <div className="mt-1 flex flex-col gap-1 text-xs text-muted-foreground">
                        <a
                          href={`mailto:${contact.email}`}
                          className="inline-flex w-fit items-center gap-1.5 hover:text-foreground"
                        >
                          <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                          {contact.email}
                        </a>
                        {contact.phone && (
                          <a
                            href={`tel:${contact.phone}`}
                            className="inline-flex w-fit items-center gap-1.5 hover:text-foreground"
                          >
                            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                            {contact.phone}
                          </a>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="max-w-xl align-top">
                      {contact.subject && (
                        <div className="mb-1 text-sm font-medium">
                          {contact.subject}
                        </div>
                      )}
                      <p
                        className="line-clamp-3 text-sm leading-relaxed text-muted-foreground"
                        title={contact.message}
                      >
                        {contact.message}
                      </p>
                    </TableCell>

                    <TableCell className="pr-6 text-right align-top">
                      <MessageActions
                        contact={contact}
                        isUpdating={toggleRead.isPending}
                        isDeleting={remove.isPending}
                        onToggleRead={() =>
                          toggleRead.mutate({
                            id: contact.id,
                            isRead: !contact.is_read,
                          })
                        }
                        onDelete={() => remove.mutate(contact.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="divide-y md:hidden">
            {rows.length === 0 ? (
              <div className="px-4 py-14">
                <EmptyState filtersAreActive={filtersAreActive} />
              </div>
            ) : (
              rows.map((contact) => (
                <article
                  key={contact.id}
                  className={
                    contact.is_read
                      ? "space-y-4 p-4"
                      : "space-y-4 bg-primary/[0.025] p-4"
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {!contact.is_read && (
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                        )}
                        <h2 className="truncate font-semibold">{contact.name}</h2>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(contact.created_at)}
                      </p>
                    </div>

                    <MessageActions
                      contact={contact}
                      isUpdating={toggleRead.isPending}
                      isDeleting={remove.isPending}
                      onToggleRead={() =>
                        toggleRead.mutate({
                          id: contact.id,
                          isRead: !contact.is_read,
                        })
                      }
                      onDelete={() => remove.mutate(contact.id)}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                    <a
                      href={`mailto:${contact.email}`}
                      className="inline-flex w-fit items-center gap-2 hover:text-foreground"
                    >
                      <Mail className="h-4 w-4" aria-hidden="true" />
                      {contact.email}
                    </a>
                    {contact.phone && (
                      <a
                        href={`tel:${contact.phone}`}
                        className="inline-flex w-fit items-center gap-2 hover:text-foreground"
                      >
                        <Phone className="h-4 w-4" aria-hidden="true" />
                        {contact.phone}
                      </a>
                    )}
                  </div>

                  <div className="rounded-lg border bg-muted/20 p-3">
                    {contact.subject && (
                      <h3 className="mb-1 text-sm font-semibold">
                        {contact.subject}
                      </h3>
                    )}
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {contact.message}
                    </p>
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
  icon: typeof Mail;
  iconClassName: string;
}) {
  return (
    <Card className="border-border/60 shadow-sm transition-colors hover:border-border">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <div className={`rounded-xl p-3 ${iconClassName}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </CardContent>
    </Card>
  );
}

function MessageActions({
  contact,
  isUpdating,
  isDeleting,
  onToggleRead,
  onDelete,
}: {
  contact: Contact;
  isUpdating: boolean;
  isDeleting: boolean;
  onToggleRead: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="inline-flex items-center">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        title={contact.is_read ? "Marquer comme non lu" : "Marquer comme lu"}
        aria-label={
          contact.is_read ? "Marquer comme non lu" : "Marquer comme lu"
        }
        disabled={isUpdating}
        onClick={onToggleRead}
      >
        {contact.is_read ? (
          <Mail className="h-4 w-4" />
        ) : (
          <MailOpen className="h-4 w-4" />
        )}
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            title="Supprimer le message"
            aria-label="Supprimer le message"
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce message ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le message de {contact.name} sera
              définitivement supprimé.
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
    </div>
  );
}

function EmptyState({
  filtersAreActive,
}: {
  filtersAreActive: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div className="mb-3 rounded-full bg-muted p-3">
        <Inbox className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="font-medium">
        {filtersAreActive
          ? "Aucun message ne correspond aux filtres"
          : "Aucun message reçu"}
      </p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {filtersAreActive
          ? "Modifiez votre recherche ou réinitialisez les filtres."
          : "Les nouveaux messages envoyés depuis le site apparaîtront ici."}
      </p>
    </div>
  );
}