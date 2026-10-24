# Comptes & accès — registre sans sidebar

## Demande et réalisation
La sidebar propre à la page Admin a été explicitement rejetée. Son import, son rendu, son composant et ses règles de décalage ont été retirés. La navigation globale du dashboard n’est pas modifiée.

- Bandeau compact : retour au tableau de bord, Mon compte, titre « Comptes & accès », action de gestion existante.
- Motif **Bogolan sélectionné**, issu du fichier original présent dans le workspace, sans nouvelle génération : `docs/design/admin-bogolan-selected.png`. Export `public/images/admin-bogolan-selected.webp` (qualité 95), marges papier retirées entre 28 % et 72 % de la hauteur de la source 2320 × 464 ; les trois rangées du dessin sont conservées. Répétition proportionnelle dans les bandeaux haut, bas et fiche. Aucun filtre de couleur en sombre.
- Navigation Comptes / Rôles / Journal, compteurs compacts, filtres et registre avec sélection cuivre. Photos existantes ou initiales, sans portraits fictifs dans le code de production.
- Fiche administrateur : identité structurée (photo, rôle, entreprise, état), groupes de sécurité courts, mot de passe à la demande et état du compte replié séparément. Explications détaillées conservées dans une rubrique dépliable, pas supprimées.
- Les fonctionnalités de sécurité encore indisponibles ne sont pas transformées en faux boutons fonctionnels. Mot de passe, désactivation et protections existantes ne sont pas réécrits.
- Journal : lecture réelle des 50 derniers événements `admin_account_events`, identification acteur/cible à partir du registre chargé, message explicite et Réessayer en cas d’erreur. Aucun faux état vide si le serveur refuse. Le périmètre limité aux événements déjà journalisés est indiqué.
- Mon compte : identité plus compacte et navigation horizontale sur ordinateur ; pas de grande colonne personnelle à gauche du formulaire.
- Mobile : fiches de registre, tiroir plein écran, contrôles tactiles et focus préservés. Ordinateur : largeur centrée et alignements communs entre bandeau, liste et fiche.

## Vérifications
- **787 tests / 80 fichiers réussis**, build réussi. Porte ESLint : zéro erreur, un warning préexistant EnterpriseSelectorModal.
- Régression : absence de sidebar, titre, journal réel et erreur/retry, motif de la fiche, actions sensibles repliées. Tests existants des mots de passe, profils et permissions conservés.
- Chromium : 16 configurations (Comptes / Mon compte × clair/sombre × 320/390/768/1440 px), absence de débordement, ouverture du formulaire de mot de passe, Échap et restitution du focus, lecture du journal. Captures inspectées.
- Captures avec données simulées, pas une session de production. Les images du dossier captures et le document d’aperçu sont actualisés pour ne plus montrer l’ancienne sidebar.
- Aucune migration, aucune modification des rôles, mots de passe ou comptes réels. Les prérequis serveur des lots précédents restent inchangés.

## Aperçus du code
![Registre et fiche sur ordinateur](captures/admin-comptes-desktop.png)

![Fiche sur mobile, thème sombre](captures/admin-comptes-mobile.png)

![Mon compte compact](captures/mon-compte-desktop.png)
