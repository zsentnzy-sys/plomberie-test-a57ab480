import { Phone, MessageCircle } from "lucide-react";
import { site } from "@/lib/site";

export function MobileCallBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-2 gap-px border-t border-border bg-border lg:hidden">
      <a
        href={`tel:${site.phoneRaw}`}
        className="flex items-center justify-center gap-2 bg-urgent py-3.5 text-sm font-semibold text-urgent-foreground"
      >
        <Phone className="h-4 w-4" /> Appeler
      </a>
      <a
        href={`https://wa.me/${site.whatsapp}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 bg-accent py-3.5 text-sm font-semibold text-accent-foreground"
      >
        <MessageCircle className="h-4 w-4" /> WhatsApp
      </a>
    </div>
  );
}