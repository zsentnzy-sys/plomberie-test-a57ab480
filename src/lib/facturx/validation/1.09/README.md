# Artefacts de validation Factur-X 1.09

Ce dossier est réservé aux artefacts officiels du package
Factur-X 1.09 / ZUGFeRD 2.5 publié le 10 juin 2026.

## État actuel

Les artefacts ne sont pas encore installés.

Le fichier `manifest.json` doit conserver :

- la version Factur-X ;
- la version ZUGFeRD ;
- la syntaxe CII ;
- le profil ;
- la provenance ;
- la date de publication ;
- la liste des fichiers ;
- leur empreinte SHA-256.

Tant que `installed` vaut `false` :

- aucune validation XSD officielle ne doit être annoncée ;
- aucune validation Schematron officielle ne doit être annoncée ;
- le générateur doit rester `unqualified` ;
- `validation_artifacts_version` doit rester à `null`.

## Règles d’import

Les fichiers officiels doivent être copiés sans modification dans
le sous-dossier `artifacts/`.

Ne pas :

- renommer silencieusement les fichiers ;
- mélanger plusieurs versions ;
- mélanger plusieurs packages ;
- remplacer les artefacts Factur-X par des fichiers EN16931
  génériques sans traçabilité ;
- modifier un fichier après le calcul de son empreinte.

Une modification d’un artefact exige une nouvelle provenance,
une nouvelle version et de nouvelles empreintes.