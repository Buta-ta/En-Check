# GÉOPOINTAGE — le plateau et les zones, un seul écran

> La carte en direct et les zones de pointage ne font plus qu'une page.
> Le dessin est celui de la carte : la porte de grenier dogon, le panneau
> de bois, la patine. Rien n'a été redessiné pour les zones — elles sont
> descendues sous le plateau, dans le même registre.

La planche est dans le dépôt : `docs/design/refonte-geopointage.png`.

---

## 1. Ce qui a fusionné

| Avant | Après |
| --- | --- |
| `Carte en direct` → `/carte-temps-reel` (`CarteTempsReel.jsx`) | **Géopointage** → `/geopointage` (`Geopointage.jsx`) |
| `Zones de pointage` → `/geofencing` (`ConfigGeofencing.jsx`, écran noir à part) | la même page, sous la carte |

- **le menu** n'a plus qu'une entrée : **Géopointage** (section *Outils*) ;
- **deux adresses restent vivantes** pour les liens déjà partagés ou mis en
  favori : `/carte-temps-reel` et `/geofencing` redirigent (`replace`) vers
  `/geopointage` ;
- **l'ancienne page** `ConfigGeofencing.jsx` est supprimée : elle était écrite
  en styles inline, sur un fond `#0A0A0F`, avec des emojis de statut. Il n'en
  reste rien ;
- **le verrou des options payantes** : `/geopointage` reste ouverte si l'une
  *ou l'autre* des deux options est vendue (`module_geolocalisation`,
  `module_carte_temps_reel`) ; elle ne se ferme que si les deux sont éteintes ;
- **l'assistant** (`geofence`, `goMap`) et **la recherche** (`goMap`) envoient
  sur la page unique.

## 2. L'écran, de haut en bas

1. **la porte dogon** — bandeau de motif en haut (76 px) et en bas (32 px),
   panneau gravé, blason, pastille « En direct », bascule clair/sombre ;
2. **le seuil** — l'entreprise et ses personnes géolocalisées, les raccourcis
   vers les autres pages, en haut à droite ;
3. **les cinq registres** — Employés GPS, Présents, Sortis, Hors zone,
   Non vérifié ;
4. **les outils** — la date, l'entreprise (super administrateur), l'employé,
   les quatre clés de statut, *Actualiser*, *Ma position* ;
5. **le plateau** — la carte Leaflet, ses zones, ses épingles, sa légende,
   les voiles de chargement et de carte vide ; à droite la colonne des
   employés du jour, avec leur recherche et leur heure ;
6. **les zones du site** *(nouveau)* — un registre : numéro, nom, centre et
   rayon, mode, état, et trois gestes en mots ;
7. **le pied** — la bande de motif en bas.

## 3. Les zones, dans l'écriture de la page

| Geste | Ce qui se passe |
| --- | --- |
| **Tracer une zone** | une fenêtre : nom, *Utiliser ma position actuelle*, une carte cliquable, latitude / longitude, rayon (50 m → 5 000 m), « Zone bloquante », « Zone active » |
| **Modifier** | la même fenêtre, remplie avec la zone ; l'enregistrement met à jour `geofences` |
| **Éteindre / Rallumer** | `is_active` bascule ; la zone reste dans la liste, barrée, parce qu'on doit pouvoir la rallumer |
| **Supprimer** | une confirmation qui compte d'abord les pointages liés ; `attendances.geofence_id` passe à `null` **avant** la suppression, l'historique est conservé |

Chaque geste donne un retour visible dans la page (un avis daté, au ton vert
ou rouge) — aucun `alert`, aucun toast d'une autre époque. Un refus de la base
est dit en français, avec sa raison.

La fenêtre de tracé porte sa propre carte (`CarteDeZone`) : elle se crée à
l'ouverture, se retire à la fermeture. Le clic pose le centre ; le cercle et
le mode se dessinent en direct avec les deux couleurs de zone du produit
(vert non bloquante, rouge bloquante).

**Douze et une leçons tenues** : aucune règle de style dans le JSX de la page
(le test le vérifie), tous les `z-index` sous 80 restent sous la barre de
l'assistant, le survol ne change ni fond derrière un texte, ni couleur de
texte, ni opacité de champ, et les champs passent à 16 px sur téléphone.

## 4. Ce qui n'a pas bougé

- la carte Leaflet, le cluster, les épingles, la légende, la fiche employé ;
- le canal temps réel `carte-realtime-*` et le rechargement à chaque pointage
  géolocalisé ;
- les filtres `filterStatut` / `filterEmploye`, la recherche par nom ou
  matricule ;
- les tables : `geofences`, `attendances`, `employees`, `enterprises`.

## 5. Tests

`src/services/__tests__/geopointage.test.jsx` — **42 tests** (ex-`carteDogon`,
35 tests, plus la fusion).

Ce qu'ils défendent, en plus de tout ce que gardait la carte :

- une seule entrée de menu, une seule adresse, deux redirections ;
- le verrou ouvert si l'une des deux options est vendue ;
- l'assistant et la recherche sur `/geopointage` ;
- la gestion des zones dans la page : les quatre ordres sur `geofences`,
  `is_active`, la suppression qui détache `geofence_id` avant de supprimer ;
- la carte de tracé, le rayon, les deux choix bloquante / active ;
- toujours aucun style dans le JSX, aucun `z-index` hors modale au-dessus de
  80, aucun emoji dans les textes de travail.
