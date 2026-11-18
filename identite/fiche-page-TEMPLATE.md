# Fiche de page — <Nom de la page>

> Une page = une branche = une fiche. Cette fiche est le contrat : elle dit ce
> qui est autorisé, ce qui est interdit, et comment la page a été notée. Rien
> n'est codé tant que la fiche n'est pas lue.
>
> Mode d'emploi : remplis chaque section, puis copie les valeurs exactes dans le
> code. Ne résume pas. « Comme l'autre page » est interdit — écris la valeur.

## 1. Identité de la page

| Champ | Valeur | Décision |
|---|---|---|
| Route | `/___` | |
| Nom affiché | | |
| Motif (bande) | kente / zoulou / bogolan / adinkra / ndebele / kuba / … | D-004 |
| Position du motif | bandeau 76 px en haut (+ 32 px en bas si longue) | D-003 |
| Thèmes | clair par défaut + sombre (1 bouton) | D-005 |

## 2. La structure (avant d'habiller)

Décris la page en blocs, du haut en bas. Un bloc = une intention.

| # | Bloc | Contenu | Règle |
|---|---|---|---|
| 1 | Bandeau motif | `PageCulturalBand` motif = `___` | D-003 : 76 px, pas de texte dessus |
| 2 | Titre + sous-titre | h1 20 px/700 + 14 px | D-013 |
| 3 | Actions | **une seule** action de poids maximal | D-013 |
| 4 | … | | |

## 3. Les formes autorisées (sur les 18)

Cite la forme exacte et son usage. Tout ce qui n'est pas listé est interdit ici.

| Objet | Forme retenue | Où / pourquoi |
|---|---|---|
| Bouton | Pleine (1×) + Contour | « ___ » = principale, « ___ » = secondaire |
| Champ | Cadre | formulaire de création |
| Badge | Pilule (statut courant) + Tampon (statut figé) | statut présent, statut verrouillé |
| Message | Bandeau (succès) + Carte (erreur bloquante) | |
| Tableau | Filets + pagination 25 lignes | liste longue |
| Tuile | Chiffre + repère (période) | KPI |

**Interdit sur cette page** (cocher les lignes applicables) :
- [ ] une tuile bento hors accueil (D-014)
- [ ] un badge onglet si le statut est figé (D-017)
- [ ] une couleur seule pour exprimer un retard / un statut (D-009) — le mot est obligatoire
- [ ] une modale de plus de 8 champs (D-020 : 420/560/760, 2 boutons max)
- [ ] un troisième bouton d'action sur une ligne de tableau (D-017)

## 4. Les mesures (valeurs exactes)

| Élément | Valeur | Échelle |
|---|---|---|
| Titre h1 | 20 px / 700 | D-013 |
| Corps | 14 px / 400 | D-013 |
| Micro | 11 px / 400 | D-013 |
| Espacements | 4 / 8 / 12 / 16 / 24 / 32 / 48 | D-013 |
| Rayons | 6 / 8 / 11 / 12 / 999 | D-016 |
| Bouton | h36 · capitales 700/9,5 px · espacés 1,3 | D-016 |
| Champ | h40 · rayon 6 · focus 2 px | Kit v1.3 |
| Badge | h20 · rayon 999 (pilule) | Kit v1.3 |
| Tableau | lignes 34 px · pas de zébrures · 1 action/ligne · 25 lignes/page | Kit v1.3 |
| Tuile | rayon 12 · padding 24 (bento : grille 12, 6 max) | D-014 |
| Carte | rayon 8 · padding 16 | Kit v1.3 |

## 5. Les états (chacun nommé, chacun codé)

| État | Ce qui s'affiche | Règle |
|---|---|---|
| Chargement | squelette, sans texte inventé | |
| Vide | illustration + phrase + 1 action | D-008 |
| Erreur | message carte : « une erreur est survenue » + 1 action | le message ne se contente pas d'une barre |
| Données | tableau 25 lignes, pagination | |

## 6. Captures (obligatoires avant merge)

| Fichier | Vue | |
|---|---|---|
| `docs/captures/<page>-clair.png` | 1440 px, thème clair | |
| `docs/captures/<page>-sombre.png` | 1440 px, thème sombre | |

## 7. Notation

| Porte | Résultat |
|---|---|
| C1–C12 (`npm run charte`) | __ / 12 automatiques PASS |
| V1–V5 (captures) | __ × 8 |
| Total | __ / 100 — seuil : **85** pour fusionner |

Légende : 100 = fusion immédiate · 85–99 = fusion, écarts notés ici ·
60–84 = retour, critères nommés · < 60 = code jeté, temps 2 repris.

## 8. Dérogations

| D-0xx | Objet | Raison | Date | |
|---|---|---|---|---|
| | | | | |

*(aucune dérogation ici = ligne « aucune »)*

## 9. Déclaration

- [ ] Fiche lue et remplie avant code
- [ ] `npm run charte` exécuté — résultat collé ci-dessus
- [ ] 2 captures 1440 px (clair + sombre)
- [ ] Aucune décision contournée silencieusement
- [ ] Signé : __________ — Date : __________
