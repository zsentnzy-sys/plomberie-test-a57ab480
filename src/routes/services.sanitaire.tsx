import { createFileRoute } from "@tanstack/react-router";
import { ServicePageLayout, buildServiceJsonLd, type ServiceFAQ, type RelatedService } from "@/components/ServicePageLayout";

const SLUG = "sanitaire" as const;
const URL = "https://plomberie-test.lovable.app/services/sanitaire";
const TITLE = "Rénovation salle de bain à Metz | Plomberie Dupont";
const DESCRIPTION =
  "Installation sanitaire et rénovation de salle de bain à Metz : douche à l'italienne, WC suspendu, lavabo, robinetterie. Devis gratuit et travaux soignés.";

const faqs: ServiceFAQ[] = [
  {
    q: "Quel budget prévoir pour rénover une salle de bain ?",
    a: "Une rénovation partielle (remplacement d'équipements, robinetterie, peinture) reste souvent contenue. Une rénovation complète, qui touche aux arrivées d'eau, aux évacuations et à l'étanchéité, représente un projet plus important. Nous établissons systématiquement un devis détaillé après visite sur place, pour éviter les mauvaises surprises.",
  },
  {
    q: "Peut-on installer une douche à l'italienne dans toutes les salles de bain ?",
    a: "Dans la majorité des cas, oui. Cela dépend surtout de la hauteur disponible sous la dalle pour intégrer l'évacuation, et de la nature du sol. Quand la contrainte technique est trop forte, un receveur extra-plat offre un rendu proche pour un chantier plus léger.",
  },
  {
    q: "Combien de temps dure une rénovation complète ?",
    a: "Comptez généralement une à deux semaines de chantier pour une rénovation complète, hors délais d'approvisionnement des équipements. Le planning est précisé sur le devis et confirmé avant de démarrer.",
  },
  {
    q: "Pouvez-vous déplacer un lavabo, une douche ou un WC ?",
    a: "Oui. Le déplacement d'un équipement implique de reprendre les arrivées d'eau chaude et froide ainsi que les évacuations, avec le respect des pentes réglementaires. Nous étudions la faisabilité pièce par pièce lors de la visite.",
  },
  {
    q: "Installez-vous les WC suspendus ?",
    a: "Oui. Nous posons les WC suspendus sur bâti-support, en veillant à la solidité de la fixation, à l'accessibilité de la trappe de maintenance et à un raccordement d'évacuation propre. Le résultat combine gain de place et facilité d'entretien.",
  },
  {
    q: "Le devis pour une rénovation est-il gratuit ?",
    a: "Oui. Pour toute rénovation de salle de bain ou installation sanitaire planifiée, le devis est gratuit et sans engagement. Il est établi après visite pour tenir compte de vos contraintes réelles.",
  },
];

const related: RelatedService[] = [
  { to: "/services/chauffage", title: "Chauffage & chaudière", desc: "Chauffe-eau, ballon thermodynamique et sèche-serviettes lors de la rénovation." },
  { to: "/services/depannage", title: "Dépannage & urgences", desc: "Fuite ou robinetterie défectueuse en attendant la rénovation." },
  { to: "/services/debouchage", title: "Débouchage canalisation", desc: "Contrôle des évacuations avant ou après travaux." },
];

export const Route = createFileRoute("/services/sanitaire")({
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
      name: "Installation sanitaire et rénovation de salle de bain à Metz",
      description: DESCRIPTION,
      breadcrumbLabel: "Sanitaire & salle de bain",
      faqs,
    }).map((data) => ({ type: "application/ld+json", children: JSON.stringify(data) })),
  }),
  component: SanitairePage,
});

function SanitairePage() {
  return (
    <ServicePageLayout
      slug={SLUG}
      breadcrumbLabel="Sanitaire & salle de bain"
      eyebrow="Sanitaire"
      h1="Installation sanitaire et rénovation de salle de bain à Metz"
      intro="Remplacement d'un lavabo, création d'une douche à l'italienne, pose d'un WC suspendu ou rénovation complète : nous accompagnons vos projets sanitaires à Metz avec un souci du détail sur l'étanchéité, les raccordements et les finitions."
      situations={{
        title: "Dans quels cas nous solliciter ?",
        body:
          "Une salle de bain, ce n'est pas seulement un décor : c'est un ensemble d'arrivées d'eau, d'évacuations et de matériaux qui doivent bien vivre ensemble dans un environnement humide. Nous intervenons aussi bien pour des remplacements ponctuels que pour une refonte complète de la pièce.",
        items: [
          "Remplacement d'un équipement usé : lavabo, WC, douche ou baignoire",
          "Passage d'une baignoire à une douche à l'italienne ou à un receveur extra-plat",
          "Création complète d'une nouvelle salle de bain",
          "Rénovation complète d'une salle de bain existante",
          "Modification des arrivées d'eau ou des évacuations pour déplacer un équipement",
          "Remplacement de robinetterie : mitigeur, mitigeur thermostatique, robinet de lavabo",
          "Adaptation de la salle de bain pour améliorer l'accessibilité",
          "Reprise d'étanchéité et de joints sanitaires anciens",
          "Installation d'un meuble vasque avec raccordement complet",
        ],
      }}
      prestations={{
        title: "Nos prestations sanitaires",
        body:
          "Nous distinguons clairement le remplacement d'un équipement, la rénovation partielle et la rénovation complète. Chaque option a son intérêt selon l'état de la salle de bain et vos objectifs.",
        items: [
          "Pose de douche à l'italienne : receveur, paroi, colonne, siphon",
          "Pose de baignoire ou remplacement baignoire par douche",
          "Installation de WC classique ou WC suspendu sur bâti-support",
          "Pose de lavabo, vasque, plan vasque et meuble vasque",
          "Alimentation en eau froide et eau chaude sanitaire",
          "Reprise ou création d'évacuations avec pentes réglementaires",
          "Pose de robinet mitigeur, mitigeur thermostatique, robinetterie de bain",
          "Reprise des joints sanitaires et de l'étanchéité autour des équipements",
          "Coordination des travaux annexes (électricité, carrelage) quand nécessaire",
        ],
      }}
      process={{
        title: "Le déroulement d'un projet sanitaire",
        body:
          "Un chantier de salle de bain se prépare : bien plus que les équipements, ce sont les arrivées d'eau, les évacuations et l'étanchéité qui font la longévité de la rénovation.",
        steps: [
          { title: "Prise de contact", desc: "Vous décrivez votre projet : remplacement simple, rénovation partielle ou complète." },
          { title: "Visite technique", desc: "Nous relevons les contraintes réelles : arrivées, évacuations, hauteur sous dalle, état des cloisons." },
          { title: "Solutions et choix", desc: "Nous vous proposons des options adaptées à votre budget et à l'usage : équipements, matériaux, agencement." },
          { title: "Devis détaillé", desc: "Devis écrit et détaillé, gratuit, poste par poste, avec un planning prévisionnel." },
          { title: "Réalisation", desc: "Chantier organisé pour limiter la gêne, protection des sols et évacuation des déchets." },
          { title: "Vérification", desc: "Contrôle d'étanchéité, mise en eau, essais de robinetterie et remise en service." },
        ],
      }}
      zone={{
        title: "Rénovation de salle de bain à Metz et alentours",
        body:
          "Nous réalisons vos travaux sanitaires à Metz et dans un rayon d'environ 30 km, notamment à Montigny-lès-Metz, Woippy, Marly, Maizières-lès-Metz et dans l'ensemble de l'Eurométropole de Metz.",
      }}
      reassurance={{
        title: "Une rénovation sereine du devis à la mise en eau",
        body:
          "Un chantier de salle de bain doit être clair, tant sur le prix que sur les étapes. Voici ce sur quoi nous nous engageons.",
        items: [
          "Devis gratuit et détaillé pour toute rénovation planifiée",
          "Tarifs de référence disponibles sur notre page services",
          "Facture détaillée conforme au devis validé",
          "Assurance responsabilité civile professionnelle et garantie décennale sur les installations",
          "Un seul artisan interlocuteur du premier échange à la fin des travaux",
        ],
      }}
      faqTitle="Questions fréquentes sur les installations sanitaires"
      faqs={faqs}
      ctaTitle="Un projet de salle de bain à concrétiser ?"
      ctaBody="Décrivez-nous votre projet : nous revenons vers vous rapidement avec une première estimation."
      related={related}
    />
  );
}