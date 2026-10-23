# Retards : course vers la borne et photos des employés

## Demande validée
Une personne court pour pointer pendant le chargement de Retards. Afficher simplement la photo de profil existante des employés qui en ont sur Retards et Heures supplémentaires, avec initiales en secours.

## Livraison
- Scène originale SVG/CSS : personnage générique, course avec bras/jambes animés, déplacement vers une borne puis présentation du badge. Boucle 4,8 s, palette En-Check et bandeaux culturels fins.
- Aucun voyant de validation, faux retard, heure fictive, pourcentage ou photo réelle dans le loading. Texte « Chargement des arrivées… ».
- Branché sur le chargement réel des résultats Retards ; disparaît dès leur disponibilité. Aucun délai minimum ajouté. Le contrôle d’accès garde son état distinct.
- Reduced-motion : aucune animation ; personne immobile devant la borne, badge présenté. Dessin décoratif masqué aux lecteurs d’écran, statut de chargement accessible.
- Composant photo partagé : utilise `employee.photo_url`, recadrage object-fit cover dans l’avatar existant. Initiales si URL absente ou image en erreur ; réinitialisation si employé/URL change. Les noms restent visibles à côté, sans annonce répétée de l’image.
- Heures supplémentaires : la requête existante fournit déjà photo_url ; aucune requête de profil supplémentaire.
- Retards : enrichissement optionnel après le résultat SQL, uniquement pour les employés affichables, IDs dédupliqués et lots de 100. Lecture limitée à id/enterprise_id/photo_url, portée entreprise hors super-admin global, RLS existante et contrôle de concordance entreprise avec les lignes SQL.
- Les résultats ne sont pas bloqués par les photos : si récupération impossible, les initiales restent disponibles. Une réponse photo tardive ne remplace pas les résultats d’un autre contexte.
- Aucun nouveau système de profils, aucune modification des calculs SQL, permissions, données de paie ou schéma. Aucune écriture de données réelles effectuée.

## Vérifications
- **725 tests / 73 fichiers réussis** : photo affichée, secours après erreur, absence, changement d’URL/personne, déduplication et lots, portée/concordance entreprise, erreur réseau, période sans résultat. Montage des vraies pages Retards et Heures supplémentaires vérifiant la photo issue des employés. Tests de source SQL conservés.
- Build Vite/PWA réussi. Porte ESLint : zéro erreur, un warning préexistant EnterpriseSelectorModal. git diff --check réussi.
- Chromium : clair/sombre × 320/390/768/1440 px. SVG animé et version reduced-motion, absence de débordement horizontal, chargement réel de Retards avec requête de test suspendue puis libérée, retrait du loader, images décodées et initiales après image invalide/absence sur les deux présentations. Captures de scène inspectées.
- Tests navigateur avec données et images synthétiques : vraie page Retards/API interceptée ; composant de présentation Heures supplémentaires dans le harnais, complété par le montage de sa vraie page en jsdom. Pas de session authentifiée en production.
- Dépendances versionnées inchangées. Aucun SQL exécuté et aucun déploiement production.
