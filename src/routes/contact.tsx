import { useState, useId, cloneElement, isValidElement, type ReactElement } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Phone, Mail, MapPin, Clock, MessageCircle, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { submitContact } from "@/lib/forms.functions";
import { contactSchema, type ContactInput } from "@/lib/forms.schemas";
import { site } from "@/lib/site";
import { useClientIpv4 } from "@/hooks/use-client-ipv4";

const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "Plumber",
  name: site.name,
  telephone: site.phoneRaw,
  email: site.email,
  url: "https://plomberie-test.lovable.app/contact",
  address: {
    "@type": "PostalAddress",
    streetAddress: "12 rue des Artisans",
    postalCode: "57000",
    addressLocality: site.city,
    addressCountry: "FR",
  },
  areaServed: site.zone,
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      opens: "08:00",
      closes: "19:00",
    },
  ],
};

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact & Urgences 24/7 - Plombier à Metz - Plomberie Dupont" },
      { name: "description", content: "Contactez votre plombier chauffagiste à Metz : téléphone, WhatsApp et formulaire. Urgences plomberie 24h/24 et 7j/7." },
      { property: "og:title", content: "Contact & Urgences 24/7 - Plombier à Metz - Plomberie Dupont" },
      { property: "og:description", content: "Téléphone, WhatsApp et formulaire. Urgences 24/7." },
      { property: "og:url", content: "https://plomberie-test.lovable.app/contact" },
    ],
    links: [{ rel: "canonical", href: "https://plomberie-test.lovable.app/contact" }],
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(localBusinessJsonLd) },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [done, setDone] = useState(false);
  const submit = useServerFn(submitContact);
  const { trigger, getIpv4 } = useClientIpv4();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = async (values: ContactInput) => {
    try {
      await submit({ data: { ...values, client_ipv4: await getIpv4() } });
      setDone(true);
      reset();
      toast.success("Message envoyé ! Nous vous répondons rapidement.");
    } catch (err) {
      const msg = err instanceof Error && err.message.includes("Trop de demandes")
        ? err.message
        : "Une erreur est survenue. Réessayez ou appelez-nous.";
      toast.error(msg);
    }
  };

  return (
    <>
      {/* Page hero with the single H1 */}
      <section className="bg-hero-gradient text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-20 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">Contact</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
            Contact & urgences — plombier chauffagiste à {site.city}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-primary-foreground/80">
            Une question, une urgence ou un projet ? Joignez votre artisan plombier à {site.city} par téléphone, WhatsApp, e-mail ou via le formulaire.
          </p>
        </div>
      </section>

      {/* Urgence band */}
      <section className="bg-urgent text-urgent-foreground">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 sm:px-6 lg:flex-row lg:px-8">
          <div className="flex items-center gap-3">
            <Siren className="h-8 w-8" />
            <div>
              <h2 className="text-2xl font-bold">Urgence plomberie ? Appelez maintenant.</h2>
              <p className="text-urgent-foreground/85">Disponibles 24h/24 et 7j/7 sur {site.city} et alentours.</p>
            </div>
          </div>
          <Button asChild size="xl" className="bg-urgent-foreground text-urgent hover:bg-urgent-foreground/90">
            <a href={`tel:${site.phoneRaw}`}><Phone className="h-5 w-5" /> {site.phoneDisplay}</a>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div>
          <h2 className="text-3xl font-bold sm:text-4xl">Contactez-nous</h2>
          <p className="mt-3 text-muted-foreground">Une question, un projet ? Écrivez-nous ou joignez-nous directement.</p>
          <ul className="mt-8 space-y-4">
            <ContactItem icon={Phone} label="Téléphone" value={site.phoneDisplay} href={`tel:${site.phoneRaw}`} />
            <ContactItem icon={MessageCircle} label="WhatsApp" value="Discuter sur WhatsApp" href={`https://wa.me/${site.whatsapp}`} external />
            <ContactItem icon={Mail} label="E-mail" value={site.email} href={`mailto:${site.email}`} />
            <ContactItem icon={MapPin} label="Adresse" value={site.address} />
            <ContactItem icon={Clock} label="Horaires" value={site.hours} />
          </ul>
          <div className="mt-8 rounded-2xl border border-border bg-secondary/40 p-5">
            <p className="text-sm font-semibold">Zone d'intervention</p>
            <p className="mt-1 text-sm text-muted-foreground">{site.zone}</p>
          </div>
        </div>

        <div>
          {done ? (
            <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
              <CheckCircle2 className="mx-auto h-14 w-14 text-accent" />
              <h2 className="mt-4 text-2xl font-bold">Message envoyé !</h2>
              <p className="mt-2 text-muted-foreground">Merci, nous vous répondrons dans les meilleurs délais.</p>
              <Button variant="outline" className="mt-6" onClick={() => setDone(false)}>Envoyer un autre message</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} onFocus={() => trigger()} className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Nom" error={errors.name?.message}><Input {...register("name")} placeholder="Jean Dupont" /></Field>
                <Field label="Téléphone" error={errors.phone?.message} optional><Input {...register("phone")} placeholder="06 12 34 56 78" inputMode="tel" /></Field>
              </div>
              <Field label="E-mail" error={errors.email?.message}><Input {...register("email")} type="email" placeholder="jean@email.fr" /></Field>
              <Field label="Sujet" error={errors.subject?.message} optional><Input {...register("subject")} placeholder="Objet de votre message" /></Field>
              <Field label="Message" error={errors.message?.message}><Textarea {...register("message")} rows={5} placeholder="Comment pouvons-nous vous aider ?" /></Field>
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Envoi…" : "Envoyer le message"}
              </Button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}

function ContactItem({ icon: Icon, label, value, href, external }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; href?: string; external?: boolean }) {
  const content = (
    <span className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent"><Icon className="h-5 w-5" /></span>
      <span><span className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span><span className="font-medium text-foreground">{value}</span></span>
    </span>
  );
  if (href) return <li><a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="block transition-opacity hover:opacity-80">{content}</a></li>;
  return <li>{content}</li>;
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