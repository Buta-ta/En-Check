# Obligation MFA individuelle — livraison applicative, activation séparée

## Parcours intégré

- Fiche d'un autre compte Admin → Sécurité → Exiger la double authentification.
  Confirmation, motif5–500 caractères, superadmin actif avec session MFA AAL2.
  Pas d'auto-imposition. Cible active et liée à Auth obligatoire.
- Consultation explicite avec MFA : Non exigée / Exigée — à configurer / Exigée — configurée. Ce dernier état ne certifie pas chaque session.
- Enregistrement privé : cible, auteur, motif et date. Répéter la même action
  ne remplace pas la trace initiale. Aucune API de suppression de l'obligation.
- Login et entrée dans les routes Admin consultent le statut propre avant les
  données métier. Une obligation non satisfaite redirige vers `/admin/mfa-obligatoire`.
- Cet écran ne dépend pas d'un profil métier déjà chargé ni du cache local Admin :
  inscription TOTP native, challenge d'un facteur existant, vérification serveur,
  puis retour par Login pour terminer le parcours normal. Déconnexion disponible.
- Dans une session déjà ouverte, le rejet serveur `MFA_ENROLLMENT_REQUIRED` provoque
  également cette redirection. Pas de polling permanent. Les données déjà affichées
  ou téléchargées ne sont pas effacées ; la redirection survient à la requête rejetée.
- Aucun nouveau CSS ou redesign. Le composant d'inscription existant est réutilisé.

## Contrôle serveur019

Pré-requis018 (repris de la livraison précédente, absent de cette base Git).
019 sauvegarde le guard existant avant de l'envelopper, sans supprimer ses contrôles.
Ne pas rejouer des migrations anciennes qui remplaceraient ensuite ce guard.

Le seul passage avant MFA est la RPC **lecture du statut propre**. Elle vérifie UID
unique, compte actif, session Auth vivante et absence de révocation. Aucun identifiant
cible fourni pour ce statut. Les autres routes restent soumises au guard métier.
L'enrôlement lui-même passe par Supabase Auth, pas une exemption des tables métier.

Une obligation est satisfaite seulement si **JWT AAL2 ET facteur vérifié présent**.
Retirer le dernier facteur ne lève donc pas l'obligation, même avec un ancien JWT AAL2.
Les policies restrictives s'ajoutent aux tables publiques déjà sous RLS, Storage objects
et Realtime messages lorsqu'elles existent. Les anciennes policies permissives ne
peuvent pas les élargir. Évaluation du statut par sous-requête non corrélée.

Ce lot ne certifie PAS les chemins anon historiques, les liens publics/signés déjà
émis, les connexions Realtime existantes, les vues definer et les Edge/service_role.
Les nouvelles tables après migration ne reçoivent pas automatiquement cette policy.
**Ces accès doivent être revus avant activation**, pas simplement supposés couverts.

## État de livraison

Code et tests intégrés dans la branche. **019 NON exécutée en production par ce lot.**
Même après installation, émission d'obligations désactivée par défaut dans la table
privée `admin_mfa_policy_config`. Aucun compte réel ciblé ni facteur manipulé.
Le bouton ne doit pas annoncer un succès si la migration/l'activation manque.

L'activation opérateur n'est pas une préférence accessible au navigateur. Elle ne
peut suivre qu'un déploiement client confirmé, recette réelle Auth/TOTP et revue des
canaux ci-dessus. Désactiver l'émission de nouvelles obligations ne lève pas celles
déjà enregistrées. Aucune rétrogradation automatique en accès par mot de passe.

## Suite : récupération et recette avant généralisation

Le raccordement de récupération v2 est désormais codé : voir
[le contrat020 et ses limites](ADMIN-MFA-RECUPERATION-V2.md). Il n'est pas encore
déployé ni activé ; les prérequis de recette ci-dessous restent applicables.


La récupération existante n'est pas déployée par cette livraison. La raccorder ensuite
sans supprimer la ligne d'obligation : vérification d'identité, intervention autorisée
et auditée, invalidation des facteurs perdus et des sessions, nouvel enrôlement par le
titulaire. La nouvelle connexion doit pouvoir atteindre l'écran d'inscription ; une
session révoquée ne le peut pas. Ne pas présenter cette procédure comme opérationnelle.

Scénarios nécessaires : aucun facteur, facteur existant+AAL1, AAL2, session déjà
ouverte, refresh, suppression du dernier facteur, perte du téléphone, compte inactif,
session révoquée, panne réseau, autres admins et Pointage inchangés. Utiliser un compte
de recette autorisé ; ne pas imposer une obligation à un vrai compte pour tester.

## Preuves locales

Tests PGlite : refus avant activation, acteur/ACL, idempotence, trace privée,
restriction Storage malgré policy permissive, statut propre/bootstrap, absence ou
retrait de facteur, AAL1/AAL2, révocation, admin non ciblé.
Tests JS/UI : erreurs de statut refusées, compatibilité avant migration uniquement
sur PGRST202, cible/motif et confirmation, absence de faux succès.
Ce ne sont pas des tests de connexion MFA native contre la production.
