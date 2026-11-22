# En-Check — Décisions entérinées

Le registre opposable — v1.1 · 18/11/2026

Ce document ne propose rien. Il constate. Chaque ligne a été décidée par le
fondateur, à une date, avec la phrase qui l'a décidée. Tant qu'une ligne est ici,
personne ne la renégocie — ni un développeur, ni une IA. Source complète : dossier
Google Drive « Identité En-Check » (charte volume 1, kit, protocole).

## Les trois statuts

| Statut | Sens | Qui peut le changer |
|---|---|---|
| **entérinée** | close, s'applique telle quelle, partout | le fondateur seul, par une nouvelle décision numérotée |
| **validée** | décidée, détails ajustables dans le choix | le fondateur |
| **proposée** | en attente, ne s'applique à rien | personne ne l'applique |

Règle de verrouillage : une décision entérinée ne se « réinterprète » pas. Une
contrainte technique impossible sur un écran se remonte — elle ne se contourne pas
silencieusement. Un contournement non déclaré est une faute.

Règle de réouverture : rouvrir coûte un numéro D-0xx nouveau, daté, raison écrite.
On n'efface jamais l'ancienne : on la déclare remplacée.

## Registre

| N° | Décision | Statut | Phrase qui l'a décidée | Date |
|---|---|---|---|---|
| D-001 | Palette B — sable & argile, fond `#F3E9DA`, surface `#FBF4E9`, aplat `#A26537`, texte `#7E4A26`, encre `#2A1708` | entérinée | « palette B retenue » | 18/11/2026 |
| D-002 | Secondaires indigo `#0C1C35` et vert forêt `#21624F`, réservés illustration / états vides | proposée | — | — |
| D-003 | Motifs en passe-partout : hauteur native (76 px, 60 mobile), bordure 1 px, rayon 6, marge 10, jamais étiré, jamais de texte dessus | entérinée | « je choisis le passe-partout » | 18/11/2026 |
| D-004 | Motif par page : Accueil/Paie = Bogolan, Pointages = Adinkra, **Employés = Zoulou**, Absences = Ndebélé, Planning = Kuba… ; kente = bandeau lettrage 28 px sur espresso | entérinée | « pour le dashboard, on garde le bogolan » | 18/11/2026 |
| D-005 | Thème clair par défaut, un seul bouton à deux états, choix mémorisé (`localStorage['encheck.theme']` = `clair` / `sombre`), anti-clignotement | entérinée | — | 18/11/2026 |
| D-005 bis | L'icône du bouton montre l'action : lune en clair, soleil en sombre | entérinée | « je valide la A aussi » | 18/11/2026 |
| D-006 | IBM Plex Sans (interface) + IBM Plex Mono (matricules, heures, montants), auto-hébergées dans `public/fonts/`, chiffres tabulaires, poids 400/600/700 | entérinée | « je valide ton choix » | 18/11/2026 |
| D-007 | Logotype inchangé ; l'écart avec la palette B est assumé | close | « ne touche pas au logo pour l'instant » | 18/11/2026 |
| D-008 | Une illustration par page ; la photo de preuve (avatar, badgeage, pièce) est une donnée, pas une image | entérinée | « je préfère une image illustrée par page » | 18/11/2026 |
| D-009 | La preuve : 3 documents, une grammaire, liens 3 mois ; mise en œuvre sous réserve d'une revue sécurité | validée (principe) | « je veux le complet » | 18/11/2026 |
| D-010 | Français partout ; bonjour par pays | entérinée | « pour l'instant on garde le français » | 18/11/2026 |
| D-011 | Le kit : six objets, et rien d'autre | entérinée | « principe du kit accepté » | 18/11/2026 |
| D-012 | (clôturée — remplacée par D-014) | clôturée | — | 18/11/2026 |
| D-013 | Apple par défaut : espace 4-48, texte 20/700 · 14/400 · 11/400, une action de poids maximal, 200 ms ease-out | entérinée | « je valide ta proposition » | 18/11/2026 |
| D-014 | Bento : grille 12 colonnes, 6 tuiles maximum, rayon 12, accueils uniquement | entérinée | « je valide ta proposition » | 18/11/2026 |
| D-015 | 3D réservée au site public, cinq garde-fous | entérinée | « je valide ta proposition » | 18/11/2026 |
| D-016 | La peau du kit : D — brut adouci. Contour 2 px `#2A1708` sur objet actif, ombre dure décalée 3 px sans flou, rayons {6, 8, 11, 12, 999}, boutons capitales 700 / 9,5 px espacées 1,3 | entérinée | « brut adouci (j'adore présenté comme ça) » | 18/11/2026 |
| D-017 | Trois formes par objet — dix-huit formes en tout, une emploi chacune | entérinée | « garde ces 3 formes. Je les valide et il faut absolument entériner ça » | 18/11/2026 |
| D-018 | Barre latérale : espresso conservé (clair comme sombre), kente sous le logo, item actif ivoire, 5 teintes de statut fixes | entérinée (voir note) | « je valide » (tableau du registre) | 18/11/2026 |
| D-019 | Périmètre : chaque page, chaque modale, dashboard en premier ; ordre dessin → validation → code → remesure | entérinée | « je veux cette nouvelle identité dans chaque page, chaque modale » | 18/11/2026 |
| D-020 | La modale : carte 420 / 560 / 760 px, voile espresso 44 %, deux boutons au plus, fermeture clavier | **entérinée** | « je valide tout » (planche 27 vue) | 18/11/2026 |
| D-021 | Exception d'ordre : la page Employés (et ses onglets) est redevinée avant le dashboard | entérinée | « commence par la page Employés car tu étais déjà dessus » (phrase rapportée par le fondateur) | 18/11/2026 |
| D-022 | Page Employés : la composition d'une référence fournie est reprise à l'identique (barre latérale, en-tête, KPI, graphiques, tableau) ; seuls changent palette, police, rayons et ombres | entérinée | « je valide la version clonée » | 08/11/2026 |

**Note D-018** : le tableau du registre dit « entérinée — je valide », le journal
de la même page dit « proposée ». Le tableau fait foi (règle du document). Si le
fondateur dit le contraire, une D-0xx remplacera cette note.

**Correction du 18/11** — D-020 était restée « proposée » alors que le fondateur
avait validé la planche 27 (« je valide tout »). Elle est entérinée. Et les écarts
d'écrans ne prennent plus de numéro `D-0xx` : ils sont numérotés `DÉR-01`…, parce
qu'une dérogation n'est pas une décision et ne doit pas décaler la série.

## La peau, chiffrée (D-016)

| Paramètre | Valeur |
|---|---|
| Contour des objets actifs | 2 px `#2A1708` |
| Ombre | dure, décalée 3 px, blur = 0 |
| Rayons | 6 (champ/bouton/carte) · 8 (message/tuile) · 11 (badge) · 12 (tuile bento) · 999 (pilule) |
| Boutons | capitales, 700 / 9,5 px, espacés 1,3 px ; hauteur 36 px ; une seule variante pleine par écran |
| Remplissages | argile `#A26537` (action), espresso `#2A1708` (ce qui engage) — deux densités, pas plus |
| Contrastes tenus | blanc cassé sur argile 4,64 · sable sur espresso 11,37 · blanc cassé sur vert 6,04 · espresso sur surface2 12,71 |

## Les dix-huit formes (D-017)

| Objet | Forme 1 | Forme 2 | Forme 3 |
|---|---|---|---|
| Bouton | Pleine — action principale | Contour — action secondaire | Inverse (espresso) — ce qui engage |
| Champ | Cadre — formulaire | Souligné — saisie en ligne | Étiquette fixe — grille de réglages |
| Badge | Pilule — statut courant | Tampon — statut figé | Onglet — statut provisoire |
| Message | Carte — erreur bloquante | Bandeau — succès fugace | Fiche — alerte datée |
| Tableau | Grille — contrôle et paie | Filets — listes longues | Tampon — suivi de statuts |
| Tuile | Chiffre — accueil | Chiffre + repère — période, unité | Bandeau — tuile de section |

Interdits, sans exception : un composant hors des 18 formes ; un tampon sur un
statut qui peut changer (ou l'inverse) ; une tuile sans période quand le chiffre en
dépend ; un troisième niveau d'action sur une même ligne de tableau ; une forme
utilisée « parce qu'elle est plus jolie ici ».

## Les douze contrôles automatiques

| # | Contrôle | Décision |
|---|---|---|
| C1 | Aucun #hex en dur hors `src/index.css`, `src/styles/charte.css`, `src/styles/tokens.css` | D-001 |
| C2 | Toute paire texte/fond ≥ 4,5:1 (paires de référence) | D-001 |
| C3 | Une seule bande de motif par page, à la hauteur native (manuel) | D-003 |
| C4 | Aucun motif étiré (manuel) | D-003 |
| C5 | Aucun texte posé sur une bande (manuel) | D-004 |
| C6 | Aucune police tierce | D-006 |
| C7 | Aucun statut exprimé par la couleur seule (manuel) | D-009 |
| C8 | Aucun composant hors des dix-huit formes | D-017 |
| C9 | Aucune ombre floue : blur toujours à 0 | D-016 |
| C10 | Rayons limités à {6, 8, 11, 12, 999} | D-016 |
| C11 | Contour 2 px espresso sur tout objet actif | D-016 |
| C12 | Boutons en capitales 700 / 9,5 px | D-016 |

Mesure par `npm run charte` (`--json` pour la CI, `--strict` pour un code de
sortie 1). La CI l'exécute en rapport non bloquant jusqu'à la page qui rend le
dépôt conforme — « une porte rouge le premier jour reste rouge pour toujours ».

## Journal

| Date | Événement |
|---|---|
| 18/11/2026 | D-001 à D-017 consignées. D-002 et D-020 ouvertes. |
| 18/11/2026 | D-017 entérinée — les 18 formes opposables, 5 contrôles CI ajoutés. |
| 18/11/2026 | D-019 entérinée — périmètre et ordre. |
| 18/11/2026 | D-021 entérinée — exception : Employés avant le dashboard. Note de divergence D-018 consignée. |
| 08/11/2026 | D-022 entérinée — la composition d'une référence fournie prime sur l'interprétation de l'agent ; seules la palette, la police, les rayons et les ombres changent. Maquette v1 (dépouillée) et v2 (réinterprétée) rejetées. |
| 22/11/2026 | La PAGE de détail d’une tâche DEVIENT FENÊTRE et sort du dépôt : « dans l’onglet „taches“ quand on clique sur la tâche, on arrive sur une page. Désormais je veux que ça puisse ouvrir un modal (supprime cette page) », a tranché le fondateur. `src/pages/TaskDetail.jsx` est supprimé — 1 655 lignes, dont un objet `S` de 699 lignes de CSS écrites en JS, 40 `style={…}`, 83 valeurs de couleur en dur, un `backdropFilter: blur(6px)` et deux ombres floues. Tout ce qu’elle savait dire entre dans `FicheTacheModal`, cinquième fenêtre de `TachesModales.jsx`, sous la même `tam-voile` et la même feuille à 760 px que ses quatre sœurs : les huit mesures (échéance, durée prédite et réelle, performance, quatre horodatages) en `<dl>`, le motif de rejet, les pièces jointes, les cinq exigences lues, les commentaires en deux groupes avec leur champ d’ajout, l’historique replié sur son titre, et les trois gestes d’administrateur. Ce que la maison impose et que la page ignorait : la peau va dans `TachesModales.css`, aucune couleur en dur, aucun flou, largeur au registre ; et la teinte de la catégorie ne lave PAS un mot — les quatre marques du haut sont d’encre ou de doux et ne portent que leur trait de feutre de 2 px, les tons de priorité reprennent les QUATRE TOKENS DE LA CARTE du tableau, dans le même ordre. L’adresse survit au cadavre : `/taches/:taskId` n’est plus qu’un `RedirectionTache` vers `/employes?vue=taches&tache=<id>`, l’onglet lit ce paramètre, la commande rapide de l’assistant et la recherche globale pointent sur la vue la fenêtre ouverte, et le « retour » du navigateur referme la fenêtre au lieu de jeter hors de la page. Les gestes d’écriture restent chez le parent (`onValider` / `onRejeter` / `onReassigner` / `onCommenter`), qui recharge la liste ET la fiche : après une validation la carte change de colonne SOUS la fenêtre ouverte, au lieu de renvoyer l’administrateur au tableau comme le faisait la page. Trois piges corrigées sur le fait : les deux fenêtres de geste se DÉMONTENT au lieu d’être vidées par un `setState` dans un `useEffect` (la faute que l’île connaissait déjà, et qui reste ouverte chez ses sœurs) ; la fiche naît `key=<identifiant>`, donc neuve à chaque tâche ; et `fermerFiche` a dû remonter au-dessus de l’effet des raccourcis — sa référence était lue trop tôt, dix-huit tests en échec sur un `ReferenceError`. `npm run charte` : **C1 4 665 → 4 582** (la page en emportait 83, ma propre note de commentaire en ajoutait un, retiré), C9 131 · C10 362 immobiles. 118 tests ✓ dont 16 ajoutés (la fenêtre s’ouvre sur la carte cliquée, les huit mesures se lisent, le motif du rejet est EXIGÉ avant l’appel, Échap referme et rend l’adresse, `existsSync` de la page est faux, la fenêtre ne parle à aucun service d’écriture) ; build ✓ 32 s 97 ; lint 12 problems sur les cinq fichiers touchés, contre 16 à HEAD. Reste à l’œil du fondateur, une fois de plus : la hauteur sous la `max-height` de la feuille et le pliage de l’historique, que jsdom ne peut pas juger. |
| 22/11/2026 | Cartes d’équipe et de tâche LAVÉES à leur couleur, palette en FEUTRES, et les fenêtres de l’onglet Tâches sortent aussi des styles en ligne : « colore sa card en cette couleur là […] colore les cards en fonction de la couleur de la catégorie […] et je veux des couleurs feutres ». La palette des deux sélecteurs (équipes et catégories) passe des dix teintes terreuses de l’île zoulou à **dix encres de marqueur** — rouge, orange, jaune, vert, turquoise, bleu, violet, rose, sépia, bleu nuit — et chaque pastille de choix reçoit un NOM (`FEUTRE_NOMS`) pour qu’un lecteur d’écran n’annonce pas un code hexadecimal. La couleur n’est jamais un mot : mesurées sous l’encre de la maison, les dix teintes pures descendent jusqu’à **2,13:1** — elles lavent, elles soulignent, elles tracent, elles n’écrivent pas. Mécanique commune aux deux onglets : la teinte, donnée de la base, ENTRE dans la carte en variable de peau (`--eqv-teinte`, `--tqv-teinte`) et `EquipesVue.css` / `TachesVue.css` en font un **lavis à 12 %** du papier (repli : le filet de sable pour les équipes et tâches sans couleur) — le trait d’encre de 2 px du contour reste l’encre de la charte, l’objet est actif (C11). Équipes : le filet de 4 px devient un **trait de feutre de 6 px** surmonté d’une **saignée de 3 px** à 24 % de la même encre (l’ombre du marqueur sur le papier léger, à zéro de flou), et le nom porte un soulignement de feutre à 45 %, 85 % au survol. Tâches : la carte n’a aucune marge libre — rabat, drapeau de priorité, deux icônes au pied — donc le trait de 5 px est posé LÀ OÙ LA MAISON MET SON FILET D’ENCRE, au pied de la bande de colle, la `background-image` étant redéclarée en entier sur la carte seule (la colonne garde le filet d’encre de `--tqv-colle-degrade`) ; et le MOT de la catégorie est entré dans `.tqv2-fiche-meta`, sans quoi une carte colorée serait une couleur seule (C7). Fenêtres des Tâches : mêmes classes jumelles (`tam-`, `TachesModales.css`), objet `styles` de **133 clefs supprimé** (39 trouvaient preneur, 94 décrivaient une ancienne page entière), flou `blur(6px)` et ombre `0 24px 80px` effacés, voile noir à 80 % remplacé par l’espresso à 44 %, `borderRadius: 18` rendu aux jetons, largeurs 340 / 420 / 520 / 800 ramenées à 420 / 420 / 560 / 760 — la fenêtre de tâche perd 40 px, c’est le registre qui parle. Deux rectifications publiées : **la mienne d’hier était fausse** — `--empv2-or` n’est pas mis à `transparent` par la peau post-it, il vaut c9a961 sur `.empv2-main` et reste vivant sous l’onglet ; la couronne des fenêtres garde le dos de la feuille pour une autre raison, qui tient (deux marques sur un seul mot). Et le compteur de référence n’est plus 4 664 mais **4 667** : la #287 d’une autre session a posé trois couleurs en dur sur les pointeuses, je ne l’ai pas touchée ; mon travail en retire deux (`c9a961` de repli en Équipes, `6366F1` d’une icône en Tâches) et le laisse à **4 665**, avec C9 131 · C10 362 immobiles. . Et une trouvaille de dernière minute, à force de relire le paquet : `.eqv2-carte-trait` est un **span vide dans un `article` qui n’est ni flex ni grille** — donc en ligne, et un inline ne prend ni hauteur ni largeur. Le filet de couleur d’équipe, `height: 3px` à la base et son fond en attribution, **ne s’est jamais peint** : la carte d’équipe attendait qu’on la regarde depuis le début. `display: block` posé dans la peau (la base reste intacte) le rend à son office. Un test réécrit, pas adouci : `pose chaque équipe en carte à trait coloré` affirmait un `style` en ligne sur `.eqv2-carte-trait` ; il affirme maintenant que la teinte entre par `--eqv-teinte` sur l’article ET que le trait n’a plus d’attribution en ligne. 2 049 tests ✓ (cinq suites en échec de collecte pour le `.env` Supabase absent du bac à sable, comme la veille), build ✓ 24 s 68, lint 10 problems sur les fichiers touchés = 10 à HEAD. Relevé d’humilité : j’ai daté ce chantier du 23/11 avant de relire l’horloge (nous sommes le 22 au soir), et mon remplacement global de la date a touché trois fichiers de l’île Parcours qui n’avaient rien demandé — restaurés en un `git checkout`. La leçon est écrite : une date se corrige fichier par fichier, jamais par `sed` sur `src/`. |
| 22/11/2026 | Les cinq fenêtres de l’onglet « Équipes » reçoivent la même peau et sortent des styles en ligne : « retravailles tous les modales de cet onglet Equipes », a demandé le fondateur. Elles n’étaient pas mal habillées, elles étaient hors de tout habillement — un objet `S` de 63 clefs de CSS écrites dans le JS, posées en `style={…}`, et une attribution en ligne bat n’importe quel sélecteur de feuille. Trois entorses y vivaient, impossible à rattraper d’un CSS : `backdropFilter: blur(5px)` sur le voile et une ombre de `0 20px 70px` sous la feuille (la maison ne connaît aucun flou, D-016) ; un voile `rgba(0,0,0,.8)`, noir pur à 80 %, qui efface la page au lieu de l’assourdir ; et des largeurs de 300, 380, 440, 460, 480 px, hors du registre des modales (420 / 560 / 760, D-020). Les voilà 560 pour les trois fenêtres de travail et 420 pour les deux de confirmation, en feuille de fiche employé : coin carré, contour d’encre de 2 px, bande de colle de 14 px, rabat au coin bas-droit, double feutre de deux ombres dures (`EquipesModales.css`, 674 lignes, la peau portée par `eqm-voile` ; le fichier réduit à 319 lignes de markup). Dix-trois clefs sur 63 trouvaient preneur ; les cinquante autres ne servaient à rien — elles décrivaient l’ancienne page retirée quand la vue est devenue `.eqv2` — et sont parties avec l’objet. Deux piges relevées sur le vif : `--empv2-or` est mis à `transparent` par la peau de l’onglet, la couronne du chef y serait restée invisible — elle prend le dos de la feuille ; et le voile, `position: fixed`, n’est piégé par aucun ancêtre (aucun `transform`/`filter`/`container-type` sur la portée `.eqv2--postit`). Deux ajouts hors peau mais dans la maison : `role="dialog"`, `aria-modal`, `aria-label` sur chaque fenêtre, et un mot — « Lecture de l’historique… » — là où un spinner seul parlait (C7). `npm run charte` rendu à C1 4 664 · C9 131 · C10 362, au mot près la veille ; build ✓ 19 s 34 ; 2 027 tests ✓, et le seul test qui rend ces fenêtres (`Nom *`) passe, après contrôle que nul libellé visible n’a disparu. Relevé d’humilité : mon contrôle de paquet a d’abord déclaré les règles absentes parce que le `glob` prenait le CSS `vendor` au lieu du `index` ; et un build qui passe ne dit toujours rien du rendu — la hauteur utile des feuilles reste à l’œil. Les fenêtres de l’onglet Tâches (`TachesModales.jsx`) sont la même île en styles en ligne : même traitement à proposer. |
| 22/11/2026 | Onglet « Équipes » rhabillé de la peau exacte de celui des Tâches : tête cerclée d’une seule bande de bogolan (titre en `h1`, incliné, double trait de feutre), quatre chiffres enfin en grille, cartes et panneaux en feuilles agrafées, et l’action « Nouvelle équipe » redescendue en espresso dans la barre d’outils — elle vivait dans l’en-tête de page, qui ne se monte plus sur aucun des deux onglets (l’annuaire, lui, n’a pas bougé d’un octet ; les deux branches `vueActive === ’equipes’`/`’taches’` de cet en-tête sont devenues inatteignables et restent là). Trois absences comblées ici aussi : `.eqv2-kpis` n’avait AUCUNE règle — la base visait `.eqv2 .empv2-kpis`, un sélecteur mort —, et `.empv2-recherche` comme `.empv2-nouvel` n’étaient stylés que sous la portée de l’onglet Tâches. |
| 21/11/2026 | Onglet « Tâches » : l’en-tête de page de l’annuaire ne se monte plus sur cet onglet, la tête cerclée de bogolan prend sa place en haut de page (mêmes 20/22 px de respiration, titre en `h1`) et garde 40 px d’air avant la barre d’outils. L’annuaire et l’onglet Équipes gardent l’en-tête d’un octet identique. Bug saisi au passage : `.tqv2--postit { gap }` avait la même spécificité que `.tqv2 { gap: 14px }` et arrivait avant lui dans le bundle — la base gagnait, l’espace de la peau ne s’affichait pas. |
| 21/11/2026 | Onglet « Tâches » de la page Employés redeviné en post-it sur la maquette choisie (quatre colonnes-agrafes, cartes à rabat, drapeau de priorité dans le trait, action principale en espresso) ; au passage, trois absences de CSS comblées : la rangée de chiffres sans `display`, « + Nouvelle tâche » et le champ de recherche sans aucune règle. L or reste un marqueur de sélection, jamais une action. |
| 21/11/2026 | Modale « fiche employé » redevinée en post-it sur la maquette que le fondateur a choisie (double feutre, bande de colle, rabat, bandeau de motif retiré) ; DÉR-05 ouverte pour sa largeur de 940 px, DÉR-02 réduite à la page. Les règles de la feuille sont écrites dans le dossier Drive identité. |
| 18/11/2026 | Fondations installées dans le dépôt : `identite/`, `src/styles/tokens.css`, `src/styles/charte.css`, polices IBM Plex, `scripts/charte-check.mjs` + `npm run charte`, thème D-005, barre D-018. |
