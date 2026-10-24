# Suite du lot Administration : mot de passe depuis la fiche

## Livraison dans la même PR #123
- Suppression du renvoi vers l’ancien écran pour changer le mot de passe d’un autre administrateur.
- Formulaire repliable dans Sécurité : compte cible explicite, nouveau mot de passe, confirmation, motif obligatoire et confirmation du remplacement.
- De 12 à 72 caractères, au plus 72 octets UTF-8 afin de ne pas risquer une troncature silencieuse avec un service bcrypt. Le motif ne peut pas contenir le mot de passe fourni.
- Verrou anti-double soumission. Fermeture/changement d’onglet bloqués pendant la requête. Les secrets sont effacés après succès ou erreur, au changement d’onglet, de compte et à la fermeture du formulaire.
- La modification de son propre mot de passe reste dirigée vers Mon compte et sa vérification du mot de passe courant.
- Pas de message brut de service susceptible de divulguer un secret. Sur une réponse incertaine, aucun succès n’est présumé ; consulter le journal avant de réessayer.

## Migration additionnelle, non appliquée
`20261024000002_admin_account_password.sql` installe `encheck_account_password(uuid,text,text)` après la migration du lot 1.

La RPC identifie le superadmin actif via `auth.uid()`, verrouille les profils, refuse l’auto-intervention, valide les paramètres, appelle le service SQL existant `encheck_admin_definir_mot_de_passe(uuid,text)` et ajoute un événement `password_changed`. Le nouveau journal conserve seulement acteur, cible, action, motif et date. Aucun mot de passe n’est placé dans cet événement.

Le résultat du service est contrôlé : contrat void avec exception en cas d’échec, booléen true ou objet explicitement réussi. Résultat ambigu, négatif, contradictoire ou contenant une erreur : rejet. Une erreur du journal fait échouer la transaction ; aucun succès sans événement.

**Avant application : auditer la définition réelle du service existant**, ses droits, son contrat de résultat, sa gestion d’Auth et sa journalisation. Les tests utilisent un service simulé dans PostgreSQL local ; ils ne certifient pas le code serveur existant. Ils établissent l’atomicité pour des écritures dans la même transaction, pas pour un éventuel effet externe du service historique. Cette livraison ne modifie pas les anciens chemins d’administration et ne prétend pas les auditer rétroactivement.

## Limites explicites
- Ce n’est pas un e-mail de récupération ni un mot de passe à changement obligatoire.
- Les sessions existantes ne sont pas révoquées par cette action.
- Le bouton ne réactive pas automatiquement un compte inactif.
- Aucun mot de passe réel n’a été changé. Aucune migration appliquée, aucune fusion.
- Le reste du programme (invitations, rôles personnalisés, accès temporaires, révocation distante, récupération et suppression encadrée) reste à réaliser.

## Vérifications
Tests React : correspondance des deux mots de passe, cible correcte, double soumission, succès confirmé, masquage des erreurs et effacement des secrets. Tests PGlite : installation idempotente, interdiction anonyme/non-superadmin/auto-intervention, cible absente, taille UTF-8, motif sans secret, audit, rollback sur erreur de journal, refus des résultats ambigus du service.

Captures des composants réels et vérification responsive clair/sombre sur 320/390/768/1440 px. Données simulées uniquement. Consulter [l’aperçu GitHub](APERCU-ADMINISTRATION.md), sans dépendre du viewer du workspace.

Résultat local final : **762 tests / 78 fichiers réussis**, build réussi, ESLint gate sans erreur (un warning préexistant EnterpriseSelectorModal), git diff --check réussi. Les 16 configurations navigateur passent.
