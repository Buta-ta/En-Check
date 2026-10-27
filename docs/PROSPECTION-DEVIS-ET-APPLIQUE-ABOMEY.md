# PROSPECTION — le pipeline et les devis, cousus ensemble

> Les prospects et les devis ne font plus qu'une page. Le dessin est
> l'appliqué d'Abomey : des pièces de toile cousues sur un fond d'indigo,
> une couture visible, des emblèmes. L'arithmétique du devis n'a pas
> bougé d'un franc — elle a seulement déménagé dans un module testable.

La planche est dans le dépôt : `docs/design/refonte-prospection.png`
(1500 × 3520).

---

## 1. Ce qui a fusionné

| Avant | Après |
| --- | --- |
| `Prospection` → `/prospection` (`Prospection.jsx`, 1 760 lignes, styles inline) | **Prospection** → `/prospection` (`Prospection.jsx`, vue *Prospects*) |
| `Devis` → `/devis` (`Devis.jsx`, 5 475 lignes, styles inline) | la même page, vue *Devis* + l'atelier de devis |

- **une seule entrée de menu** : **Prospection** (icône `TrendingUp`) ;
- **une seule adresse** : `/prospection` — `/devis` redirige
  (`/prospection?vue=devis`) ; la notification « devis sans réponse » y mène
  directement ;
- **`Devis.jsx` est supprimé** ; les deux pages n'avaient ni CSS ni thème ;
- **aucune fonction serveur nouvelle** : `prospects` et `devis` restent les
  mêmes tables, avec les mêmes colonnes, et le même payload à l'enregistrement.

## 2. L'appliqué d'Abomey

Les comptes (`/admins`) portent déjà l'appliqué : Prospection en est une autre
pièce, cousue dans la même famille.

| Jeton | Nuit | Rôle |
| --- | --- | --- |
| `--ps-fond` | `#141a2b` | le fond d'indigo |
| `--ps-patch` | `#1d2740` | la pièce de toile |
| `--ps-ivoire` | `#f3ead6` | le texte |
| `--ps-terre` | `#c0562f` | les gestes, le point du titre |
| `--ps-or` | `#dfb45a` | la couture, les étiquettes |
| `--ps-vert` | `#3f8168` | les états gagnés |

- les **cartes sont des pièces** : bord gauche de couleur, pointillés intérieurs
  (la couture), jamais de coin arrondi mou ;
- les **colonnes du pipeline** sont des bandes de tissu, une couleur par étape ;
- le **blason de la page** est `AbomeyBlasonAppliqueSvg` — nouvel export de
  `AbomeySvg.jsx` ; `AbomeyFriseSvg`, `AbomeyBlasonSvg` et `AbomeyCoinSvg`
  restent intacts ;
- **thème clair** complet (`.ps-clair`), avec sa propre bascule dans l'en-tête.

## 3. Les trois vues

### Prospects
Le pipeline, six étapes, **une carte par entreprise** : nom, secteur et ville,
potentiel, effectif, contact, relance (« due depuis 4 j » / « le 12 nov. »), et
ce qui manque à la fiche. Recherche libre (nom, contact, téléphone, ville,
secteur, notes) et filtre par potentiel.

La **fiche latérale** montre le contact, l'entreprise, le suivi, les devis du
prospect, et permet de changer d'étape en un clic, de créer son devis, de le
modifier ou de le supprimer.

### Devis
La liste, avec le client, le statut (modifiable sur place), les trois montants
qui comptent — investissement, mensuel, engagement — et les gestes : fiche,
modifier, devis PDF, facture, échéancier, WhatsApp, supprimer.

Chaque document s'ouvre dans une **fenêtre de dates** (émission, échéance,
première échéance, dates de signature), puis part en PDF.

### Appels
Les six scénarios métier (pharmacie, BTP, hôtellerie, clinique, école,
industrie) avec contexte, accroche, argumentaire, demande finale et barrières ;
les objections universelles en dessous.

## 4. L'atelier de devis (`src/components/AtelierDevis.jsx`)

Quatre étapes, dans une fenêtre plein écran :

1. **Prospect & scoring** — le prospect à lier, six critères, le niveau suggéré
   par la moyenne, le niveau retenu (mini / moy / max) ;
2. **Configuration** — sites, employés, machines, admins, admins en plus,
   employés à former, type de pointage (PIN ou QR, prix unitaire affiché),
   douze options avec leur prix et leur quantité ;
3. **Négociation** — chaque ligne du devis avec son barème, deux saisies
   (unitaire, total), le retour au barème, l'alerte « sous le minimum » ; les
   remises, l'engagement, le paiement en plusieurs fois, le mois offert, et les
   montants convenus ou les totaux de catégorie ;
4. **Résultat** — les trois totaux, l'alerte de plancher, les dates de
   signature, les notes, l'aperçu PDF, WhatsApp, et l'enregistrement.

## 5. Ce qui n'a pas changé

Le calcul a été **extrait tel quel** de l'ancienne page, puis testé :

| Module | Contenu |
| --- | --- |
| `src/lib/devis.js` | `TARIFS`, `ENGAGEMENTS`, `CRITERES_SCORING`, `STATUTS_DEVIS`, `CONFIG_INITIAL`, `prixAutoUnitaire`, `prixTotalEffectif`, `estLigneSousMinimum`, `getAlerteMinDetail`, `calculerScore`, `calculerDevis`, `appliquerPriorites`, `nombreDeMois`, `echeanceFixe`, `totauxDuDevis` |
| `src/lib/devisDocuments.js` | les trois documents HTML (devis, facture, échéancier) + la capture PDF |
| `src/lib/prospection.js` | statuts, secteurs, formes juridiques, canaux, potentiels, formulaire vide, scénarios, objections, relances |

La **priorité des montants** reste : montant convenu → total de catégorie →
lignes (avec remises) ; la remise mensuelle reste plafonnée à 50 % ; les jours
fériés restent gratuits et sans plancher.

## 6. Détails de mise en page

- **survol** : seulement des bordures et des ombres — jamais le fond derrière
  un texte, sa couleur, ni l'opacité d'un champ ;
- **contrôles dessinés** : cases d'option, points de scoring, chevrons de
  chargement, pastilles d'état ;
- **chargement dessiné** (trois chevrons qui s'allument), jamais une roue ;
- **responsive** 1180 / 900 / 760 / 520 px sur la page, 860 px dans l'atelier ;
- `prefers-reduced-motion` respecté sur les deux feuilles ;
- **aucun emoji** dans le rendu, **aucun nom de colonne**, aucune formule
  d'atelier dans le texte.

## 7. Vérification

- `src/services/__tests__/prospectionDevis.test.jsx` — **51 tests** : fusion
  (route, redirection, menu, motif), arithmétique (barème, remises, engagement,
  échéances, scoring, plancher, priorités), documents, gestes réels sur une
  fausse base, atelier (étapes, enregistrement, alerte), règles de dessin ;
- suite complète : **129 fichiers, 1 535 tests** ;
- eslint (gate) : 0 erreur ; `vite build` : ✓.
