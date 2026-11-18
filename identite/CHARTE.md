# EN-CHECK — LA CHARTE

## Le rapport à respecter partout

**Version 1.2 — 18 novembre 2026**
Document de référence. Il remplace, pour l'application, toutes les décisions antérieures dispersées.

---

## Comment lire ce document

Ce rapport est né d'une règle simple, posée au premier jour : **rien n'est décidé sans avoir été vu, mesuré, puis validé par le fondateur.** Vingt décisions, vingt-huit planches, un registre. Tout ce qui suit en découle.

Trois statuts, et un seul verrouille :

| Statut | Signification | Qui peut y toucher |
|---|---|---|
| **entérinée** | close. S'applique telle quelle. | le fondateur seul, par une nouvelle décision numérotée |
| **validée** | arrêtée, détails ajustables à l'intérieur | le fondateur |
| **proposée** | en attente ; ne s'applique à rien | personne |

Une décision entérinée ne se réinterprète pas. Si une contrainte technique empêche de l'appliquer, **on remonte le problème** — on ne contourne pas en silence. Rouvrir coûte un nouveau numéro daté ; on n'efface jamais l'ancienne, on la déclare remplacée.

**Les documents sources :** `DECISIONS-ENTERINEES.md` (le registre opposable), `CHARTE-VOLUME-1.md` (le pourquoi de l'identité), `CHARTE-TENDANCES.md`, `CHARTE-KIT.md`, et les 28 planches. En cas de divergence, le registre fait foi.

---

# 1. L'identité

## 1.1 La palette — sable & argile (D-001, entérinée)

| Rôle | Valeur | Contraste sur son fond |
|---|---|---|
| Fond de page | `#F3E9DA` | — |
| Surface (carte, champ) | `#FBF4E9` | — |
| Surface 2 (en-tête de tableau) | `#EADCC7` | — |
| Bordure | `#D8C6AC` | — |
| Encre (texte principal) | `#2A1708` | **14,27** sur le fond |
| Encre douce (secondaire) | `#6B4A32` | **7,25** sur surface |
| Texte d'accent | `#7E4A26` | **6,64** sur surface |
| Aplat (remplissage) | `#A26537` | — |
| Succès | `#3F6B4C` | 5,62 |
| Alerte | `#8A5A14` | 5,41 |
| Erreur | `#9B2C2C` | 6,89 |
| Blanc cassé (texte sur aplat) | `#FFFDF7` | **4,64** sur `#A26537` |

**La règle d'or :** `#A26537` **remplit**, `#7E4A26` **écrit**. Le terracotta ne porte jamais de texte — ni ivoire (3,93), ni espresso (3,64). Il est la matière, pas le fond du texte.

## 1.2 Les motifs (D-003, D-004 — entérinées)

Bande de motif en **passe-partout** : hauteur **native 76 px** (60 px sur mobile), bordure 1 px, marge 10, `repeat-x`, jamais étirée, **jamais de texte dessus**. Une seule bande par page. Une page sans motif assigné reçoit le Bogolan.

| Page | Motif |
|---|---|
| Accueil (dashboard), Paie | Bogolan |
| Absences | Ndebele |
| Planning, Enrôlements, Réglages | Kuba |
| Pointages | Adinkra |
| Employés | Zoulou |
| Pauses, Jours fériés | Lésotho |
| Retards | Tissage |
| Heures supplémentaires | Aso-oké |
| Admins | Abomey |
| Entreprises | Korhogo |
| Géopointage | Dogon |
| Rapports | Nsibidi |
| Défaut | Kente |

Le kente n'est pas une bande de page : c'est un **bandeau de lettrage de 28 px sur espresso** (voir 6.2).

## 1.3 La typographie (D-006, entérinée)

**IBM Plex Sans** (400/600/700) et **IBM Plex Mono**, auto-hébergées, `font-display: swap`, licence OFL. **Aucune police tierce.** Chiffres **tabulaires** obligatoires : « 111 111 » et « 888 888 » doivent occuper la même largeur.

Trois niveaux, jamais plus : **titre 20/700**, **corps 14/400**, **légende 11/400**.

## 1.4 Le logotype (D-007, entérinée)

Inchangé. Il reste en palette A dans un produit en palette B : l'écart est **choisi**, pas subi. Il se rouvre sur une nouvelle décision, jamais au détour d'une page.

---

# 2. Le thème et les langues

**Thème (D-005, entérinée).** Clair par défaut. **Un seul bouton, deux états** ; l'icône montre l'action (lune en clair, soleil en sombre) — pas l'état. Mémoire dans `localStorage['encheck.theme']` et `profiles.theme_pref` ; priorité : personne > site (kiosque) > défaut ; script anti-clignotement dans `index.html`.

*État du code : aucun thème sombre n'existe. Les images sombres des planches sont des maquettes.*

**Langues (D-010, entérinée).** Interface en français. Salutation d'accueil selon le pays de l'entreprise, validée par un locuteur natif :

| Pays | Langue | Salutation |
|---|---|---|
| Bénin | fon | Àfɔ̀n gandia |
| Congo (RC et RDC) | lingala | Mboté |
| Madagascar | malgache | Manao ahoana |
| Sénégal | wolof | Na nga def |
| Défaut | — | Bonjour |

Une police de secours est nécessaire pour ɔ, ɛ, ɖ, ŋ (Plex et Inter ne les ont pas).

---

# 3. La preuve (D-009)

Trois documents, une grammaire : billet `2026-11-08-0042`, bulletin `FP-2026-11-0417`, rapport `RP-2026-11-A1`. **Liens de vérification valables 3 mois** pour tous. Tampon « CLÔTURÉE » retiré. Page `/v/<jeton>` montrant les montants, avec quatre garde-fous : jeton de 32 caractères, `noindex`/`nofollow`, révocable, journalisé.

> **Réserve.** Le principe est entériné ; la **mise en œuvre** est conditionnée à une revue sécurité et confidentialité (données exposées, qui peut ouvrir, comment la personne autorise, conséquences d'une fuite). La mention de l'APDP ne remplace pas cette revue.

**Les images (D-008).** Une illustration par page ; la photo de preuve, l'avatar et le justificatif sont des **données métier fournies par les personnes**, hors du périmètre de cette règle.

---

# 4. La peau : brut adouci (D-016, entérinée)

C'est elle qui donne au produit son caractère. Elle tient en cinq nombres.

| Paramètre | Valeur | Effet |
|---|---|---|
| Contour | **2 px `#2A1708`** sur tout objet actif | l'objet affirme son bord |
| Ombre | **dure, décalée de 3 px, sans flou** | l'objet se décolle, comme une carte posée |
| Rayons | **6** (bouton, champ) · **8** (carte, message, tuile) · **11** (badge) · **999** (pastille) | des angles francs, jamais cliniques |
| Boutons | **capitales, 700 / 9,5 px, espacées de 1,3** | l'action se lit comme une étiquette |
| Deux densités | terracotta (agir) · espresso (engager) | pas de troisième |

**Interdits de la peau :** ombres floues, rayons supérieurs à 12, gris de service en texte (3,53 — sous le seuil), ombre portée sur un texte.

---

# 5. Le kit : six objets, dix-huit formes (D-011, D-017 — entérinées)

| Objet | Forme 1 | Forme 2 | Forme 3 |
|---|---|---|---|
| **Bouton** | **Pleine** — action principale | **Contour** — action secondaire | **Inverse** (espresso) — ce qui engage |
| **Champ** | **Cadre** — formulaire | **Souligné** — saisie en ligne | **Étiquette fixe** — grille de réglages |
| **Badge** | **Pilule** — statut mouvant | **Tampon** — statut figé | **Onglet** — statut provisoire |
| **Message** | **Carte** — erreur bloquante | **Bandeau** — succès fugace | **Fiche** — alerte datée |
| **Tableau** | **Grille** — contrôle, paie | **Filets** — listes longues | **Tampon** — suivi de statuts |
| **Tuile** | **Chiffre** — accueil | **Chiffre + repère** — période, unité | **Bandeau** — tuile de section |

**Chaque forme a un emploi, et un seul.** Un badge « tampon » sur un statut qui peut encore changer est une faute, pas un choix. Sept états de bouton (repos, survol, actif, désactivé, secondaire, danger, lien) avec leurs contrastes : 4,64 · 5,72 · 7,13 · 5,87 · 6,64 · 7,40 · 6,64.

**Le rouge est réservé à ce qui détruit.** Clôturer une paie engage : bouton **inverse**, pas danger.

---

# 6. Les écrans (D-013, D-014, D-018, D-019, D-020)

## 6.1 Une page

1. **Bande de motif** (76 px, native) ;
2. **En-tête** : titre 20/700, sous-titre 11 px, **une seule action de poids maximal** ;
3. **Tuiles** (accueil et tableaux de bord) : 6 maximum, une seule grande, rayon 12 ;
4. **Messages** : deux au plus à l'écran, jamais « une erreur est survenue » ;
5. **Tableau** : chiffres à droite en largeur fixe, une action par ligne, pas de zébrures ;
6. **Pagination à 25 lignes** — découverte sur la page de paie : 40 lignes font 1,7 écran, donc les garde-fous de D-013 vivent dans l'écran, pas dans la liste infinie.

Espace : **4 · 8 · 12 · 16 · 24 · 32 · 48**, jamais une autre valeur. Mouvement : **200 ms**, `ease-out`, jamais au chargement.

## 6.2 La barre latérale (D-018)

Espresso conservé, **252 px**, fixe. Sous le logo, le **bandeau kente de 28 px** : c'est la seule surface espresso du produit, donc sa seule place. L'item actif est un **bloc ivoire, texte espresso (14,27)**, avec l'ombre terracotta décalée — le terracotta ne peut pas porter de texte, il devient la matière.

Le mode « Personnaliser » garde **réordonner et renommer** ; il perd le choix libre de couleur. Cinq teintes fixes de la palette B, pastilles de 6 px avec liseré ivoire. *Défaut mesuré sur l'ancien système : quatre des cinq teintes tombaient sous 4,5:1 — ambre 1,92.*

## 6.3 La modale (D-020)

Une **carte**, pas un écran : rayon 8, contour 2 px, ombre dure de 6 px, **trois largeurs** — 420 (décider), 560 (saisir), 760 (consulter). Voile espresso **44 %**. **Deux boutons au plus**, une action pleine. Le titre est l'action, en question. Sortie : croix, Échap, Annuler — au même endroit. Sous 640 px de fenêtre, feuille plein écran, action principale en haut.

Au-delà de 8 champs, ce n'est plus une modale : c'est une page.

---

# 7. Les tendances

Couche 3, durée de vie 2 à 5 ans — elle ne contamine jamais les couches 1 et 2.

| Tendance | Ce qu'on prend | Ce qu'on refuse |
|---|---|---|
| **Bento** | la grille de l'accueil uniquement | jamais dans un tableau, un formulaire, la paie |
| **Apple** | une action de poids maximal, trois niveaux de texte, l'échelle d'espace, le mouvement qui explique | SF Pro, rayons 16-20, flou de transparence |
| **Awwwards 3D** | un seul écran, côté public, < 1,5 Mo, image de remplacement | l'administration, la paie, tout ce qui doit être vérifiable |
| **Glassmorphism** | rien | exclu : contraste ≈ 3:1 sur sable |

**Le test qui arbitre :** *est-ce que ça aide quelqu'un de fatigué, à 18 h, à clôturer une paie sans se tromper ?*

---

# 8. Les douze contrôles

| # | Contrôle | Décision | Automatisable |
|---|---|---|---|
| 1 | Aucun `#hex` hors des fichiers de tokens | D-001 | **oui** |
| 2 | Toute paire texte/fond ≥ 4,5:1 | D-001 | **oui** |
| 3 | Une seule bande de motif par page, hauteur native | D-003 | non — capture |
| 4 | Aucun motif étiré | D-003 | non — capture |
| 5 | Aucun texte sur une bande | D-004 | non — capture |
| 6 | Aucune police tierce | D-006 | **oui** |
| 7 | Aucun statut exprimé par la couleur seule | D-009 | non — lecture |
| 8 | Aucun composant hors des dix-huit formes | D-017 | partiel |
| 9 | Aucune ombre floue (`blur` = 0) | D-016 | **oui** |
| 10 | Rayons limités à {6, 8, 11, 12, 999} | D-016 | **oui** |
| 11 | Contour 2 px `#2A1708` sur tout objet actif | D-016 | partiel |
| 12 | Boutons en capitales 700 / 9,5 px | D-016 | partiel |

**L'outil :** `node scripts/charte-check.mjs` (voir `PROTOCOLE-IMPLEMENTATION.md`). Il mesure, il ne corrige pas.

---

# 9. L'état du dépôt au 18 novembre 2026

Relevé par `node scripts/charte-check.mjs` sur la branche de travail. **C'est la ligne de départ, pas un jugement.**

| Mesure | Aujourd'hui | Cible |
|---|---|---|
| Valeurs de couleur en dur | **4 712** dans **184** fichiers | 0 hors tokens |
| Tailles de texte | **57** | **3** |
| Marges intérieures | **43** | **7** |
| Rayons d'angle | **27** valeurs (362 hors liste) | **4** |
| Ombres floues | **140** | 0 |
| Polices tierces | **0** | 0 |
| Paires de contraste | **10 vérifiées**, plancher 4,64 | ≥ 4,5 |

**Verdict du jour : NON CONFORME** — et c'est normal. Une charte qui serait « conforme » le premier jour n'aurait rien changé à rien.

---

# 10. Comment on applique

**L'ordre est fixé (D-019) :** dashboard → pages de travail (pointages, absences, planning, employés, paie) → pages de réglage → modales. Aucun écran ne passe avant celui qui le précède.

**Une exception, décidée (D-021) :** la page **Employés** passe avant le dashboard, parce qu'elle était déjà en chantier. Les deux autres règles ne bougent pas : une page à la fois, et les modales en dernier.

**La règle des quatre temps, pour chaque page :** dessin → validation → code → **remesure**. Aucun code avant validation du dessin ; aucune page déclarée finie sans que les compteurs aient bougé.

Le protocole complet, avec la fiche de page, la notation et la dérogation, est dans `PROTOCOLE-IMPLEMENTATION.md`. Le **message à coller** en tête de chaque conversation avec un agent est dans `MESSAGE-AGENT.md` : trois lignes de réponse avant tout code. C'est ce couple qui rend cette charte applicable par plusieurs mains en même temps.

**Ce qui n'est pas une décision :** un écart sur un écran pas encore refait. Ces écarts sont numérotés **DÉR-01 à DÉR-04** dans `DEROGATIONS.md` — datés, motivés, et levés à la rétro de l'écran. Ils ne prennent pas de numéro `D-0xx` : la série des décisions appartient au fondateur.

---

# 11. Ce qui reste ouvert

| N° | Sujet | État |
|---|---|---|
| **D-002** | Couleurs secondaires (indigo, vert forêt) : illustration, états vides, séparateurs. Jamais bouton, en-tête, navigation. | **proposée** |
| — | Numéroter les dérogations `DÉR-0x` plutôt que `D-0xx` | **proposée** (le registre applique déjà la correction) |
| — | Revue sécurité de D-009 | à planifier |
| — | Le module « IA » et les pages qui n'ont pas encore de planche | à dessiner au moment venu |

Rien d'autre. Les vingt autres décisions sont entérinées.

---

## Annexe — les 28 planches

`01-palettes` · `02-ecrans` · `03-preuve` · `04-decision` · `05-motifs` · `06-motifs-regles` · `07-theme` · `08-kente` · `09-interrupteur` · `10-bouton` · `11-police` · `12-logotype` · `13-images` · `14-illustration` · `15-preuve-document` · `16-verification` · `17-langues` · `18-bonjour` · `19-perimetre` · `20-tendances` · `21-apple-defaut` · `22-kit` · `23-quatre-peaux` · `24-brut-adouci` · `25-paie-brut-adouci` · `26-dashboard-sidebar` · `27-modale` · `28-mecanisme`

---

### Journal

| Date | Événement |
|---|---|
| 18/11/2026 | D-001 à D-020 décidées, toutes entérinées sauf D-002. 27 planches produites. |
| 18/11/2026 | Première version du rapport. Relevé d'entrée du dépôt : 4 661 couleurs en dur, 53 tailles de texte. |
| 18/11/2026 | Planche 28 : le mécanisme d'évaluation et de contrôle. Protocole d'implémentation écrit pour les agents IA. |
| 18/11/2026 | Fondations posées dans le dépôt (PR #231) : jetons, 18 formes, IBM Plex, thème, barre D-018. D-020 entérinée. Dérogations renumérotées DÉR-01 à DÉR-04. Relevé du dépôt refait. |
