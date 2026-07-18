import { useMemo, useState, useId, cloneElement, isValidElement, type ReactElement } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { 
  CheckCircle2, 
  ShieldCheck, 
  Clock, 
  FileText, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Wrench, 
  AlertTriangle, 
  ChevronDown, 
  ArrowRight,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PageHero } from "@/components/PageHero";
import { submitQuote } from "@/lib/forms.functions";
import { quoteSchema, type QuoteInput } from "@/lib/forms.schemas";
import { useClientIpv4 } from "@/hooks/use-client-ipv4";
import { serviceOptions, site } from "@/lib/site";
import { PhotoUploader } from "@/components/PhotoUploader";

export const Route = createFileRoute("/devis")({
  head: () => ({
    meta: [
      { title: "Devis Plomberie & Chauffage Gratuit à Metz | Dupont" },
      { name: "description", content: "Demandez votre devis de plomberie ou chauffage gratuit et sans engagement. Réponse rapide par un artisan à Metz." },
      { property: "og:title", content: "Devis Plomberie & Chauffage Gratuit à Metz | Dupont" },
      { property: "og:description", content: "Devis de plomberie gratuit et sans engagement. Réponse rapide." },
      { property: "og:url", content: "https://plomberie-test.lovable.app/devis" },
    ],
    links: [{ rel: "canonical", href: "https://plomberie-test.lovable.app/devis" }],
  }),
  component: DevisPage,
});

const urgencyOptions = [
  { value: "Pas urgent", label: "Pas urgent (projet à venir)" },
  { value: "Cette semaine", label: "Cette semaine" },
  { value: "Dès que possible", label: "Dès que possible" },
  { value: "Urgence", label: "Urgence immédiate" }
];

function DevisPage() {
  const [done, setDone] = useState(false);
  
  // États pour nos menus déroulants sur-mesure
  const [isServiceOpen, setIsServiceOpen] = useState(false);
  const [isUrgencyOpen, setIsUrgencyOpen] = useState(false);
  const uploadToken = useMemo(
    () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : ""),
    [],
  );
  const [photosUploading, setPhotosUploading] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);

  const submit = useServerFn(submitQuote);
  const { trigger, getIpv4 } = useClientIpv4();
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<QuoteInput>({
    resolver: zodResolver(quoteSchema),
    defaultValues: { service_type: "", urgency: "", name: "", phone: "", email: "", address: "", description: "" },
  });

  // On observe les valeurs pour l'affichage dynamique
  const selectedService = watch("service_type");
  const selectedUrgency = watch("urgency");

  const onSubmit = async (values: QuoteInput) => {
    try {
      await submit({
        data: {
          ...values,
          client_ipv4: await getIpv4(),
          upload_token: photoCount > 0 ? uploadToken : "",
        },
      });
      setDone(true);
      reset();
      toast.success("Demande de devis envoyée ! Nous revenons vers vous rapidement.");
    } catch (err) {
      const msg = err instanceof Error && err.message.includes("Trop de demandes")
        ? err.message
        : "Une erreur est survenue. Réessayez ou appelez-nous.";
      toast.error(msg);
    }
  };

  return (
    <>
      <PageHero
        eyebrow="Estimation en ligne"
        title="Votre devis gratuit et détaillé"
        subtitle="Décrivez votre besoin en quelques lignes. Nous vous répondons sous 24h avec une proposition claire et sans engagement."
        badgeText="100% Gratuit & Sans engagement"
      />

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-3 lg:px-8 lg:py-16">
        
        {/* Colonne de Réassurance (Aside) modernisée */}
        <aside className="space-y-6 lg:col-span-1">
          <div className="sticky top-24 space-y-4">
            {[
              { icon: FileText, t: "Devis clair et détaillé", d: "Chaque ligne est expliquée, sans frais cachés." },
              { icon: Clock, t: "Réponse rapide", d: "Nous traitons votre demande sous 24h ouvrées." },
              { icon: ShieldCheck, t: "Sans engagement", d: "Le devis est gratuit, vous décidez ensuite." },
            ].map((f) => (
              <div key={f.t} className="group flex gap-4 rounded-2xl border border-border/60 bg-card p-5 shadow-sm transition-colors hover:border-accent/50">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 transition-colors group-hover:bg-accent/20">
                  <f.icon className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="font-bold tracking-tight text-foreground">{f.t}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.d}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Colonne du Formulaire */}
        <div className="lg:col-span-2">
          {done ? (
            <div className="animate-in fade-in zoom-in-95 duration-500 rounded-3xl border border-border/50 bg-card p-10 text-center shadow-xl">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100/50">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="mt-6 text-3xl font-extrabold tracking-tight">Merci, c'est bien reçu !</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Votre demande de devis a été transmise à notre équipe. Nous l'étudions et revenons vers vous très rapidement.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild variant="hero" size="lg" className="w-full sm:w-auto">
                  <Link to="/">Retour à l'accueil</Link>
                </Button>
                <Button variant="outline" size="lg" onClick={() => setDone(false)} className="w-full sm:w-auto">
                  Nouvelle demande
                </Button>
              </div>
            </div>
          ) : (
            <form 
              onSubmit={handleSubmit(onSubmit)} 
              onFocus={() => trigger()} 
              className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-xl"
            >
              {/* Header du formulaire */}
              <div className="bg-muted/30 border-b border-border/40 px-6 py-4 sm:px-8">
                <p className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-accent" />
                  Vos informations nous permettent uniquement d'établir votre devis.
                </p>
              </div>

              <div className="p-6 sm:p-8 space-y-10">
                
                {/* SECTION 1 : Coordonnées */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-border/40 pb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">1</div>
                    <h3 className="text-xl font-bold tracking-tight">Vos informations</h3>
                  </div>
                  
                  <div className="grid gap-6 sm:grid-cols-2">
                    <Field label="Nom complet" error={errors.name?.message}>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                        <Input {...register("name")} placeholder="Jean Dupont" className="pl-10 h-12 rounded-xl" />
                      </div>
                    </Field>
                    <Field label="Téléphone" error={errors.phone?.message}>
                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                        <Input {...register("phone")} placeholder="06 12 34 56 78" inputMode="tel" className="pl-10 h-12 rounded-xl" />
                      </div>
                    </Field>
                    <Field label="E-mail" error={errors.email?.message}>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                        <Input {...register("email")} placeholder="jean@email.fr" type="email" className="pl-10 h-12 rounded-xl" />
                      </div>
                    </Field>
                    <Field label="Code postal ou Ville" error={errors.address?.message} optional>
                      <div className="relative">
                        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                        <Input {...register("address")} placeholder="Ex: 57000 Metz" className="pl-10 h-12 rounded-xl" />
                      </div>
                    </Field>
                  </div>
                </div>

                {/* SECTION 2 : Le Projet */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-border/40 pb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">2</div>
                    <h3 className="text-xl font-bold tracking-tight">Votre projet</h3>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    
                    {/* Menu déroulant sur-mesure : Prestation */}
                    <Field label="Type de prestation" error={errors.service_type?.message}>
                      <div className="relative">
                        <input type="hidden" {...register("service_type")} />
                        <button
                          type="button"
                          onClick={() => setIsServiceOpen(!isServiceOpen)}
                          className={`flex h-12 w-full items-center justify-between rounded-xl border bg-background px-4 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                            isServiceOpen ? "border-accent ring-2 ring-accent/20" : "border-input hover:border-accent/50"
                          } ${!selectedService ? "text-muted-foreground" : "text-foreground"}`}
                        >
                          <div className="flex items-center gap-3">
                            <Wrench className="h-4 w-4 text-muted-foreground/70" />
                            <span className="truncate">{selectedService || "Sélectionnez..."}</span>
                          </div>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground/70 transition-transform duration-200 ${isServiceOpen ? "rotate-180" : ""}`} />
                        </button>

                        {isServiceOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsServiceOpen(false)}></div>
                            <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-full overflow-hidden rounded-xl border border-border/60 bg-popover text-popover-foreground shadow-lg animate-in fade-in-80 zoom-in-95">
                              <div className="max-h-96 overflow-auto p-1.5">
                                {serviceOptions.map((option) => (
                                  <button
                                    key={option}
                                    type="button"
                                    onClick={() => { setValue("service_type", option, { shouldValidate: true }); setIsServiceOpen(false); }}
                                    className={`relative flex w-full cursor-pointer select-none items-center rounded-lg py-3 pl-3 pr-9 text-sm font-medium outline-none transition-colors hover:bg-accent/10 hover:text-accent ${selectedService === option ? "bg-accent/10 text-accent" : ""}`}
                                  >
                                    <span className="block truncate">{option}</span>
                                    {selectedService === option && <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-accent"><Check className="h-4 w-4" /></span>}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </Field>

                    {/* Menu déroulant sur-mesure : Urgence */}
                    <Field label="Degré d'urgence" error={errors.urgency?.message} optional>
                      <div className="relative">
                        <input type="hidden" {...register("urgency")} />
                        <button
                          type="button"
                          onClick={() => setIsUrgencyOpen(!isUrgencyOpen)}
                          className={`flex h-12 w-full items-center justify-between rounded-xl border bg-background px-4 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                            isUrgencyOpen ? "border-accent ring-2 ring-accent/20" : "border-input hover:border-accent/50"
                          } ${!selectedUrgency ? "text-muted-foreground" : "text-foreground"}`}
                        >
                          <div className="flex items-center gap-3">
                            <AlertTriangle className={`h-4 w-4 ${selectedUrgency === "Urgence" ? "text-destructive" : "text-muted-foreground/70"}`} />
                            <span className="truncate">{selectedUrgency || "Pas urgent"}</span>
                          </div>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground/70 transition-transform duration-200 ${isUrgencyOpen ? "rotate-180" : ""}`} />
                        </button>

                        {isUrgencyOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsUrgencyOpen(false)}></div>
                            <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-full overflow-hidden rounded-xl border border-border/60 bg-popover text-popover-foreground shadow-lg animate-in fade-in-80 zoom-in-95">
                              <div className="max-h-96 overflow-auto p-1.5">
                                {urgencyOptions.map((option) => (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => { setValue("urgency", option.value, { shouldValidate: true }); setIsUrgencyOpen(false); }}
                                    className={`relative flex w-full cursor-pointer select-none items-center rounded-lg py-3 pl-3 pr-9 text-sm font-medium outline-none transition-colors hover:bg-accent/10 hover:text-accent ${selectedUrgency === option.value ? "bg-accent/10 text-accent" : ""}`}
                                  >
                                    <span className={`block truncate ${option.value === "Urgence" ? "text-destructive font-bold" : ""}`}>
                                      {option.label}
                                    </span>
                                    {selectedUrgency === option.value && <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-accent"><Check className="h-4 w-4" /></span>}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </Field>

                  </div>

                  <Field label="Décrivez vos travaux" error={errors.description?.message}>
                    <Textarea 
                      {...register("description")} 
                      rows={5} 
                      placeholder="Ex : remplacement d'un vieux chauffe-eau, aménagement complet d'une salle de bain de 8m², etc." 
                      className="rounded-xl resize-none"
                    />
                  </Field>
                </div>
              </div>

              {/* Footer du formulaire avec le Call to Action */}
              <div className="bg-muted/20 border-t border-border/40 p-6 sm:p-8">
                <Button 
                  type="submit" 
                  variant="hero" 
                  size="lg" 
                  className="w-full h-14 rounded-xl text-base shadow-lg transition-transform hover:scale-[1.02]" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Envoi de la demande…" : (
                    <>
                      Envoyer ma demande de devis <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
                <p className="mt-4 text-center text-sm font-medium text-muted-foreground">
                  Artisan certifié intervenant sur <span className="text-foreground">{site.city}</span> et ses alentours.
                </p>
              </div>
            </form>
          )}
        </div>
      </section>
    </>
  );
}

function Field({ label, error, optional, children }: { label: string; error?: string; optional?: boolean; children: React.ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
        {optional && <span className="ml-1 text-xs font-normal text-muted-foreground/70">(optionnel)</span>}
      </Label>
      {isValidElement(children) ? cloneElement(children as ReactElement<{ id?: string }>, { id }) : children}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}