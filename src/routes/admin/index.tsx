import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { CalendarDays, FileText, Mail, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Rectangle,
} from "recharts";

import { getAdminStats } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminRealtime } from "@/hooks/use-admin-realtime";

const statsQuery = queryOptions({
  queryKey: ["admin", "stats"],
  queryFn: () => getAdminStats(),
});

export const Route = createFileRoute("/admin/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(statsQuery),
  component: OverviewPage,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive" role="alert">
      {error.message}
    </p>
  ),
});

function OverviewPage() {
  const { data } = useSuspenseQuery(statsQuery);

  useAdminRealtime("appointments", ["admin", "stats"]);
  useAdminRealtime("quote_requests", ["admin", "stats"]);
  useAdminRealtime("contact_requests", ["admin", "stats"]);

  const cards = [
    {
      label: "Rendez-vous",
      value: data.appointmentsThisMonth,
      description: "Planifiés ce mois-ci",
      icon: CalendarDays,
      iconClassName: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      status: "Ce mois-ci",
    },
    {
      label: "Devis",
      value: data.quotesPending,
      description: "En attente de traitement",
      icon: FileText,
      iconClassName: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      status: "À traiter",
    },
    {
      label: "Messages",
      value: data.contactsUnread,
      description: "Non lus actuellement",
      icon: Mail,
      iconClassName: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      status: "À consulter",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-sm font-medium text-primary">
            Tableau de bord
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Vue d&apos;ensemble
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Suivez rapidement les demandes clients et l&apos;activité de votre
            entreprise.
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Card
            key={card.label}
            className="group relative overflow-hidden border-border/60 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
              <div className="space-y-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </CardTitle>
                <p className="text-xs text-muted-foreground/80">
                  {card.description}
                </p>
              </div>

              <div className={`rounded-xl p-2.5 ${card.iconClassName}`}>
                <card.icon className="h-5 w-5" aria-hidden="true" />
              </div>
            </CardHeader>

            <CardContent className="flex items-end justify-between gap-4">
              <div className="text-3xl font-bold tracking-tight sm:text-4xl">
                {card.value}
              </div>
              <span className="mb-1 text-xs font-medium text-muted-foreground">
                {card.status}
              </span>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="overflow-hidden border-border/60 shadow-sm">
        <CardHeader className="flex flex-col gap-3 border-b bg-muted/20 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">
              Activité des rendez-vous
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Nombre de rendez-vous par semaine sur les 30 derniers jours
            </p>
          </div>

          <div className="inline-flex w-fit items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs font-medium text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />
            30 derniers jours
          </div>
        </CardHeader>

        <CardContent className="px-2 pb-4 pt-6 sm:px-6">
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.weekly}
                margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border/70"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                  dy={8}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                />
                <Tooltip
                  // CORRECTION 1 : On sépare le fill et l'opacity pour éviter le bug du carré noir
                  cursor={false}
                  contentStyle={{
                    borderRadius: "0.75rem",
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--popover))",
                    color: "hsl(var(--popover-foreground))",
                    boxShadow: "0 10px 30px -12px rgb(0 0 0 / 0.25)",
                  }}
                  labelStyle={{ fontWeight: 600, marginBottom: "0.25rem" }}
                  formatter={(value) => [value as number, "Rendez-vous"]}
                />
                <Bar
                  dataKey="count"
                  // Couleur de base des barres : un joli bleu clair (équivalent au blue-400 de Tailwind)
                  fill="#60A5FA" 
                  radius={[6, 6, 0, 0]}
                  maxBarSize={56}
                  // Couleur au survol : un bleu légèrement plus foncé/intense (blue-500) pour marquer l'action
                  activeBar={<Rectangle fill="#3B82F6" />} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}