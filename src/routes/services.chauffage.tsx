import { createFileRoute } from "@tanstack/react-router";
import { ServicePageLayout, buildServiceJsonLd, type ServiceFAQ, type RelatedService } from "@/components/ServicePageLayout";

const SLUG = "chauffage" as const;
const URL = "https://plomberie-test.lovable.app/services/chauffage";
const TITLE = "Chauffagiste à Metz : chaudière & entretien | Plomberie Dupont";
const DESCRIPTION =
  "Chauffagiste à Metz : entretien annuel de chaudière, dépannage, remplacement et installation de chaudière gaz, pompe à chaleur et ballon thermodynamique.";

const faqs: ServiceFAQ[] = [
  {
    q: "L'entretien annuel d'une chaudière est-il obligatoire ?",
    a: "Oui. Pour les chaudières gaz, fioul, bois ou à granulés dont la puissance est comprise entre 4 et 400 kW, un entretien annuel est obligatoire pour l'occupant du logement. Cet entretien porte sur la sécurité, les performances et les émissions de l'appareil. Une attestation vous est remise à la fin de la visite.",
  },
  {
    q: "Pourquoi ma chaudière perd-elle de la pression ?",
    a: "Une baisse de pression peut venir d'une fuite sur le circuit de chauffage, d'un vase d'expansion en défaut ou d'une purge récente. Si vous devez remettre de l'eau plus d'une fois par mois, il y a probablement un problème sous-jacent qu'il faut diagnostiquer avant qu'il n'endommage la chaudière.",
  },
  {
    q: "Pourquoi certains radiateurs restent-ils froids ?",
    a: "Le plus souvent, il s'agit d'air emprisonné dans le circuit : une purge des radiateurs suffit à rétablir la chauffe. Si le problème persiste, il peut s'agir d'un déséquilibre du réseau, d'un circulateur fatigué ou de boues accumulées dans les canalisations, qui nécessitent alors un désembouage.",
  },
  {
    q: "Quand faut-il envisager le remplacement d'une chaudière ?",
    a: "Au-delà de 15 à 20 ans, une chaudière consomme plus, tombe plus souvent en panne et devient plus difficile à réparer (pièces indisponibles). Le remplacement se justifie aussi quand les codes d'erreur se répètent malgré les dépannages ou lorsque le rendement s'est nettement dégradé.",
  },
  {
    q: "Intervenez-vous sur les pompes à chaleur ?",
    a: "Oui. Nous intervenons sur les pompes à chaleur air/eau et les ballons thermodynamiques : mise en service, dépannage, entretien courant et remplacement. Certaines opérations spécifiques sur le circuit frigorifique restent réservées à un intervenant titulaire de l'attestation de capacité fluides.",
  },
  {
    q: "Fournissez-vous une attestation d'entretien ?",
    a: "Oui, systématiquement. Après chaque entretien annuel de chaudière, nous vous remettons une attestation détaillée : contrôles réalisés, mesures effectuées, éventuelles recommandations. Ce document est à conserver et peut vous être demandé par votre assurance.",
  },
];

const related: RelatedService[] = [
  { to: "/services/depannage", title: "Dépannage & urgences", desc: "Panne inattendue, fuite d'eau ou de gaz : intervention 7 j/7." },
  { to: "/services/sanitaire", title: "Sanitaire & salle de bain", desc: "Ballon d'eau chaude, robinetterie et rénovation complète." },
  { to: "/services/debouchage", title: "Débouchage canalisation", desc: "Évacuation lente ou bouchée : intervention adaptée." },
];

export const Route = createFileRoute("/services/chauffage")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: buildServiceJsonLd({
      slug: SLUG,
      name: "Chauffagiste à Metz : chaudière, entretien et dépannage",
      description: DESCRIPTION,
      breadcrumbLabel: "Chauffage & chaudière",
      faqs,
    }).map((data) => ({ type: "application/ld+json", children: JSON.stringify(data) })),
  }),
  component: ChauffagePage,
});

function ChauffagePage() {
  return (
    <ServicePageLayout
      slug={SLUG}
      breadcrumbLabel="Chauffage & chaudière"
      eyebrow="Chauffage"
      h1="Chauffagiste à Metz : chaudière, entretien et dépannage"
      intro="Entretien annuel, dépannage, remplacement ou installation neuve : nous intervenons sur les chaudières gaz à condensation, les pompes à chaleur et les ballons thermodynamiques à Metz et dans l'Eurométropole. Objectif : un chauffage fiable, économe et durable."
      situations={{
        title: "Quand contacter votre chauffagiste ?",
        body:
          "Un système de chauffage bien entretenu tombe rarement en panne au pire moment. Certaines situations sont clairement des urgences (pas de chauffage en plein hiver, pas d'eau chaude), d'autres sont des signaux faibles qu'il vaut mieux traiter avant l'aggravation.",
        items: [
          "Chaudière qui ne démarre plus, se met en sécurité ou affiche un code erreur",
          "Absence totale de chauffage ou d'eau chaude sanitaire",
          "Baisse répétée de pression du circuit de chauffage",
          "Radiateurs froids en haut, tièdes en bas ou totalement inertes",
          "Bruits anormaux : claquements, sifflements, bouillonnements",
          "Odeur suspecte à proximité de la chaudière",
          "Consommation de gaz ou d'électricité en forte hausse à usage égal",
          "Chaudière ancienne, réparée régulièrement, dont les pièces se raréfient",
          "Projet de remplacement par une chaudière à condensation ou une pompe à chaleur",
        ],
      }}
      prestations={{
        title: "Ce que nous prenons en charge côté chauffage",
        body:
          "Nous couvrons le cycle complet d'un système de chauffage : de l'entretien courant à l'installation neuve, en passant par les dépannages et le remplacement d'équipements en fin de vie.",
        items: [
          "Entretien annuel de chaudière gaz avec attestation",
          "Dépannage de chaudière : brûleur, circulateur, vase d'expansion, sonde",
          "Diagnostic de codes erreur et remise en service",
          "Purge des radiateurs et désembouage du réseau de chauffage",
          "Remplacement de chaudière par une chaudière gaz à condensation",
          "Installation de pompe à chaleur air/eau (PAC)",
          "Installation de ballon thermodynamique",
          "Remplacement de radiateurs et pose de robinets thermostatiques",
          "Réglage de la régulation et du thermostat pour optimiser la consommation",
        ],
      }}
      process={{
        title: "Comment se déroule une intervention chauffage ?",
        body:
          "Que ce soit pour un entretien planifié ou un dépannage, notre démarche reste la même : comprendre l'état réel de l'installation avant de proposer une solution proportionnée.",
        steps: [
          { title: "Prise de contact", desc: "Vous nous décrivez la panne ou la demande (entretien, remplacement). Nous fixons un créneau." },
          { title: "Diagnostic", desc: "Sur place, nous relevons les codes erreur, contrôlons la pression, les organes de sécurité et le brûleur." },
          { title: "Solution expliquée", desc: "Nous vous expliquons ce qui doit être réparé, remplacé ou simplement entretenu, et pourquoi." },
          { title: "Devis ou tarif", desc: "Entretien à tarif fixe, dépannage annoncé à l'avance, installation sur devis écrit détaillé." },
          { title: "Réalisation", desc: "Nous intervenons proprement, protégeons le sol autour de la chaudière et évacuons les pièces remplacées." },
          { title: "Vérification & attestation", desc: "Contrôle du bon fonctionnement, remise en service et attestation d'entretien le cas échéant." },
        ],
      }}
      zone={{
        title: "Chauffagiste à Metz et dans l'Eurométropole",
        body:
          "Nous intervenons à Metz et jusqu'à environ 30 km autour, notamment à Montigny-lès-Metz, Woippy, Marly et Maizières-lès-Metz. Cette proximité est particulièrement précieuse pour l'entretien annuel et pour les dépannages en période de chauffe.",
      }}
      reassurance={{
        title: "Un chauffagiste artisan à vos côtés dans la durée",
        body:
          "Un système de chauffage se vit dans le temps. Notre approche est de suivre votre installation d'une année sur l'autre plutôt que d'enchaîner les visites anonymes.",
        items: [
          "Devis gratuit pour les installations et remplacements planifiés",
          "Tarif d'entretien annuel affiché à l'avance",
          "Attestation d'entretien remise systématiquement",
          "Facture détaillée et conforme à la réglementation",
          "Assurance responsabilité civile professionnelle et garantie décennale sur les installations",
          "Un seul interlocuteur pour l'entretien, le dépannage et les évolutions futures",
        ],
      }}
      faqTitle="Questions fréquentes sur le chauffage"
      faqs={faqs}
      ctaTitle="Entretien, dépannage ou remplacement de chaudière ?"
      ctaBody="Parlons de votre installation pour définir la solution la plus adaptée."
      related={related}
    />
  );
}