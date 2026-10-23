# Paie — tiroirs, paramètres accessibles et chargement porte-monnaie

23 octobre 2026 — branche arena/4ee978f2-en-check

## Corrections
- Position du calque des tiroirs explicitement fixée au viewport avec une spécificité supérieure à `.paie-page`. Le thème de page définit `position: relative` : la position du tiroir ne doit pas dépendre de l’ordre de chargement CSS.
- Hauteur adaptée au viewport mobile (`100dvh`), marges/paddings du panneau remis à zéro, focus sans défilement de la page, ouverture au début du panneau.
- Aide plus compacte ; exemples accessibles par un détail repliable. Les formulaires, valeurs et callbacks métier sont conservés.

## Paramètres
- Six repères : base du calcul, données utilisées, ajouts/déductions, entreprise, présentation, signatures.
- Navigation directe entre ces groupes ; nouvelle grille avec résumé distinct et empilement mobile.
- Explication visible des jours/heures de référence, exemples numériques illustratifs.
- Distinction entre lire une source et déduire/payer une somme ; descriptions des absences, congés et retards sans assimiler tous les congés à une retenue.
- Boutons heures supplémentaires, fiscalité, signatures et enregistrement harmonisés. Accès fiscal transformé en véritable bouton clavier.
- Mention explicite des choix non enregistrés et absence de recalcul des bulletins déjà enregistrés.

## Chargement
Animation SVG originale d’une pièce entrant dans un porte-monnaie, commune à l’espace Paie & Fiscalité, aux fiches et à la configuration fiscale. Carte fixée dans la partie haute du viewport, sans devoir scroller ; texte annoncé par `role=status`, illustration décorative et animation désactivée si réduction des mouvements. Composant conservé dans l’arbre de son éditeur pour rester caché quand l’éditeur est masqué.

## Vérifications
- 618 tests Vitest / 60 fichiers réussis ; test du statut de chargement ajouté, assertion de l’aide repliable mise à jour.
- ESLint gate : 0 erreur, 1 avertissement préexistant dans EnterpriseSelectorModal.
- Build Vite/PWA réussi ; avertissement préexistant sur la taille des bundles.
- Chromium : véritable page FichesPaie et véritables modales avec services/données simulés, sans production. Largeurs 320, 390, 768, 1440 ; clair et sombre ; zéro erreur JavaScript, pas de débordement horizontal.
- Ouverture des primes et retenues et ouverture depuis le bas de page : panneau à y=0, titre au-dessus de 220 px, scroll initial zéro, fermeture Échap. Test effectué en ajoutant les styles de page APRÈS les styles du tiroir pour reproduire l’ordre défavorable.
- Carte de chargement entièrement dans le viewport même après défilement au bas d’une page longue.
- Captures réalisées, vue paramètres claire desktop inspectée. Pas de test métier authentifié ni sauvegarde de données réelles.

Aucun SQL, taux, formule ou montant de production modifié. Installation locale avec xlsx temporairement substitué pour contourner le CDN inaccessible ; manifests restaurés, aucune modification de dépendance livrée.
