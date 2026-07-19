import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Phone, Menu, X, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { site } from "@/lib/site";

const nav = [
  { to: "/", label: "Accueil" },
  { to: "/services", label: "Services & Tarifs" },
  { to: "/rendez-vous", label: "Rendez-vous" },
  { to: "/devis", label: "Devis gratuit" },
  { to: "/a-propos", label: "À propos" },
  { to: "/avis", label: "Avis" },
  { to: "/contact", label: "Contact" },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="relative z-50 w-full border-b border-border bg-background">
      {/* La hauteur (h-16) est fixe. items-center force tout au centre de cet axe vertical */}
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        
        {/* Le Logo est géré par ton composant. flex et items-center l'empêchent de couler en bas */}
        <Link to="/" aria-label={site.name} className="flex items-center transition-transform hover:scale-[1.01]">
          <Logo />
        </Link>

        {/* Navigation Desktop */}
        <nav className="hidden items-center gap-1 lg:flex">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/40"
              activeProps={{ className: "text-foreground bg-muted/60 shadow-sm" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Boutons d'action : Utilisation de mr-2 pour espacer proprement l'icône du texte */}
        <div className="hidden items-center gap-2 lg:flex">
          <Button asChild variant="urgent" size="sm" className="transition-transform hover:scale-105">
            <a href={`tel:${site.phoneRaw}`}>
              {/* Icône urgence avec petite animation pour attirer l'œil */}
              <Siren className="mr-2 h-4 w-4 animate-pulse" /> 
              Urgence 24/7
            </a>
          </Button>
          
          <Button asChild variant="hero" size="sm" className="transition-transform hover:scale-105">
            <a href={`tel:${site.phoneRaw}`}>
              {/* L'icône téléphone bien présente et alignée avec le texte */}
              <Phone className="mr-2 h-4 w-4" /> 
              {site.phoneDisplay}
            </a>
          </Button>
        </div>

        {/* Bouton Menu Mobile */}
        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-muted/40 text-foreground transition-colors hover:bg-muted focus:outline-none lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Menu Mobile */}
      {open && (
        <div className="border-t border-border/60 bg-background lg:hidden animate-in slide-in-from-top-2">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                activeProps={{ className: "text-foreground bg-muted font-semibold" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                {item.label}
              </Link>
            ))}
            
            <div className="mt-4 pt-4 border-t border-border/60">
              <Button asChild variant="urgent" className="w-full h-12">
                <a href={`tel:${site.phoneRaw}`}>
                  <Siren className="mr-2 h-5 w-5 animate-pulse" /> 
                  Urgence 24/7 : {site.phoneDisplay}
                </a>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}