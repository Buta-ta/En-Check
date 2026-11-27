# Heures supplémentaires — navigation, guide, tiroir et chargement

## ⚠️ Deux des deux premières lignes de ce chapitre sont rétractées le 26/12/2026

Elles décrivent ce que le fondateur a demandé d'enlever : « Enlever les
raccourcis, le bouton sombre/clair. » Elles sont LAISSÉES telles quelles ci
dessous, parce qu'elles racontent une livraison qui a existé six semaines et
qu'un lecteur a besoin de savoir ce qui a été construit avant de comprendre ce
qui est retiré — mais elles ne décrivent plus le dépôt.

- Les quatre raccourcis et leur barre de 58 px (16 de `padding-top` + 42 de
  `min-height`) sont **supprimés** : le composant `OvertimeNavigation` n'existe
  plus dans `src/components/OvertimeExperience.jsx`, qui n'exporte plus que le
  guide de calcul et l'écran de chargement. Un composant retiré du montage mais
  laissé dans le fichier est une dette, pas une option.
- Le bouton soleil/lune de la page est **supprimé**, ainsi que la classe
  `.ot-dark` et le prop `darkMode` du tiroir. Ce qui reste, et qui doit rester :
  le `ThemeProvider` et sa persistance (`encheck.theme`,
  `documentElement.dataset.theme`) — la page perd sa BASCULE, pas le THÈME. La
  bascule vit dans l'en-tête de l'administration. Les deux sont verrouillés par
  des aiguilles (`overtimeExperience.test.jsx`, `overtimeBrandAlignment.test.js`)
  pour que personne ne « répare » l'une en ressuscitant l'autre.
- Le tiroir décrit au quatrième point garde ses sections, ses labels, ses
  validations, sa boucle de focus, sa restitution du focus et sa fermeture
  Échap. Ce qui change est sa peau : un cerclage par section, règle pleine de
  3 px à gauche, voile `--charte-modale-voile` à la place du `blur(4px)`,
  champs au `--charte-mono`, et ses 37 attributions `style={…}` (dont 5 hex,
  9 `rgba`, un dégradé orange et deux `borderRadius`) devenues des classes de la
  feuille — seul endroit que le `npm run charte` sait lire.
- L'écran de chargement et ses deux blocs `prefers-reduced-motion` sont intacts,
  à l'octet près : l'aiguille qui les vérifie compare une chaîne crue.

Les cotes et la table avant/après de la peau sont dans
`docs/HEURES-SUPPLEMENTAIRES-CORRECTION-CHARTE.md`, chapitre « Peau du
26/12/2026 ».

## Livraison
- Quatre raccourcis React Router : Pointages, Planning, Employés, Paie & Fiscalité. Deux colonnes sur mobile, pas de scroll horizontal.
- Bouton soleil/lune relié au ThemeContext existant : thème global persistant, pas de thème indépendant pour cette page.
- Carte de calcul compacte : trois étapes, exemple explicitement illustratif 9 h − 8 h = 1 h, deux explications repliées (majorations / jours particuliers). Aucun taux supposé pour l’entreprise.
- Tiroir natif existant conservé et redessiné : bandeaux aso-oke vectoriels haut/bas, trois sections Déclenchement / Majorations / Jours particuliers, champs dimanche/fériés regroupés, aides repliées, corps défilant et actions toujours hors du scroll. Conservation des labels, validations, verrouillage pendant sauvegarde, boucle du focus, restitution du focus et fermeture Échap.
- Chargement : fiche de pointage animée près d’une horloge cuivrée, temps prévu indigo puis dépassement cuivre après le repère. Scène CSS/SVG décorative, boucle 4 s, texte de statut accessible. Aucun faux pourcentage, paiement validé ou délai minimum. L’affichage cesse avec l’état réel d’accès/chargement. Version fixe en reduced-motion.
- Charte corrigée conservée : tailles des titres, palette, police et bandeaux fins. Aucun changement des calculs ou permissions. Aucun SQL, écriture réelle ou déploiement production pendant l’intervention.

## Vérifications
- 700 tests / 70 fichiers réussis. Nouveaux tests : quatre destinations, changement du thème global et persistance, exemple illustratif, aides fermées, états du loader et reduced-motion. Montage de la vraie page : deux bandeaux dans le dialogue, trois sections et champ dimanche dans Jours particuliers ; sauvegarde/erreur existantes toujours couvertes.
- Build Vite/PWA réussi. Porte ESLint : zéro erreur, un warning préexistant EnterpriseSelectorModal. git diff --check réussi.
- Chromium : vrais composants dans un harnais synthétique, clair/sombre × 320/390/768/1440 px. Navigation à quatre liens, thème global, absence d’overflow, arrêt des animations en reduced-motion, deux bandeaux de dialogue, pied visible et fermeture Échap. Aucune erreur JavaScript observée.
- Le harnais utilise un formulaire simplifié pour vérifier la disposition du dialogue. Le vrai formulaire est testé en jsdom ; pas de session authentifiée de bout en bout en production.
- Dépendances versionnées inchangées ; harnais et captures hors dépôt.
