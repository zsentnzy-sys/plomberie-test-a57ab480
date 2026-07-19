import { Link } from "@tanstack/react-router";
import { Phone, Mail, MapPin, Clock, MessageCircle, ShieldCheck, ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { site, services } from "@/lib/site";

export function Footer() {
  return (
    <footer className="relative isolate overflow-hidden border-t border-primary-foreground/5 bg-primary text-primary-foreground">
      {/* Subtile lueur d'ambiance en arrière-plan */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0" style={{
        background:
        "radial-gradient(circle at 100% 100%, rgba(0, 178, 169, 0.14) 0%, rgba(0, 178, 169, 0) 38rem)",
      }}
      />

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          
          {/* Colonne 1 : Brand & Badge de confiance */}
          <div className="flex flex-col space-y-5">
            <div>
              <Logo light />
              <p className="mt-4 text-sm leading-relaxed text-primary-foreground/70">
                Artisan plombier chauffagiste de confiance. Dépannage rapide, chauffage et
                rénovation à <span className="font-semibold text-primary-foreground">{site.city}</span> et ses alentours.
              </p>
            </div>
            
            {/* Badge d'assurance : Gros point fort pour rassurer un client */}
            <div className="inline-flex max-w-xs items-center gap-2.5 rounded-lg border border-primary-foreground/10 bg-primary-foreground/5 p-3 text-xs text-primary-foreground/80">
              <ShieldCheck className="h-5 w-5 shrink-0 text-accent" />
              <span>Garantie décennale & Responsabilité Civile Professionnelle</span>
            </div>
          </div>

          {/* Colonne 2 : Services (Avec effet de glissement au survol) */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-primary-foreground/40">
              Nos Services
            </h3>
            <ul className="mt-5 space-y-3 text-sm">
              {services.map((s) => (
                <li key={s.slug}>
                  <Link 
                    to="/services" 
                    className="group flex items-center text-primary-foreground/70 transition-colors hover:text-accent"
                  >
                    <span className="transition-transform duration-200 group-hover:translate-x-1">
                      {s.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Colonne 3 : Navigation */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-primary-foreground/40">
              Navigation
            </h3>
            <ul className="mt-5 space-y-3 text-sm">
              {[
                { to: "/devis", label: "Demander un devis gratuit" },
                { to: "/rendez-vous", label: "Prendre rendez-vous" },
                { to: "/a-propos", label: "À propos de nous" },
                { to: "/avis", label: "Avis de nos clients" },
                { to: "/contact", label: "Contact & Urgences" },
                { to: "/mentions-legales", label: "Mentions légales" },
                { to: "/politique-de-confidentialite", label: "Politique de confidentialité" },
              ].map((link, idx) => (
                <li key={idx}>
                  <Link 
                    to={link.to} 
                    className="group flex items-center justify-between text-primary-foreground/70 transition-colors hover:text-primary-foreground"
                  >
                    <span>{link.label}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-all group-hover:opacity-100 group-hover:text-accent" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Colonne 4 : Contact (Plus visuel et interactif) */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-primary-foreground/40">
              Urgence & Contact
            </h3>
            <ul className="mt-5 space-y-4 text-sm">
              <li>
                <a 
                  href={`tel:${site.phoneRaw}`} 
                  className="group flex items-center gap-3 rounded-xl bg-primary-foreground/5 p-2.5 transition-all hover:bg-accent hover:text-accent-foreground"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground group-hover:bg-primary group-hover:text-primary-foreground">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider opacity-60">Appel direct</span>
                    <span className="font-semibold">{site.phoneDisplay}</span>
                  </div>
                </a>
              </li>

              <li className="flex items-center gap-3 px-2.5">
                <MessageCircle className="h-4 w-4 shrink-0 text-accent" />
                <a href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noopener noreferrer" className="text-primary-foreground/70 transition-colors hover:text-primary-foreground">
                  Discuter sur WhatsApp
                </a>
              </li>

              <li className="flex items-center gap-3 px-2.5">
                <Mail className="h-4 w-4 shrink-0 text-accent" />
                <a href={`mailto:${site.email}`} className="text-primary-foreground/70 transition-colors hover:text-primary-foreground truncate">
                  {site.email}
                </a>
              </li>

              <li className="flex items-start gap-3 px-2.5 text-primary-foreground/70">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span className="leading-tight">{site.address}</span>
              </li>

              <li className="flex items-start gap-3 px-2.5 text-primary-foreground/70">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span className="leading-tight">{site.hours}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Section Basse : Mentions légales & Crédits */}
        <div className="mt-16 border-t border-primary-foreground/10 pt-8">
          <div className="flex flex-col gap-4 text-xs text-primary-foreground/50 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} {site.name}. Tous droits réservés.</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>SIRET : {site.siret}</span>
              <span className="hidden sm:inline">·</span>
              <span>Zone d'intervention : {site.city} et alentours</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}