import { Link } from "@tanstack/react-router";
import { Phone, Mail, MapPin, Clock, MessageCircle } from "lucide-react";
import { Logo } from "@/components/Logo";
import { site, services } from "@/lib/site";

export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div className="lg:col-span-1">
          <Logo light />
          <p className="mt-4 max-w-xs text-sm text-primary-foreground/70">
            Artisan plombier chauffagiste de confiance. Dépannage, chauffage et
            rénovation à {site.city} et alentours.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-primary-foreground/60">Services</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {services.map((s) => (
              <li key={s.slug}>
                <Link to="/services" className="text-primary-foreground/80 hover:text-primary-foreground">
                  {s.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-primary-foreground/60">Navigation</h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link to="/devis" className="text-primary-foreground/80 hover:text-primary-foreground">Devis gratuit</Link></li>
            <li><Link to="/rendez-vous" className="text-primary-foreground/80 hover:text-primary-foreground">Prendre rendez-vous</Link></li>
            <li><Link to="/a-propos" className="text-primary-foreground/80 hover:text-primary-foreground">À propos</Link></li>
            <li><Link to="/avis" className="text-primary-foreground/80 hover:text-primary-foreground">Avis clients</Link></li>
            <li><Link to="/contact" className="text-primary-foreground/80 hover:text-primary-foreground">Contact & urgences</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-primary-foreground/60">Contact</h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-center gap-2.5">
              <Phone className="h-4 w-4 text-accent" />
              <a href={`tel:${site.phoneRaw}`} className="hover:text-primary-foreground">{site.phoneDisplay}</a>
            </li>
            <li className="flex items-center gap-2.5">
              <MessageCircle className="h-4 w-4 text-accent" />
              <a href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noopener noreferrer" className="hover:text-primary-foreground">WhatsApp</a>
            </li>
            <li className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 text-accent" />
              <a href={`mailto:${site.email}`} className="hover:text-primary-foreground">{site.email}</a>
            </li>
            <li className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span className="text-primary-foreground/80">{site.address}</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span className="text-primary-foreground/80">{site.hours}</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-primary-foreground/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-primary-foreground/60 sm:flex-row sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} {site.name}. Tous droits réservés.</p>
          <p>{site.siret} · Assurance décennale · Zone : {site.city} et alentours</p>
        </div>
      </div>
    </footer>
  );
}