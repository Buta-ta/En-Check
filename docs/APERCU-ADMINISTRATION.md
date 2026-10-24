# Aperçu du redesign — directement sur GitHub

Ces captures proviennent du **code de la nouvelle version sans sidebar**, avec des **données fictives**. Ce ne sont ni les images générées de proposition ni des comptes réels. Les champs non visibles sur mobile sont accessibles en faisant défiler la page.

## Administration des accès — ordinateur

![Administration, fiche de sécurité ouverte](captures/admin-comptes-desktop.png)

## Mon compte — ordinateur

![Profil personnel](captures/mon-compte-desktop.png)

## Mobile, thème sombre

![Fiche administrateur sur téléphone](captures/admin-comptes-mobile.png)

![Mon compte sur téléphone](captures/mon-compte-mobile.png)

## Prévisualisation interactive

Le robot de déploiement publie le lien **Preview** dans la PR de cette version. Cette prévisualisation nécessite les autorisations de déploiement et une connexion En-Check. Les captures ci-dessus restent consultables sans connexion à l’application.

**Attention : une prévisualisation peut partager le backend du site. Ne pas tester une opération sensible sur un compte réel.** Les captures ci-dessus permettent de consulter le résultat sans connexion et sans intervention sur les données.

[Détails de la refonte sans sidebar](ADMIN-REGISTRE-SANS-SIDEBAR.md).

## Périmètre et activation

- [Lot 1 : interfaces, profil et état des comptes](ADMIN-COMPTES-LOT-1.md).
- [Suite : changement de mot de passe dans la fiche](ADMIN-COMPTES-MOT-DE-PASSE.md).
- Les migrations SQL sont versionnées mais **non appliquées au serveur**. Les fonctions restantes ne sont pas présentées comme terminées.

## Nouveau : recadrage de la photo personnelle

[Voir les captures et le fonctionnement du recadrage](ADMIN-PHOTO-RECADRAGE.md).
