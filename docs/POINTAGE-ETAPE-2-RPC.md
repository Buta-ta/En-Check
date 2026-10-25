# Pointage — étape 2 : profil par jeton et catalogue restreint

## Livraison réelle, 25 octobre 2026

Migration **20261025000015_pointage_profile_catalog.sql** installée dans `en-check` / `cxggndvhwdolbtyezjde`. Le cache de schéma PostgREST a reçu une notification de rechargement. Aucune modification du dépôt Pointage ou du design Admin.

Signatures PostgreSQL disponibles, sans surcharge :

```text
encheck_employe_profil(p_jeton text) → jsonb
encheck_entreprises_publiques() → jsonb
```

Exécution autorisée à `anon`, `authenticated`, `service_role`. `anon` désigne ici le rôle de transport de l’application : le profil exige en plus un jeton applicatif valide. Ce n’est pas un accès anonyme aux fiches.

## 1. Profil personnel

Appel Flutter :

```dart
final result = await client.rpc('encheck_employe_profil', params: {
  'p_jeton': jetonDeLaSession,
});
```

Ne jamais écrire ce jeton dans un log, une URL ou une capture. Utiliser le corps JSON de la requête RPC. Ni `p_employee_id` ni `p_enterprise_id` ne sont acceptés : le serveur résout ces valeurs depuis la session.

Succès : `{ "ok": true, "expire_le": "…", "employee": { … } }`.
Voir [exemple entièrement fictif](contracts/pointage-profile-v1.example.json).

Liste exacte des champs du profil : `id`, `enterprise_id`, `matricule`, `first_name`, `last_name`, `photo_url`, `is_active`, `department`, `position`, `employee_schedules`.

Horaires : toujours une **liste** ; aucun horaire autorisé → `[]`. L’alias `work_schedule_id` correspond à la vraie colonne `employee_schedules.schedule_id`, conformément à l’exemple de la PR Pointage #13. Les champs de la réponse sont explicitement construits, sans `to_jsonb(*)`. `work_days` et `custom_work_days` sont des tableaux d’entiers tels que stockés ; aucun faux `day_of_week` n’est inventé.

Seuls les liens et horaires actifs, de la même entreprise que l’employé, sont renvoyés. Ordre : mise à jour du lien décroissante, puis création décroissante, puis ID. La fonction restitue les horaires attribués ; elle ne remplace pas le moteur de calcul de la journée ni celui des pauses. Si plusieurs attributions actives se chevauchent, la recette des horaires reste nécessaire. Aucun horaire par défaut n’est inventé si la liste est vide.

Refus métier : `{ "ok": false, "raison": "…" }`, sans objet employee :

| raison | Action côté client |
|---|---|
| jeton_invalide | Reconnexion ; aucun profil inventé ni lecture directe de secours |
| reauthentification_requise | Reconnexion PIN/QR : jeton antérieur au nouveau seuil de confiance |
| jeton_expire | Reconnexion ; ne pas continuer à présenter le profil comme une session valide |
| jeton_revoque | Purger la session et bloquer son usage |
| employe_inactif | Arrêter la session et afficher le refus |
| entreprise_inactive | Arrêter la session et afficher le refus |

Les erreurs réseau, SQL ou fonction absente restent des erreurs techniques : ne pas les transformer en `ok=true` ou en liste vide.

## 2. Date limite et seuil de confiance

L’ancien émetteur `encheck_session_ouvrir(uuid,uuid,text)` était directement exécutable par les clients sans vérification PIN/QR. Son accès PUBLIC/anon/authenticated a été retiré. Le propriétaire et service_role conservent leur accès ; les deux connexions PIN/QR sont SECURITY DEFINER sous le même propriétaire et conservent leurs appels internes. Leurs signatures, corps et privilèges n’ont pas été changés.

Pour ne pas accepter dans le nouveau profil des jetons qui auraient été créés par cette ancienne porte, la migration enregistre un seuil privé et permanent. Les sessions créées avant ce seuil nécessitent une reconnexion **pour cette nouvelle RPC**. Rejouer la migration ne déplace pas ce seuil.

`expire_le` de la réponse = minimum de l’expiration stockée et de `cree_le + 12 heures`. Cette lecture ne renouvelle ni ne modifie la session. C’est une limite prudente propre au nouveau profil, à valider pour les équipes de nuit.

**Important :** les anciens émetteurs/pointages utilisent encore une durée de 30 jours et certains la prolongent. Nous n’avons ni révoqué toutes les sessions ni changé cette logique globale, pour éviter une coupure non coordonnée. La limite de 12 heures n’est donc PAS encore une politique uniforme de tout le système. Les anciens jetons restent à traiter lors de la bascule coordonnée des autres RPC ; ne pas déclarer l’ensemble du parc sécurisé sur la seule base de ce nouveau profil.

## 3. Catalogue public

```dart
final result = await client.rpc('encheck_entreprises_publiques');
// Vérifier result['ok'], puis utiliser result['entreprises'].
```

Réponse : `{ "ok": true, "entreprises": [ … ] }`. La liste vide constitue ici un résultat valide si aucune entreprise n’est active. Chaque objet contient exactement :

```json
{
  "id": "22222222-2222-4222-8222-222222222222",
  "name": "Entreprise de démonstration",
  "logo_url": null,
  "matricule_prefix": "DEMO",
  "pointage_mode": "face_required"
}
```

`pointage_mode` vient de `face_recognition_config`, pas d’une colonne inexistante d’enterprises. Il vaut `null` sans configuration : **ne pas convertir silencieusement null en free**. Afficher une configuration indisponible et suivre le contrat d’autorisation serveur. Les trois valeurs stockées sont `free`, `face_required`, `face_exclusive`.

Pas de code entreprise, coordonnées, licence, modules internes, départements, zones ou paramètres biométriques. Les anciens accès directs à enterprises n’ont pas encore été révoqués : intégrer et valider le catalogue avant cette fermeture. Ce catalogue est un contrat d’affichage, pas une preuve d’autorisation de pointage.

## 4. Vérifications et limites

- Suite locale complète : **940 tests / 99 fichiers PASS**.
- Sept tests SQL dédiés sur PGlite : idempotence/seuil stable, droits de l’émetteur, contexte propriétaire conservé, catalogue minimal/entreprises inactives, profil du seul titulaire, absence de secrets, isolement des horaires, expiration/révocation/seuil ancien/12h, employé/entreprise inactifs, incohérence d’appartenance, absence de renouvellement, tables de session et seuil privés.
- Post-contrôle réel des privilèges : deux nouvelles RPC autorisées ; émetteur interne refusé à anon/authenticated ; connexions PIN/QR toujours autorisées.
- Vérification SQL sous rôle anon en production : jeton NULL refusé et enveloppe/liste blanche du catalogue valides. Aucun nom d’entreprise ni fiche employé retourné dans le résultat de ce contrôle.
- Aucun vrai jeton utilisé ; aucun compte ni session réelle modifié pour tester. Le chemin positif est testé sur fixtures, **pas encore sur une connexion PIN/QR réelle via HTTP/Flutter**.
- L’API de migration renvoie `version:null` : rapprocher l’historique avant déploiement CLI. Ne pas rejouer aveuglément les anciens scripts d’accès.

## 5. Intégration et reste du chantier

Feu vert pour intégrer et tester ces deux signatures, en traitant `reauthentification_requise` et le plafond de 12h. Pas de feu vert pour la bascule globale sans recette.

Restent : recette PIN/QR avec une session neuve, tests HTTP et affichage des horaires ; autorisation de borne et synchronisation collective ; biométrie v2 ; service de photos privées ; alignement des autres RPC sur les jetons ; purge/révocation coordonnée des anciennes sessions ; anti-abus et limites de requêtes ; recette ADMS. Aucun jeton de borne n’est délivré par cette tranche et aucune photo publique n’a été rendue privée brutalement.
