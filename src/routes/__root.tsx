import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";

import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/sora/wght.css";

/*
 * Vite transforme ces imports en URL contenant
 * le nom de fichier hashé produit lors du build.
 */
import interLatinWghtUrl from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import soraLatinWghtUrl from "@fontsource-variable/sora/files/sora-latin-wght-normal.woff2?url";

import "../styles.css";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { MobileCallBar } from "../components/MobileCallBar";
import { Toaster } from "../components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>

        <h2 className="mt-4 text-xl font-semibold text-foreground">
          Page introuvable
        </h2>

        <p className="mt-2 text-sm text-muted-foreground">
          La page que vous recherchez n'existe pas ou a été déplacée.
        </p>

        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  console.error(error);

  const router = useRouter();

  useEffect(() => {
    reportLovableError(error, {
      boundary: "tanstack_root_error_component",
    });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Cette page n'a pas pu se charger
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Quelque chose s'est mal passé de notre côté. Vous pouvez essayer de
          rafraîchir la page ou revenir à l'accueil.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Réessayez
          </button>

          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Retour à l'accueil
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        property: "og:site_name",
        content: "Plomberie Dupont",
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b193927d-1858-437a-9545-1f139829b524/id-preview-22febcc7--2ac8cc8b-f0c9-4b74-9068-10830844fc7a.lovable.app-1782147918592.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b193927d-1858-437a-9545-1f139829b524/id-preview-22febcc7--2ac8cc8b-f0c9-4b74-9068-10830844fc7a.lovable.app-1782147918592.png",
      },
      {
        name: "google-site-verification",
        content: "k0JAE53YdP5e7sJfHvx1HSraKZPzd7fYo--NkBxKhw4",
      },
    ],

    links: [
      /*
       * Police des titres et notamment du H1.
       * Placée en premier, car elle est probablement utilisée
       * dans la partie visible immédiatement.
       */
      {
        rel: "preload",
        href: soraLatinWghtUrl,
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },

      /*
       * Police principale du texte et de l'interface.
       */
      {
        rel: "preload",
        href: interLatinWghtUrl,
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },

      {
        rel: "icon",
        href: "https://plomberie-test.lovable.app/favicon.ico",
        sizes: "any",
      },
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "https://plomberie-test.lovable.app/favicon.svg",
      },
      {
        rel: "icon",
        type: "image/webp",
        sizes: "32x32",
        href: "https://plomberie-test.lovable.app/favicon-32.webp",
      },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "https://plomberie-test.lovable.app/apple-touch-icon.webp",
      },
      {
        rel: "manifest",
        href: "https://plomberie-test.lovable.app/site.webmanifest",
      },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>

      <body>
        {children}

        <Scripts />
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  // Route diagnostique minimal
  if (pathname === "/test") {
    return <Outlet />;
  }
  const isAdmin = pathname.startsWith("/admin");

  if (isAdmin) {
    return (
      <QueryClientProvider client={queryClient}>
        <Outlet />
        <Toaster richColors position="top-center" />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col">
        <Header />

        <main className="flex-1 pb-16 lg:pb-0">
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
        </main>

        <Footer />
        {/*<MobileCallBar />*/}
      </div>

      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}