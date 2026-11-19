# CHARTE D'IDENTITÉ EN-CHECK — VOLUME 1

**Version 1.2 — 18 novembre 2026**
*Versions 1.0 et 1.1 : 18 novembre 2026. Cette révision ne change aucune décision ; elle corrige trois ambiguïtés relevées lors d'une revue de cohérence (statut de D-012, nombre de planches, nature des images de thème) et ajoute deux nuances de périmètre (photos de preuve, réserve de sécurité).*
Décisions prises par le fondateur, une par une, chacune appuyée sur une planche rendue et mesurée.

---

## Comment lire ce document

Ce document n'est pas une proposition. C'est le **relevé des décisions déjà prises**, avec leur preuve et leur mode de contrôle.

Chaque décision porte un numéro immuable (D-001, D-002…). On n'en réécrit jamais une : on en ajoute une nouvelle, datée. Un document qui se réécrit sans laisser de trace ne vaut rien : c'est ce qui s'est passé avec le référentiel v0.1, modifié le 18 novembre alors qu'il s'appelait encore « v0.1 — 10 novembre ».

Quatre statuts, et quatre seulement :

| Statut | Sens |
|---|---|
| **validée** | décidée par le fondateur, applicable immédiatement |
| **proposée** | écrite, mesurée, en attente de décision |
| **close** | tranchée par « on ne touche pas » — elle ne revient pas sans une nouvelle décision |
| **à venir** | reconnue comme nécessaire, pas encore écrite |

---

## Les dix décisions, en une page

| # | Sujet | Décision | Statut |
|---|---|---|---|
| D-001 | Couleurs | Sable & argile (palette B) | validée |
| D-002 | Couleurs secondaires | Indigo et vert forêt, en illustration seulement | proposée |
| D-003 | Motifs | Un motif par page, en passe-partout | validée |
| D-004 | Motif par page | Accueil = Bogolan ; kente en bandeau lettrage ailleurs | validée |
| D-005 | Thème | Clair par défaut, un seul bouton, choix mémorisé | validée |
| D-006 | Typographie | IBM Plex Sans + IBM Plex Mono | validée |
| D-007 | Logotype | On garde l'actuel, sans modification | close |
| D-008 | Images | Une illustration par page | validée |
| D-009 | La preuve | Trois documents, une grammaire ; vérification complète | validée |
| D-010 | Langues | Français partout, un bonjour par pays | validée |
| D-011 | Système d'interface | Six composants | à venir |
| D-012 | Bento UI | Accueils seulement, jamais dans un tableau | clôturée — remplacée par D-014 |

---

## Chapitre 1 — Les couleurs (D-001, D-002)

### D-001 — La palette de socle : sable & argile

Les valeurs ne sont pas inventées : elles sont **échantillonnées sur le motif bogolan déjà validé** (`public/images/paie-bogolan-haut.webp`). C'est ce qui rend la palette légitime — elle vient du produit, pas d'un nuancier.

| Rôle | Clair | Sombre | Contraste sur le fond clair |
|---|---|---|---|
| Fond | `#F3E9DA` | `#1C1109` | — |
| Surface | `#FBF4E9` | `#2A1B10` | — |
| Surface 2 | `#EADCC7` | `#352316` | — |
| Bordure | `#D8C6AC` | `#463020` | 1,39 (décoratif) |
| Encre | `#2A1708` | `#F3E9DA` | **14,27** |
| Encre douce | `#6B4A32` | `#C9B49A` | **6,59** |
| Marque (aplat) | `#A26537` | `#CEA872` | 3,93 — **aplat seulement** |
| Marque en texte | `#7E4A26` | `#D9B98C` | **6,04** |
| Succès | `#3F6B4C` | `#7FB08F` | **5,11** |
| Alerte | `#8A5A14` | `#E0B36A` | **4,92** |
| Erreur | `#9B2C2C` | `#E08A8A` | **5,11** |

**La règle d'or :** `#A26537` **remplit**, `#7E4A26` **écrit**. Un texte d'accent, un lien, une référence prennent toujours la seconde valeur. La première ne sert qu'aux aplats : boutons, pastilles, repères.

Blanc cassé `#FFFDF7` sur l'argile `#A26537` : **4,64** — le seul texte autorisé sur un bouton.

### D-002 — Les couleurs secondaires (proposée)

Les motifs apportent deux familles froides que la palette B ne prévoyait pas :

| Rôle | Clair | Sombre | Source |
|---|---|---|---|
| Indigo | `#0C1C35` | `#8FA3C8` | Adinkra, Ndebélé |
| Vert forêt | `#21624F` | `#7FB08F` | Zoulou |

**Autorisé :** illustrations, états vides, séparateurs, légendes de motif.
**Interdit :** bouton d'action, en-tête, navigation. L'action reste argile, partout.

### Les contrôles automatiques de la couleur

1. Aucun code hexadécimal en dur hors de `src/index.css` — la CI échoue si un `#` suivi de six caractères apparaît dans un autre fichier.
2. Toute paire texte/fond utilisée dans l'interface est mesurée : la CI échoue en dessous de **4,5:1**, sauf pour les éléments purement décoratifs, listés un par un.

---

## Chapitre 2 — Les motifs (D-003, D-004)

### D-003 — Le passe-partout

Un motif par page, **oui**. Mais un motif n'est pas une palette : c'est une image. Ses couleurs restent dans l'image.

| Élément | Valeur |
|---|---|
| Hauteur | **hauteur native du motif** — 76 px pour le Bogolan, 60 px sur téléphone |
| Position | sous la barre haute, en haut de page, **une seule fois** |
| Fond du cadre | `--surface` |
| Bordure | **1 px** `--bordure` |
| Rayon | 6 px |
| Marge latérale | 10 px (administration) — nulle sur le kiosque, qui n'a pas de barre haute |
| Image | `repeat-x`, proportions d'origine, **jamais étirée** |
| Page sans motif | hérite du Bogolan |

**Interdits, chacun devenant un test :** du texte par-dessus la bande ; une couleur prélevée sur un motif ; deux motifs forts dans la même zone ; plus d'une bande par page.

### D-004 — Quel motif pour quelle page

Treize motifs existent, tous déclarés dans `src/components/culturalMotif.js`.

| Page | Motif |
|---|---|
| **Accueil / Dashboard** | **Bogolan** |
| Paie, fiches de paie, configuration fiscale, rémunérations | Bogolan |
| Absences | Ndebélé |
| Planning, enrôlements, réglages | Kuba |
| Pointages | Adinkra |
| Employés | Zoulou |
| Pauses, jours fériés | Lésotho |
| Retards | Tissage |
| Heures supplémentaires | Aso-Oké |
| Comptes, accès, mon compte, prospection, devis | Appliqué d'Abomey |
| Entreprises, pointeuses, annonces, journal, analytics | Korhogo |
| Géopointage, carte temps réel | Dogon |
| Rapports | Nsibidi |
| Toute page non listée | Kente |

**Conséquence assumée :** l'accueil et la Paie portent le même motif. C'est cohérent — le Bogolan est le motif dont la palette a été échantillonnée. L'accueil devient la page « source ».

### D-004 bis — Le kente est étiré

Le kente est un dessin vectoriel de **28 px** de haut, affiché sur une bande de **76 px** avec `preserveAspectRatio="none"` : il est agrandi **× 2,71** et déformé. Les neuf images, elles, sont toujours réduites en gardant leurs proportions.

**Décision : option A, le bandeau lettrage.** Le motif reste à 28 px, centré sur un fond espresso, dans la bande de 76 px. Cela vaut pour toutes les pages qui gardent encore le kente.

---

## Chapitre 3 — La typographie (D-006)

**IBM Plex Sans** pour l'interface, **IBM Plex Mono** pour les matricules, les heures et les montants.

| | |
|---|---|
| Poids retenus | 400, 600, 700 (le 500 fait doublon) |
| Licence | OFL — libre, gratuite, auto-hébergeable |
| Hébergement | `public/fonts/`, `font-display: swap` |
| Chiffres | Plex Sans dessine des **chiffres tabulaires** d'origine : les colonnes de montants s'alignent sans réglage |

**La mesure qui a tranché :** « 111 111 » et « 888 888 », même nombre de caractères — **43 px contre 65 px** en Inter, **62 px contre 62 px** en Plex Sans.

**Interdit :** aucune police chargée depuis un serveur tiers. Une fiche de paie ne doit pas dépendre de la disponibilité de Google.

---

## Chapitre 4 — Le thème (D-005)

| Point | Décision |
|---|---|
| Défaut | **clair**, sur tout appareil neuf. `prefers-color-scheme` n'est pas lu sans autorisation |
| Interrupteur | **un seul bouton, deux états** — la logique vit dans le bouton |
| Ce qui n'existe pas | sélecteur à trois positions, mot « automatique », page « Apparence » |
| Enregistrement | immédiat au clic : `localStorage['encheck.theme']` = `clair` \| `sombre` |
| Compte | colonne `profiles.theme_pref`, appliquée à la connexion si l'appareil n'a rien |
| Priorité | choix de la personne > réglage du site (kiosque) > défaut clair |
| Kiosque | pas de bouton : le réglage du site s'impose |
| Anti-clignotement | thème appliqué **avant le premier pixel**, par un script en ligne dans `index.html` |

**D-005 bis — l'icône.** Le bouton montre **l'action** : lune en thème clair, soleil en thème sombre. L'état, l'écran entier le dit déjà ; une icône qui le répète n'apprend rien.

Fiche : 32 × 32 px, rayon 8, icône 18 px, barre haute avant l'avatar, `aria-label` explicite et `aria-pressed`.

**État du code :** il n'existe aujourd'hui aucun thème sombre — ni `[data-theme]`, ni `prefers-color-scheme`, ni bouton. Le tableau de D-001, colonne de droite, est intégralement à créer.
**Les images sombres de ce document sont des maquettes.** Elles montrent à quoi ressemblerait le thème sombre une fois décidé ; aucune capture de l'application réelle n'est reproduite ici. Quand le thème sera codé, une capture de l'écran réel remplacera la maquette — et pas avant.

---

## Chapitre 5 — Le logotype (D-007, close)

**Décision : on garde l'actuel, sans modification.** Disque à dégradé radial et empreinte de pied, dans les 23 fichiers où il apparaît.

Constats conservés pour mémoire, **non appliqués** :

- le dégradé ne survit ni à 16 px, ni au noir et blanc, ni au fond sombre ;
- l'animation de chargement traverse trois couleurs hors palette : `#F59E0B`, `#D97706`, `#4A7C59` ;
- les couleurs du logo sont celles de l'ancienne palette.

**Conséquence assumée :** le logo reste en palette A dans un produit qui passe en B. L'écart est choisi, pas subi. Il se rouvre sur une nouvelle décision.

---

## Chapitre 6 — Les images (D-008)

**Une illustration par page. Pas de photo dans le produit.**

| Point | Décision |
|---|---|
| Référence | **la scène du badgeage** (`retards-arrival-approved.webp`) : une personne, un geste, le terminal |
| Photo | seulement avec autorisation écrite du lieu et des personnes |
| Cadre | jamais à nu : recadrée sur le sujet, dans une carte à bordure 1 px, ou dans une carte d'état vide |
| Couleurs | terre cuite et indigo — déjà dans les palettes |
| Technique | WebP, 1 376 px de large au plus, 120 Ko au plus |
| **Photos de preuve** | **hors périmètre de D-008.** La photo de badgeage, l'avatar et la pièce justificative sont des **données métier** fournies par les personnes, pas des images de décoration : elles ne sont ni choisies, ni recadrées, ni illustratives. D-008 ne régit que l'illustration de page |

**La mesure qui impose le cadre :** le fond blanc de l'illustration occupe **57 %** de l'image ; sur le sable il donne **1,17:1**, sur la surface **1,07:1**. Posée telle quelle, l'image fait un trou clair dans la page.

**Interdits :** visage de salarié réel ; capture d'écran illisible ; texte incrusté dans l'image — le visual d'équipe actuel porte un slogan, « On gère ! », qui n'existe dans aucun document de marque.

**Programme :** 27 pages, 17 visuels existants. Séquence retenue : Accueil, Pointages, Absences, Planning, Paie.

---

## Chapitre 7 — La preuve (D-009)

> **Réserve de sécurité, ajoutée en v1.1.** Le statut « validée » porte sur **le principe** : une preuve qui montre ses montants, avec trois documents et quatre garde-fous. La **mise en œuvre** reste conditionnée à une revue sécurité et confidentialité, avec quatre questions à trancher avant la première mise en service : quelles données exactement sont exposées, qui peut ouvrir le lien, comment la personne autorise le partage, que se passe-t-il en cas de fuite. La mention de l'APDP ne remplace pas cette revue.

Trois documents, une seule grammaire.

| Document | Ce qu'il prouve | Référence |
|---|---|---|
| Billet de pointage | une journée | `2026-11-08-0042` |
| Bulletin de paie | un mois | `FP-2026-11-0417` |
| Rapport de pointage | une période | `RP-2026-11-A1` |

### Les six règles du document

1. **Toujours clair** — un document ne suit jamais le thème de l'application.
2. **Le motif en tête** — 18 à 20 px, en passe-partout, une seule fois. Il signe ; il ne décore pas le corps.
3. **Chiffres en mono** — colonnes et virgules alignées.
4. **Une référence unique** — imprimée, lisible, jamais cachée.
5. **Vérifiable** — un QR vers une page publique.
6. **Noir et blanc d'abord** — la couleur ne porte jamais l'information seule.

### Ce qui a été retiré

Un tampon « CLÔTURÉE » avait été posé sur le billet. Il a été **retiré** : posé sur du texte, il rend les deux illisibles — ce que D-003 interdit déjà. La preuve est portée par la **référence**, l'**empreinte** et l'**heure serveur**, pas par un cachet.

### La page de vérification : niveau complet

La page publique affiche le détail des rubriques et **les montants**. Quatre garde-fous, non négociables :

| Garde-fou | Ce qu'il empêche |
|---|---|
| Jeton imprévisible | 32 caractères au hasard : on ne passe pas d'un bulletin au suivant en changeant un chiffre |
| Non indexable | `noindex`, `nofollow`, absent du sitemap, aucun lien depuis le site |
| Révocable | l'employeur invalide un lien ; la page n'affiche alors plus aucun montant |
| Journalisé | chaque consultation horodatée et visible du salarié |

**Durée de vie des liens : 3 mois, pour tous les documents.** Au-delà, la page n'affiche plus que l'authenticité et la date d'émission.

**Risque résiduel, écrit noir sur blanc :** une personne qui a le papier peut photographier l'écran. Les garde-fous rendent la fuite traçable et révocable ; ils ne la rendent pas impossible. C'est le prix du niveau complet, et le client doit en être informé.

Au Bénin, l'autorité de contrôle est l'**APDP**.

---

## Chapitre 8 — Les langues (D-010)

**L'interface reste en français.** Les langues locales servent à une seule chose : la salutation de l'accueil, selon le pays de l'entreprise.

| Pays | Langue | Salutation |
|---|---|---|
| Bénin | fon | Àfɔ̀n gandia |
| Congo (RC et RDC) | lingala | Mboté |
| Madagascar | malgache | Manao ahoana |
| Sénégal | wolof | Na nga def |
| autre pays | — | **Bonjour** |

| Point | Règle |
|---|---|
| Où | une table « pays vers salutation », **en base** : ajouter un pays ne demande jamais de redéploiement |
| Quand | le pays choisi par l'entreprise, jamais la langue du navigateur |
| Défaut | « Bonjour » — jamais de case vide, jamais de carré |
| Qui valide | un locuteur du pays. Une salutation fausse est pire que « Bonjour » |
| Portée | l'accueil seulement |

**La difficulté, mesurée :** la police retenue ne contient ni ɔ, ɛ, ɖ, ŋ, ṣ, ẹ ni ọ. « Afon Gandia » s'écrit sans ces lettres — lisible partout, mais ce n'est pas l'orthographe du fon. La forme juste demande une **police de secours** déclarée en second, et un test qui échoue si un caractère manque.

---

## Chapitre 9 — Le périmètre (ce qui n'est pas encore écrit)

Trois couches, à ne pas confondre :

| Couche | Contenu | Durée de vie |
|---|---|---|
| **1 · L'identité** | ce document | des années |
| **2 · Le système d'interface** | boutons, champs, tableaux, badges, modales, états vides — **dérivés** de la couche 1 | suit le produit |
| **3 · Les tendances** | Bento UI, glassmorphism, néomorphisme, icônes 3D | 2 à 5 ans |

**Preuve que la couche 2 découle de la couche 1 :** rien dans le bouton n'est un choix de bouton. Sa couleur vient de D-001, sa police de D-006, ses états sont la même couleur déclinée — et leurs contrastes sont mesurés : **4,64** au repos, **6,35** au survol, **6,03** pour la suppression, **3,24** pour un bouton désactivé (assumé : un bouton inactif doit se voir inactif).

**D-011 — le kit** (à venir) : six composants, chacun avec ses états et ses contrastes mesurés.

**D-012 — Bento UI** (clôturée) : sur les accueils uniquement, jamais dans un tableau. Quarante-deux lignes et six colonnes ne se découpent pas en cartes. **D-012 est remplacée par D-014**, qui dit la même chose en plus précis : grille de 12 colonnes, six tuiles maximum dont une seule grande, rayon 12. Il n'y a jamais eu deux règles concurrentes — seulement une règle courte, puis la règle longue qui l'absorbe.

---

## Chapitre 10 — Les contrôles à installer

Douze tests, chacun vérifiant une décision. Sans eux, ce document est une intention.

| # | Test | Vérifie |
|---|---|---|
| 1 | Aucun `#hex` hors de `src/index.css` | D-001 |
| 2 | Toute paire texte/fond ≥ 4,5:1 | D-001 |
| 3 | Une seule bande de motif par page, hauteur conforme au motif | D-003 |
| 4 | Aucun motif étiré : `background-size: auto 100%` ou équivalent | D-003, D-004 bis |
| 5 | Aucun texte sur une bande de motif | D-003 |
| 6 | Aucune police chargée depuis un domaine tiers | D-006 |
| 7 | Aucun statut exprimé par la couleur seule | D-009 |
| 8 | Aucun composant hors des dix-huit formes du kit | D-017 |
| 9 | Aucune ombre floue : `blur` toujours à 0 | D-016 |
| 10 | Rayons limités à {6, 8, 11, 12, 999} | D-016 |
| 11 | Contour 2 px `#2A1708` sur tout objet actif | D-016 |
| 12 | Boutons en capitales, 700 / 9,5 px, espacées de 1,3 | D-016 |

---

## Chapitre 11 — Ce qui reste ouvert

| Sujet | État |
|---|---|
| D-002 — indigo et vert forêt | proposée, une ligne à valider |
| D-011 — le kit d'interface | à venir |
| D-012 — Bento UI | proposée |
| Le logotype | close, à rouvrir sur décision |
| Le poste partagé (deux personnes, un navigateur) | à trancher avec la question des rôles |
| Les 20 illustrations manquantes | programme, séquence définie |
| Le slogan | aucun slogan officiel — et « On gère ! » est déjà imprimé dans deux visuels |

---

## Annexe — Les vingt-trois planches

| Fichier | Ce qu'elle montre |
|---|---|
| `01-palettes.png` | trois directions, cinq contrastes mesurés chacune |
| `02-ecrans.png` | le même écran d'administration, clair et sombre |
| `03-preuve.png` | le billet de pointage, palette A contre palette B |
| `04-decision.png` | six tokens, trois directions, score AA |
| `05-motifs.png` | les motifs en service et leur grammaire |
| `06-motifs-regles.png` | bandeau nu, passe-partout, illustration |
| `07-theme.png` | clair, sombre, automatique — cinq critères |
| `08-kente.png` | le kente étiré ×2,71 et ses trois poses |
| `09-interrupteur.png` | l'interrupteur et sa mémoire |
| `10-bouton.png` | un seul bouton, et ce que son icône raconte |
| `11-police.png` | trois candidates et la mesure des colonnes |
| `12-logotype.png` | l'empreinte existante et ses trois échecs |
| `13-images.png` | l'inventaire réel des visuels |
| `14-illustration.png` | quatre poses du même dessin |
| `15-preuve-document.png` | trois documents, une grammaire |
| `16-verification.png` | la page de vérification et ses garde-fous |
| `17-langues.png` | ce que la police peut écrire |
| `18-bonjour.png` | le bonjour par pays |
| `19-perimetre.png` | identité, système, tendances |
| `20-tendances.png` | Bento, Apple, Awwwards 3D : le même accueil, trois traitements |
| `21-apple-defaut.png` | D-013 chiffrée : 88 % des valeurs hors échelle |
| `22-kit.png` | les six composants, sept états de bouton |
| `23-quatre-peaux.png` | quatre directions pour le kit, mêmes contrastes |

---

## Journal des décisions

> **Statut des décisions.** Ce volume raconte le *pourquoi*. Le **statut opposable** de chaque décision vit dans `DECISIONS-ENTERINEES.md` : une décision **entérinée** ne se rouvre que par un nouveau numéro daté. En cas de divergence, c'est ce registre-là qui fait foi.

| Date | Décision |
|---|---|
| 18/11/2026 | D-001 palette B « sable & argile » retenue |
| 18/11/2026 | D-003 passe-partout retenu |
| 18/11/2026 | D-004 accueil = Bogolan ; kente = bandeau lettrage |
| 18/11/2026 | D-005 clair par défaut, un seul bouton, choix mémorisé |
| 18/11/2026 | D-005 bis l'icône montre l'action |
| 18/11/2026 | D-006 Plex Sans + Plex Mono |
| 18/11/2026 | D-007 logotype inchangé |
| 18/11/2026 | D-008 une illustration par page |
| 18/11/2026 | D-009 preuve : grammaire + vérification complète, liens 3 mois |
| 18/11/2026 | D-010 français partout + bonjour par pays |
| 18/11/2026 | D-013 Apple par défaut, D-014 Bento, D-015 3D — validées (« je valide ta proposition ») |
| 18/11/2026 | v1.1 : D-012 clôturée au profit de D-014 ; planches 20 à 23 ajoutées ; réserves photo et sécurité |

---

*Fin du volume 1. Le volume 2 — le système d'interface — s'écrit à partir de ces décisions, jamais avant elles.*
