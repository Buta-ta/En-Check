# Inscription MFA : distinguer Auth422 des services Admin404

Diagnostic du 26 octobre 2026, en lecture seule : le facteur signalé existe en
TOTP mais reste `unverified`. Aucune clé TOTP, aucun code, aucun JWT consulté ou
modifié. Aucun facteur retiré, réinitialisé ou marqué vérifié manuellement.

Les RPC d'obligation, mot de passe, sessions et alertes ainsi que la table de
résiliation citées dans la console sont absentes du serveur. Le socle
`encheck_account_security_status()` existe. Ces404 traduisent le déploiement
partiel des modules Admin ; ils ne démontrent pas la cause du refus Auth422.
Les checkpoints mot de passe/obligation acceptent déjà explicitement l'absence
PGRST202 avant déploiement ; les autres modules affichent leur indisponibilité.
Aucune fausse RPC de succès ni activation générale des migrations pour masquer404.

Le code HTTP422 seul ne permet pas de distinguer un code TOTP incorrect, un
challenge expiré ou un autre refus fournisseur. Le diagnostic précis demande
l'identifiant d'erreur de la **réponse échouée** (`mfa_verification_failed`, etc.),
jamais la charge de la requête, le code à six chiffres, les en-têtes, le QR ou la clé.

## Correctif interface

- Diagnostic contrôlé par liste blanche des codes Auth, sans messages bruts ni logs.
- Conseils distincts : code/challenge/réseau/limitation/inscription indisponible.
  Pour422 inconnu, aucune cause inventée.
- Code effacé après tentative ; saisie désactivée pendant l'envoi. Pas de retry ni
  suppression automatique de facteur ; la même inscription reste disponible.
- Confirmation AAL2 nécessaire avant l'annonce de succès.
- Succès Auth suivi d'un échec de rechargement Admin : conserver l'annonce du
  succès MFA et signaler séparément la liste indisponible. Ne pas inciter à recréer
  le facteur pour cette seule erreur.
- Consignes : entrée associée au QR actuel, heure automatique du téléphone, code
  de l'authentificateur (pas SMS/e-mail). Ne pas partager les secrets au support.

## Limites

Ce correctif améliore diagnostic et reprise, **ne résout pas à lui seul la cause du
422 du titulaire**, encore inconnue sans son identifiant d'erreur. Pas de recette
native réussie annoncée. Les modules404 restent à déployer séparément selon leurs
prérequis. Le design et les contrôles de sécurité ne sont pas assouplis.
