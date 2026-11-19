# Registre des décisions — identité En-Check

> **Ce fichier est le brouillon de la charte.** On n'écrira pas la charte à la fin :
> on l'assemblera à partir de ce registre. Chaque ligne a une date, un statut, une
> preuve et un décideur. Aucune ligne ne passe à « validée » sans décision explicite
> du fondateur — même règle que le registre du dossier « IA ANALYSE ».
>
> Statuts : **proposée** · **à tester** · **validée** · **retirée**

---

## D-001 — Palette de socle : sable & argile

| | |
|---|---|
| **Statut** | **validée** |
| **Décidé par** | Le fondateur, le 18 novembre 2026 |
| **Preuve** | `01-palettes.png`, `04-decision.png`, `02-ecrans.png`, `03-preuve.png` |
| **Origine des valeurs** | Échantillonnées sur `public/images/paie-bogolan-haut.webp` (motif déjà validé) |

| Rôle | Clair | Sombre |
|---|---|---|
| Fond | `#F3E9DA` | `#1C1109` |
| Surface | `#FBF4E9` | `#2A1B10` |
| Surface 2 | `#EADCC7` | `#352316` |
| Bordure | `#D8C6AC` | `#463020` |
| Encre | `#2A1708` | `#F3E9DA` |
| Encre douce | `#6B4A32` | `#C9B49A` |
| Marque (aplat) | `#A26537` | `#CEA872` |
| Marque en texte | `#7E4A26` | `#D9B98C` |
| Succès | `#3F6B4C` | `#7FB08F` |
| Alerte | `#8A5A14` | `#E0B36A` |
| Erreur | `#9B2C2C` | `#E08A8A` |

**Règle d'usage attachée** : `#A26537` remplit (boutons, repères) mais **n'écrit jamais**.
Tout texte d'accent, lien ou référence prend `#7E4A26` (6,04:1).

---

## D-002 — Couleurs secondaires issues des motifs

| | |
|---|---|
| **Statut** | **proposée** |
| **Preuve** | `05-motifs.png` (échantillonnage des six motifs) |

| Rôle | Clair | Sombre | Source |
|---|---|---|---|
| Indigo | `#0C1C35` | `#8FA3C8` | Adinkra · Ndébélé |
| Vert forêt | `#21624F` | `#7FB08F` | Zoulou |

**Usage autorisé** : illustrations, états vides, séparateurs, légendes d'un motif.
**Usage interdit** : bouton d'action principal, en-tête, navigation. L'action reste argile.

---

## D-003 — Doctrine des motifs : le passe-partout

| | |
|---|---|
| **Statut** | **validée** — option « passe-partout » |
| **Décidé par** | Le fondateur, le 18 novembre 2026 |
| **Preuve** | `06-motifs-regles.png` (régime 2) |

### Fiche technique (c'est ce que les devs implémentent)

| Élément | Valeur |
|---|---|
| Hauteur de bande | **hauteur native du motif** — 76 px (Bogolan, référence) · 60 px sur téléphone |
| Correctif du 18/11 | La planche 06 annonçait 20 px : **c'était une valeur inventée**. Le produit affiche 76 px, et les neuf images sont réduites proportionnellement. Seuls les cinq motifs vectoriels sont étirés (voir D-004 bis). |
| Position | sous la barre haute, **en haut de page**, une seule fois |
| Fond du cadre | `--surface` (`#FBF4E9` / `#2A1B10`) |
| Bordure | **1 px** `--bordure` (`#D8C6AC` / `#463020`) |
| Rayon | 6 px |
| Marge latérale | **10 px** sur les pages d'administration |
| Exception kiosque | marge nulle (bord à bord), bordure haute et basse seulement — le kiosque n'a pas de barre haute |
| Image | `repeat-x`, hauteur = celle de la bande, **proportions d'origine**, jamais étirée en largeur |
| Page sans motif | hérite du **Bogolan** |

### Interdits (chacun est un contrôle CI)

- texte, tableau ou bouton **par-dessus** la bande ;
- une **couleur prélevée** sur un motif (le bleu du Ndébélé n'est pas un bleu de bouton) ;
- **deux** motifs forts dans la même zone ;
- **plus d'une** bande par page.

Un motif par page, **oui**. Les conditions :

1. **Hauteur et place fixes** — 20 px de haut, en haut de page, marge 10 px,
   bordure 1 px `--bordure`, fond `--surface` (le passe-partout). Identiques partout.
2. **Jamais derrière du texte** — le motif occupe sa bande, aucun contenu par-dessus.
3. **Aucune couleur prélevée** — le bleu du Ndébélé n'est pas un bleu de bouton.
4. **Une bande par page, jamais étirée** — `repeat-x` aux proportions d'origine.

---

## D-004 — Motif attribué à chaque page

| | |
|---|---|
| **Statut** | **validée** — l'accueil prend le **Bogolan** (correction du fondateur, 18/11 : « je m'étais trompé ») ; le reste relevé dans le code |
| **Source de vérité** | `src/components/culturalMotif.js` — et non ma mémoire : le code en connaît **treize**, pas six |
| **Preuve** | `08-kente.png` |

| Page (route) | Motif | Type |
|---|---|---|
| **Accueil / Dashboard** | **Bogolan** | image 1536 × 76 |
| Paie, Fiches de paie, Config. fiscale, Rémunérations | Bogolan | image 1536 × 76 |
| Absences | Ndebélé | image 2172 × 724 |
| Planning, Enrôlements, Réglages | Kuba | image 1086 × 362 |
| Pointages | Adinkra | image 1200 × 298 |
| Employés | Zoulou | image 1200 × 298 |
| Pauses, Jours fériés | Lésotho | image |
| Retards | Tissage | image |
| Heures supplémentaires | Aso-Oké | SVG |
| Comptes, Accès, Mon compte, Prospection, Devis | Appliqué d'Abomey | SVG |
| Entreprises, Pointeuses, Annonces, Journal, Analytics | Korhogo | SVG |
| Géopointage, Carte temps réel | Dogon | SVG |
| Rapports | Nsibidi | SVG |
| Toute page non listée | Kente (défaut du code) | SVG, 960 × 28 |

**Conséquence assumée :** l'accueil et la Paie portent le même motif. C'est cohérent —
le Bogolan est le motif dont la palette B a été échantillonnée : l'accueil devient la
page « source », et la Paie garde sa variante haute + basse.

**Deux erreurs de ma planche 05, corrigées ici :** j'avais écrit six motifs (il y en a treize) et « Administrateurs → Bogolan » (c'est l'Appliqué d'Abomey). La leçon : je lis le code, je ne me fie pas à ma table précédente.

### D-004 bis — Le kente est étiré, et c'est le seul

Le kente est dessiné sur une tuile de **28 px** de haut, posée sur une bande de **76 px**
avec `preserveAspectRatio="none"` : il est donc agrandi **× 2,71** et déformé. Les neuf
images, elles, sont réduites en gardant leurs proportions.

| Solution | Effet | Coût |
|---|---|---|
| **A · Bandeau lettrage** | motif à 28 px centré sur fond espresso, dans la bande de 76 px | nul — une ligne de CSS |
| **B · Bande fine** | motif à 28 px seul, en passe-partout | la bande de l'accueil devient plus fine que les autres |
| **C · Redessiner le kente à 76 px** | le motif est recomposé à la bonne hauteur | un dessin à refaire, et validé par toi |

**Décidé : option A — le bandeau lettrage.** Le motif reste à 28 px, centré sur un fond
espresso, dans la bande de 76 px. Cela vaut pour toutes les pages qui gardent encore le
kente (les routes non listées dans `culturalMotif.js`), pas seulement l'accueil.

---

## D-005 — Thème : clair par défaut, un bouton, choix mémorisé

| | |
|---|---|
| **Statut** | **validée** |
| **Décidé par** | Le fondateur, 18 novembre 2026 |
| **Preuve** | `07-theme.png`, `09-interrupteur.png`, `10-bouton.png` |

| Point | Décision |
|---|---|
| Défaut | **clair**, sur tout appareil neuf |
| Interrupteur | **un seul bouton**, deux états (clair / sombre) — « la logique vit dans le bouton » |
| Ce qui disparaît | le sélecteur à trois positions, le mot « automatique », la page « Apparence » |
| Enregistrement | **immédiat** au clic : `localStorage['encheck.theme']` = `clair` \| `sombre` |
| Compte | colonne `profiles.theme_pref`, appliquée à la connexion si l'appareil n'a rien |
| Priorité | choix de la personne > réglage du site (kiosque) > défaut clair |
| Kiosque | pas de bouton : le réglage du site s'impose |
| Anti-clignotement | thème appliqué **avant le premier pixel** (script en ligne dans `index.html`) |

**État du code (vérifié le 18/11) :** il n'existe aujourd'hui **aucun** thème sombre —
ni `[data-theme]`, ni `prefers-color-scheme`, ni bouton. Les valeurs sombres de B sont
donc à créer entièrement (tableau D-001, colonne de droite).

### D-005 bis — Ce que montre l'icône

| | |
|---|---|
| **Statut** | **validée** — option A |
| **Décidé par** | Le fondateur, 18 novembre 2026 |
| **Preuve** | `10-bouton.png` |

- **A (retenue)** : l'icône montre **l'action** — lune en thème clair, soleil en thème sombre.
- ~~B~~ : l'icône montre l'état — écartée.

Fiche du bouton : 32 × 32 px, rayon 8, icône 18 px, barre haute avant l'avatar,
`aria-label` explicite et `aria-pressed` — l'icône seule ne suffit pas à un lecteur d'écran.

---

## D-006 — La police

| | |
|---|---|
| **Statut** | **validée** — IBM Plex Sans + IBM Plex Mono |
| **Décidé par** | Le fondateur, 18 novembre 2026 |
| **Preuve** | `11-police.png` |

### Ce que le code fait aujourd'hui

`--encheck-font-ui: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif` — **aucune police
n'est chargée**. Le produit emprunte celle de la machine du visiteur : Segoe UI sur
Windows, Geneva sur Mac, Roboto sur Android. Trois machines, trois dessins.

### Les trois candidates

| | Poids woff2 (400) | Chiffres tabulaires | Remarque |
|---|---|---|---|
| Inter | 23,1 Ko | non par défaut (9 largeurs distinctes) | neutre, invisible, excellente à l'écran |
| **IBM Plex Sans** | 22,1 Ko | **oui d'origine** (1 largeur) | du caractère, conçue pour les données, jumelle à chasse fixe |
| Work Sans | 19,4 Ko | non (9 largeurs) | plus ronde, plus chaleureuse |

Toutes les trois sont sous licence **OFL** (libres, auto-hébergeables, gratuites).

### La mesure qui compte

« 111 111 » et « 888 888 » — même nombre de caractères : **43 px contre 65 px** en
Inter, **62 px contre 62 px** en Plex Sans. Une colonne de montants ne s'aligne pas
toute seule. Inter sait le faire avec `font-variant-numeric: tabular-nums` ; Plex le
fait d'origine.

### Décision

**IBM Plex Sans** pour l'interface + **IBM Plex Mono** pour les matricules, les heures
et les montants. Poids retenus : 400, 600, 700 (les trois suffisent ; 500 fait doublon).
Auto-hébergement dans `public/fonts/`, `font-display: swap`.

### Une contrainte relevée pour D-010

Aucune des trois ne contient ɔ, ɛ, ɖ (fon) ni ṣ, ẹ (yoruba) — vérifié dans les
fichiers : les sous-ensembles web « latin » et « latin-ext » ne les livrent pas. Le
jour où on écrira en fon sur le kiosque, il faudra une police de complément.

---

## D-007 — Le logotype : on garde l'actuel

| | |
|---|---|
| **Statut** | **close — sans modification** |
| **Décision** | Le fondateur, 18 novembre 2026 : « ne touche pas au logo pour l'instant, gardons l'actuel » |
| **Preuve** | `12-logotype.png` (constat, non appliqué) |

Rien ne change : disque dégradé + empreinte, tel quel, dans les 23 fichiers.

**Constats conservés pour mémoire** (à ne pas appliquer sans une nouvelle décision) :

- le dégradé ne survit ni à 16 px, ni au noir et blanc, ni au fond sombre ;
- l'animation de chargement traverse trois couleurs hors palette (`#F59E0B`, `#D97706`, `#4A7C59`) ;
- les couleurs du logo sont celles de la palette A, donc décalées par rapport à B.

**Conséquence à assumer :** le logo reste en palette A dans un produit qui passe en B.
C'est un écart visible, mais il est **choisi**, pas subi. À rouvrir le jour où tu voudras.

---

## D-008 — Les images : une illustration par page

| | |
|---|---|
| **Statut** | **validée** |
| **Décidé par** | Le fondateur, 18 novembre 2026 |
| **Preuve** | `13-images.png`, `14-illustration.png` |

| Point | Décision |
|---|---|
| Nature | **une illustration par page** — pas de photo dans le produit |
| Référence | **la scène du badgeage** (`retards-arrival-approved.webp`) : une personne, un geste, le terminal |
| Photo | seulement sur autorisation écrite du lieu et des personnes |
| Cadre | jamais à nu : recadrée sur le sujet, dans une carte à bordure 1 px, ou dans une carte d'état vide |
| Couleurs | terre cuite et indigo — déjà dans les palettes D-001 et D-002 |
| Technique | WebP, 1 376 px de large au plus, 120 Ko au plus |

### Pourquoi la scène plutôt que la borne seule

La borne vide est un objet ; la scène est **un geste**. Le produit vend le geste — quelqu'un
passe, à telle heure — et la scène le montre sans avoir besoin d'un mot. Elle a en plus
l'avantage d'être une illustration : aucun visage réel, donc aucun consentement à gérer.

### La mesure qui impose le cadre

Le fond blanc de l'illustration occupe **57 % de l'image** ; sur le sable de B il donne
**1,17:1**, et sur la surface **1,07:1** — l'image fait un trou clair dans la page.
D'où trois règles : recadrer sur le sujet, poser dans une carte, border de 1 px.

### Ouvert (à traiter plus tard)

« Mettre en avant ce genre d'image » : à rouvrir quand les cinq premières illustrations
existeront. Séquence proposée : **Accueil, Pointages, Absences, Planning, Paie**.
Il manque une vingtaine de visuels sur les 27 pages — c'est un programme, pas une retouche.

---

## D-009 — L'identité de la preuve

| | |
|---|---|
| **Statut** | **validée** |
| **Décidé par** | Le fondateur, 18 novembre 2026 |
| **Preuve** | `03-preuve.png`, `15-preuve-document.png`, `16-verification.png` |
| **Statut** | **validée** — grammaire des six règles + vérification niveau complet (voir ci-dessous) |

### Trois sorties, une seule grammaire

| Document | Ce qu'il prouve | Durée de conservation | Référence |
|---|---|---|---|
| Billet de pointage | une journée | non modifiable après clôture, 5 ans | `2026-11-08-0042` |
| Bulletin de paie | un mois | 5 ans | `FP-2026-11-0417` |
| Rapport de pointage | une période | — | `RP-2026-11-A1` |

### Les six règles

1. **Toujours clair** — un document ne suit jamais le thème de l'application, même si l'écran est sombre.
2. **Le motif en tête** — 18–20 px, en passe-partout, une seule fois. Il signe ; il ne décore pas le corps.
3. **Chiffres en mono** — colonnes et virgules alignées, même police pour tous les montants (D-006).
4. **Une référence unique** — chaque sortie en porte une, imprimée et lisible.
5. **Vérifiable** — un QR vers une page publique qui dit si le document est authentique.
6. **Noir et blanc d'abord** — la couleur ne porte jamais l'information seule.

### Le test qui impose la règle 6

Passés en niveaux de gris : vert **90**, ambre **96**, rouge **77**. Le vert et l'ambre sont à
six points l'un de l'autre — sur une photocopie, « en poste » et « en retard » deviennent
le même rond. D'où : **la couleur informe, le mot décide.**

### Décision de conception prise en cours de route

Le tampon « CLÔTURÉE » a été **retiré** de la maquette : posé sur du texte, il rend les deux
illisibles — ce que D-003 interdit déjà. La preuve est portée par la **référence**,
l'**empreinte** et l'**heure serveur**, pas par un cachet.

### Décision : niveau **complet**

| | |
|---|---|
| **Statut** | **validée** — niveau complet |
| **Décidé par** | Le fondateur, 18 novembre 2026 : « je veux le complet » |
| **Preuve** | `16-verification.png` |

La page publique affiche : statut d'authenticité, employeur, salarié, période, détail des
rubriques et **montants**, empreinte, nombre de consultations.

**Quatre garde-fous, non négociables** (chacun est une ligne de code, et un test) :

| Garde-fou | Ce qu'il empêche |
|---|---|
| **Jeton imprévisible** | 32 caractères tirés au hasard : on ne passe pas d'un bulletin au suivant en changeant un chiffre |
| **Non indexable** | `noindex`, `nofollow`, absent du sitemap, aucun lien depuis le site |
| **Révocable** | l'employeur peut invalider un lien ; la page affiche alors « document révoqué » et plus aucun montant |
| **Journalisé** | chaque consultation horodatée et visible du salarié : il sait qui a regardé sa paie |

**Risque résiduel, écrit noir sur blanc :** une personne qui a le papier peut photographier
l'écran. Les garde-fous rendent la fuite **traçable et révocable**, pas impossible. C'est le
prix du niveau complet, et le client doit en être informé — pas protégé par le silence.

**Durée de vie des liens : 3 mois, pour tous les documents.** Décidé le 18/11/2026 —
« 3 mois pour tout ». Au-delà, la page n'affiche plus que l'authenticité et la date
d'émission, jamais les montants.

Un lien qui ne meurt pas est une fuite qui attend son heure. Trois mois couvrent
largement le besoin réel : un vérificateur contrôle un document frais, pas un bulletin
de l'an dernier — et s'il en a besoin plus tard, l'employeur peut réémettre.

**Autorité compétente** : APDP (Bénin). Le principe est celui de toute donnée personnelle —
une exposition doit pouvoir être justifiée, et la personne concernée doit pouvoir savoir
qui a consulté.

---

## D-010 — Les langues : français partout, un bonjour par pays

| | |
|---|---|
| **Statut** | **validée** |
| **Décidé par** | Le fondateur, 18 novembre 2026 |
| **Preuve** | `17-langues.png`, `18-bonjour.png` |

**Décision :** l'interface reste **en français**. Les langues locales ne servent qu'à une
chose : **la salutation de l'accueil**, choisie selon le pays de l'entreprise.

| Pays | Langue | Salutation |
|---|---|---|
| Bénin | fon | Àfɔ̀n gandia |
| Congo (RC et RDC) | lingala | Mboté |
| Madagascar | malgache | Manao ahoana |
| Sénégal | wolof | **Na nga def** |
| *(autre pays)* | — | **Bonjour** par défaut |

### Le mécanisme

| | |
|---|---|
| **Où** | une table « pays vers salutation », **en base** — ajouter un pays ne doit jamais demander de redéployer l'application |
| **Quand** | la salutation suit le **pays choisi par l'entreprise**, jamais la langue du navigateur |
| **Défaut** | « Bonjour » si le pays n'a pas d'entrée : jamais de case vide, jamais de carré |
| **Qui valide** | un locuteur du pays. Une salutation fausse est pire que « Bonjour » |
| **Portée** | l'accueil seulement — et le premier écran du kiosque, si tu veux aller jusque-là |

### La seule difficulté technique, et sa mesure

« Afon Gandia » s'écrit sans les lettres propres au fon : c'est lisible partout, mais ce
n'est pas l'orthographe du fon et la prononciation se perd. La forme correcte —
**Àfɔ̀n gandia** — demande une police de secours pour le **o ouvert** (ɔ) et l'accent grave.

Coût : **une seule ligne** à charger, une police de secours déclarée en second, et un test
automatique qui échoue si un caractère manque. C'est le prix de l'orthographe juste, et il
est dérisoire.

---

## Le périmètre — trois couches, à ne pas confondre

| Couche | Ce que c'est | Ce qu'elle contient | Durée de vie |
|---|---|---|---|
| **1 · L'identité** | ce qui rend En-Check reconnaissable sans son nom | couleurs, motifs, typographie, image, preuve, voix | des années |
| **2 · Le système d'interface** | la bibliothèque de composants, **dérivée** de la couche 1 | boutons, champs, tableaux, badges, modales, états vides | suit le produit |
| **3 · Les tendances** | les modes graphiques | Bento UI, glassmorphism, néomorphisme, icônes 3D | 2 à 5 ans |

Preuve que la couche 2 découle de la couche 1, et non l'inverse : **le bouton**. Sa couleur
(argument de D-001), son rayon, sa police (D-006), ses quatre états et ses contrastes
mesurés (4,64 · 6,35 · 6,03 · 3,24) ne sont pas des choix de bouton — ce sont les
décisions d'identité appliquées à un objet de 40 px.

### Bento UI — où ça marche, où ça casse

Bento est une **grille** : des cartes de tailles inégales. Ce n'est pas une identité, mais
ça peut le devenir — le jour où il est **le même sur tous les accueils**.

| Contexte | Verdict |
|---|---|
| Accueil, tableau de bord | ✓ le regard hiérarchise tout seul |
| Paie, pointages, rapports | ✗ 42 lignes et 6 colonnes ne se découpent pas en cartes |

**Règle proposée :** Bento sur les pages d'accueil uniquement, jamais dans un tableau.

---

## D-011 — Le système d'interface (le kit)

| | |
|---|---|
| **Statut** | **à venir** — deuxième volume |
| **Preuve** | `19-perimetre.png` (le périmètre et le bouton) |

Six composants à dessiner, chacun avec ses états et ses contrastes mesurés :
**boutons** · **champs** · **tableaux** · **badges** · **modales** · **états vides**.

Ce volume ne s'écrit pas avant le volume 1 : un composant dessiné avant les couleurs est
un composant à redessiner.

---

## Les tendances — ce qui entre, ce qui reste dehors

Document complet : `CHARTE-TENDANCES.md`. Planche : `20-tendances.png`.

| Tendance | Nature | Ce qu'on prend | Ce qu'on refuse |
|---|---|---|---|
| **Bento UI** | une grille | accueil + tableaux de bord : 12 colonnes, 6 tuiles max, une seule grande, rayon 12, un chiffre par tuile | jamais dans un tableau, un formulaire ou la paie |
| **Apple / HIG** | une discipline | une action principale par écran, trois niveaux de texte, échelle d'espace 4-48, mouvement de 200 ms qui explique | SF Pro (D-006), rayons 16-20 px, flou de transparence |
| **Awwwards 3D** | un spectacle | un seul écran, côté public : moins de 1,5 Mo, image de remplacement, aucun mouvement automatique | l'administration, la paie, tout ce qui doit être vérifiable |
| **Glassmorphism** | un effet | rien | exclu : contraste ≈ 3:1 sur sable, sous le seuil de 4,5:1 du contrôle n° 2 |

**Décision du 18 novembre 2026 :** les trois sont **validées**, sur la phrase
exacte : « je valide ta proposition » — à confirmer une dernière fois si elle
ne portait que sur une partie. Citation conservée ici : c'est la trace qui
autorise le statut, rien d'autre. Preuve chiffrée de D-013 sur `21-apple-defaut.png` : 53 tailles
de texte, 41 marges, 27 rayons dans `src/`, dont **88 % hors échelle**.

**Le test qui arbitre :** *est-ce que ça aide quelqu'un de fatigué, à 18 h, à
clôturer une paie sans se tromper ?* Apple gagne, Bento gagne mais localisé,
la 3D perd dans l'admin et gagne au-dehors.

**Les trois critères comptables :** 1 action principale + 3 secondaires
maximum ; moins de 300 Ko hors images ; action principale atteinte en moins de
2 secondes sans défilement sur 1280 × 800.

---

## À décider — la suite

| # | Sujet | État |
|---|---|---|

| D-006 | Police de référence de l'interface | **validée** — IBM Plex Sans + Mono |
| D-007 | Logotype | **close** — l'actuel, inchangé |
| D-008 | Les images | **validée** — une illustration par page, la scène du badgeage |
| D-009 | L'identité de la preuve | **validée** — grammaire + vérification complète |
| D-010 | Les langues | **validée** — français + bonjour par pays |
| D-011 | Le système d'interface (six composants) | **entérinée** — `22-kit.png`, détail `CHARTE-KIT.md` |
| D-012 | Bento UI sur les accueils | **clôturée** — remplacée par D-014 (`19-perimetre.png`) |
| D-013 | Apple par défaut (espace, hiérarchie, mouvement) | **validée** — `20-tendances.png`, preuve `21-apple-defaut.png` |
| D-014 | Bento sur l'accueil (grille 12 colonnes, 6 tuiles) | **validée** — `20-tendances.png` |
| D-015 | 3D sur le site public (un seul écran, cinq garde-fous) | **validée** — `20-tendances.png` |
| D-016 | La peau du kit | **entérinée** — **D, brut adouci** (`23-quatre-peaux.png`) |
| D-017 | Trois formes par objet (18 formes) | **entérinée** — `24-brut-adouci.png` |
| D-018 | La barre latérale : espresso, kente sous le logo, actif ivoire, 5 teintes fixes | **entérinée** — `26-dashboard-sidebar.png` |
| D-019 | Périmètre : chaque page, chaque modale, dashboard d'abord | **entérinée** |
| D-020 | La modale : 420/560/760, voile 44 %, deux boutons, Échap | **entérinée** — « je valide tout », `27-modale.png` |

---

## Le mécanisme (pourquoi ce registre existe)

Trois défauts observés dans tes documents actuels, que ce registre corrige :

1. **Deux vérités** — le référentiel Drive disait « pas encore approuvé » quand
   l'audit du dépôt disait « validée, on n'y touche pas ». Ici, une seule ligne,
   une seule date, un seul décideur.
2. **Version sans mise à jour** — un document modifié le 18 restait nommé
   « v0.1 — 10 novembre ». Ici, chaque décision est un numéro immuable : on
   ajoute D-011, on ne réécrit pas D-001.
3. **Décision sans preuve** — ici chaque ligne renvoie à une planche, donc à une
   image que tu as vue et que je peux régénérer.

**Fin de parcours** : quand les lignes D-001 à D-010 seront à « validée », la
charte s'écrit en une heure — c'est ce fichier, mis en page. Rien à réinventer.

---

## Le registre opposable

`DECISIONS-ENTERINEES.md` porte le statut **entérinée** : décisions closes, dont
la réouverture exige un nouveau numéro daté. Le présent registre suit les
travaux ; l'autre document fait foi. Quand les deux divergent, c'est
`DECISIONS-ENTERINEES.md` qui a raison, et l'écart doit être corrigé ici.
