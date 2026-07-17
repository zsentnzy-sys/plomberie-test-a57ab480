import { createFileRoute, Link } from "@tanstack/react-router";
import { Star, Quote, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/PageHero";
import { testimonials } from "@/lib/site";

export const Route = createFileRoute("/avis")({
  head: () => ({
    meta: [
      { title: "Avis Clients Plombier Chauffagiste Metz | Dupont" },
      { name: "description", content: "Découvrez les avis de nos clients sur nos interventions de plomberie et chauffage à Metz : réactivité, propreté et tarifs honnêtes." },
      { property: "og:title", content: "Avis Clients - Plombier Chauffagiste à Metz - Plomberie Dupont" },
      { property: "og:description", content: "Note moyenne 4,9/5 sur nos interventions de plomberie à Metz." },
      { property: "og:url", content: "https://plomberie-test.lovable.app/avis" },
    ],
    links: [{ rel: "canonical", href: "https://plomberie-test.lovable.app/avis" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          name: "Plomberie Dupont",
          aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", reviewCount: String(testimonials.length) },
        }),
      },
    ],
  }),
  component: ReviewsPage,
});

function ReviewsPage() {
  return (
    <>
      <PageHero eyebrow="Avis clients" title="Avis clients — plombier chauffagiste à Metz" subtitle="La satisfaction de nos clients est notre meilleure publicité. Voici quelques retours récents." />

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
          <div className="flex gap-1 text-accent">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-6 w-6" fill="currentColor" />)}</div>
          <p className="text-3xl font-bold">4,9 / 5</p>
          <p className="text-muted-foreground">Sur la base de {testimonials.length}+ avis vérifiés</p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t) => (
            <figure key={t.name} className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-soft">
              <Quote className="h-7 w-7 text-accent/40" />
              <div className="mt-2 flex gap-0.5 text-accent">{Array.from({ length: t.rating }).map((_, i) => <Star key={i} className="h-4 w-4" fill="currentColor" />)}</div>
              <blockquote className="mt-3 flex-1 text-sm text-foreground/90">“{t.text}”</blockquote>
              <figcaption className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 font-semibold text-accent">{t.name[0]}</span>
                <span className="text-sm"><span className="font-semibold">{t.name}</span><br /><span className="text-muted-foreground">{t.city}</span></span>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-5 rounded-3xl bg-hero-gradient px-8 py-10 text-center text-primary-foreground shadow-elegant sm:flex-row sm:text-left">
          <div>
            <h2 className="text-2xl font-bold">Rejoignez nos clients satisfaits</h2>
            <p className="mt-1 text-primary-foreground/80">Confiez-nous votre prochaine intervention.</p>
          </div>
          <Button asChild variant="hero" size="xl"><Link to="/devis">Demander un devis <ArrowRight className="h-5 w-5" /></Link></Button>
        </div>
      </section>
    </>
  );
}