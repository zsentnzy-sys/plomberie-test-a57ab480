import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { site } from "@/lib/site";

export const Route = createFileRoute("/unsubscribe")({
  head: () => ({
    meta: [
      { title: "Désabonnement — Plomberie Dupont" },
      { name: "description", content: "Gérez vos préférences e-mail : confirmez votre désabonnement pour ne plus recevoir d'e-mails de Plomberie Dupont." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Désabonnement — Plomberie Dupont" },
      { property: "og:description", content: "Confirmez votre désabonnement pour ne plus recevoir d'e-mails de Plomberie Dupont." },
      { property: "og:url", content: "https://plomberie-test.lovable.app/unsubscribe" },
    ],
  }),
  component: UnsubscribePage,
});

type State = "loading" | "valid" | "invalid" | "already" | "done" | "error";

function UnsubscribePage() {
  const [state, setState] = useState<State>("loading");
  const [submitting, setSubmitting] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    setToken(t);
    if (!t) {
      setState("invalid");
      return;
    }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(t)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.valid) setState("valid");
        else if (d.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      })
      .catch(() => setState("error"));
  }, []);

  const confirm = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const d = await res.json();
      if (d.success) setState("done");
      else if (d.reason === "already_unsubscribed") setState("already");
      else setState("error");
    } catch {
      setState("error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <div className="w-full rounded-2xl border border-border bg-card p-8 shadow-soft">
        {state === "loading" && (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-accent" />
            <p className="mt-4 text-muted-foreground">Vérification du lien…</p>
          </>
        )}
        {state === "valid" && (
          <>
            <h1 className="text-2xl font-bold">Se désabonner</h1>
            <p className="mt-2 text-muted-foreground">
              Confirmez pour ne plus recevoir d'e-mails de {site.name}.
            </p>
            <Button className="mt-6" variant="hero" onClick={confirm} disabled={submitting}>
              {submitting ? "Traitement…" : "Confirmer le désabonnement"}
            </Button>
          </>
        )}
        {state === "done" && (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-accent" />
            <h1 className="mt-4 text-2xl font-bold">Désabonnement confirmé</h1>
            <p className="mt-2 text-muted-foreground">
              Vous ne recevrez plus d'e-mails de notre part.
            </p>
          </>
        )}
        {state === "already" && (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-accent" />
            <h1 className="mt-4 text-2xl font-bold">Déjà désabonné</h1>
            <p className="mt-2 text-muted-foreground">
              Cette adresse est déjà désabonnée.
            </p>
          </>
        )}
        {(state === "invalid" || state === "error") && (
          <>
            <XCircle className="mx-auto h-12 w-12 text-destructive" />
            <h1 className="mt-4 text-2xl font-bold">Lien invalide</h1>
            <p className="mt-2 text-muted-foreground">
              Ce lien de désabonnement est invalide ou a expiré.
            </p>
          </>
        )}
      </div>
    </section>
  );
}