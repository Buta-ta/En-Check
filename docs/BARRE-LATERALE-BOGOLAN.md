# La barre latérale bogolan, la cloche et le bandeau lisible

> Round 43 — barre latérale personnalisable, motif **bogolan** pris dans les
> **vraies pièces de la page Paie & fiscalité**, bandeau système réparé en mode
> clair, cloche refondue avec l'icône de chaque page, avatar cliquable.

Les planches de référence sont dans `docs/design/` :

- `refonte-sidebar-bogolan.png` — la barre à l'échelle 1:1, le mode
  « Personnaliser », le geste du glisser et la palette ;
- `refonte-cloche-bogolan.png` — le panneau de la cloche, le bandeau dans les
  deux thèmes, le bloc du profil.

---

## 1. Le vrai bandeau du bogolan

Le motif n'est **pas redessiné**. Ce sont les deux pièces déjà utilisées par la
page Paie & fiscalité, posées telles quelles :

| Pièce | Fichier | Taille | Usage dans la barre |
|---|---|---|---|
| Haut | `public/images/paie-bogolan-haut.webp` | 1536 × 76 | bande de 58 px sous la marque, `repeat-x`, `background-size: auto 58px` |
| Bas | `public/images/paie-bogolan-bas.webp` | 1536 × 32 | bande de 26 px juste avant le profil |

```css
.sidebar-bogolan {
  height: 58px;
  margin: 2px -16px 14px;           /* pleine largeur malgré le rembourrage */
  background-image: url('/images/paie-bogolan-haut.webp');
  background-repeat: repeat-x;
  background-position: center;
  background-size: auto 58px;
  mask-image: linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent);
}
```

Les deux bords se fondent dans l'espresso (`mask-image`), donc la pièce ne
ressemble pas à un rectangle collé. La trame du fond de barre reste un simple
fil tissé (`repeating-linear-gradient` à 7 px), pas un second motif concurrent.

## 2. La palette

| Nom | Teinte | Rôle |
|---|---|---|
| Cuivre | `#C1743C` | accent principal, première section |
| Terre | `#9A4A2E` | deuxième section |
| Olive | `#7C8A46` | troisième section |
| Ambre | `#D8A13C` | quatrième section |
| Ardoise | `#6E7F91` | cinquième section |

Le fond de la barre est espresso `#1B1410`, le texte ivoire de néré `#F0E4CB`.
Chaque groupe porte sa teinte : point du groupe, compteur, trait de la page
active et fond doux de la ligne sélectionnée. Une page peut déroger à la teinte
de son groupe.

## 3. Personnaliser la navigation

Bouton **Personnaliser la navigation** en haut de la barre. Il ouvre le mode
d'édition, refermable par **Terminer** ou **Échap**.

| Geste | Comment |
|---|---|
| Renommer une page | champ en place, 42 caractères au plus ; un nom vide est refusé |
| Changer l'ordre | glisser-déposer (la ligne visée s'ouvre d'un trait) ou boutons **Monter / Descendre** |
| Créer un groupe | **Nouveau groupe** : nom + pastille de couleur, puis **Créer** |
| Nommer un groupe | champ de la tête de groupe |
| Colorer | cinq pastilles par groupe et par page |
| Ranger une page | sélecteur de groupe sur chaque ligne |
| Déplacer un groupe | **Monter / Descendre** dans la tête du groupe |
| Supprimer un groupe | corbeille ; ses pages rejoignent le premier groupe, aucune n'est perdue |
| Rétablir | revenir à l'ordre et aux noms du code |

La mémoire est **par administrateur** :
`localStorage["encheck_navigation_admin_v1:<id>"]`. Un enregistrement abîmé,
d'une autre version, ou une page disparue du code ne cassent rien : le modèle
est rapproché des sections du moment (`fusionnerModele`). Une page masquée par
un module éteint (`show: false`) disparaît de l'affichage mais **reste** dans le
modèle, avec son groupe et son nom.

Tout vit dans `src/lib/navigationPerso.js` (aucun React) et
`src/components/SidebarNavigation.jsx` + `.css`.

## 4. Le bandeau système, lisible dans les deux thèmes

L'ancien bandeau peignait ses propres couleurs claires (`#FECACA`, `#FDE68A`,
`#A7F3D0`, `#C7D2FE`) sur des fonds sombres, en style en ligne : en mode clair,
« Mises à jour en cours » devenait illisible. Il n'y a plus une seule couleur en
dur. `.bandeau-systeme` déclare des jetons (`--bandeau-fond`, `--bandeau-titre`,
`--bandeau-texte`, `--bandeau-teinte`) et `:root[data-theme="light"]` les
remplace : encre sur écru le jour, ivoire sur espresso la nuit.

Le bouton de fermeture est présent **sur tous les messages**, priorité haute
comprise, avec un libellé explicite (« Fermer le message : … »).

## 5. La cloche

- Le médaillon d'une notification reprend **l'icône de sa page** dans la barre
  (`PAGES` dans `NotificationBell.jsx`) : Pointages → horloge, Absences →
  calendrier barré, Retards → chrono, Administrateurs → bouclier.
- Une puce nomme la page visée, colorée par la teinte de la notification.
- Le panneau suit le thème (`--cloche-*`), plus aucun style en ligne.
- Le détail d'un signal d'assiduité s'ouvre dans une fenêtre au même dessin,
  refermable par Échap ou par le voile.
- Le survol ne change ni le fond, ni la couleur du texte, ni l'opacité : il ne
  déplace que le cadre.

## 6. L'avatar

Le bloc « Bc / Buta code / Super administrateur » est **un seul lien** vers la
page **Administrateurs** (`/admins`) : avatar, nom, rôle et chevron. La
déconnexion reste un bouton séparé, à côté.

## 7. Fichiers touchés

| Fichier | Nature |
|---|---|
| `src/lib/navigationPerso.js` | nouveau — modèle, fusion, gestes, mémoire |
| `src/components/SidebarNavigation.jsx` / `.css` | nouveau — la barre et son mode édition |
| `src/components/SystemMessageBanner.jsx` / `.css` | réécrit — jetons de thème, fermeture partout |
| `src/components/NotificationBell.jsx` / `.css` | réécrit — icône de page, panneau thémé |
| `src/components/DashboardExperience.jsx` | intègre la barre, les deux bandeaux, le lien du profil |
| `src/pages/Dashboard.css` | espresso/bogolan, bandeaux réels, pied cliquable |
| `src/services/__tests__/navigationPerso.test.js` | 52 tests — la logique |
| `src/services/__tests__/sidebarNavigation.test.jsx` | 16 tests — les gestes à l'écran |

---

## 8. Retouches de navigation (round 44)

| Demande | Réponse |
|---|---|
| « **Bc / Buta code / Super administrateur** » cliquable | Le bloc du **profil dans la barre du haut** devient un lien vers `/admins` (avatar + nom + rôle + chevron), comme celui de la barre latérale. Le cadre s'éclaire au survol, le texte ne bouge pas. |
| Bandeau bogolan après le navbar | `.dashboard-bogolan`, 48 px, pleine largeur, juste après `</header>` : la **vraie** pièce `paie-bogolan-haut.webp` en `repeat-x`, bords fondus. |
| Flèche retour en haut à gauche | `.aa-retour` (Administrateurs) et `.en-retour` (Entreprises) : cercle cousu, 38 px, `aria-label="Retour au tableau de bord"`. Le bouton « Tableau de bord » redondant de la page Entreprises a été retiré. |
| Section du planning pliable | `.sk-focus-bar` devient repliable : bouton `.sk-focus-toggle` (`aria-expanded`, `aria-controls`), corps `.sk-focus-corps` conditionnel, résumé « N collaborateur(s) · filtre » quand elle est repliée, chevron qui pivote. Le choix est retenu (`localStorage["planning_legende_ouverte"]`). Le filtre, le compteur et la légende (Disponibilité, Types de cartes, Signaux) restent dans le corps. |

Tests : `src/services/__tests__/retouchesNavigation.test.js` (16 tests).
