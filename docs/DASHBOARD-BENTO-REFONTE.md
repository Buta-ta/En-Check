# Dashboard — refonte Bento UI (finition Apple)

## Demande
Refonte totale de la page dashboard : style Bento UI, finition « awwards / Apple »,
sidebar entièrement revue. Constat de départ : trop d'incompréhension, page peu pratique.

## Ce qui a changé

### Sidebar (clarifiée + repensée)
- Sections renommées pour lever les ambiguïtés :
  - « Aujourd'hui » → **« Pilotage du jour »**
  - « Gestion RH » → **« Paie & RH »**
  - « Outils » → **« Terrain & outils »**
  - « Administration » inchangée.
- « Équipe » (route `/employes`) → **« Employés »** : le libellé correspond enfin à la route,
  et ne se confond plus avec « Équipes » (route `/equipes`).
- Nouveau rendu : panneau sombre flottant (rayon 28px), pastilles de navigation
  arrondies, élément actif en pastille blanche sur fond sombre (style Apple),
  compteurs en pastille cuivre, pied de profil épuré.

### Grille Bento
- Tuile héro agrandie (salutation 30–44px, dégradés cuivre/vert discrets).
- Indicateurs : la **première tuile est la vedette** (fond encre sombre, double largeur),
  les suivantes en tuiles blanches ; chiffres en 26–34px, chasse resserrée.
- Panneaux « À vérifier », « Présence aujourd'hui » (anneau 108px), « Activité récente »,
  « Entreprises actives / Répartition » et « Accès rapide » en tuiles à rayon 28px,
  ombres douces en couches, espacements généreux.
- Barre supérieure en **verre dépoli** (flou + saturation), boutons en pastilles.

### Charte
- Clair : fond `#f5f5f7`, surface blanche, encre `#1d1d1f`, gris `#86868b` (jetons Apple).
- Sombre : fond noir pur, surfaces `#1c1c1e`, encre `#f5f5f7`.
- Accent cuivre En-Check conservé (`#bf713b` / `#a85f2e`), sémantiques Apple
  (vert `#248a3d`, orange `#c77400`, rouge `#d70015`, violet `#6e56cf`).
- Rayons : 28px (tuiles), 22px, 16px, 12px. Typographie Inter, chiffres tabulaires.

## Ce qui n'a PAS changé (volontairement)
- Aucune logique métier : `src/pages/Dashboard.jsx` (chargement, calculs, alertes,
  conflits, sorties manquantes, pauses) est intact.
- `src/components/DashboardExperience.jsx` : seuls 4 libellés de navigation changent ;
  personnalisation (widgets, barre du haut, accès rapides), modales (conflit, sortie
  manquante, détail d'activité), catalogues et analytics sont inchangés.
- Toutes les classes CSS et variables existantes sont conservées : les composants
  raccordés (sélecteur d'entreprise, cloche de notifications, bandeau système)
  continuent de fonctionner.
- Aucune donnée de démonstration dans le produit ; l'aperçu `/dashboard-preview`
  reste le seul endroit avec des données fictives.

## Vérifications
- Suite complète : **784 tests, 80 fichiers réussis** (URL/clé factices de test).
- Build Vite/PWA réussi (avertissement de taille de bundles préexistant).
- ESLint : les erreurs restantes sur `DashboardExperience.jsx` sont préexistantes
  (effet « retards » et effet de préférences distantes, tous deux verrouillés par
  des tests de câblage) ; aucune nouvelle erreur introduite.
- Responsive : 1160px / 940px (sidebar en tiroir) / 720px / 480px.
- Aucun SQL, aucun déploiement de production réalisé par cette intervention.
