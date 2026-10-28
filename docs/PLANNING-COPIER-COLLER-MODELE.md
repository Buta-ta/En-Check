# Planning — copier un modèle, le coller dans une case

> Demande : « dans la page planning, je veux la possibilité de copier un modèle
> (cliquer copier ou utiliser Ctrl+C / Cmd+C) et venir le coller dans une case du
> calendrier (soit clic coller ou Ctrl+V / Cmd+V) ».

Le geste existait déjà à moitié : on pouvait **glisser** un modèle du dock vers une
case. On ajoute le geste du bureau — **copier / coller** — sans changer ce que fait
le glisser.

---

## 1. Les deux chemins, pour chaque étape

| Étape | Souris | Clavier |
| --- | --- | --- |
| Copier | bouton **Copier** sur le modèle (dock) | `Ctrl+C` / `⌘+C` sur le modèle survolé ou au focus |
| Coller | bouton **Coller** dans la case | `Ctrl+V` / `⌘+V` sur la case survolée |
| Coller sans survol | bouton **Coller dans la case** de la barre de rappel | — |
| Abandonner | bouton **×** de la barre de rappel | `Échap` |

La case visée est **la dernière case survolée** — Semaine (`sk-td-cell`), Jour
(`sk-day-row`) ou Mois (`sk-cal-cell`). Elle s'entoure d'un liseré pointillé dès
que le pointeur passe dessus, pour que l'on sache exactement où le modèle tombera.

---

## 2. Ce que fait le collage

Rien de neuf : le collage **réutilise les fonctions de dépôt du glisser-déposer**.

- `handleDropOnCell(e, emp, jour, payload)` — grille Semaine et vue Jour ;
- `handleDropOnCalendarDay(e, date, payload)` — calendrier Mois.

Ces deux fonctions ont reçu un quatrième/troisième paramètre `payloadExplicite`.
Il existe pour une raison précise : le glisser lit `draggedPayload` dans l'état du
composant, alors que `setState` n'est pas encore appliqué au moment où l'on appelle
la fonction à la main (c'était déjà le cas pour le glisser tactile). Le collage
passe donc le paquet directement, sous la même forme que le dock :

```js
{ sourceType: "dock", template: { id, name, label, kind, color,
  start_time, end_time, has_break, break_start, break_end,
  variant, schedule_id } }
```

Conséquence : un modèle collé se comporte **exactement** comme un modèle glissé —
même carte, même pause, même persistance (`persistEmployeeShiftToSupabase`), mêmes
messages. Aucun second chemin d'écriture n'a été ouvert.

---

## 3. Ne jamais manger le presse-papiers du navigateur

Le raccourci n'est pris que s'il nous appartient. Trois garde-fous, dans
`src/lib/planningCopie.js` :

1. **Champ de saisie** — `input`, `textarea`, `select`, `contentEditable` :
   on laisse faire le navigateur (`estChampDeSaisie`).
2. **Texte sélectionné** — si `window.getSelection()` contient autre chose que des
   espaces, `Ctrl+C` reste le copier natif (`raccourciPressePapiers`).
3. **Aucun modèle actif** — sans modèle survolé, `Ctrl+C` n'est pas intercepté.

`Échap` range le modèle copié (et avec lui la barre de rappel) sans toucher au
reste de la page.

---

## 4. Repères visuels

- `.sk-brick-copy` — bouton **toujours visible** sur chaque modèle (une action ne
  se devine pas au survol) ; devient `.is-copie` en vert quand ce modèle est dans
  le presse-papiers.
- `.sk-brick.is-copie` — un liseré ambre rappelle d'où vient la copie.
- `.sk-copie-bar` — barre collante sous le dock : nom du modèle, horaires,
  rappel du geste, bouton **Coller dans la case**, bouton **×**. Elle est en
  `role="status"` / `aria-live="polite"` : le changement est annoncé.
- `.sk-case-coller` — bouton **Coller** dans la case visée : en haut à droite de
  la case Semaine (il n'apparaît qu'au survol ou au focus, pour ne jamais
  recouvrir la carte d'horaire au repos), au centre-droit de la piste Prévu en
  Jour, sous le résumé en Mois.
- `.sk-*-is-collable` — quand un modèle est copié, les cases s'annoncent d'un
  filet intérieur ambre : elles sont prêtes à recevoir.
- `.is-cible-collage` — la case survolée : **un cadre pointillé, rien d'autre**.
  Le survol ne déplace aucun texte, ne change ni fond ni couleur de texte.

Sur mobile (`≤ 640 px`) le bouton de collage du Mois disparaît au profit de la
barre de rappel, pour ne pas écraser la grille.

---

## 5. Fichiers

| Fichier | Rôle |
| --- | --- |
| `src/lib/planningCopie.js` | décisions pures : champ de saisie, raccourci, libellés, paquet |
| `src/pages/Planning.jsx` | état `modeleCopie` / `caseCible`, bouton Copier, collage, raccourcis, barre de rappel |
| `src/pages/PlanningAfroTech.css` | `.sk-brick-copy`, `.sk-copie-bar`, `.sk-case-coller`, états de case |
| `src/services/__tests__/copierCollerModele.test.js` | 33 tests (module pur + lecture de source) |

---

## 6. Ce que les tests garantissent

Les 20 premiers tests exercent le module pur : `Ctrl`/`⌘`, la sélection de texte,
les champs de saisie, les libellés de chaque type de modèle, la forme du paquet.

Les 13 suivants lisent les sources et vérifient que le câblage ne se perdra pas :

- un bouton de copie par modèle et un seul écouteur `keydown` sur `window` ;
- trois cases collables (Semaine, Jour, Mois), au clic comme au clavier ;
- le collage passe par `payloadExplicite` et par les dépôts existants ;
- la barre de rappel est annoncée (`role="status"`, `aria-live`) et propose
  Coller / Annuler ;
- le survol d'une case cible ne déclare **ni** `color:` **ni** `background:`
  **ni** `opacity` — seulement un cadre.

---

## 7. Vérifications

```
npx vitest run            → 136 fichiers, 1782 tests ✓
npx vite build            → ✓
npx eslint src --config eslint.gate.config.js → 0 erreur
npx eslint src/pages/Planning.jsx → 9 erreurs / 7 avertissements,
                                    identiques à ceux d'avant la modification
```
