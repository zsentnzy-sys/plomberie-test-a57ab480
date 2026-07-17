import { CheckCircle2 } from "lucide-react";

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  badgeText?: string; // Optionnel : pour afficher une info clé (ex: "En 2 minutes")
}

export function PageHero({ eyebrow, title, subtitle, badgeText }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden bg-hero-gradient text-primary-foreground">
      {/* On réduit drastiquement le padding vertical (py-10 à py-14 au lieu de py-32) */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          
          {/* Zone de texte principale (alignée à gauche) */}
          <div className="max-w-3xl">
            {eyebrow && (
              <p className="text-xs font-bold uppercase tracking-widest text-accent mb-2">
                {eyebrow}
              </p>
            )}
            
            {/* Titre plus compact (text-3xl à 5xl max) */}
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              {title}
            </h1>
            
            {subtitle && (
              <p className="mt-3 text-base text-primary-foreground/80 sm:text-lg max-w-2xl">
                {subtitle}
              </p>
            )}
          </div>

          {/* Zone optionnelle à droite : Réassurance ou Badge rapide */}
          {badgeText && (
            <div className="mt-4 flex shrink-0 items-center gap-2 rounded-xl border border-primary-foreground/10 bg-primary-foreground/5 p-4 backdrop-blur-sm lg:mt-0">
              <CheckCircle2 className="h-5 w-5 text-accent" />
              <span className="text-sm font-medium text-primary-foreground/90">{badgeText}</span>
            </div>
          )}

        </div>
        
      </div>
    </section>
  );
}