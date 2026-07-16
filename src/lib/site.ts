export const site = {
  name: "Plomberie Dupont",
  tagline: "Plombier chauffagiste artisan à Metz et alentours",
  phoneDisplay: "+33 6 00 00 00 00",
  phoneRaw: "+33600000000",
  whatsapp: "33600000000",
  email: "contact@plomberie-dupont.fr",
  city: "Metz",
  zone: "Metz et 30 km alentour (Eurométropole de Metz, Montigny-lès-Metz, Woippy, Marly, Maizières-lès-Metz...)",
  address: "12 rue des Artisans, 57000 Metz",
  hours: "Lun–Sam : 8h–19h · Urgences 24/7",
  siret: "SIRET 000 000 000 00000",
} as const;

export const services = [
  {
    slug: "depannage",
    title: "Dépannage & urgences",
    icon: "Wrench",
    desc: "Recherche de fuite d'eau, panne de chauffe-eau ou cumulus, WC bouché : intervention rapide 7j/7 pour vos urgences de plomberie.",
  },
  {
    slug: "chauffage",
    title: "Chauffage & chaudière",
    icon: "Flame",
    desc: "Installation, remplacement, entretien annuel et dépannage de vos systèmes de chauffage : chaudières gaz à condensation et pompes à chaleur (PAC).",
  },
  {
    slug: "sanitaire",
    title: "Sanitaire & salle de bain",
    icon: "ShowerHead",
    desc: "Rénovation complète de salle de bain, pose de douche à l'italienne, installation de sanitaires, lavabos et dépannage de robinetterie.",
  },
  {
    slug: "debouchage",
    title: "Débouchage canalisation",
    icon: "Droplets",
    desc: "Débouchage d'urgence de canalisations bouchées (évier, WC, tout-à-l'égout) par hydrocurage haute pression et inspection vidéo par caméra.",
  },
] as const;

export const pricing = [
  {
    category: "Dépannage",
    items: [
      { label: "Déplacement + diagnostic", price: "à partir de 49 €" },
      { label: "Recherche & réparation de fuite", price: "90 – 180 €" },
      { label: "Réparation de chasse d'eau / WC", price: "80 – 150 €" },
      { label: "Remplacement robinetterie", price: "à partir de 110 €" },
    ],
  },
  {
    category: "Débouchage",
    items: [
      { label: "Débouchage évier / lavabo", price: "90 – 160 €" },
      { label: "Débouchage WC", price: "110 – 190 €" },
      { label: "Débouchage haute pression", price: "à partir de 190 €" },
      { label: "Inspection caméra", price: "à partir de 150 €" },
    ],
  },
  {
    category: "Chauffage & chaudière",
    items: [
      { label: "Entretien annuel chaudière gaz", price: "à partir de 99 €" },
      { label: "Dépannage chaudière", price: "120 – 250 €" },
      { label: "Installation chaudière gaz à condensation", price: "à partir de 2 500 €" },
      { label: "Installation pompe à chaleur", price: "sur devis" },
    ],
  },
  {
    category: "Installation & rénovation",
    items: [
      { label: "Pose chauffe-eau électrique", price: "à partir de 350 €" },
      { label: "Pose ballon thermodynamique", price: "sur devis" },
      { label: "Rénovation salle de bain complète", price: "sur devis" },
      { label: "Pose WC / lavabo / douche", price: "à partir de 180 €" },
    ],
  },
] as const;

export const serviceOptions = [
  "Dépannage / urgence",
  "Recherche de fuite",
  "Débouchage canalisation",
  "Entretien chaudière",
  "Dépannage chaudière",
  "Installation chaudière / PAC",
  "Chauffe-eau / ballon",
  "Rénovation salle de bain",
  "Autre / je ne sais pas",
] as const;

export const timeSlots = ["Matin (8h – 12h)", "Après-midi (12h – 16h)", "Fin de journée (16h – 19h)"] as const;

export const testimonials = [
  { 
    name: "Sophie M.", 
    city: "Metz Centre", 
    rating: 5, 
    text: "Intervention rapide en moins d'une heure pour une recherche de fuite d'eau sous mon évier à Metz Centre. Le plombier a été très pro, le tarif annoncé par téléphone a été respecté. Je recommande !" 
  },
  { 
    name: "Karim B.", 
    city: "Montigny-lès-Metz", 
    rating: 5, 
    text: "Remplacement de notre vieille chaudière par une chaudière gaz à condensation à Montigny-lès-Metz. Conseils clairs pour les aides, chantier impeccable et artisan très honnête." 
  },
  { 
    name: "Hélène D.", 
    city: "Woippy", 
    rating: 5, 
    text: "Très réactif pour le débouchage en urgence d'une canalisation de WC un dimanche à Woippy. Arrivé à l'heure, équipé d'une caméra, problème réglé rapidement." 
  },
  {
    name: "Marc L.",
    city: "Marly",
    rating: 5,
    text: "Rénovation complète de la salle de bain. Le résultat est superbe et les délais ont été tenus. Un vrai artisan.",
  },
  {
    name: "Nadia R.",
    city: "Maizières-lès-Metz",
    rating: 5,
    text: "Entretien annuel de la chaudière fait sérieusement, avec des explications. Rien à redire.",
  },
  {
    name: "Thomas P.",
    city: "Montigny-lès-Metz",
    rating: 5,
    text: "Devis gratuit et détaillé reçu le jour même. Pas de surprise sur la facture finale. Parfait.",
  },
] as const;

export const faqs = [
  { 
    q: "Intervenez-vous en urgence le week-end ?", 
    a: "Oui, notre équipe assure un dépannage plomberie d'urgence 24h/24 et 7j/7 pour les fuites d'eau, pannes de chauffage et dégâts des eaux sur Metz, Montigny-lès-Metz et l'ensemble de la Eurométropole de Metz." 
  },
  { 
    q: "Le déplacement et le devis sont-ils payants ?", 
    a: "Le devis est 100% gratuit pour tous les travaux de rénovation ou d'installation planifiés. Pour un dépannage d'urgence à domicile, le déplacement et le diagnostic sont facturés à partir de 49 €, mais ce montant est déduit de votre facture finale si vous validez les réparations." 
  },
  { 
    q: "Quels moyens de paiement acceptez-vous ?", 
    a: "Nous acceptons les règlements par carte bancaire (CB), virement, espèces et chèques. Une facture conforme et détaillée vous est systématiquement délivrée à la fin de l'intervention." 
  },
  { 
    q: "Êtes-vous assuré pour les travaux de plomberie et chauffage ?", 
    a: "Oui, notre entreprise dispose d'une assurance garantie décennale obligatoire pour les installations (chauffage, salle de bain) ainsi que d'une responsabilité civile professionnelle (RC Pro) pour couvrir l'ensemble de nos interventions." 
  },
] as const; // Pense à ajouter "as const" ici aussi s'il n'y était pas, pour la cohérence !
