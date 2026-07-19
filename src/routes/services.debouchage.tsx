import { createFileRoute } from "@tanstack/react-router";
import { ServicePageLayout, buildServiceJsonLd, type ServiceFAQ, type RelatedService } from "@/components/ServicePageLayout";

const SLUG = "debouchage" as const;
const URL = "https://plomberie-test.lovable.app/services/debouchage";
const TITLE = "Débouchage canalisation à Metz | Plomberie Dupont";
const DESCRIPTION =
  "Canalisation, WC ou évier bouché à Metz : débouchage mécanique, hydrocurage haute pression et inspection caméra. Intervention rapide et durable.";

const faqs: ServiceFAQ[] = [
  {
    q: "Comment savoir où se trouve le bouchon dans la canalisation ?",
    a: "L'origine du bouchon se déduit d'abord des symptômes : un seul équipement concerné, l'obstruction est proche ; plusieurs équipements affectés, c'est plus en aval sur le réseau. Une inspection vidéo par caméra permet de localiser précisément le bouchon quand le doute persiste.",
  },
  {
    q: "Quand faut-il utiliser un hydrocurage haute pression ?",
    a: "Le curage haute pression est indiqué pour les bouchons de graisse, les accumulations tenaces et les canalisations qui se rebouchent souvent. Il nettoie les parois de la canalisation, contrairement au furet qui perce simplement le bouchon.",
  },
  {
    q: "Une inspection caméra est-elle toujours nécessaire ?",
    a: "Non. Pour un WC bouché ou un évier obstrué par un bouchon classique, un débouchage direct suffit. La caméra devient utile quand les bouchons se répètent, quand l'écoulement reste lent après débouchage, ou pour rechercher une cause structurelle (racine, canalisation cassée, contre-pente).",
  },
  {
    q: "Pourquoi une canalisation se bouche-t-elle régulièrement ?",
    a: "Les causes courantes : accumulation de graisses, dépôts de calcaire, cheveux, résidus de savon, mais aussi défauts structurels comme une contre-pente ou une racine dans le réseau extérieur. Traiter la cause plutôt que le seul symptôme évite les rebouchages en série.",
  },
  {
    q: "Que faire quand l'eau remonte dans plusieurs équipements en même temps ?",
    a: "C'est le signe d'un bouchon situé plus en aval, sur une canalisation commune ou sur la colonne d'évacuation. Cessez d'utiliser les équipements concernés, ne versez pas de produit chimique et contactez-nous : il faut intervenir sur la bonne portion du réseau.",
  },
  {
    q: "Intervenez-vous pour un WC bouché en urgence ?",
    a: "Oui. Un WC totalement bouché entre dans nos interventions urgentes 7 j/7 à Metz et dans l'Eurométropole. Nous privilégions les méthodes mécaniques qui préservent la cuvette et la canalisation.",
  },
];

const related: RelatedService[] = [
  { to: "/services/depannage", title: "Dépannage & urgences", desc: "Fuite associée, refoulement ou robinetterie à réparer." },
  { to: "/services/sanitaire", title: "Sanitaire & salle de bain", desc: "Remise en état des évacuations lors d'une rénovation." },
  { to: "/services/chauffage", title: "Chauffage & chaudière", desc: "Réseau de chauffage embouché : désembouage dédié." },
];

export const Route = createFileRoute("/services/debouchage")({
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
      name: "Débouchage de canalisation à Metz",
      description: DESCRIPTION,
      breadcrumbLabel: "Débouchage canalisation",
      faqs,
    }).map((data) => ({ type: "application/ld+json", children: JSON.stringify(data) })),
  }),
  component: DebouchagePage,
});

function DebouchagePage() {
  return (
    <ServicePageLayout
      slug={SLUG}
      breadcrumbLabel="Débouchage canalisation"
      eyebrow="Débouchage"
      h1="Débouchage de canalisation à Metz"
      intro="Évier qui s'écoule au ralenti, WC qui refoule, mauvaises odeurs, glouglous dans les canalisations : nous intervenons rapidement à Metz pour débloquer votre installation et surtout comprendre pourquoi elle s'est bouchée, afin d'éviter que cela recommence."
      situations={{
        title: "Les signes qui doivent alerter",
        body:
          "Une canalisation ne se bouche presque jamais d'un coup : elle se rétrécit progressivement. Repérer les signes tôt permet d'intervenir avant l'obstruction complète, souvent plus simple à traiter.",
        items: [
          "Écoulement de plus en plus lent d'un évier, lavabo, douche ou baignoire",
          "WC dont la chasse s'évacue mal ou remonte partiellement",
          "Glouglous dans les canalisations lors des écoulements",
          "Mauvaises odeurs persistantes qui sortent des évacuations",
          "Remontée d'eau sale ou reflux dans un équipement voisin",
          "Plusieurs équipements bouchés en même temps",
          "Fuite ou trace d'humidité au niveau d'un raccord d'évacuation",
          "Canalisation extérieure ou regard qui déborde",
        ],
      }}
      prestations={{
        title: "Nos méthodes de débouchage",
        body:
          "Nous choisissons la méthode la moins invasive possible et la plus adaptée au type de bouchon. Nous évitons les produits chimiques corrosifs vendus en grande surface : ils peuvent abîmer les joints, la robinetterie et l'émail, et ne traitent pas la cause du bouchon.",
        items: [
          "Débouchage manuel avec ventouse ou pompe adaptée",
          "Débouchage mécanique au furet manuel ou électrique",
          "Hydrocurage haute pression pour bouchons de graisse et dépôts tenaces",
          "Inspection vidéo par caméra pour localiser le bouchon et le contrôler",
          "Débouchage WC, évier, lavabo, douche et baignoire",
          "Intervention sur colonne d'évacuation et raccordement au tout-à-l'égout",
          "Entretien préventif de canalisation pour installations sensibles",
        ],
      }}
      process={{
        title: "Comment se déroule un débouchage ?",
        body:
          "Le débouchage se pense en deux temps : rétablir l'écoulement, puis comprendre pourquoi le bouchon s'est formé pour proposer, si besoin, une solution durable.",
        steps: [
          { title: "Prise de contact", desc: "Vous décrivez les équipements concernés et la nature du problème (lenteur, obstruction totale, refoulement)." },
          { title: "Diagnostic sur place", desc: "Nous identifions la portion de canalisation en cause et le type de bouchon probable." },
          { title: "Méthode adaptée", desc: "Nous vous expliquons la méthode retenue : mécanique, hydrocurage ou inspection caméra selon le contexte." },
          { title: "Tarif ou devis", desc: "Le tarif est annoncé avant de démarrer. Une intervention lourde fait l'objet d'un devis écrit." },
          { title: "Débouchage", desc: "Nous intervenons proprement, en protégeant la zone autour de la canalisation traitée." },
          { title: "Vérification & conseils", desc: "Nous vérifions l'écoulement, contrôlons l'absence de fuite et vous donnons quelques conseils d'entretien." },
        ],
      }}
      zone={{
        title: "Débouchage à Metz et dans l'Eurométropole",
        body:
          "Nous intervenons à Metz et jusqu'à environ 30 km alentour : Montigny-lès-Metz, Woippy, Marly, Maizières-lès-Metz et l'ensemble des communes de l'Eurométropole. Les urgences de débouchage sont prises en charge 7 j/7.",
      }}
      reassurance={{
        title: "Un débouchage clair, sans mauvaise surprise",
        body:
          "Un bouchon est rarement une bonne surprise : nous faisons en sorte que l'intervention, elle, se passe simplement.",
        items: [
          "Tarif annoncé avant l'intervention et grille de tarifs consultable",
          "Facture détaillée systématiquement remise",
          "Méthodes respectueuses de votre installation, pas de produit corrosif en première intention",
          "Responsabilité civile professionnelle pour toutes nos interventions",
          "Conseils pour éviter la récidive après l'intervention",
        ],
      }}
      faqTitle="Questions fréquentes sur le débouchage"
      faqs={faqs}
      ctaTitle="Une canalisation bouchée à traiter ?"
      ctaBody="Appelez-nous pour une intervention rapide ou envoyez votre demande en ligne."
      related={related}
    />
  );
}