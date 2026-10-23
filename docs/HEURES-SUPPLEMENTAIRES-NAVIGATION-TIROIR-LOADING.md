# Heures supplémentaires — navigation, guide, tiroir et chargement

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
