import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Phone, Check, MapPin, CalendarCheck, Home, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { site } from "@/lib/site";

export interface ServiceFAQ {
  q: string;
  a: string;
}

export interface RelatedService {
  to: "/services/depannage" | "/services/chauffage" | "/services/sanitaire" | "/services/debouchage";
  title: string;
  desc: string;
}

export interface ServicePageLayoutProps {
  slug: "depannage" | "chauffage" | "sanitaire" | "debouchage";
  breadcrumbLabel: string;
  eyebrow: string;
  h1: string;
  intro: string;
  situations: { title: string; body: string; items: string[] };
  prestations: { title: string; body: string; items: string[] };
  process: { title: string; body: string; steps: { title: string; desc: string }[] };
  zone: { title: string; body: string };
  reassurance: { title: string; body: string; items: string[] };
  faqTitle: string;
  faqs: ServiceFAQ[];
  ctaTitle: string;
  ctaBody: string;
  related: RelatedService[];
  extraContent?: ReactNode;
}

export function ServicePageLayout(props: ServicePageLayoutProps) {
  const {
    breadcrumbLabel,
    eyebrow,
    h1,
    intro,
    situations,
    prestations,
    process,
    zone,
    reassurance,
    faqTitle,
    faqs,
    ctaTitle,
    ctaBody,
    related,
    extraContent,
  } = props;

  return (
    <>
      {/* Fil d'Ariane */}
      <nav aria-label="Fil d'Ariane" className="border-b border-border bg-secondary/30">
        <ol className="mx-auto flex max-w-7xl flex-wrap items-center gap-1.5 px-4 py-3 text-xs text-muted-foreground sm:px-6 lg:px-8">
          <li className="inline-flex items-center gap-1">
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
            <Link to="/" className="hover:text-foreground">Accueil</Link>
          </li>
          <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
          <li>
            <Link to="/services" className="hover:text-foreground">Services</Link>
          </li>
          <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
          <li aria-current="page" className="font-medium text-foreground">{breadcrumbLabel}</li>
        </ol>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-hero-gradient text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <p className="text-xs font-bold uppercase tracking-widest text-accent mb-2">{eyebrow}</p>
          <h1 className="max-w-4xl text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            {h1}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-primary-foreground/85 sm:text-lg">{intro}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild variant="hero" size="lg">
              <Link to="/devis">Demander un devis <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="outlineLight" size="lg">
              <a href={`tel:${site.phoneRaw}`}>
                <Phone className="h-4 w-4" /> Appeler {site.phoneDisplay}
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Situations */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold sm:text-3xl">{situations.title}</h2>
        <p className="mt-4 max-w-3xl text-muted-foreground">{situations.body}</p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {situations.items.map((it) => (
            <li key={it} className="flex items-start gap-2 rounded-xl border border-border bg-card p-4 text-sm shadow-soft">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Prestations */}
      <section className="bg-secondary/40 py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold sm:text-3xl">{prestations.title}</h2>
          <p className="mt-4 max-w-3xl text-muted-foreground">{prestations.body}</p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {prestations.items.map((it) => (
              <li key={it} className="flex items-start gap-2 rounded-xl border border-border bg-card p-4 text-sm shadow-soft">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Déroulement */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold sm:text-3xl">{process.title}</h2>
        <p className="mt-4 max-w-3xl text-muted-foreground">{process.body}</p>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {process.steps.map((step, idx) => (
            <li key={step.title} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent">
                {idx + 1}
              </span>
              <h3 className="mt-3 font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{step.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Zone */}
      <section className="bg-secondary/40 py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <MapPin className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl">{zone.title}</h2>
              <p className="mt-3 max-w-3xl text-muted-foreground">{zone.body}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Réassurance */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold sm:text-3xl">{reassurance.title}</h2>
        <p className="mt-4 max-w-3xl text-muted-foreground">{reassurance.body}</p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {reassurance.items.map((it) => (
            <li key={it} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      </section>

      {extraContent}

      {/* FAQ */}
      <section className="bg-secondary/40 py-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold sm:text-3xl">{faqTitle}</h2>
          <div className="mt-6 space-y-3">
            {faqs.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-border bg-card p-5 shadow-soft">
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold marker:content-['']">
                  {f.q}
                  <span className="text-accent transition-transform group-open:rotate-45">＋</span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-5 rounded-3xl border border-border bg-card p-8 text-center shadow-soft sm:flex-row sm:text-left">
          <div>
            <h2 className="text-2xl font-bold">{ctaTitle}</h2>
            <p className="mt-1 text-muted-foreground">{ctaBody}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild variant="hero" size="lg">
              <Link to="/devis">Demander un devis <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/rendez-vous"><CalendarCheck className="h-4 w-4" /> Prendre rendez-vous</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href={`tel:${site.phoneRaw}`}><Phone className="h-4 w-4" /> {site.phoneDisplay}</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Services associés */}
      <section className="bg-secondary/40 py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold sm:text-3xl">Services associés</h2>
          <p className="mt-3 text-muted-foreground">Nos autres prestations de plomberie et chauffage à {site.city}.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {related.map((r) => (
              <Link
                key={r.to}
                to={r.to}
                className="group rounded-2xl border border-border bg-card p-5 shadow-soft transition-colors hover:border-accent"
              >
                <h3 className="font-semibold group-hover:text-accent">{r.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{r.desc}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent">
                  En savoir plus <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export function buildServiceJsonLd(params: {
  slug: string;
  name: string;
  description: string;
  breadcrumbLabel: string;
  faqs: ServiceFAQ[];
}) {
  const url = `https://plomberie-test.lovable.app/services/${params.slug}`;
  const service = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: params.name,
    description: params.description,
    url,
    areaServed: [
      { "@type": "City", name: "Metz" },
      { "@type": "City", name: "Montigny-lès-Metz" },
      { "@type": "City", name: "Woippy" },
      { "@type": "City", name: "Marly" },
      { "@type": "City", name: "Maizières-lès-Metz" },
      { "@type": "AdministrativeArea", name: "Eurométropole de Metz" },
    ],
    provider: {
      "@type": "Plumber",
      name: site.name,
      telephone: site.phoneRaw,
      email: site.email,
      address: {
        "@type": "PostalAddress",
        streetAddress: "12 rue des Artisans",
        postalCode: "57000",
        addressLocality: site.city,
        addressCountry: "FR",
      },
      url: "https://plomberie-test.lovable.app/",
    },
  };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: "https://plomberie-test.lovable.app/" },
      { "@type": "ListItem", position: 2, name: "Services", item: "https://plomberie-test.lovable.app/services" },
      { "@type": "ListItem", position: 3, name: params.breadcrumbLabel, item: url },
    ],
  };
  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: params.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  return [service, breadcrumb, faqPage];
}