# ANALYTICS DU SITE — le journal, la carte et les visites sur une seule toile

> Trois écrans parlaient du même mouvement — quelqu'un entre quelque part —
> sans se connaître : le journal des connexions, la carte des connexions, et
> les statistiques de la page d'accueil, enfermées dans un panneau du tableau
> de bord. Ils font maintenant **une page**, dessinée comme une toile de
> korhogo : des cartouches d'écru sur un mur de fumée, des cadres tracés, des
> lisières de chevrons.

La planche est dans le dépôt : `docs/design/refonte-analytics-site.png`
(1500 × 3560).

---

## 1. Ce qui a fusionné

| Avant | Après |
| --- | --- |
| `ConnectionLogs` → `/connexions` (1 418 lignes, styles en ligne) | **Analytics du site** → `/analytics`, vue *Connexions* |
| `ConnectionsMap` → `/connexions-map` (1 054 lignes, `MapComponent` maison) | la même page, vue *Carte* — `CarteConnexions` |
| `LandingAnalytics` — **pas une route** : un panneau du tableau de bord derrière `showAnalytics` (1 063 lignes) | la même page, vue *Visites du site* |

- **une seule entrée de menu** : **Analytics du site** (icône `TrendingUp`) ;
  le panneau `LandingAnalytics`, son bouton de bascule et l'état
  `showAnalytics` du tableau de bord sont supprimés ;
- **une seule adresse** : `/analytics` — `/connexions` et `/connexions-map`
  redirigent (`/analytics`, `/analytics?vue=carte`) ;
- **aucune fonction serveur nouvelle** : les tables `connection_logs` et
  `landing_page_visits` gardent leurs colonnes ; `connectionLogService.js` et
  `analyticsService.js` gardent leurs signatures ;
- les trois anciens fichiers sont supprimés, et aucun pointeur `/connexions`
  ne subsiste hors des deux redirections.

## 2. La toile de korhogo

La même famille que **Entreprises** et **Configuration pointeuse**.

| Jeton | Nuit | Jour | Rôle |
| --- | --- | --- | --- |
| `--an-fumee` | `#171310` | `#f4ecdc` | le mur |
| `--an-carte` | `#241d18` | `#fbf6ea` | la pièce posée |
| `--an-coton` | `#f2e8d5` | `#241c16` | le texte |
| `--an-ocre` | `#c9773c` | `#a8581f` | le geste, le point du titre |
| `--an-or` | `#c9a961` | `#8a6a20` | la couture, les étiquettes |
| `--an-terre` | `#8b3e1d` | `#7d3517` | le refus |
| `--an-vert` | `#10b981` | `#0f7a58` | la réussite |

- la **lisière de chevrons** est peinte à même le mur, en haut de page ;
- les **stèles** (les quatre chiffres du haut) portent une marque ronde et un
  filet de couleur à gauche, jamais un coin mou ;
- les **cartouches** de la vue *Visites* sont de **vraies pièces de toile
  écrue** — fond clair, texte encre — posées sur le mur sombre ;
- les **barres du graphique** et les **jauges** sont dessinées (trait, hachures),
  pas des rectangles pleins ;
- le **blason** de la page est `KorhogoBlasonNuitSvg` ; `KorhogoFriseSvg`,
  `KorhogoBlasonSvg` et le bandeau `PageCulturalBand` restent intacts ;
- **thème clair** complet (`.an-clair`), avec sa propre bascule dans l'en-tête.

## 3. Les trois vues

### Connexions
Le journal, les 200 dernières traces : quand (relatif + absolu), qui (admin ou
employé), l'entreprise, l'appareil, le lieu, l'état. Une ligne s'ouvre sur le
détail : motif du refus, adresse IP, navigateur, position, méthode de connexion.
Filtres par type, par état, par dates, recherche libre côté écran. Sélection
multiple, export CSV, et purge.

### Carte
Les traces réussies et géolocalisées, sur un calque sombre, avec les amas du
markercluster. Ocre pour un employé, or pour un administrateur. Un clic sur une
épingle — ou sur une personne de la liste — la met en avant, même dans un amas.
Plages de 1 h à 7 j, suivi automatique toutes les 30 s, et le nombre de lieux
distincts. `CarteConnexions` ne décide de rien : il reçoit les connexions, un
centre, un zoom et prévient au clic.

### Visites du site
Quatre cartouches (visites, nouvelles, durée moyenne, rebond), le graphique des
14 derniers jours, les dernières visites, les appareils, les pays (cliquables
pour purger un pays), les villes, les sections vues et les boutons cliqués.
Exports PDF et CSV conservés (`exportAnalyticsToPDF` / `exportAnalyticsToCSV`).

## 4. La suppression dit ce qu'elle emporte

Deux fenêtres, jamais un `confirm()` du navigateur :

- **connexions** — la fenêtre titre « Supprimer 38 traces ? », rappelle ce qui
  sera effacé, laisse choisir la période (30 jours, 90 jours, tout
  l'historique), et **exige la saisie de « PURGER »** avant d'activer le
  bouton. La suppression se fait par lots de 100 sur `connection_logs` ;
- **visites** — une visite, un pays (par son code), ou toutes les visites.

Les deux disent que les pointages, les comptes et les autres tables ne sont pas
touchés, et que l'action est définitive.

## 5. La bibliothèque (`src/lib/analyticsSite.js`)

Aucun calcul n'est refait dans le JSX ni dupliqué depuis
`analyticsService.computeStats` :

| Fonction | Ce qu'elle dit |
| --- | --- |
| `nomUtilisateur`, `identiteUtilisateur`, `qualiteUtilisateur` | le nom lisible, le courriel ou le matricule |
| `tauxReussite`, `partPourcent`, `estReussie` | les taux, sans arrondi hasardeux |
| `tempsRelatif`, `dateHeure`, `dureeLisible` | « il y a 4 min », « 2 min 14 » |
| `visitesParJour`, `maximumDe` | la série de jours, trous compris |
| `resumeDesLieux`, `centreDe` | les lieux regroupés au millième de degré |
| `tracesASupprimer` | ce que la purge emporterait, avant de le faire |
| `construireCSV`, `lignesCSV` | le CSV du journal, guillemets et point-virgule |
| `motifsDeRefus`, `libelleAppareil`, `libelleSection` | le vocabulaire de l'écran |

## 6. Le dessin ne triche pas

- aucun emoji, ni dans la page, ni dans les feuilles de style ;
- aucun `<style>` en ligne, aucun `toast` parallèle, aucun `alert`/`confirm` ;
- les seules valeurs posées en ligne sont des **mesures** (largeur d'une jauge,
  hauteur d'une barre) ;
- le survol ne change ni le fond derrière un texte, ni la couleur du texte, ni
  l'opacité d'un champ : il touche la bordure, le trait ou la décoration ;
- les raccourcis de pages restent **en haut**, dans le seuil, jamais dans le
  pied ;
- les contrôles sont dessinés (cases, segments, boutons, champs) ; le
  responsive repasse le journal en fiches sous 720 px.

## 7. Ce qui a été touché

| Fichier | Geste |
| --- | --- |
| `src/pages/AnalyticsSite.jsx` / `.css` | nouveaux — la page et sa toile |
| `src/components/CarteConnexions.jsx` / `.css` | nouveaux — la carte extraite |
| `src/lib/analyticsSite.js` | nouveau — la lecture des traces |
| `src/pages/ConnectionLogs.jsx`, `ConnectionsMap.jsx`, `LandingAnalytics.jsx` | supprimés |
| `src/App.jsx` | `/analytics` + deux redirections |
| `src/components/DashboardExperience.jsx` | une entrée de menu, panneau retiré |
| `src/pages/Dashboard.jsx`, `DashboardDesignPreview.jsx` | `showAnalytics` retiré |
| `src/components/culturalMotif.js` | `analytics`, `connexions`, `connexions-map` → `korhogo` |
| `src/services/__tests__/analyticsSite.test.jsx` | nouveau — 38 tests |

## 8. Validation

- `npx eslint src --config eslint.gate.config.js` → 0 erreur ;
- `npx vitest run src/services/__tests__/analyticsSite.test.jsx` → 38 ✓ ;
- `npx vitest run` → 130 fichiers, 1 573 tests ✓ ;
- `npx vite build` → ✓.
