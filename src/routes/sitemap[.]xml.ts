import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
// Pensez à remplacer cette URL par votre vrai domaine plus tard
const BASE_URL = "https://plomberie-test.lovable.app";

interface SitemapEntry {
  path: string;
  lastmod?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        // Génère la date du jour au format YYYY-MM-DD (ex: 2026-07-17)
        const today = new Date().toISOString().split('T')[0];

        // ⚠️ Les pages en "noindex" (mentions légales, confidentialité) ont été retirées
        // car un sitemap ne doit contenir que les pages que vous voulez voir sur Google.
        const entries: SitemapEntry[] = [
          { path: "/", lastmod: today },
          { path: "/services", lastmod: today },
          { path: "/devis", lastmod: today },
          { path: "/rendez-vous", lastmod: today },
          { path: "/a-propos", lastmod: today },
          { path: "/avis", lastmod: today },
          { path: "/contact", lastmod: today },
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            `  </url>`,
          ].filter(Boolean).join("\n")
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: { 
            "Content-Type": "application/xml", 
            // Cache de 24h (86400 secondes) pour optimiser les performances serveur
            "Cache-Control": "public, max-age=86400" 
          },
        });
      },
    },
  },
});