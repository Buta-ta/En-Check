# Pointage : contrat d’accès aux employés à coordonner avec l’équipe

**État : incompatibilité établie par lecture du code, recette réelle non exécutée.**
Ce document n’annonce ni une panne observée chez un utilisateur ni un correctif déjà intégré à l’application Pointage.

## Source vérifiée, sans modification du dépôt tiers

Dépôt `Buta-ta/En-Check-App-Pointage`, version `25f4140` de main examinée le 25 octobre 2026 :
- `lib/services/supabase_service.dart:108` : `getEmployeesParEntreprise` lit anonymement `employees_public` avec les horaires imbriqués.
- Même fichier, ligne 715 : `getEmployeeParId` lit cette vue avec entreprise et horaires.
- `lib/services/sync_service.dart:102` utilise la liste pour le cache.
- `lib/screens/pointage_screen.dart:256` utilise la liste ; ligne 1719 recharge une fiche par ID.
- Les connexions PIN/QR passent par `encheck_employee_login` / `encheck_employee_login_qr`, renvoient déjà `employee` et `jeton`, conservé par `TrustedPunchService`.

Un jeton applicatif `employee_sessions` n’est PAS un JWT Supabase Auth : sa présence côté client ne donne aucun droit aux lectures REST directes effectuées sous `anon`.

## Problème

La migration 011 a fermé la lecture anonyme de la vue qui exposait de nombreux champs personnels sous les droits du propriétaire. Les deux lectures directes ci-dessus ne sont plus autorisées. Les blocs `catch` renvoient une liste vide ou null : certaines situations peuvent donc ressembler à une absence d’employés ou de fiche. Le bon fonctionnement des autres RPC de pointage ne prouve pas celui du téléchargement et du cache.

**Ne pas rejouer un ancien script `GRANT SELECT ... TO anon` pour résoudre cela. Ne pas embarquer une clé service_role dans Flutter.**

## Contrat proposé (à implémenter et valider ensemble ; aucun nouvel endpoint annoncé disponible)

### Pointage individuel

1. Conserver la connexion PIN/QR existante et son jeton applicatif.
2. Utiliser le profil de la réponse de connexion pour la session initiale, plutôt qu’une lecture anonyme par UUID.
3. Pour le rafraîchissement, utiliser une RPC dédiée dont le serveur résout l’employé depuis le jeton, vérifie expiration/révocation, état actif de l’employé et entreprise. Un ID fourni par le client ne constitue jamais une autorisation.
4. Définir une liste explicite des champs nécessaires : identité d’affichage, photo si nécessaire, entreprise, horaires utiles. Exclure identité nationale, fiscalité, coordonnées privées non nécessaires, mots de passe/hachages, PIN/QR et jetons.
5. Retourner une erreur d’autorisation explicite, pas un faux succès vide.

### Borne partagée, synchronisation et hors-ligne

Une session personnelle d’employé ne doit pas autoriser automatiquement le téléchargement du personnel et des gabarits biométriques de toute l’entreprise.

Le téléchargement collectif requiert un appareil autorisé par l’administration : secret non public, entreprise liée côté serveur, révocation et durée de validité. Le code entreprise ou le seul device ID fourni par le client ne suffit pas. Définir avec l’équipe le périmètre minimal du cache, sa durée et sa purge lors de révocation/désactivation. Ne pas transformer un jeton personnel en autorisation collective.

### Biométrie

`encheck_visage_lister(text)` valide actuellement un jeton applicatif non expiré/non révoqué, puis renvoie les enrôlements de l’entreprise, y compris les embeddings approuvés. Ce n’est pas une fonction dépourvue de contrôle, mais son périmètre collectif et la vérification des états actifs doivent être revus. Elle est réellement appelée par Pointage : aucune révocation aveugle effectuée dans cette livraison.

## Recette indispensable avant clôture

Sur un environnement contrôlé avec comptes/appareils de test autorisés :
- PIN valide/invalide, QR valide/invalide ; profil initial sans lecture anonyme ;
- jeton expiré/révoqué, employé/entreprise désactivés ;
- impossible de lire un autre employé ou une autre entreprise avec un jeton personnel ;
- synchronisation de borne autorisée et refus d’une borne inconnue/révoquée ;
- cache vide, ancien, hors-ligne et retour réseau : pas de faux succès ;
- reconnaissance faciale, consentement/périmètre des gabarits et absence de secrets dans les logs/cache ;
- non-régression des pointages machine ADMS.

## Message à transmettre à l’équipe

> Les lectures anonymes d’employees_public ne sont plus autorisées pour protéger les données RH. Votre service lit encore cette vue dans getEmployeesParEntreprise et getEmployeeParId. Merci de remplacer ces lectures selon le contrat ci-dessus : profil individuel via session vérifiée, synchronisation collective via appareil autorisé. Ne réouvrez pas les GRANT anonymes. Nous devons valider ensemble les données et signatures nécessaires avant déploiement coordonné. Le dépôt Pointage n’a pas été modifié par l’agent Admin.
