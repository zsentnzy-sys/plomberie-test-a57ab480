import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Award, MapPin, HeartHandshake, ArrowRight, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/PageHero";
import { site, faqs } from "@/lib/site";
import portrait from "@/assets/artisan-portrait.webp";

export const Route = createFileRoute("/a-propos")({
  head: () => ({
    meta: [
      { title: "À propos - Plombier Chauffagiste à Metz - Plomberie Dupont" },
      { name: "description", content: "Découvrez l'artisan derrière Plomberie Dupont : 17 ans d'expérience, valeurs de proximité et de transparence, zone d'intervention autour de Metz." },
      { property: "og:title", content: "À propos - Plombier Chauffagiste à Metz - Plomberie Dupont" },
      { property: "og:description", content: "Artisan plombier chauffagiste à Metz, 17 ans d'expérience." },
      { property: "og:url", content: "https://plomberie-test.lovable.app/a-propos" },
      { property: "og:image", content: portrait },
    ],
    links: [{ rel: "canonical", href: "https://plomberie-test.lovable.app/a-propos" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <>
      <PageHero eyebrow="À propos" title="Plombier chauffagiste à Metz, proche de vous depuis 17 ans" />

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8">
      <img src={portrait} alt="Portrait de l'artisan plombier de Plomberie Dupont" loading="lazy" width={900} height={900} className="aspect-square w-full max-w-md rounded-3xl object-cover shadow-elegant" />
        <div>
          <h2 className="text-3xl font-bold sm:text-4xl">Bonjour, je suis votre plombier de confiance</h2>
          <div className="mt-5 space-y-4 text-muted-foreground">
            <p>Plombier chauffagiste de métier, j'ai créé Plomberie Dupont avec une idée simple : offrir un service de qualité, honnête et réactif, comme on aimerait en trouver pour soi-même.</p>
            <p>Chaque intervention est réalisée avec soin, du petit dépannage à la rénovation complète. Vous avez toujours en face de vous l'artisan qui réalise les travaux — pas un standard téléphonique.</p>
            <p>Mon objectif : que vous repartiez serein, avec un problème réglé durablement et une facture conforme au devis.</p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="hero" size="lg"><Link to="/devis">Demander un devis <ArrowRight className="h-4 w-4" /></Link></Button>
            <Button asChild variant="outline" size="lg"><a href={`tel:${site.phoneRaw}`}><Phone className="h-4 w-4" /> Appeler</a></Button>
          </div>
        </div>
      </section>

      <section className="bg-secondary/40 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold">Mes engagements</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Award, t: "17 ans d'expérience", d: "Un savoir-faire éprouvé sur tous types d'installations." },
              { icon: ShieldCheck, t: "Assuré & garanti", d: "Assurance décennale et garantie sur les interventions." },
              { icon: HeartHandshake, t: "Transparence", d: "Devis clairs, conseils honnêtes, pas de surfacturation." },
              { icon: MapPin, t: "Proximité", d: site.zone },
            ].map((v) => (
              <div key={v.t} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                <v.icon className="h-7 w-7 text-accent" />
                <p className="mt-3 font-semibold">{v.t}</p>
                <p className="mt-1 text-sm text-muted-foreground">{v.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold">Questions fréquentes</h2>
        <div className="mt-8 space-y-4">
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
      </section>
    </>
  );
}