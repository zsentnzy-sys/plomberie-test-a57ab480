import { createFileRoute, Link } from "@tanstack/react-router";
import { Wrench, Flame, ShowerHead, Droplets, Check, ArrowRight, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/PageHero";
import { site, services, pricing } from "@/lib/site";

const SITE_URL = "https://plomberie-test.lovable.app";
const servicesJsonLd = {
  "@context": "https://schema.org",
  "@type": "OfferCatalog",
  name: `Services de plomberie et chauffage — ${site.name}`,
  provider: {
    "@type": "LocalBusiness",
    name: site.name,
    telephone: site.phoneRaw,
    address: {
      "@type": "PostalAddress",
      streetAddress: "12 rue des Artisans",
      postalCode: "57000",
      addressLocality: site.city,
      addressCountry: "FR",
    },
  },
  itemListElement: services.map((s) => ({
    "@type": "Offer",
    itemOffered: {
      "@type": "Service",
      name: s.title,
      description: s.desc,
      areaServed: site.city,
      url: `${SITE_URL}/services#${s.slug}`,
    },
  })),
};

export const Route = createFileRoute("/services/")({
  head: () => ({
    meta: [
      { title: "Services & Tarifs Plomberie Chauffage Metz | Dupont" },
      { name: "description", content: "Dépannage, débouchage, entretien et installation de chaudière, rénovation de salle de bain : découvrez nos prestations et une grille de tarifs claire." },
      { property: "og:title", content: "Services & Tarifs Plomberie Chauffage à Metz - Plomberie Dupont" },
      { property: "og:description", content: "Grille de tarifs transparente pour dépannage, chauffage, sanitaire et débouchage." },
      { property: "og:url", content: "https://plomberie-test.lovable.app/services" },
    ],
    links: [{ rel: "canonical", href: "https://plomberie-test.lovable.app/services" }],
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(servicesJsonLd) },
    ],
  }),
  component: ServicesPage,
});

const iconMap = { Wrench, Flame, ShowerHead, Droplets } as const;

const slugToRoute = {
  depannage: "/services/depannage",
  chauffage: "/services/chauffage",
  sanitaire: "/services/sanitaire",
  debouchage: "/services/debouchage",
} as const;

function ServicesPage() {
  return (
    <>
      <PageHero
        eyebrow="Services & Tarifs"
        title="Services & tarifs de plomberie et chauffage à Metz"
        subtitle="Pour chaque intervention, vous savez à quoi vous attendre. Voici nos prestations et une grille de tarifs indicative."
      />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((s) => {
            const Icon = iconMap[s.icon as keyof typeof iconMap];
            const to = slugToRoute[s.slug as keyof typeof slugToRoute];
            return (
              <Link
                key={s.slug}
                to={to}
                className="group flex flex-col rounded-2xl border border-border bg-card p-6 shadow-soft transition-colors hover:border-accent"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent"><Icon className="h-6 w-6" /></span>
                <h2 className="mt-4 text-lg font-semibold group-hover:text-accent">{s.title}</h2>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">{s.desc}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent">
                  Découvrir {s.title.toLowerCase()} <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="bg-secondary/40 py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">Grille de tarifs</p>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Nos tarifs indicatifs</h2>
            <p className="mt-4 text-muted-foreground">
              Tarifs TTC donnés à titre indicatif. Le prix exact est confirmé par un devis gratuit avant toute intervention.
            </p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {pricing.map((block) => (
              <div key={block.category} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                <h3 className="text-lg font-semibold">{block.category}</h3>
                <ul className="mt-4 divide-y divide-border">
                  {block.items.map((it) => (
                    <li key={it.label} className="flex items-center justify-between gap-4 py-3">
                      <span className="flex items-start gap-2 text-sm text-foreground/90">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> {it.label}
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-foreground">{it.price}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-5 rounded-3xl border border-border bg-card p-8 text-center shadow-soft sm:flex-row sm:text-left">
          <div>
            <h2 className="text-2xl font-bold">Un projet précis ? Recevez un devis gratuit.</h2>
            <p className="mt-1 text-muted-foreground">Réponse rapide et sans engagement.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild variant="hero" size="lg"><Link to="/devis">Demander un devis <ArrowRight className="h-4 w-4" /></Link></Button>
            <Button asChild variant="outline" size="lg"><a href={`tel:${site.phoneRaw}`}><Phone className="h-4 w-4" /> Appeler</a></Button>
          </div>
        </div>
      </section>
    </>
  );
}