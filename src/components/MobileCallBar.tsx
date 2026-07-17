import { Phone, MessageCircle } from "lucide-react";
import { site } from "@/lib/site";

export function MobileCallBar() {
  return (
    <div 
      // Ajout d'une ombre portée inversée pour détacher la barre du contenu qui défile
      className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-2 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] lg:hidden"
      // CRUCIAL : Protège la barre contre la "Home Indicator" (la barre de balayage) des iPhone récents
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <a
        href={`tel:${site.phoneRaw}`}
        aria-label="Appeler directement"
        // Utilisation de h-14 pour une zone de clic parfaite et de active:brightness-90 pour le retour visuel
        className="flex h-14 items-center justify-center gap-2.5 bg-urgent text-base font-bold text-urgent-foreground transition-all active:brightness-90"
      >
        <Phone className="h-5 w-5 animate-pulse" /> 
        <span>Appeler</span>
      </a>
      
      <a
        href={`https://wa.me/${site.whatsapp}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contacter sur WhatsApp"
        className="flex h-14 items-center justify-center gap-2.5 bg-accent text-base font-bold text-accent-foreground transition-all active:brightness-90"
      >
        <MessageCircle className="h-5 w-5" /> 
        <span>WhatsApp</span>
      </a>
    </div>
  );
}