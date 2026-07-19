import { createFileRoute } from "@tanstack/react-router";
import { ServicePageLayout, buildServiceJsonLd, type ServiceFAQ, type RelatedService } from "@/components/ServicePageLayout";

const SLUG = "depannage" as const;
const URL = "https://plomberie-test.lovable.app/services/depannage";
const TITLE = "Dépannage plomberie à Metz | Plomberie Dupont";
const DESCRIPTION =
  "Fuite d'eau, WC bouché, chauffe-eau en panne : dépannage plomberie en urgence à Metz et alentours. Diagnostic, réparation et tarifs annoncés à l'avance.";

const faqs: ServiceFAQ[] = [
  {
    q: "Que faire en attendant l'arrivée du plombier en cas de fuite ?",
    a: "Coupez l'arrivée d'eau générale du logement, épongez ce qui s'écoule et essayez de contenir l'eau avec un récipient sous la fuite. Si l'eau touche des prises ou un tableau électrique, coupez également le disjoncteur concerné. Prenez quelques photos, elles nous aident à préparer l'intervention.",
  },
  {
    q: "Comment couper l'arrivée d'eau de mon logement ?",
    a: "Le robinet d'arrêt général se trouve souvent près du compteur d'eau, dans un placard technique, sous l'évier ou dans le local commun d'un immeuble. Tournez-le dans le sens des aiguilles d'une montre jusqu'à la butée. En cas de doute, appelez-nous : nous vous guidons par téléphone.",
  },
  {
    q: "Une fuite invisible peut-elle être localisée sans casser les murs ?",
    a: "Oui, dans une grande majorité des cas. Nous utilisons plusieurs méthodes selon la situation : écoute acoustique, mise sous pression du réseau, caméra thermique ou inspection vidéo. L'objectif est de localiser précisément la fuite avant toute intervention sur les cloisons ou le carrelage.",
  },
  {
    q: "Combien coûte un dépannage plomberie ?",
    a: `Le déplacement et le diagnostic sont facturés à partir de 49 €. Une recherche et réparation de fuite se situe généralement entre 90 et 180 €, la réparation d'une chasse d'eau entre 80 et 150 €. Le tarif exact vous est confirmé sur place, avant toute réparation.`,
  },
  {
    q: "Intervenez-vous le week-end et les jours fériés ?",
    a: "Oui. Les urgences plomberie ne suivent pas le calendrier : nous assurons un service de dépannage 7 j/7, y compris le week-end et les jours fériés, sur Metz et les communes de l'Eurométropole.",
  },
  {
    q: "Réparez-vous les chauffe-eau et cumulus ?",
    a: "Oui. Nous intervenons sur les chauffe-eau électriques et les cumulus : remplacement de résistance, thermostat, groupe de sécurité, purge, détartrage ou remplacement complet du ballon selon son état. Une panne complète de chaudière est traitée sur notre page chauffage.",
  },
];

const related: RelatedService[] = [
  { to: "/services/chauffage", title: "Chauffage & chaudière", desc: "Panne de chaudière, absence d'eau chaude ou de chauffage : nos interventions dédiées." },
  { to: "/services/debouchage", title: "Débouchage canalisation", desc: "Évier, WC, douche : débouchage mécanique ou hydrocurage haute pression." },
  { to: "/services/sanitaire", title: "Sanitaire & salle de bain", desc: "Remplacement de robinetterie, WC, lavabo et rénovation complète." },
];

export const Route = createFileRoute("/services/depannage")({
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
      name: "Dépannage plomberie en urgence à Metz",
      description: DESCRIPTION,
      breadcrumbLabel: "Dépannage plomberie",
      faqs,
    }).map((data) => ({ type: "application/ld+json", children: JSON.stringify(data) })),
  }),
  component: DepannagePage,
});

function DepannagePage() {
  return (
    <ServicePageLayout
      slug={SLUG}
      breadcrumbLabel="Dépannage plomberie"
      eyebrow="Dépannage & urgences"
      h1="Dépannage plomberie en urgence à Metz"
      intro="Fuite d'eau, WC qui déborde, chauffe-eau en panne ou robinet impossible à fermer : nous intervenons rapidement à Metz et dans les communes alentour pour remettre votre installation en état, sans mauvaise surprise sur la facture."
      situations={{
        title: "Quand faire appel à un plombier en urgence ?",
        body:
          "Un problème de plomberie n'attend pas toujours le lendemain. Certaines situations nécessitent une mise en sécurité immédiate de l'installation, d'autres peuvent patienter quelques heures. Dans les deux cas, un diagnostic précis évite de casser inutilement une cloison ou de remplacer une pièce encore fonctionnelle. Voici les cas les plus fréquents pour lesquels vous pouvez nous solliciter.",
        items: [
          "Fuite d'eau visible sous un évier, derrière un WC ou au niveau d'un raccord",
          "Fuite invisible suspectée : trace d'humidité, surconsommation d'eau, tache au plafond",
          "Dégât des eaux chez vous ou en provenance d'un voisin",
          "WC bouché, qui déborde ou dont la chasse d'eau fuit en continu",
          "Robinet impossible à fermer ou robinet d'arrêt bloqué",
          "Panne de chauffe-eau, cumulus ou ballon d'eau chaude, absence d'eau chaude",
          "Groupe de sécurité qui goutte en permanence",
          "Baisse ou absence de pression d'eau dans le logement",
          "Canalisation percée, flexible éclaté, raccord qui suinte",
        ],
      }}
      prestations={{
        title: "Nos prestations de dépannage plomberie",
        body:
          "Le dépannage couvre autant les micro-fuites que les interventions plus lourdes. Nous privilégions toujours la solution la moins invasive : réparer plutôt que remplacer quand c'est possible, remplacer quand la pièce est en fin de vie ou hors d'usage.",
        items: [
          "Recherche de fuite d'eau avec méthode adaptée (écoute, pression, caméra thermique)",
          "Réparation ou remplacement de canalisation (cuivre, PER, multicouche, PVC)",
          "Réparation ou remplacement de robinetterie : mitigeur, robinet, robinet d'arrêt",
          "Remplacement de flexible, siphon, joint et raccord",
          "Réparation de chasse d'eau, mécanisme, joint de cuvette et flotteur",
          "Débouchage d'urgence de WC, évier ou lavabo (voir aussi débouchage)",
          "Dépannage de chauffe-eau électrique et cumulus",
          "Remplacement de groupe de sécurité, résistance ou thermostat de ballon",
          "Mise en sécurité provisoire d'une installation avant réparation définitive",
        ],
      }}
      process={{
        title: "Comment se déroule une intervention de dépannage ?",
        body:
          "Notre méthode reste la même quelle que soit l'urgence : comprendre le problème, expliquer la solution, annoncer le tarif, réparer, puis vérifier avant de partir. Vous savez à chaque étape ce qui se passe chez vous.",
        steps: [
          { title: "Prise de contact", desc: "Vous décrivez la situation par téléphone. Nous confirmons un créneau et, si nécessaire, vous guidons pour couper l'eau." },
          { title: "Diagnostic sur place", desc: "Nous identifions l'origine réelle de la panne : fuite, pièce défectueuse, bouchon, usure. Le diagnostic conditionne la suite." },
          { title: "Explication de la solution", desc: "Nous vous expliquons ce qu'il faut faire, les pièces à remplacer et pourquoi. Vous décidez en connaissance de cause." },
          { title: "Tarif ou devis", desc: "Le prix vous est annoncé avant toute intervention : tarif clair pour un dépannage courant, devis écrit si la réparation est plus lourde." },
          { title: "Réparation", desc: "Nous intervenons avec le matériel nécessaire, en protégeant les surfaces autour de la zone de travail." },
          { title: "Vérification et facture", desc: "Nous testons l'installation, vérifions l'absence de fuite et vous remettons une facture détaillée." },
        ],
      }}
      zone={{
        title: "Un plombier proche de chez vous à Metz et alentours",
        body:
          "Nous intervenons à Metz et dans un rayon d'environ 30 km : Montigny-lès-Metz, Woippy, Marly, Maizières-lès-Metz et l'ensemble de l'Eurométropole de Metz. Cette proximité nous permet de répondre rapidement aux urgences sans facturer un déplacement disproportionné.",
      }}
      reassurance={{
        title: "Un dépannage clair et rassurant",
        body:
          "Un dépannage réussi, ce n'est pas seulement une fuite arrêtée : c'est aussi comprendre ce qui s'est passé et repartir serein. Nous nous engageons sur des règles simples, valables pour toutes nos interventions.",
        items: [
          "Tarif annoncé avant intervention, pas de surprise à la fin",
          "Grille de tarifs consultable publiquement sur notre page services",
          "Facture détaillée systématiquement remise à la fin",
          "Responsabilité civile professionnelle et garantie décennale pour les installations concernées",
          "Artisan plombier-chauffagiste unique interlocuteur, du premier appel à la fin des travaux",
        ],
      }}
      faqTitle="Questions fréquentes sur le dépannage plomberie"
      faqs={faqs}
      ctaTitle="Une urgence ou une panne à traiter ?"
      ctaBody="Appelez-nous pour une intervention rapide, ou envoyez-nous une demande en ligne pour un dépannage planifié."
      related={related}
    />
  );
}