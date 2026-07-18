import { useMemo, useState, useId, cloneElement, isValidElement, type ReactElement } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { 
  CheckCircle2, 
  CalendarDays, 
  Clock, 
  Phone, 
  User, 
  Mail, 
  Wrench, 
  ChevronDown, 
  ArrowRight,
  ShieldCheck,
  Check // Nouvelle icône ajoutée
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PageHero } from "@/components/PageHero";
import { submitAppointment } from "@/lib/forms.functions";
import { appointmentSchema, type AppointmentInput } from "@/lib/forms.schemas";
import { serviceOptions, timeSlots, site } from "@/lib/site";
import { useClientIpv4 } from "@/hooks/use-client-ipv4";
import { PhotoUploader } from "@/components/PhotoUploader";

export const Route = createFileRoute("/rendez-vous")({
  head: () => ({
    meta: [
      { title: "Prendre Rendez-vous Plombier à Metz - Plomberie Dupont" },
      { name: "description", content: "Réservez l'intervention d'un plombier chauffagiste à Metz : choisissez votre date et votre créneau en quelques clics." },
      { property: "og:title", content: "Prendre Rendez-vous Plombier à Metz - Plomberie Dupont" },
      { property: "og:description", content: "Réservez votre créneau d'intervention plomberie en ligne." },
      { property: "og:url", content: "https://plomberie-test.lovable.app/rendez-vous" },
    ],
    links: [{ rel: "canonical", href: "https://plomberie-test.lovable.app/rendez-vous" }],
  }),
  component: AppointmentPage,
});

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function AppointmentPage() {
  const [done, setDone] = useState(false);
  
  // Nouvel état pour gérer l'ouverture de notre menu déroulant sur-mesure
  const [isServiceOpen, setIsServiceOpen] = useState(false);
  const uploadToken = useMemo(
    () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : ""),
    [],
  );
  const [photosUploading, setPhotosUploading] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  
  const submit = useServerFn(submitAppointment);
  const { trigger, getIpv4 } = useClientIpv4();
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<AppointmentInput>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: { service_type: "", time_slot: "", preferred_date: "" },
  });
  
  const slot = watch("time_slot");
  // On observe la prestation sélectionnée pour l'afficher
  const selectedService = watch("service_type");

  const onSubmit = async (values: AppointmentInput) => {
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
      toast.success("Rendez-vous demandé ! Nous confirmons votre créneau rapidement.");
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
        eyebrow="Réservation en ligne"
        title="Planifiez votre intervention"
        subtitle="Choisissez le jour et le créneau qui vous arrangent. Nous vous confirmons le rendez-vous dans les plus brefs délais."
        badgeText="Confirmation rapide"
      />

      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        {done ? (
          <div className="animate-in fade-in zoom-in-95 duration-500 rounded-3xl border border-border/50 bg-card p-10 text-center shadow-xl">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100/50">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="mt-6 text-3xl font-extrabold tracking-tight">C'est noté !</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Votre demande de rendez-vous a bien été envoyée. Nous vous recontactons très vite pour valider ce créneau avec vous.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild variant="urgent" size="lg" className="w-full sm:w-auto">
                <a href={`tel:${site.phoneRaw}`}>
                  <Phone className="mr-2 h-5 w-5" /> Gérer une urgence
                </a>
              </Button>
              <Button variant="outline" size="lg" onClick={() => setDone(false)} className="w-full sm:w-auto">
                Autre demande
              </Button>
            </div>
          </div>
        ) : (
          <form 
            onSubmit={handleSubmit(onSubmit)} 
            onFocus={() => trigger()} 
            className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-xl"
          >
            <div className="bg-muted/30 border-b border-border/40 px-6 py-4 sm:px-8">
              <p className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-accent" />
                Vos informations sont sécurisées et strictement confidentielles.
              </p>
            </div>

            <div className="p-6 sm:p-8 space-y-10">
              
              {/* SECTION 1 : Coordonnées */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-border/40 pb-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">1</div>
                  <h3 className="text-xl font-bold tracking-tight">Vos coordonnées</h3>
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
                  <div className="sm:col-span-2">
                    <Field label="E-mail" error={errors.email?.message}>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                        <Input {...register("email")} placeholder="jean@email.fr" type="email" className="pl-10 h-12 rounded-xl" />
                      </div>
                    </Field>
                  </div>
                </div>
              </div>

              {/* SECTION 2 : Détails de l'intervention */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-border/40 pb-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">2</div>
                  <h3 className="text-xl font-bold tracking-tight">L'intervention</h3>
                </div>

                <Field label="Prestation souhaitée" error={errors.service_type?.message}>
                  <div className="relative">
                    {/* Le champ caché (hidden) est nécessaire pour que React Hook Form enregistre la valeur sans utiliser le vieux select natif */}
                    <input type="hidden" {...register("service_type")} />

                    {/* Le faux bouton qui simule le select */}
                    <button
                      type="button"
                      onClick={() => setIsServiceOpen(!isServiceOpen)}
                      className={`flex h-12 w-full items-center justify-between rounded-xl border bg-background px-4 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                        isServiceOpen 
                          ? "border-accent ring-2 ring-accent/20" 
                          : "border-input hover:border-accent/50"
                      } ${!selectedService ? "text-muted-foreground" : "text-foreground"}`}
                    >
                      <div className="flex items-center gap-3">
                        <Wrench className="h-4 w-4 text-muted-foreground/70" />
                        <span className="truncate">
                          {selectedService || "Sélectionnez le type de problème…"}
                        </span>
                      </div>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground/70 transition-transform duration-200 ${isServiceOpen ? "rotate-180" : ""}`} />
                    </button>

                    {/* Le menu déroulant animé */}
                    {isServiceOpen && (
                      <>
                        {/* Overlay invisible pour fermer le menu si on clique en dehors */}
                        <div 
                          className="fixed inset-0 z-40" 
                          onClick={() => setIsServiceOpen(false)}
                        ></div>
                        
                        <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-full overflow-hidden rounded-xl border border-border/60 bg-popover text-popover-foreground shadow-lg animate-in fade-in-80 zoom-in-95">
                          <div className="max-h-96 overflow-auto p-1.5">
                            {serviceOptions.map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => {
                                  setValue("service_type", option, { shouldValidate: true });
                                  setIsServiceOpen(false);
                                }}
                                className={`relative flex w-full cursor-pointer select-none items-center rounded-lg py-3 pl-3 pr-9 text-sm font-medium outline-none transition-colors hover:bg-accent/10 hover:text-accent ${
                                  selectedService === option ? "bg-accent/10 text-accent" : ""
                                }`}
                              >
                                <span className="block truncate">{option}</span>
                                {selectedService === option && (
                                  <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-accent">
                                    <Check className="h-4 w-4" />
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </Field>

                <div className="space-y-2">
                  <Label htmlFor="preferred_date" className="text-sm font-semibold">Date souhaitée</Label>
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                    <Input id="preferred_date" {...register("preferred_date")} type="date" min={todayStr()} className="pl-10 h-12 rounded-xl" />
                  </div>
                  {errors.preferred_date && <p className="text-xs text-destructive mt-1">{errors.preferred_date.message}</p>}
                </div>

                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-sm font-semibold">Créneau horaire</Label>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {timeSlots.map((ts) => (
                      <button
                        key={ts}
                        type="button"
                        onClick={() => setValue("time_slot", ts, { shouldValidate: true })}
                        className={`group relative flex h-12 items-center justify-center rounded-xl border text-sm font-medium transition-all ${
                          slot === ts 
                            ? "border-accent bg-accent text-accent-foreground shadow-md ring-2 ring-accent ring-offset-2 ring-offset-background" 
                            : "border-input bg-background text-foreground hover:border-accent hover:bg-accent/5"
                        }`}
                      >
                        <Clock className={`mr-2 h-4 w-4 ${slot === ts ? "opacity-100" : "opacity-50 group-hover:opacity-100 group-hover:text-accent"}`} />
                        {ts}
                      </button>
                    ))}
                  </div>
                  {errors.time_slot && <p className="text-xs text-destructive mt-1">{errors.time_slot.message}</p>}
                </div>

                <Field label="Précisions" error={errors.notes?.message} optional>
                  <Textarea 
                    {...register("notes")} 
                    rows={4} 
                    placeholder="Détaillez votre problème, code d'accès, étage..." 
                    className="rounded-xl resize-none"
                  />
                </Field>

                <Field label="Photos du problème ou de l'installation" optional>
                  <PhotoUploader
                    requestType="appointment"
                    uploadToken={uploadToken}
                    onStatusChange={(s) => {
                      setPhotosUploading(s.uploading);
                      setPhotoCount(s.uploaded ? s.count : 0);
                    }}
                  />
                </Field>
              </div>
            </div>

            <div className="bg-muted/20 border-t border-border/40 p-6 sm:p-8">
              <Button 
                type="submit" 
                variant="hero" 
                size="lg" 
                className="w-full h-14 rounded-xl text-base shadow-lg transition-transform hover:scale-[1.02]" 
                disabled={isSubmitting || photosUploading}
              >
                {isSubmitting ? "Validation en cours…" : photosUploading ? "Envoi des photos…" : (
                  <>
                    Confirmer ma demande <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Besoin d'une intervention immédiate ? <Link to="/contact" className="font-semibold text-accent hover:underline">Appelez-nous en urgence</Link>.
              </p>
            </div>
          </form>
        )}
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