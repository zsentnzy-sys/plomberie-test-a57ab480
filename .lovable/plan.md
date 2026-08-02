## Audit technique (réalisé)

Constats sur le moteur actuel (`@cantoo/pdf-lib` 2.7.4, `documents.server.ts`, `invoices.server.ts`, `invoices-pdf.server.ts`) :

| Exigence PDF/A-3 / Factur-X | Possible aujourd'hui ? |
|---|---|
| Polices intégralement incorporées | **Non** — `StandardFonts.Helvetica` (police non incorporée) → rejet PDF/A immédiat. Corrigible : `registerFontkit` + TTF embarqué (fontkit est déjà une dépendance de la lib). |
| Fichier XML associé + entrée `/AF` + `AFRelationship=Alternative` + MIME `application/xml` | **Oui** — `PDFDocument.attach(bytes, "factur-x.xml", { mimeType, afRelationship })` est supporté par le fork Cantoo. |
| Nom de fichier Unicode | Oui (`UF` géré par l'embedder). |
| Métadonnées XMP personnalisées (PDF/A + extension Factur-X) | **Pas d'API haut niveau**, mais faisable via l'API bas niveau (`doc.catalog.set(PDFName.of('Metadata'), flux XMP)`). |
| Profil ICC + OutputIntent | **Pas d'API**, faisable en bas niveau (flux ICC sRGB embarqué + dictionnaire `OutputIntent`). |
| Validation VeraPDF en production | **Non** — VeraPDF est un outil Java ; l'hébergement de production est un runtime Worker sans JVM ni sous-processus. |

**Conclusion / choix technique retenu** : on garde `@cantoo/pdf-lib` comme moteur de rendu (le design actuel est ainsi préservé au pixel près) et on ajoute une **couche de post-traitement PDF/A-3 maison** (`facturx-pdfa.server.ts`) qui : incorpore les polices, injecte ICC + OutputIntent, écrit les XMP (PDF/A-3B + extension Factur-X), attache `factur-x.xml` et force `/AF`. Aucune bibliothèque Factur-X JS mature n'existe côté Worker (les solutions éprouvées — `factur-x` Python, Mustangproject Java — nécessitent un runtime absent en production ; un microservice dédié serait la seule alternative, plus lourde et non demandée à ce stade).

**Limites assumées** : la conformité est garantie par des auto-contrôles structurels stricts à chaque génération + une **qualification VeraPDF hors production** (script sandbox/CI bloquant avant déploiement), conformément à votre choix. Impact déploiement : aucun service externe, poids bundle +~700 Ko (police Liberation Sans + profil ICC sRGB, embarqués en base64 pour rester bundle-safe).

**Police** : Liberation Sans / Liberation Sans Bold (métriques compatibles Helvetica) → rendu inchangé.

## Étapes

### 1. Migration additive (base)
Sur `invoices` : `customer_type`, `customer_siren`, `customer_siret`, `customer_vat_number`, `customer_country_code`, `operation_category`, `vat_on_debits`, `delivery_*`, `payment_due_date`, `payment_reference`, `purchase_order_reference`, `service_period_start/end`, `transaction_classification`, `invoice_format` (défaut `classic_pdf`), `facturx_version`, `facturx_profile`, `facturx_validation_status`, `facturx_validation_errors`, `structured_invoice_snapshot` (jsonb), `pdf_sha256`, `facturx_validated_at`, plus les colonnes `e_invoice_*` (défaut `not_submitted`). Sur `invoice_lines` : `unit_code`, `vat_category_code`, `discount_amount`. Nouvelle RPC `create_invoice_with_lines_facturx` (l'ancienne reste en place pour la compatibilité) ; les factures existantes restent `classic_pdf`.

### 2. Modèle métier unique
`src/lib/facturx/facturx-config.server.ts` (`FACTURX_CONFIG` : 1.09 / ZUGFeRD 2.5 / EN16931 / `factur-x.xml`), `structured-invoice.types.ts` (`StructuredInvoiceData`, parties, lignes, ventilations, paiement, totaux) et `structured-invoice.server.ts` qui construit ce modèle **exclusivement depuis les lignes persistées + le snapshot artisan**. PDF et XML consomment ce seul objet.

### 3. Arithmétique sûre
`money.server.ts` : tous les montants en centimes entiers, politique d'arrondi unique (arrondi ligne → TVA ligne → ventilation par taux → totaux → reste à payer), plus un comparateur qui échoue si base ≠ modèle ≠ PDF ≠ XML.

### 4. Mapping normalisé
`codes.server.ts` : types internes → codes (Service/Taux horaire → unités `HUR`/`C62`/`MTQ`…), moyens de paiement → UNTDID 4461 (virement 30, carte 48, chèque 20, espèces 10), catégories TVA (`S`, `Z`, `E`), type de facture `380`, devise `EUR`, pays ISO 3166-1.

### 5. Classification réglementaire
`classification.server.ts` : calcul serveur de `b2b_france | b2c_france | b2b_international | b2c_international | public_sector` à partir du type client, du pays et de la situation TVA, avec validation conditionnelle (SIREN exigé pour une entreprise française, jamais pour un particulier).

### 6. XML CII EN 16931
`facturx-xml.server.ts` : fonctions séparées *mapping* → *sérialisation* (échappement strict, aucune concaténation brute, namespaces officiels rsm/ram/udt, UTF-8) → *validation* (XSD + règles Schematron EN 16931 et Factur-X pertinentes, listes de codes, cohérence des totaux BR-CO).

### 7. PDF/A-3 hybride
`facturx-pdfa.server.ts` : polices Liberation embarquées, ICC sRGB + OutputIntent, XMP PDF/A-3B avec le schéma d'extension Factur-X (`DocumentFileName`, `DocumentType=INVOICE`, `Version=1.0`, `ConformanceLevel=EN 16931`), pièce jointe `factur-x.xml` en `Alternative`, `/AF` au catalogue, XMP dcterms/pdf. Le rendu visuel reste celui de `documents.server.ts`.

### 8. Flux de génération
`invoices.functions.ts` / `invoices-pdf.server.ts` suivent l'ordre imposé : auth admin → Zod → RPC idempotente → relecture DB → `StructuredInvoiceData` → XML → validation XML → PDF/A-3 → auto-contrôles PDF (OutputIntent, polices, XMP, AF, nom du fichier) → contrôle de cohérence des montants → SHA-256 → upload bucket privé → persistance conformité + snapshot → `ready` → envoi e-mail existant. Tout échec ⇒ `generation_failed` + `facturx_validation_status = invalid`, erreur technique côté serveur et message générique côté UI. Aucune facture finalisée n'est régénérée à partir de données plus récentes.

### 9. Formulaire /admin/factures
Ajout de sections repliables optionnelles (Informations réglementaires, Livraison, Paiement, Période de prestation), champs conditionnels selon `customer_type`. Le formulaire actuel et la conversion devis → facture restent inchangés visuellement.

### 10. Historique
`/admin/historique` : badge « Factur-X EN 16931 » ou « PDF classique », statut de validation, boutons Ouvrir / Télécharger via URL signée courte, mention « Prête pour plateforme agréée » uniquement si validation réussie, résumé d'erreur lisible sans stack trace.

### 11. Abstraction future plateforme
`src/lib/einvoice/provider.types.ts` : interface `EInvoiceProvider` seule, colonnes `e_invoice_*` à `not_submitted`. Aucun fournisseur, aucun bouton.

### 12. Qualification & tests
Script `scripts/validate-facturx.ts` (sandbox/CI) : génère une facture de référence, exécute VeraPDF (PDF/A-3B) et la validation Schematron officielle, échoue en cas de non-conformité. Tests unitaires sur les arrondis, le mapping des codes, la classification et l'échappement XML. Non-régression vérifiée sur : devis (moteur intact), numérotation, idempotence, renvoi d'e-mails, pièces jointes, anciennes factures.

## Hors périmètre
Aucun fournisseur connecté, aucune transmission réglementaire, aucun changement sur les devis, les rendez-vous, les formulaires publics ni le design du dashboard.
