import { createFileRoute } from '@tanstack/react-router';
import { site } from '@/lib/site';

export const Route = createFileRoute('/politique-de-confidentialite')({
  head: () => ({
    meta: [
      { title: `Politique de confidentialité | ${site.name}` },
      {
        name: 'description',
        content:
          "Politique de confidentialité et protection des données personnelles conformément au RGPD.",
      },
      { name: 'robots', content: 'noindex, follow' },
      { property: 'og:title', content: `Politique de confidentialité | ${site.name}` },
      { property: 'og:description', content: 'Politique de confidentialité et protection des données personnelles conformément au RGPD.' },
      { property: 'og:url', content: 'https://plomberie-test.lovable.app/politique-de-confidentialite' },
    ],
  }),
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  return (
    <main className="bg-background">
      <section className="container mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:py-24">
        <header className="mb-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
            Protection des données personnelles
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Politique de confidentialité
          </h1>
          <p className="mt-4 text-muted-foreground">
            Dernière mise à jour : <time dateTime="2026-07-17">17 juillet 2026</time>
          </p>
          <p className="mt-4 leading-7 text-muted-foreground">
            La présente politique de confidentialité décrit la manière dont {site.name}
            {' '}collecte, utilise et protège les données personnelles des utilisateurs
            du site, conformément au Règlement (UE) 2016/679 du 27 avril 2016 (RGPD) et
            à la loi « Informatique et Libertés » modifiée.
          </p>
        </header>

        <div className="space-y-12 text-foreground">
          <PolicySection title="1. Responsable du traitement">
            <p>
              Le responsable du traitement des données personnelles collectées via
              ce site est :
            </p>
            <dl className="mt-4 grid gap-3">
              <PolicyInfo label="Entreprise" value={site.name} />
              <PolicyInfo label="Adresse" value={site.address} />
              <PolicyInfo label="Téléphone" value={site.phoneDisplay} />
              <PolicyInfo label="Email de contact" value={site.email} />
              <PolicyInfo label="Identification" value={site.siret} />
            </dl>
            <p className="mt-4">
              Pour toute question relative à vos données personnelles, vous pouvez
              nous écrire à{' '}
              <a
                href={`mailto:${site.email}`}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {site.email}
              </a>
              .
            </p>
          </PolicySection>

          <PolicySection title="2. Données personnelles collectées">
            <p>Nous collectons uniquement les données strictement nécessaires aux finalités décrites ci-dessous :</p>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>
                <strong>Formulaires de contact, de devis et de prise de rendez-vous :</strong>{' '}
                nom, prénom, adresse email, numéro de téléphone, adresse postale
                éventuelle, type de prestation demandée, message libre, créneau
                souhaité.
              </li>
              <li>
                <strong>Données techniques :</strong> adresse IP et informations
                relatives au navigateur (user-agent), collectées uniquement à des fins
                de sécurité, de prévention des abus (anti-spam) et de limitation du
                nombre de soumissions par utilisateur (rate limiting).
              </li>
              <li>
                <strong>Espace d'administration :</strong> adresse email et
                identifiants de connexion du gérant, utilisés exclusivement pour
                l'authentification au back-office du site.
              </li>
            </ul>
            <p className="mt-4">
              Aucune donnée dite « sensible » au sens de l'article 9 du RGPD (données
              de santé, opinions politiques, religieuses, etc.) n'est collectée.
            </p>
          </PolicySection>

          <PolicySection title="3. Finalités du traitement">
            <p>Vos données sont traitées pour les finalités suivantes :</p>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>Répondre à vos demandes de contact, de devis et de prise de rendez-vous.</li>
              <li>Vous adresser les emails de confirmation et de suivi liés à votre demande.</li>
              <li>Établir un devis, planifier une intervention et assurer le suivi de la relation client.</li>
              <li>Assurer la sécurité du site, prévenir les abus et les envois automatisés (anti-spam / rate limiting).</li>
              <li>Respecter nos obligations légales, notamment comptables et fiscales.</li>
            </ul>
          </PolicySection>

          <PolicySection title="4. Bases légales du traitement">
            <p>Conformément à l'article 6 du RGPD, les traitements reposent sur les bases légales suivantes :</p>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>
                <strong>Mesures précontractuelles (art. 6.1.b) :</strong> traitement
                des demandes de devis et de rendez-vous, préalables à la conclusion
                éventuelle d'un contrat de prestation.
              </li>
              <li>
                <strong>Intérêt légitime (art. 6.1.f) :</strong> sécurité du site,
                prévention de la fraude et des soumissions abusives, gestion interne
                de la relation client.
              </li>
              <li>
                <strong>Obligation légale (art. 6.1.c) :</strong> conservation des
                pièces comptables et facturation.
              </li>
              <li>
                <strong>Consentement (art. 6.1.a) :</strong> pour toute communication
                non essentielle, révocable à tout moment.
              </li>
            </ul>
          </PolicySection>

          <PolicySection title="5. Destinataires des données">
            <p>Les données collectées sont destinées :</p>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>À {site.name} et aux personnes habilitées au sein de l'entreprise.</li>
              <li>
                À nos sous-traitants techniques agissant sur nos instructions et
                encadrés contractuellement : hébergeur du site, fournisseur de base
                de données et prestataire d'envoi des emails transactionnels.
              </li>
            </ul>
            <p className="mt-4">
              Vos données ne sont ni vendues, ni louées, ni cédées à des tiers à des
              fins commerciales.
            </p>
          </PolicySection>

          <PolicySection title="6. Transferts hors Union européenne">
            <p>
              Les données personnelles collectées sont hébergées et traitées au sein
              de l'Union européenne. Aucun transfert de données hors de l'Union
              européenne n'est effectué. Dans l'hypothèse où un tel transfert
              deviendrait nécessaire, il serait encadré par les garanties appropriées
              prévues par le RGPD (clauses contractuelles types de la Commission
              européenne notamment).
            </p>
          </PolicySection>

          <PolicySection title="7. Durées de conservation">
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>
                <strong>Demandes de contact :</strong> 3 ans à compter du dernier
                contact avec le prospect.
              </li>
              <li>
                <strong>Demandes de devis et de rendez-vous :</strong> 3 ans à
                compter du dernier contact pour les prospects, 10 ans à compter de la
                fin de la prestation pour les clients (obligations comptables).
              </li>
              <li>
                <strong>Données techniques (adresse IP, user-agent, rate limiting) :</strong>{' '}
                12 mois maximum.
              </li>
              <li>
                <strong>Compte administrateur :</strong> pour toute la durée
                d'exploitation du site.
              </li>
              <li>
                <strong>Documents comptables et factures :</strong> 10 ans,
                conformément aux obligations légales.
              </li>
            </ul>
          </PolicySection>

          <PolicySection title="8. Sécurité des données">
            <p>
              {site.name} met en œuvre des mesures techniques et organisationnelles
              appropriées pour garantir la sécurité et la confidentialité de vos
              données : chiffrement des échanges via HTTPS, contrôle d'accès à
              l'espace d'administration par authentification, cloisonnement des
              données par des règles de sécurité au niveau de la base (RLS), et
              limitation du nombre de soumissions par adresse IP.
            </p>
          </PolicySection>

          <PolicySection title="9. Vos droits">
            <p>
              Conformément aux articles 15 à 22 du RGPD, vous disposez des droits
              suivants sur vos données personnelles :
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li><strong>Droit d'accès :</strong> obtenir la confirmation que vos données sont traitées et en recevoir copie.</li>
              <li><strong>Droit de rectification :</strong> faire corriger des données inexactes ou incomplètes.</li>
              <li><strong>Droit à l'effacement :</strong> demander la suppression de vos données, sous réserve des obligations légales de conservation.</li>
              <li><strong>Droit à la limitation du traitement</strong> dans les cas prévus par le RGPD.</li>
              <li><strong>Droit d'opposition</strong> au traitement fondé sur l'intérêt légitime.</li>
              <li><strong>Droit à la portabilité</strong> de vos données.</li>
              <li><strong>Droit de retirer votre consentement</strong> à tout moment, lorsque le traitement est fondé sur celui-ci.</li>
              <li><strong>Droit de définir des directives</strong> relatives au sort de vos données après votre décès.</li>
            </ul>
            <p className="mt-4">
              Ces droits peuvent être exercés en écrivant à{' '}
              <a
                href={`mailto:${site.email}`}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {site.email}
              </a>
              , accompagné, le cas échéant, d'un justificatif d'identité en cas de
              doute raisonnable sur l'auteur de la demande. Nous nous engageons à
              répondre dans un délai maximum d'un mois.
            </p>
          </PolicySection>

          <PolicySection title="10. Réclamation auprès de la CNIL">
            <p>
              Si vous estimez, après nous avoir contactés, que vos droits ne sont pas
              respectés, vous pouvez adresser une réclamation à la Commission
              Nationale de l'Informatique et des Libertés (CNIL) :
            </p>
            <p className="mt-4">
              CNIL — 3 Place de Fontenoy, TSA 80715, 75334 PARIS CEDEX 07 —{' '}
              <a
                href="https://www.cnil.fr"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                www.cnil.fr
              </a>
              .
            </p>
          </PolicySection>

          <PolicySection title="11. Cookies et traceurs">
            <p>
              Le site utilise uniquement des cookies strictement nécessaires à son
              bon fonctionnement (session d'authentification de l'espace
              d'administration notamment). Ces cookies sont exemptés du recueil du
              consentement en application des recommandations de la CNIL.
            </p>
            <p className="mt-4">
              Aucun cookie de mesure d'audience tierce, de publicité ou de suivi
              comportemental n'est déposé. Si de tels traceurs devaient être ajoutés
              à l'avenir, ils ne seraient déposés qu'après recueil de votre
              consentement préalable.
            </p>
          </PolicySection>

          <PolicySection title="12. Modifications de la politique">
            <p>
              La présente politique de confidentialité peut être mise à jour à tout
              moment pour tenir compte des évolutions légales, réglementaires ou
              techniques. La date de dernière mise à jour indiquée en tête de page
              fait foi.
            </p>
          </PolicySection>
        </div>
      </section>
    </main>
  );
}

type PolicySectionProps = {
  title: string;
  children: React.ReactNode;
};

function PolicySection({ title, children }: PolicySectionProps) {
  const id = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-5 text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      <div className="leading-7 text-muted-foreground">{children}</div>
    </section>
  );
}

type PolicyInfoProps = { label: string; value: string };

function PolicyInfo({ label, value }: PolicyInfoProps) {
  return (
    <div className="grid gap-1 border-b border-border pb-3 sm:grid-cols-[14rem_1fr] sm:gap-6">
      <dt className="font-medium text-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}