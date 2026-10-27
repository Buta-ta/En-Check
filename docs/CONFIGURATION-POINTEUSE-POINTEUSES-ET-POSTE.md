# CONFIGURATION POINTEUSE — les machines à badge et l'écran du poste

> Le registre des pointeuses ADMS et la page du poste de pointage ne font plus
> qu'une page. Le dessin est la toile de Korhogo : mur de fumée, toile de coton
> écru, cadres tracés et cartouches ocre. La mécanique n'a pas bougé : mêmes
> tables, mêmes fonctions serveur, même fichier `appareils.json`, même mémoire
> d'appareil que la tablette.

La planche est dans le dépôt : `docs/design/refonte-configuration-pointeuse.png`
(1500 × 3094).

---

## 1. Ce qui a fusionné

| Avant | Après |
| --- | --- |
| `Pointeuses ADMS` → `/pointeuses` (`Pointeuses.jsx`, 1 396 lignes en styles inline) | **Configuration pointeuse** → `/configuration-pointeuse` (`ConfigurationPointeuse.jsx`) |
| `Poste de pointage` → `/poste` (`PostePointage.jsx`, kiosque tablette, 1 000 lignes en styles inline) | sous l'onglet **Poste de pointage**, et l'écran `/poste` réécrit |

- **le menu** n'a plus qu'une entrée : **Configuration pointeuse** (icône
  `Router`, section *Outils*) ;
- **une seule adresse d'administration** : `/configuration-pointeuse` ;
  `/pointeuses` redirige (`replace`) dessus ;
- **l'écran du poste reste ouvert seul** : `/poste` n'est pas sous `AdminRoute`,
  la tablette de l'entrée n'a pas de session d'administrateur. Il garde son
  verrou propre (`module_poste_pointage`) et lit `encheck_poste` ;
- **la page s'ouvre si l'une ou l'autre des options est payée** :
  `/configuration-pointeuse` accepte `['module_pointeuses', 'module_poste_pointage']` ;
- **`Pointeuses.jsx` est supprimé**. Il n'en reste rien : ni les styles inline,
  ni le fond `#0A0A0F`, ni les emojis ;
- **`src/lib/postePointage.js`** rassemble ce que la page et la tablette doivent
  savoir l'une de l'autre : la clé `encheck_poste`, le délai de 60 s entre deux
  pointages, la durée de confirmation, le seuil d'écart d'horloge, la lecture et
  l'écriture du poste, l'identifiant d'appareil, l'installation par code, et les
  messages de refus du serveur en français. Une seule source.

## 2. La toile de Korhogo

Entreprises et Configuration pointeuse partagent le même motif : la toile
peinte sénoufo. Ce qui les distingue est la mise en page — Entreprises est un
registre à colonnes, celle-ci une pièce à trois vues — et les jetons de couleur
(`--cp-*`).

| Jeton | Nuit | Rôle |
| --- | --- | --- |
| `--cp-mur` | `#171310` | le mur de fumée |
| `--cp-carte` | `#241d18` | la toile posée |
| `--cp-coton` | `#f2e8d5` | le texte |
| `--cp-ocre` | `#c9773c` | les cadres, les gestes |
| `--cp-terre` | `#8b3e1d` | les alertes douces |
| `--cp-or` | `#c9a961` | les filets |

Les chevrons de la lisière sont dessinés en SVG dans `ConfigurationPointeuse.css`
(data-URI, 34 px), pas une image à part. En haut, le bandeau culturel du produit
(`PageCulturalBand`, motif `korhogo`) ; en bas, le même bandeau retourné, comme
le rabat d'une toile. Le blason de l'en-tête est `KorhogoBlasonNuitSvg` —
nouvel export de `KorhogoSvg.jsx`, les deux exports existants sont intacts.

**Thème clair** : la page a sa propre bascule (`.cp-clair`), un jeu de jetons
clair complet, et ne touche pas au reste de l'application.

## 3. Les trois vues

### Pointeuses
La liste des machines ({name, serial, état, dernière vue, pointages}) en
cartouches. Chaque cartouche porte son état — **en ligne** (vue il y a moins de
10 min), **hors ligne**, **en pause** — et ses gestes : copier la clé, la
révéler (l'œil), l'exporter, mettre en pause / réactiver, retirer du registre.

Un **repli** est prévu à l'enregistrement : la fonction serveur
`encheck_adms_appareil_ajouter` d'abord ; si elle n'existe pas encore sur
l'installation (`PGRST202` / `42883`), la page écrit directement
(`creerDirectement`), avec la même clé de 24 octets (base64url), et reconnaît le
doublon (`23505`) pour renvoyer sur la machine existante. Un refus de droit
(`42501`) est dit en français, sans jargon.

**`appareils.json`** : le fichier attendu par le receveur, avec le numéro de
série et la clé secrète — c'est le seul moment où la clé est en clair.

### Journal des envois
Les 25 derniers dépôts (`adms_log`) : date, numéro de série, type de payload,
nombre de lignes, pointages acceptés, et **les numéros non attribués**
(`pins_inconnus`). Ceux-là s'affichent en rouge et renvoient vers les employés
sans code personnel (`encheck_employes_sans_pin`). Un bloc « Dépannage rapide »
dit quoi faire dans les trois cas qui reviennent.

### Poste de pointage
- le **code de l'entreprise** (`ENC-229`) à saisir sur la tablette, copiable ;
- l'état de **cet** appareil : est-il déjà un poste, pour quelle entreprise,
  avec quel identifiant ;
- **Installer cet appareil** (par code) et **Détacher cet appareil** ;
- **Ouvrir l'écran du poste** (`/poste`).

## 4. L'écran du poste (`/poste`, classes `pp-`)

Un kiosque : on le laisse allumé à l'entrée, il se lit à deux mètres.

1. **Installation** — le code d'entreprise, une fois. La tablette retient
   `encheck_poste` (`enterprise_id`, nom, code, `device_id`, date).
2. **Scan** — `html5-qrcode` sur `#zone-badge` ; si la caméra manque, un repli
   en saisie : numéro d'employé, puis code personnel si le serveur le réclame
   (`encheck_employee_login_qr` → `pin_requis`).
3. **Confirmation** — nom de l'employé, sens (`ARRIVÉE` / `DÉPART`), heure.
   Le sens vient de `sensSuivant()` : le dernier pointage du jour décide. Une
   confirmation reste 4 s, puis l'écran revient au scan.
4. **Refus** — le message traduit (`MESSAGES` / `messageDe()`), jamais un code
   d'erreur nu.
5. **Horloge** — un avis s'affiche si l'horloge de la tablette s'écarte de plus
   de 120 s de celle du serveur : c'est la panne qui fausse tous les retards.
6. **Réglages** — l'identifiant du poste, la version, « Changer d'entreprise ».

60 s entre deux pointages du même employé (`DELAI_ENTRE_POINTAGES`) : le
double-lecture d'un badge ne crée pas deux lignes.

## 5. Ce qui n'a pas changé

- `/poste` reste **public** (hors `AdminRoute`), avec son verrou
  `module_poste_pointage` et `ouAller: null` ;
- les tables `adms_devices`, `adms_log`, la colonne `secret`, `is_active`,
  `last_seen_at`, `punch_count` ;
- les fonctions serveur `encheck_adms_appareil_ajouter`,
  `encheck_employes_sans_pin`, `encheck_entreprise_par_code`,
  `encheck_employee_login_qr`, `encheck_pointages_historique`, `encheck_punch`
  (`p_method: 'poste'`) ;
- la clé de stockage `encheck_poste` et la forme de l'objet retenu ;
- `KorhogoFriseSvg` et `KorhogoBlasonSvg` (assertés par
  `entreprisesKorhogo.test.jsx`).

## 6. Détails de mise en page

- pas de **survol** qui change un fond derrière un texte, la couleur d'un texte
  ou l'opacité d'un champ : les `:hover` ne touchent que les bordures et les
  ombres ;
- pas de **case nue** : l'œil de la clé, le chevron du dépannage, l'onglet
  sélectionné et le sceau de l'état sont dessinés ;
- **chargement dessiné** (chevrons qui défilent), jamais une roue photo ;
- **responsive** 1024 / 860 / 760 / 620 px sur la page, 720 / 480 px sur le
  poste ; cibles tactiles de 44 px sur la tablette ;
- `prefers-reduced-motion` respecté sur les deux écrans ;
- **aucune formule d'atelier** dans le texte lu, aucun nom de table.

## 7. Vérification

- `src/services/__tests__/configurationPointeuse.test.jsx` — 37 tests :
  la fusion (route, redirection, menu, verrou), le motif et le blason, le
  thème clair, la mécanique ADMS, les gestes réels sur une fausse base
  (enregistrer / mettre en pause / réactiver / supprimer / journal), le poste
  dans la page, l'écran de la tablette, et les règles de dessin ;
- suite complète : **128 fichiers, 1 484 tests** ;
- eslint (gate) : 0 erreur ; `vite build` : ✓.
