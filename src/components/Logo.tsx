import { Droplet } from "lucide-react";
import { site } from "@/lib/site";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-gradient shadow-soft">
        <Droplet className="h-5 w-5 text-accent-foreground" fill="currentColor" />
      </span>
      <span className="flex flex-col leading-none">
        <span className={`font-display text-lg font-bold tracking-tight ${light ? "text-primary-foreground" : "text-foreground"}`}>
          {site.name}
        </span>
        <span className={`text-[11px] font-medium ${light ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          Plombier · Chauffagiste
        </span>
      </span>
    </span>
  );
}