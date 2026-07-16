import { useState, useId, cloneElement, isValidElement, type ReactElement } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, ShieldCheck, Clock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PageHero } from "@/components/PageHero";
import { submitQuote } from "@/lib/forms.functions";
import { quoteSchema, type QuoteInput } from "@/lib/forms.schemas";
import { useClientIpv4 } from "@/hooks/use-client-ipv4";
import { serviceOptions } from "@/lib/site";

export const Route = createFileRoute("/devis")({
  head: () => ({
    meta: [
      { title: "Devis Plomberie & Chauffage Gratuit à Metz - Plomberie Dupont" },
      { name: "description", content: "Demandez votre devis de plomberie ou chauffage gratuit et sans engagement. Réponse rapide par un artisan à Metz." },
      { property: "og:title", content: "Devis Plomberie & Chauffage Gratuit à Metz - Plomberie Dupont" },
      { property: "og:description", content: "Devis de plomberie gratuit et sans engagement. Réponse rapide." },
      { property: "og:url", content: "/devis" },
    ],
    links: [{ rel: "canonical", href: "/devis" }],
  }),
  component: DevisPage,
});

function DevisPage() {
  const [done, setDone] = useState(false);
  const submit = useServerFn(submitQuote);
  const { trigger, getIpv4 } = useClientIpv4();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<QuoteInput>({
    resolver: zodResolver(quoteSchema),
    defaultValues: { service_type: "", urgency: "" },
  });

  const onSubmit = async (values: QuoteInput) => {
    try {
      await submit({ data: { ...values, client_ipv4: await getIpv4() } });
      setDone(true);
      reset();
      toast.success("Demande de devis envoyée ! Nous revenons vers vous rapidement.");
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
        eyebrow="Devis gratuit"
        title="Devis plomberie & chauffage gratuit à Metz"
        subtitle="Décrivez votre besoin en quelques lignes. Nous vous répondons rapidement avec une estimation claire et sans engagement."
      />

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-3 lg:px-8">
        <aside className="space-y-6 lg:col-span-1">
          {[
            { icon: FileText, t: "Devis clair et détaillé", d: "Chaque ligne est expliquée, sans frais cachés." },
            { icon: Clock, t: "Réponse rapide", d: "Nous traitons votre demande sous 24h ouvrées." },
            { icon: ShieldCheck, t: "Sans engagement", d: "Le devis est gratuit, vous décidez ensuite." },
          ].map((f) => (
            <div key={f.t} className="flex gap-3 rounded-2xl border border-border bg-card p-5 shadow-soft">
              <f.icon className="h-6 w-6 shrink-0 text-accent" />
              <div><p className="font-semibold">{f.t}</p><p className="text-sm text-muted-foreground">{f.d}</p></div>
            </div>
          ))}
        </aside>

        <div className="lg:col-span-2">
          {done ? (
            <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
              <CheckCircle2 className="mx-auto h-14 w-14 text-accent" />
              <h2 className="mt-4 text-2xl font-bold">Merci, c'est bien reçu !</h2>
              <p className="mt-2 text-muted-foreground">Votre demande de devis a été transmise. Nous vous recontactons très vite.</p>
              <div className="mt-6 flex justify-center gap-3">
                <Button variant="outline" onClick={() => setDone(false)}>Nouvelle demande</Button>
                <Button asChild variant="hero"><Link to="/">Retour à l'accueil</Link></Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} onFocus={() => trigger()} className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
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
                <Field label="Adresse des travaux" error={errors.address?.message} optional>
                  <Input {...register("address")} placeholder="Ville ou code postal" />
                </Field>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Type de prestation" error={errors.service_type?.message}>
                  <select {...register("service_type")} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Sélectionnez…</option>
                    {serviceOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </Field>
                <Field label="Urgence" error={errors.urgency?.message} optional>
                  <select {...register("urgency")} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Pas urgent</option>
                    <option value="Cette semaine">Cette semaine</option>
                    <option value="Dès que possible">Dès que possible</option>
                    <option value="Urgence">Urgence immédiate</option>
                  </select>
                </Field>
              </div>
              <Field label="Décrivez vos travaux" error={errors.description?.message}>
                <Textarea {...register("description")} rows={5} placeholder="Ex : remplacement de chaudière, fuite sous l'évier, rénovation de salle de bain…" />
              </Field>
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Envoi…" : "Envoyer ma demande de devis"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">Vos données ne servent qu'à traiter votre demande.</p>
            </form>
          )}
        </div>
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