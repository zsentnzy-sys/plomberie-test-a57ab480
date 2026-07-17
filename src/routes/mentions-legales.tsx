import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/mentions-legales')({
  head: () => ({
    meta: [
      { title: 'Mentions légales | Plomberie Dupont' },
      {
        name: 'description',
        content:
          'Mentions légales du site Plomberie Dupont : éditeur, hébergement, propriété intellectuelle et responsabilité.',
      },
      {
        name: 'robots',
        content: 'noindex, follow',
      },
      { property: 'og:title', content: 'Mentions légales | Plomberie Dupont' },
      { property: 'og:description', content: 'Mentions légales du site Plomberie Dupont : éditeur, hébergement, propriété intellectuelle et responsabilité.' },
      { property: 'og:url', content: 'https://plomberie-test.lovable.app/mentions-legales' },
    ],
  }),
  component: LegalNoticesPage,
});

function LegalNoticesPage() {
  return (
    <main className="bg-background">
      <section className="container mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:py-24">
        <header className="mb-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
            Informations juridiques
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Mentions légales
          </h1>

          <p className="mt-4 text-muted-foreground">
            Dernière mise à jour :{' '}
            <time dateTime="2026-07-17">17 juillet 2026</time>
          </p>
        </header>

        <div className="space-y-12 text-foreground">
          <LegalSection title="1. Éditeur du site">
            <p>
              Le présent site est édité par :
            </p>

            <dl className="mt-4 grid gap-3">
              <LegalInformation
                label="Nom commercial"
                value="[Nom Entreprise]"
              />

              <LegalInformation
                label="Nom et prénom de l’entrepreneur"
                value="[NOM ET PRÉNOM DE L’ARTISAN]"
              />

              <LegalInformation
                label="Statut juridique"
                value="[ENTREPRENEUR INDIVIDUEL / MICRO-ENTREPRENEUR / SARL / SASU]"
              />

              <LegalInformation
                label="Adresse professionnelle"
                value="[ADRESSE COMPLÈTE]"
              />

              <LegalInformation
                label="Téléphone"
                value="[NUMÉRO DE TÉLÉPHONE]"
              />

              <LegalInformation
                label="Adresse électronique"
                value="[ADRESSE E-MAIL PROFESSIONNELLE]"
              />

              <LegalInformation
                label="SIREN"
                value="[NUMÉRO SIREN]"
              />

              <LegalInformation
                label="SIRET"
                value="[NUMÉRO SIRET]"
              />

              <LegalInformation
                label="Immatriculation"
                value="[IMMATRICULÉ AU RNE SOUS LE NUMÉRO…]"
              />

              <LegalInformation
                label="TVA intracommunautaire"
                value="[NUMÉRO DE TVA OU « TVA NON APPLICABLE, ARTICLE 293 B DU CGI »]"
              />
            </dl>
          </LegalSection>

          <LegalSection title="2. Directeur de la publication">
            <p>
              Le directeur de la publication est :
              {' '}
              <strong>[NOM ET PRÉNOM DU RESPONSABLE]</strong>.
            </p>

            <p className="mt-4">
              Il peut être contacté à l’adresse suivante :
              {' '}
              <a
                href="mailto:[ADRESSE E-MAIL]"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                [ADRESSE E-MAIL]
              </a>
              .
            </p>
          </LegalSection>

          <LegalSection title="3. Hébergement du site">
            <p>
              Le site est hébergé par :
            </p>

            <dl className="mt-4 grid gap-3">
              <LegalInformation
                label="Hébergeur"
                value="[NOM OU RAISON SOCIALE DE L’HÉBERGEUR]"
              />

              <LegalInformation
                label="Adresse"
                value="[ADRESSE COMPLÈTE DE L’HÉBERGEUR]"
              />

              <LegalInformation
                label="Téléphone"
                value="[NUMÉRO DE TÉLÉPHONE DE L’HÉBERGEUR]"
              />

              <LegalInformation
                label="Site internet"
                value="[ADRESSE DU SITE DE L’HÉBERGEUR]"
              />
            </dl>
          </LegalSection>

          <LegalSection title="4. Conception et réalisation">
            <p>
              Le site a été conçu et réalisé par :
              {' '}
              <strong>[NOM DU CONCEPTEUR OU DE L’ENTREPRISE]</strong>.
            </p>

            <p className="mt-4">
              Contact :
              {' '}
              <a
                href="mailto:[E-MAIL DU CONCEPTEUR]"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                [E-MAIL DU CONCEPTEUR]
              </a>
              .
            </p>
          </LegalSection>

          <LegalSection title="5. Propriété intellectuelle">
            <p>
              L’ensemble des contenus présents sur ce site, notamment les
              textes, photographies, illustrations, éléments graphiques,
              logos, icônes, vidéos, fichiers et éléments de mise en page, est
              protégé par les dispositions applicables en matière de propriété
              intellectuelle.
            </p>

            <p className="mt-4">
              Sauf mention contraire, ces contenus sont la propriété exclusive
              de [Nom Entreprise] ou sont utilisés avec l’autorisation de leurs
              titulaires respectifs.
            </p>

            <p className="mt-4">
              Toute reproduction, représentation, modification, publication,
              adaptation ou exploitation, totale ou partielle, des contenus de
              ce site, quel que soit le procédé utilisé, est interdite sans
              autorisation écrite préalable.
            </p>

            <p className="mt-4">
              Les marques, photographies ou illustrations appartenant à des
              tiers restent la propriété de leurs titulaires respectifs.
            </p>
          </LegalSection>

          <LegalSection title="6. Responsabilité">
            <p>
              [Nom Entreprise] s’efforce de fournir sur ce site des
              informations exactes, complètes et régulièrement mises à jour.
              Toutefois, ces informations sont fournies à titre indicatif et
              ne sauraient constituer un engagement contractuel.
            </p>

            <p className="mt-4">
              Les tarifs, délais, disponibilités et descriptions de prestations
              éventuellement présentés sur le site doivent être confirmés par
              un devis ou par un échange direct avec l’entreprise.
            </p>

            <p className="mt-4">
              [Nom Entreprise] ne pourra être tenu responsable des dommages
              directs ou indirects résultant de l’accès au site, de son
              utilisation, de son indisponibilité temporaire ou de la présence
              éventuelle d’informations inexactes.
            </p>
          </LegalSection>

          <LegalSection title="7. Liens hypertextes">
            <p>
              Le site peut contenir des liens vers des sites internet exploités
              par des tiers.
            </p>

            <p className="mt-4">
              [Nom Entreprise] n’exerce aucun contrôle sur le contenu de ces
              sites et ne peut être tenu responsable de leur disponibilité, de
              leurs pratiques ou des informations qu’ils proposent.
            </p>
          </LegalSection>

          <LegalSection title="8. Données personnelles">
            <p>
              Le site peut collecter des données personnelles lorsque
              l’utilisateur utilise un formulaire de contact, demande un devis
              ou sollicite un rendez-vous.
            </p>

            <p className="mt-4">
              Les informations relatives aux données collectées, aux finalités
              des traitements, à leur durée de conservation et aux droits des
              utilisateurs sont présentées dans la politique de
              confidentialité du site.
            </p>

            <p className="mt-4">
              Pour toute question concernant ses données personnelles,
              l’utilisateur peut écrire à :
              {' '}
              <a
                href="mailto:[E-MAIL DE CONTACT RGPD]"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                [E-MAIL DE CONTACT RGPD]
              </a>
              .
            </p>
          </LegalSection>

          <LegalSection title="9. Cookies et traceurs">
            <p>
              Le site peut utiliser des cookies strictement nécessaires à son
              fonctionnement ainsi que, selon les services activés, des
              traceurs destinés à la mesure d’audience ou à l’amélioration de
              l’expérience utilisateur.
            </p>

            <p className="mt-4">
              Lorsque la réglementation l’exige, les traceurs non essentiels
              ne sont déposés qu’après avoir recueilli le consentement de
              l’utilisateur.
            </p>

            <p className="mt-4">
              Les modalités d’utilisation et de gestion des cookies sont
              précisées dans la politique de confidentialité ou dans une page
              dédiée à la gestion des cookies.
            </p>
          </LegalSection>

          <LegalSection title="10. Droit applicable">
            <p>
              Le présent site et ses mentions légales sont soumis au droit
              français.
            </p>

            <p className="mt-4">
              En cas de différend, les parties s’efforceront de rechercher une
              solution amiable avant toute action judiciaire.
            </p>
          </LegalSection>

          <LegalSection title="11. Médiation de la consommation">
            <p>
              Conformément aux dispositions applicables à la médiation de la
              consommation, le consommateur peut recourir gratuitement au
              médiateur de la consommation dont relève l’entreprise, après
              avoir adressé une réclamation écrite préalable à [Nom Entreprise].
            </p>

            <dl className="mt-4 grid gap-3">
              <LegalInformation
                label="Médiateur compétent"
                value="[NOM DU MÉDIATEUR DE LA CONSOMMATION]"
              />

              <LegalInformation
                label="Adresse"
                value="[ADRESSE DU MÉDIATEUR]"
              />

              <LegalInformation
                label="Site internet"
                value="[URL DU MÉDIATEUR]"
              />
            </dl>
          </LegalSection>
        </div>
      </section>
    </main>
  );
}

type LegalSectionProps = {
  title: string;
  children: React.ReactNode;
};

function LegalSection({
  title,
  children,
}: LegalSectionProps) {
  return (
    <section aria-labelledby={createSectionId(title)}>
      <h2
        id={createSectionId(title)}
        className="mb-5 text-2xl font-semibold tracking-tight"
      >
        {title}
      </h2>

      <div className="leading-7 text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

type LegalInformationProps = {
  label: string;
  value: string;
};

function LegalInformation({
  label,
  value,
}: LegalInformationProps) {
  return (
    <div className="grid gap-1 border-b border-border pb-3 sm:grid-cols-[14rem_1fr] sm:gap-6">
      <dt className="font-medium text-foreground">
        {label}
      </dt>

      <dd>{value}</dd>
    </div>
  );
}

function createSectionId(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}