import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { CalendarDays, FileText, Mail } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
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
    <p className="text-sm text-destructive" role="alert">{error.message}</p>
  ),
});

function OverviewPage() {
  const { data } = useSuspenseQuery(statsQuery);
  useAdminRealtime("appointments", ["admin", "stats"]);
  useAdminRealtime("quote_requests", ["admin", "stats"]);
  useAdminRealtime("contact_requests", ["admin", "stats"]);

  const cards = [
    { label: "RDV ce mois-ci", value: data.appointmentsThisMonth, icon: CalendarDays },
    { label: "Devis en attente", value: data.quotesPending, icon: FileText },
    { label: "Messages non lus", value: data.contactsUnread, icon: Mail },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Vue d'ensemble</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rendez-vous par semaine (30 derniers jours)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.weekly}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="label" stroke="currentColor" className="text-xs text-muted-foreground" />
                <YAxis allowDecimals={false} stroke="currentColor" className="text-xs text-muted-foreground" />
                <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}