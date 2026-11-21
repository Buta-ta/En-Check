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
| 21/11/2026 | Onglet « Tâches » : l’en-tête de page de l’annuaire ne se monte plus sur cet onglet, la tête cerclée de bogolan prend sa place en haut de page (mêmes 20/22 px de respiration, titre en `h1`) et garde 40 px d’air avant la barre d’outils. L’annuaire et l’onglet Équipes gardent l’en-tête d’un octet identique. Bug saisi au passage : `.tqv2--postit { gap }` avait la même spécificité que `.tqv2 { gap: 14px }` et arrivait avant lui dans le bundle — la base gagnait, l’espace de la peau ne s’affichait pas. |
| 21/11/2026 | Onglet « Tâches » de la page Employés redeviné en post-it sur la maquette choisie (quatre colonnes-agrafes, cartes à rabat, drapeau de priorité dans le trait, action principale en espresso) ; au passage, trois absences de CSS comblées : la rangée de chiffres sans `display`, « + Nouvelle tâche » et le champ de recherche sans aucune règle. L or reste un marqueur de sélection, jamais une action. |
| 21/11/2026 | Modale « fiche employé » redevinée en post-it sur la maquette que le fondateur a choisie (double feutre, bande de colle, rabat, bandeau de motif retiré) ; DÉR-05 ouverte pour sa largeur de 940 px, DÉR-02 réduite à la page. Les règles de la feuille sont écrites dans le dossier Drive identité. |
| 18/11/2026 | Fondations installées dans le dépôt : `identite/`, `src/styles/tokens.css`, `src/styles/charte.css`, polices IBM Plex, `scripts/charte-check.mjs` + `npm run charte`, thème D-005, barre D-018. |
