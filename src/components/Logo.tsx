import { Droplet } from "lucide-react";
import { site } from "@/lib/site";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      {/* shrink-0 empêche l'icône de se déformer. h-9 w-9 garde un carré parfait. */}
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-gradient shadow-soft">
        <Droplet className="h-5 w-5 text-accent-foreground" fill="currentColor" />
      </span>
      
      {/* justify-center assure un centrage vertical parfait par rapport à l'icône. gap-0.5 gère l'écart entre les lignes. */}
      <span className="flex flex-col justify-center gap-1 sm:gap-0.5">
        <span 
          className={`font-display text-base sm:text-lg font-bold leading-none tracking-tight ${
            light ? "text-primary-foreground" : "text-foreground"
          }`}
        >
          {site.name}
        </span>
        <span 
          className={`text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider leading-none ${
            light ? "text-primary-foreground/70" : "text-muted-foreground"
          }`}
        >
          Plombier · Chauffagiste
        </span>
      </span>
    </span>
  );
}