import { useState, useId, cloneElement, isValidElement, type ReactElement } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, CalendarDays, Clock, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PageHero } from "@/components/PageHero";
import { submitAppointment } from "@/lib/forms.functions";
import { appointmentSchema, type AppointmentInput } from "@/lib/forms.schemas";
import { serviceOptions, timeSlots, site } from "@/lib/site";
import { useClientIpv4 } from "@/hooks/use-client-ipv4";

export const Route = createFileRoute("/rendez-vous")({
  head: () => ({
    meta: [
      { title: "Prendre Rendez-vous Plombier à Metz - Plomberie Dupont" },
      { name: "description", content: "Réservez l'intervention d'un plombier chauffagiste à Metz : choisissez votre date et votre créneau en quelques clics." },
      { property: "og:title", content: "Prendre Rendez-vous Plombier à Metz - Plomberie Dupont" },
      { property: "og:description", content: "Réservez votre créneau d'intervention plomberie en ligne." },
      { property: "og:url", content: "/rendez-vous" },
    ],
    links: [{ rel: "canonical", href: "/rendez-vous" }],
  }),
  component: AppointmentPage,
});

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function AppointmentPage() {
  const [done, setDone] = useState(false);
  const submit = useServerFn(submitAppointment);
  const { trigger, getIpv4 } = useClientIpv4();
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<AppointmentInput>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: { service_type: "", time_slot: "", preferred_date: "" },
  });
  const slot = watch("time_slot");

  const onSubmit = async (values: AppointmentInput) => {
    try {
      await submit({ data: { ...values, client_ipv4: await getIpv4() } });
      setDone(true);
      reset();
      toast.success("Rendez-vous demandé ! Nous confirmons votre créneau rapidement.");
    } catch (err) {
      const msg = err instanceof Error && err.message.includes("Trop de demandes")
        ? err.message
        : "Une erreur est survenue. Réessayez ou appelez-nous.";
      toast.error(msg);
    }
  };

  return (
    <>
      <PageHero
        eyebrow="Rendez-vous"
        title="Prendre rendez-vous avec votre plombier à Metz"
        subtitle="Choisissez le jour et le créneau qui vous arrangent. Nous confirmons votre rendez-vous par téléphone ou e-mail."
      />

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        {done ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
            <CheckCircle2 className="mx-auto h-14 w-14 text-accent" />
            <h2 className="mt-4 text-2xl font-bold">Demande de rendez-vous envoyée !</h2>
            <p className="mt-2 text-muted-foreground">Nous vous recontactons pour confirmer le créneau. Pour une urgence, appelez-nous directement.</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="outline" onClick={() => setDone(false)}>Nouveau rendez-vous</Button>
              <Button asChild variant="urgent"><a href={`tel:${site.phoneRaw}`}><Phone className="h-4 w-4" /> Urgence</a></Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} onFocus={() => trigger()} className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Nom complet" error={errors.name?.message}>
                <Input {...register("name")} placeholder="Jean Dupont" />
              </Field>
              <Field label="Téléphone" error={errors.phone?.message}>
                <Input {...register("phone")} placeholder="06 12 34 56 78" inputMode="tel" />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="E-mail" error={errors.email?.message}>
                <Input {...register("email")} placeholder="jean@email.fr" type="email" />
              </Field>
              <Field label="Prestation souhaitée" error={errors.service_type?.message}>
                <select {...register("service_type")} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Sélectionnez…</option>
                  {serviceOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="preferred_date" className="text-sm font-medium">Date souhaitée</Label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="preferred_date" {...register("preferred_date")} type="date" min={todayStr()} className="pl-9" />
              </div>
              {errors.preferred_date && <p className="text-xs text-destructive">{errors.preferred_date.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-sm font-medium"><Clock className="h-4 w-4 text-accent" /> Créneau horaire</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                {timeSlots.map((ts) => (
                  <button
                    key={ts}
                    type="button"
                    onClick={() => setValue("time_slot", ts, { shouldValidate: true })}
                    className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${slot === ts ? "border-accent bg-accent/10 text-accent" : "border-border hover:border-accent/50"}`}
                  >
                    {ts}
                  </button>
                ))}
              </div>
              {errors.time_slot && <p className="text-xs text-destructive">{errors.time_slot.message}</p>}
            </div>

            <Field label="Précisions" error={errors.notes?.message} optional>
              <Textarea {...register("notes")} rows={3} placeholder="Étage, code d'accès, détails utiles…" />
            </Field>

            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Envoi…" : "Demander ce rendez-vous"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Besoin d'une intervention immédiate ? <Link to="/contact" className="font-medium text-accent">Contactez-nous en urgence</Link>.
            </p>
          </form>
        )}
      </section>
    </>
  );
}

function Field({ label, error, optional, children }: { label: string; error?: string; optional?: boolean; children: React.ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">{label}{optional && <span className="ml-1 text-xs font-normal text-muted-foreground">(optionnel)</span>}</Label>
      {isValidElement(children) ? cloneElement(children as ReactElement<{ id?: string }>, { id }) : children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}