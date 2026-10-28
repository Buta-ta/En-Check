# La carte d'Analytics — un fond qui ne réclame aucune clé

## Le symptôme

La carte de la page **Analytics du site** restait grise, avec le message
« api key required » servi à la place des tuiles. Un fournisseur de fond
réclamait une clé qui n'existe pas dans le projet — et une clé manquante
ne doit jamais vider une carte.

## La réponse : trois fonds, aucun compte

`src/components/CarteConnexions.jsx` essaie maintenant trois fonds, dans
cet ordre :

| Ordre | Fond | Clé ? | Rôle |
| --- | --- | --- | --- |
| 1 | **Esri « Canvas »** — `World_Dark_Gray_Base` ou `World_Light_Gray_Base`, avec la couche `_Reference` pour les noms | non | le fond des deux thèmes |
| 2 | **OpenStreetMap** — `tile.openstreetmap.org` | non | le filet de sécurité |
| 3 | **Le monde dessiné** — `/data/monde-110m.geojson` | non | la carte embarquée dans l'application |

Trois tuiles manquantes (`tileerror`) et le fond suivant prend le relais.
Quand les deux serveurs de tuiles se taisent, la carte **cesse de dépendre
d'Internet** : le trait de côtes est dessiné à même la carte, les épingles
se posent dessus, et le zoom se limite à 6 (`ZOOM_DESSINE`).

## Le monde dessiné

- Source : **Natural Earth 110m** (`world-atlas`, domaine public), converti
  en GeoJSON une fois pour toutes.
- Fichier : `public/data/monde-110m.geojson` — **86 Ko**, 1 383 polygones.
- Rendu : `L.geoJSON`, sans interaction ; côtes à l'or et terres au brun en
  thème de nuit, côtes à l'ocre et terres au parchemin en thème clair.
- Préchargé par le service worker (`globPatterns` inclut `geojson`) : hors
  ligne aussi, la carte reste une carte.

Un message discret, en bas du cadre, dit lequel des trois fonds est affiché
quand ce n'est pas le premier : « Les tuiles n'ont pas répondu : le monde est
dessiné ici, les épingles restent à leur place. »

## La barre de recherche passe devant la carte

Leaflet pose ses panneaux à des `z-index` de 200 à 1000. Sans barrière, ils
passent par-dessus la barre de recherche de l'assistant, fixée en bas de
l'écran. Trois verrous, tous sur `CarteConnexions.css` :

```css
.an-carte-cadre {
  isolation: isolate;   /* les z-index de Leaflet restent dans le cadre */
  contain: paint;       /* rien ne peut être peint hors du cadre */
  z-index: 0;
}

.an-carte-cadre .leaflet-tile-pane   { z-index: 1; }
.an-carte-cadre .leaflet-popup-pane  { z-index: 6; }
.an-carte-cadre .leaflet-top,
.an-carte-cadre .leaflet-bottom      { z-index: 7; }
```

`contain: paint` est le verrou de fond : même un contrôle ajouté par une
extension de Leaflet ne peut plus déborder du cadre.

## Vérifications

```
npx vitest run src/services/__tests__/analyticsSite.test.jsx   → 46 tests ✓
npx vitest run                                                 → 136 fichiers ✓
npx vite build                                                 → ✓ (precache 22 entrées)
npx eslint src --config eslint.gate.config.js                  → 0 erreur
```

Les tests de la section 7 vérifient : aucun fournisseur à clé, Esri pour les
deux thèmes avec ses étiquettes, OSM en secours, la chaîne des trois essais,
la présence et la validité du GeoJSON embarqué, et les trois verrous de
peinture.
