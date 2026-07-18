import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Phone, Siren, ShieldCheck, Clock, Star, Wrench, Flame, ShowerHead, Droplets,
  CheckCircle2, ArrowRight, MessageCircle, ThumbsUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { site, services, testimonials } from "@/lib/site";
import heroImg from "@/assets/hero-plumber.webp";
import heroMobileImg from "@/assets/hero-plumber-mobile.webp";
import bathroomImg from "@/assets/work-bathroom.webp";
import boilerImg from "@/assets/work-boiler.webp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Plombier Chauffagiste Metz - Dépannage 7j/7 | Dupont" },
      { name: "description", content: "Artisan plombier chauffagiste à Metz : dépannage 24/7, recherche de fuite, chaudière et rénovation de salle de bain. Devis gratuit." },
      { property: "og:title", content: "Plombier Chauffagiste à Metz | Dépannage 7j/7 - Plomberie Dupont" },
      { property: "og:description", content: "Dépannage 24/7, chauffage, sanitaire et rénovation. Devis gratuit, tarifs transparents." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://plomberie-test.lovable.app/" },
    ],
    links: [
      { rel: "canonical",
        href: "https://plomberie-test.lovable.app/",
      },

    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Plumber",
          name: site.name,
          telephone: site.phoneRaw,
          email: site.email,
          address: { "@type": "PostalAddress", streetAddress: site.address, addressLocality: site.city, addressCountry: "FR" },
          areaServed: site.city,
          openingHours: "Mo-Sa 08:00-19:00",
          priceRange: "€€",
        }),
      },
    ],
  }),
  component: Index,
});

const iconMap = { Wrench, Flame, ShowerHead, Droplets } as const;

function Index() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-hero-gradient text-primary-foreground">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24 lg:px-8">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-4 py-1.5 text-sm font-medium ring-1 ring-primary-foreground/20">
              <Siren className="h-4 w-4 text-accent" /> Urgence 24h/24 · 7j/7
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.08] sm:text-5xl lg:text-6xl">
              Plombier chauffagiste à {site.city} — dépannage 7j/7
            </h1>
            <p className="mt-5 max-w-xl text-lg text-primary-foreground/80">
              Dépannage rapide, installations soignées et conseils honnêtes.
              Un artisan réactif, des tarifs clairs et un travail garanti.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="hero" size="xl">
                <a href={`tel:${site.phoneRaw}`}><Phone className="h-5 w-5" /> {site.phoneDisplay}</a>
              </Button>
              <Button asChild variant="outlineLight" size="xl">
                <Link to="/devis">Devis gratuit <ArrowRight className="h-5 w-5" /></Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-primary-foreground/80">
              <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /> Assurance décennale</span>
              <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-accent" /> Intervention rapide</span>
              <span className="flex items-center gap-2"><Star className="h-4 w-4 text-accent" fill="currentColor" /> +500 clients satisfaits</span>
            </div>
          </div>
          <div className="overflow-hidden rounded-3xl shadow-elegant ring-1 ring-primary-foreground/10">
            <picture>
              <source
                media="(max-width: 639px)"
                srcSet={heroMobileImg}
                width={480}
                height={320}
              />
                
              <img
                src={heroImg}
                alt="Plombier chauffagiste en intervention"
                width={1280}
                height={853}
                fetchPriority="high"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </picture>                  
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-b border-border bg-secondary/40">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 md:grid-cols-4 lg:px-8">
          {[
            { n: "17 ans", l: "d'expérience" },
            { n: "24/7", l: "urgences" },
            { n: "< 1h", l: "délai moyen en urgence" },
            { n: "4,9/5", l: "note moyenne clients" },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <p className="text-3xl font-bold text-foreground sm:text-4xl">{s.n}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SERVICES */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">Nos prestations</p>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Tout ce dont votre logement a besoin</h2>
          <p className="mt-4 text-muted-foreground">
            De la fuite urgente à la rénovation complète, nous intervenons proprement et durablement.
          </p>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((s) => {
            const Icon = iconMap[s.icon as keyof typeof iconMap];
            return (
              <div key={s.slug} className="group rounded-2xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-1 hover:shadow-elegant">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
                <Link to="/services" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent">
                  En savoir plus <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* URGENCE BANNER */}
      <section className="bg-urgent text-urgent-foreground">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-4 py-10 sm:px-6 lg:flex-row lg:px-8">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-urgent-foreground/15 animate-pulse-ring">
              <Siren className="h-7 w-7" />
            </span>
            <div>
              <h2 className="text-2xl font-bold">Une urgence ? On arrive vite.</h2>
              <p className="text-urgent-foreground/85">Fuite, dégât des eaux, panne de chauffage — disponibles 24h/24 et 7j/7.</p>
            </div>
          </div>
          <Button asChild size="xl" className="bg-urgent-foreground text-urgent hover:bg-urgent-foreground/90">
            <a href={`tel:${site.phoneRaw}`}><Phone className="h-5 w-5" /> Appeler maintenant</a>
          </Button>
        </div>
      </section>

      {/* WHY US */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24 lg:px-8">
        <div className="grid grid-cols-2 gap-4">
          <img src={bathroomImg} alt="Installation sanitaire soignée" loading="lazy" width={1024} height={768} className="aspect-[4/5] w-full rounded-2xl object-cover shadow-soft" />
          <img src={boilerImg} alt="Chaudière à condensation installée" loading="lazy" width={1024} height={768} className="mt-8 aspect-[4/5] w-full rounded-2xl object-cover shadow-soft" />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">Pourquoi nous choisir</p>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Un artisan, pas une plateforme</h2>
          <ul className="mt-6 space-y-4">
            {[
              { t: "Tarifs transparents", d: "Un devis clair avant toute intervention. Pas de mauvaise surprise sur la facture." },
              { t: "Réactivité réelle", d: "Vous parlez directement à l'artisan qui interviendra chez vous." },
              { t: "Travail garanti", d: "Matériel de qualité, finitions soignées et garantie sur nos interventions." },
              { t: "Proximité", d: "Basé à Metz, nous connaissons votre secteur et intervenons rapidement." },
            ].map((f) => (
              <li key={f.t} className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-accent" />
                <div>
                  <p className="font-semibold">{f.t}</p>
                  <p className="text-sm text-muted-foreground">{f.d}</p>
                </div>
              </li>
            ))}
          </ul>
          <Button asChild variant="default" size="lg" className="mt-8">
            <Link to="/a-propos">Découvrir l'artisan <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="bg-secondary/40 py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-accent">Avis clients</p>
              <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Ils nous ont fait confiance</h2>
            </div>
            <Link to="/avis" className="hidden shrink-0 items-center gap-1 text-sm font-medium text-accent sm:flex">
              Tous les avis <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {testimonials.slice(0, 3).map((t) => (
              <figure key={t.name} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                <div className="flex gap-0.5 text-accent">
                  {Array.from({ length: t.rating }).map((_, i) => <Star key={i} className="h-4 w-4" fill="currentColor" />)}
                </div>
                <blockquote className="mt-4 text-sm text-foreground/90">“{t.text}”</blockquote>
                <figcaption className="mt-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 font-semibold text-accent">{t.name[0]}</span>
                  <span className="text-sm"><span className="font-semibold">{t.name}</span><br /><span className="text-muted-foreground">{t.city}</span></span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl bg-hero-gradient px-6 py-12 text-center text-primary-foreground shadow-elegant sm:px-12 lg:py-16">
          <ThumbsUp className="mx-auto h-10 w-10 text-accent" />
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl">Prêt à régler votre problème de plomberie ?</h2>
          <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
            Demandez un devis gratuit ou réservez un créneau en ligne. Réponse rapide garantie.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild variant="hero" size="xl"><Link to="/devis">Obtenir mon devis</Link></Button>
            <Button asChild variant="outlineLight" size="xl"><Link to="/rendez-vous">Prendre rendez-vous</Link></Button>
            <Button asChild variant="outlineLight" size="xl">
              <a href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-5 w-5" /> WhatsApp</a>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
