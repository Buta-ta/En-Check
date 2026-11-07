# La recherche intelligente se replie — round 48

> « je veux la possibilité de retracter la barre de recherche intelligente »

Le bandeau de l'assistant occupe **180 px** en bas de chaque page. Il se
replie maintenant en une pastille de **96 px**, et se rouvre d'un clic.

## Où

| Commande | Où elle est | Ce qu'elle fait |
| --- | --- | --- |
| **Replier** (chevron bas) | en haut à droite du bandeau, à côté de « Converser · Vérifier · Comprendre » | replie le bandeau |
| **Recherche intelligente** (chevron haut) | pastille restée en bas de la page | rouvre le champ de saisie |

Le choix est retenu dans `localStorage['ec_assistant_recherche_repliee']` : une
page repliée le reste en changeant de page, et le même bouton défait le repli.

## Trois garde-fous

1. **Ouverte par défaut.** Rien dans le stockage = barre ouverte. Personne ne
   perd la recherche sans l'avoir demandé (règle du round 13).
2. **Jamais retirée.** Repliée, la pastille reste visible et cliquable. Le
   champ reprend son identifiant `#ec-assistant-recherche` à la réouverture
   (règle du round 40 : la recherche n'est jamais recouverte ni escamotée).
3. **Aucun effet secondaire.** Le repli passe par un bouton, jamais par un
   `useEffect` ; un `localStorage` refusé laisse la barre utilisable.

## Ce que ça ne touche pas

- la fenêtre de conversation (`dialog`), son formulaire et sa mémoire ;
- la hauteur du bandeau quand il est ouvert, son `z-index: 80`, son rang
  au-dessus des cartes de page ;
- le filtre du **Planning**, qui a déjà son propre pli (`.sk-focus-bar`,
  `localStorage['planning_legende_ouverte']`, round 44).

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `src/components/AssistantDock.jsx` | état `repliee`, clé de stockage, bouton « Replier », pastille de réouverture |
| `src/styles/assistantDock.css` | `.ec-assistant-dock.is-repliee`, `.ec-assistant-rangee`, `.ec-assistant-rallumer`, `.ec-assistant-replier`, hauteur `.ec-assistant-space.is-repliee` |
| `src/services/__tests__/rechercheIntelligentePliable.test.js` | 16 tests (ouverture par défaut, garde-fous, survol, petit écran) |
| `docs/design/round-48-equipes-et-recherche-pliable.png` | planche de contrôle |

## Vérifications

```
npx eslint src/components/AssistantDock.jsx   → identique à l'existant
npx vitest run                                → 138 fichiers, 1835 tests ✓
npx vite build                                → ✓
```
