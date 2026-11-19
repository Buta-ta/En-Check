# Fiche de page — Employés

> Contrat de la PR B (D-021 : Employés avant le dashboard). Rien n'est codé
> tant que cette fiche n'est pas lue. Référence de squelette : planche 25
> (page de paie en peau D) — « les dix-huit formes entérinées (D-017). Aucun
> composant n'a été inventé ».

## 1. Identité de la page

| Champ | Valeur | Décision |
|---|---|---|
| Route | `/employes` (liste) · `/employes/:id` (fiche) | |
| Nom affiché | Employés | |
| Motif (bande) | **zoulou** (`employes-zoulou.webp`) | D-004 |
| Position du motif | bandeau **76 px** en haut, bordure 1 px, marge 10, jamais étiré, jamais de texte dessus | D-003 |
| Thèmes | clair par défaut + sombre (1 bouton, lune/soleil) | D-005 |

## 2. La structure (du haut en bas — squelette planche 25)

| # | Bloc | Contenu | Règle |
|---|---|---|---|
| 1 | Bandeau motif | `PageCulturalBand` motif = `zoulou` | D-003 : 76 px, pas de texte dessus (C3/C5) |
| 2 | Titre + sous-titre | « Employés » h1 20 px/700 · « N employés · M équipes » 14 px | D-013 |
| 3 | Actions | **une seule** action de poids maximal : « NOUVEL EMPLOYÉ » (bouton **pleine**). Secondaire : contour — jamais deux pleines | D-013 |
| 4 | Tuiles | 3 tuiles « chiffre + repère » (période obligatoire) : Présents · Retards · Absents | D-017 : tuile chiffre + repère ; chiffre mono, le repère porte la période |
| 5 | Message | Fiche (alerte datée) si un retard dépasse le seuil ; bandeau (succès) après une action | le mot est obligatoire — « retard » s'écrit, pas un point rouge seul (C7) |
| 6 | Filtres | Requête (champ **cadre** h40 r6) + statut (badge **pilule** cliquable) | 1 action par écran |
| 7 | **Annuaire** | tableau **filets** : lignes 34 px, pas de zébrures, **25 lignes/page**, 1 action par ligne (ouvrir la fiche) | Kit v1.3 |
| 8 | Onglets secondaires | Équipes (cartes + pilules) · Tâches (kanban + tampons) — sous la même bande, mêmes 18 formes | D-017 |

Le mot « retard » est **toujours écrit** (badge pilule « Retard · 12 min »),
jamais un point de couleur seul (C7, veto).

## 3. Les formes autorisées (sur les 18)

| Objet | Forme retenue | Où / pourquoi |
|---|---|---|
| Bouton | Pleine (1×) « NOUVEL EMPLOYÉ » — aucune secondaire sur la vue principale ; état vide : contour « Tout montrer » | 1 action de poids maximal (D-013) |
| Champ | Cadre | la recherche |
| Badge | Pilule — statut courant (Présent / Retard / Absent · le mot + la durée) | statut changeable |
| Badge | Tampon — statut figé (Sorti, Férié) | seul le tampon porte un statut figé (D-017) |
| Message | Fiche — alerte datée (retard > seuil) · Bandeau — succès fugace | |
| Tableau | **Filets** — l'annuaire, 25 lignes/page | liste longue |
| Tuile | Chiffre + repère (jour) | les 3 compteurs du haut |

**Interdit sur cette page** :
- [x] une tuile bento hors accueil (D-014) — la fiche employée bento reste en D-023
- [x] un badge onglet (statut provisoire) — les statuts ici sont courants ou figés
- [x] une couleur seule pour dire « retard » (C7) — le mot est obligatoire
- [x] un troisième bouton d'action sur une ligne de tableau (D-017)
- [x] une modale de plus de 8 champs (D-020) — la création reste la modale existante (dérogation modales, D-019 : dernières à redeviner)

## 4. Les mesures (valeurs exactes)

| Élément | Valeur | Échelle |
|---|---|---|
| Titre h1 | 20 px / 700 | D-013 |
| Corps | 14 px / 400 | D-013 |
| Micro (légendes, badges, compteur de pagination) | 11 px / 400 | D-013 |
| Espacements | 4 / 8 / 12 / 16 / 24 / 32 / 48 | D-013 |
| Rayons | 6 (champ, bouton, carte) · 8 (message, carte) · 11 (tampon) · 12 (tuile) · 999 (pilule) | D-016 |
| Bouton | h36 · capitales 700 / 9,5 px · espacés 1,3 · aplat `var(--charte-aplat)` | D-016 |
| Champ | h40 · rayon 6 · focus 2 px encre · le mot d'erreur dessous | Kit v1.3 |
| Badge | h20 · rayon 999 · le mot = la donnée | Kit v1.3 |
| Tableau | lignes 34 px · filets 1 px · pas de zébrures · 1 action/ligne · **25 lignes/page** | Kit v1.3 |
| Tuile | rayon 12 · padding 24 · valeur mono 20 px/700 | D-014/D-017 |
| Carte | rayon 8 · padding 16 | Kit v1.3 |
| Bandeau motif | 76 px · bordure 1 px · marge 10 | D-003 |

Matricules, heures, minutes : **IBM Plex Mono**, chiffres tabulaires (D-006).

## 5. Les états

| État | Ce qui s'affiche | Règle |
|---|---|---|
| Chargement | squelette filets, sans chiffre inventé | |
| Vide | « Aucun employé » + 1 action « NOUVEL EMPLOYÉ » | D-008 : illustration + phrase + action |
| Erreur | message carte : « une erreur est survenue » + 1 action « RÉESSAYER » | jamais une barre seule |
| Données | tableau 25 lignes + pagination « 1–25 sur N » 11 px | |

## 6. Captures (obligatoires avant merge)

| Fichier | Vue |
|---|---|
| `docs/captures/employes-clair.png` | 1440 px, thème clair, annuaire |
| `docs/captures/employes-sombre.png` | 1440 px, thème sombre, annuaire |

## 7. Notation

| Porte | Résultat |
|---|---|
| C1–C12 (`npm run charte`) | __ / 12 |
| V1–V5 (captures, 0 ou 8, doute = 0) | __ × 8 |
| Total | __ / 100 — seuil de fusion : **85** |

## 8. Dérogations

| D-0xx | Objet | Raison | Date |
|---|---|---|---|
| D-023 | la fiche employée (modale bento #228) reste en ancien style | les modales sont redevinées en dernier (D-019) | 18/11/2026 |
| D-019 | la modale de création d'employée garde son habillage actuel | idem — modales en dernier | 18/11/2026 |

## 9. Déclaration

- [ ] Fiche lue et remplie avant code
- [ ] `npm run charte` exécuté — résultat collé ici
- [ ] 2 captures 1440 px (clair + sombre)
- [ ] Aucune décision contournée silencieusement
- [ ] Signé : agent En-Check — Date : 19/11/2026

## 10. Leçon de la régression du 18/11 (fix en prod, `aece9b0` → prod)

La page est partie en prod cassée : bande Zoulou tronquée, sidebar invisible,
moitié droite sombre, message écrasé sur 50 px. Trois causes, toutes
structurelles — aucune n'avait passé les gates :

| # | Cause | Correction |
|---|---|---|
| 1 | **Collision de nom de classe** : la coque de page portait `empv2-page`, classe déjà utilisée par les boutons de pagination (`display: inline-flex; height: 28px`). La coque entier est devenue une boîte inline resserrée : la bande (`width: 100%`, `flex-shrink: 0`) l'a occupée en entier, la grille a déborder à droite sur le fond du `body`. | La coque s'appelle **`empv2-coque`**, les boutons de pagination **`empv2-pagbtn`**. Règle : **une classe = un élément** ; les classes de page (`empv2-coque`, `empv2-layout`, `empv2-main`, `empv2-sidebar`) ne servent qu'à la page. |
| 2 | **Variables de la barre manquantes** : cette page n'est pas dans `.encheck-dashboard`, qui est le seul endroit qui définit `--sidebar-*`. Sans elles, `.nav-panel` est transparente et son texte (encre foncée) est illisible sur le fond sombre. | `--sidebar-*` sont posées sur `.empv2-coque` (mêmes liaisons que le dashboard, tokens `--charte-barre*`, D-018). |
| 3 | **Échappements littéraux** : `aujourd\u2019hui` affiché tel quel dans les tuiles (le JSX contient le texte brut, pas une chaîne JS échappée). | L'apostrophe réelle (`aujourd'hui`), jamais `\u2019` en dur. |

Le canvas de la coque est `var(--charte-sable)` avec `!important` : il bat le
canvas `pt-canvas` du shell `.pointages-afrotech-shell` (importé via
l'écran de chargement), qui n'existe qu'en clair et n'a pas de
`data-theme` posé sur cette coque.

Preuves : `docs/regression-employes.png` (prod cassée, capture utilisateur),
`docs/verify-base.png` (le même bug reproduit en harnais),
`docs/verify-fixed.png` (corrigé, 1456 px, thème sombre).

