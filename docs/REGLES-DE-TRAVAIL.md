# Les règles de notre travail — note à l'intention d'une nouvelle recrue IA

> Ce document ne décrit pas le produit : il décrit **la façon de travailler**.
> Chaque règle vient d'une consigne explicite du chef de projet, datée.
> Ce qui n'est pas daté ici est une **méthode éprouvée dans ce dépôt**, pas une
> consigne — la distinction est maintenue partout où elle compte.

---

## 0. En une phrase

On refait les pages **une par une**, chacune avec **sa propre identité visuelle
africaine**, **sans jargon technique à l'écran**, et **chaque livraison passe par
une pull request**.

---

## 1. Livrer

| Règle | Depuis |
| --- | --- |
| **Livrer par PR uniquement.** Jamais de commit direct sur `main`. | round 4 |
| **Une PR par demande.** On ne mélange pas deux chantiers dans une PR. | round 16 |
| **Jamais merger sur une CI rouge.** Si « Tests financiers, Lint & Build » est rouge, on répare d'abord. | round 16 |
| Une demande = **un résultat visible** à la fin. Un envoi qui ne montre rien est un échec. | round 33 |
| Les **exports** font partie de la livraison, pas d'un lot suivant. | round 15 |

**Ce qu'une PR contient toujours** : ce qui était demandé, la cause réelle du
défaut, ce qui change, ce qui ne change pas, et les vérifications chiffrées.

---

## 2. Avant d'écrire du code

| Règle | Depuis |
| --- | --- |
| **Corriger la cause, pas le symptôme.** Un 500 est un défaut, pas un aléa. | rounds 17 et 22 |
| **L'image avant le code.** On montre le motif, la planche, la maquette d'abord ; on code ensuite. | round 18 |
| **Les motifs sont des images réelles avant d'être du code.** | round 14 |
| **Ne jamais demander « je code maintenant ? » puis démarrer dans le même souffle.** Une seule question à la fois, et on attend la réponse. | consigne de méthode |
| Pas de **décor muet**, pas de **doublon**, pas de **chiffre inventé** : les nombres affichés sont réels. | round 29 |
| Une refonte est une **refonte totale**, pas une retouche. | round 30 |

---

## 3. L'écran

| Règle | Depuis |
| --- | --- |
| **Aucun nom technique ni de base de données dans l'interface.** On parle métier. | 22 oct. 2026 |
| **Un onglet ou un libellé en texte nu est un échec.** Tout contrôle est dessiné. | round 4 |
| **Pas de case nue** : cases à cocher, boutons, sélecteurs sont dessinés. | round 6 |
| **Responsive obligatoire** — téléphone compris, à chaque livraison. | round 6 |
| **Chaque shell de page embarque `RaccourcisPages.jsx`.** | 22 oct. 2026 |
| **Une direction artistique distincte par page** — jamais un thème recyclé d'une page à l'autre. | 22 oct. 2026 |
| Le **chargement est une animation dessinée**, pas un texte ni un rond qui tourne seul. | 25 oct. 2026 |
| Un chargement doit être **visible** — pas d'écran qui a l'air figé. | round 24 |
| Le **menu est opaque** ; les raccourcis restent **en haut à droite**. | round 31 |

### Les motifs — la règle la plus dure du dossier

Un motif déjà choisi et validé **n'est jamais redessiné**. On reprend **l'image
réelle**, à ses proportions, en `repeat-x`, sans l'étirer. Le bogolan de la page
Paie est le cas d'école : une version redessinée en losanges et chevrons a été
**refusée**, puis remplacée par `public/images/paie-bogolan-haut.webp` tel quel
(round 43, révision 2).

---

## 4. Le geste et l'interaction

| Règle | Depuis |
| --- | --- |
| **Au survol, on ne touche ni au fond derrière un texte, ni à la couleur du texte, ni à l'opacité d'un champ.** On change la bordure, l'anneau, le relief. | round 21 |
| **Deux chemins pour un geste** quand le geste est fréquent : le clic **et** le clavier (`Ctrl+C` / `Ctrl+V`). | round 45 |
| Ce qui doit être cliquable **est cliquable** — et on le dit quand ça ne l'est pas. | round 23 |
| Les **modales** suivent le modèle « mot de passe » déjà validé. | round 33 |
| La **recherche intelligente n'est jamais masquée, floutée ni recouverte** — par rien, jamais. | round 13, rappelé round 40 |

---

## 5. Le ton

- **Aucune formule d'atelier métaphorique.** On décrit le comportement, pas une
  ambiance (round 25).
- On nomme les choses telles que l'utilisateur les voit dans l'écran, pas telles
  qu'elles s'appellent en base.
- On **mesure** : « 96 px au lieu de 180 px » vaut mieux que « plus compact ».

---

## 6. Méthode éprouvée dans ce dépôt (pas des consignes du chef de projet)

Ces points ne viennent pas d'une demande explicite : ils viennent de ce qui a
échoué au moins une fois ici. Les respecter évite de refaire les mêmes erreurs.

### Vérifier avant de livrer

```
npx vitest run                                    # la suite entière, pas un fichier
npx vite build                                    # ce que le lint ne voit pas
npx eslint src --config eslint.gate.config.js     # la porte de lint (0 erreur attendu)
```

- **Ne pas se fier au compteur global d'eslint.** On compare `-f json` entre
  `HEAD` et l'arbre de travail : le dépôt traîne des remarques préexistantes, une
  nouvelle erreur noyée dedans est invisible.
- Il n'y a **pas de navigateur headless** dans l'environnement : on vérifie par le
  build, par les tests, et par une **planche d'images** quand c'est visuel.

### Écrire les tests

- Les tests de câblage lisent les **sources** (`fs.readFileSync` +
  `import.meta.dirname`) : ils vérifient qu'une classe CSS existe, qu'un état est
  branché, qu'une comparaison porte bien sur une clé.
- Un test qui décrit un défaut doit **porter le cas réel** : le bug « Équipe de
  vente » est verrouillé par les 5 vraies personnes du relevé, pas par des
  données inventées.

### Eviter les pièges connus

| Piège | Ce qu'il faut faire |
| --- | --- |
| `react-hooks/set-state-in-effect` | pas de `localStorage`/`sessionStorage` → `setState` dans un effet |
| `react-hooks/purity` | `Date.now()` en rendu → `instantPresent()` |
| `react-hooks/immutability` | un helper utilisé avant sa déclaration → **déplacer la définition**, pas `useCallback` |
| Assertion CSS par regex | `not.toContain('color')` matche `border-color` → `/(^|[\s;{])color:/` |
| `npm ci` | échoue ici (`xlsx` → `cdn.sheetjs.com` en `ECONNRESET`) ; passer par `npm install --legacy-peer-deps` |
| Vitest sans `.env` | 4 fichiers tombent en échec : un `.env` factice non suivi suffit |

---

## 7. La boucle d'un « round »

1. **Lire** la demande et retrouver la cause dans le code — pas dans l'intuition.
2. **Montrer** (planche, image, croquis) si c'est visuel.
3. **Écrire** le code et les tests qui verrouillent le défaut.
4. **Vérifier** : vitest complet, build, porte de lint.
5. **Documenter** : une page `docs/` par chantier, un fichier par défaut corrigé.
6. **Livrer** : branche, PR, CI verte, merge.
7. **Répondre** : ce qui a changé, où le voir, ce qui n'a pas changé.

---

## 8. Ce qui n'est jamais acceptable

- Un libellé, un onglet, un bouton **en texte nu**.
- Un **motif redessiné** à la main alors qu'une image validée existe.
- Un **nom de table ou de colonne** affiché à l'utilisateur.
- Un **chiffre fictif** présenté comme une mesure.
- Une **fusion silencieuse** de deux équipes, de deux pages ou de deux règles.
- Merger **sur une CI rouge**.
- Demander « je code maintenant ? » puis coder sans attendre.
