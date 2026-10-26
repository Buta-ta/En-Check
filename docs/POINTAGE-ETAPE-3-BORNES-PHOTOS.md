# Étape 3 — contrats bornes, visages et photos

État au 26 octobre 2026. L'étape 2 Admin (PR145) et Pointage (PR14) est fusionnée.
Le dépôt Pointage reste sous la responsabilité de son équipe : aucune modification
faite ici dans ce dépôt tiers. Pas de redesign Admin ; un volet fonctionnel replié
est ajouté sous les rôles pour les superadministrateurs.

## Déploiement et limites réelles

- Migrations 016/017 exécutées sur `cxggndvhwdolbtyezjde`, noms historiques
  `pointage_bornes_biometrics` / `pointage_photo_tickets`, retour API `version:null`.
  Rapprocher cet historique avant tout replay CLI ; ne pas rejouer toute la chaîne.
- Edge `pointage-enrollment-photo` déployée, version 1 ACTIVE. Source déployée
  regroupée en un fichier (limite du connecteur), équivalente à index/handler/codec.
  `verify_jwt=false` est intentionnel : jeton applicatif validé par RPC015,
  pas un JWT Supabase Auth. Aucune clé service_role dans le client.
- Post-check live : tables privées, helper inaccessible à anon, administration
  inaccessible à anon ; appels sans jeton refusés. **Zéro borne créée.**
- **Aucun superadmin actif avec facteur MFA vérifié** au préflight. La fonction
  générale `encheck_account_security_status()` est absente. Le socle MFA Admin
  doit être activé/validé, puis le titulaire doit lui-même enrôler son facteur,
  avant de provisionner une vraie borne. Ne pas abaisser le contrôle AAL2.
  Ce lot ne prétend pas avoir activé les anciennes migrations Admin 001–010.
- Bucket `face-enrollments` privé (`public=false`) mais policies permissives
  SELECT/INSERT/DELETE encore larges : **confidentialité globale non acquise**.
  Nouvelle voie contrôlée livrée ; anciens accès NON fermés pour éviter la coupure.
- Pas d'invocation HTTP réelle avec une photo ni de recette tablette réalisée par
  l'agent. ACTIVE + tests locaux ne constituent pas une preuve de bout en bout.
- Anciennes RPC conservées. Aucun changement ADMS, aucune activation aveugle de010.

## 1. Autorisation de borne : administration uniquement

RPC appelées avec la session Supabase Auth du superadmin, JWT `aal2`, compte actif
lié sans ambiguïté à son UID, session Auth encore présente/non expirée.
Si le guard Admin général existe, il doit être actif et ne pas restreindre le rôle.
Une installation partielle des révocations sans guard général est refusée.

| RPC | Paramètres |
|---|---|
| `encheck_borne_creer` | `p_device_id`, `p_enterprise_id`, `p_expire_le`, `p_motif` |
| `encheck_bornes_lister` | aucun |
| `encheck_borne_secret_renouveler` | `p_borne_id`, `p_motif` |
| `encheck_borne_revoquer` | `p_borne_id`, `p_motif` |

Identifiant appareil unique 1–128 caractères ; motif 5–500 ; autorisation future,
maximum 90 jours. Création : `{ok,borne_id,device_id,secret,expire_le}`. Rotation :
`{ok,borne_id,secret,expire_le}`. Secret `bs1_…` présenté une seule fois ; seul son
SHA256 est conservé. Ne jamais le mettre dans les logs, le motif, une capture ou
un stockage web persistant. Volet Admin : effacement après deux minutes, masquage
à la fermeture/onglet masqué, contrôle explicite MFA avant chaque intervention.
Le catalogue n'inclut ni hash ni secret. Les interventions ont un audit privé.

Rotation invalide les sessions actuelles. Révocation définitive ; pas de RPC de
réactivation. L'identifiant reste réservé, même révoqué : utiliser un nouvel
identifiant pour une nouvelle autorisation, sans réutilisation implicite.

## 2. Authentification et snapshot borne

```js
rpc('encheck_borne_authentifier', {
  p_device_id: deviceId,
  p_secret: secretProvisionne
})
// {ok:true, jeton_borne:'bk1_…', enterprise_id, expire_le}
```

La borne ne choisit pas son entreprise. Bail au plus 24h, limité par l'autorisation.
Une nouvelle authentification invalide les anciennes sessions de cette borne.
Refus générique secret/appareil inconnu ; après secret valide : appareil révoqué,
expiré, entreprise inactive. Le secret matériel reste nécessaire pour renouveler
un bail : coffre sécurisé de l'OS, jamais préférences ordinaires ou logs.

```js
rpc('encheck_borne_personnel', {
  p_jeton_borne: jetonBorne,
  p_maj_depuis: null
})
// {ok:true, mode:'snapshot_complet', enterprise_id,
//  employes:[...], embeddings:[...], maj, cache_expire_le}
```

`p_maj_depuis` est accepté mais volontairement ignoré. **Remplacer tout le cache**
après succès, ne pas fusionner : sorties d'effectif, révocations et suppressions
ne doivent pas rester en mémoire. Maximum 1000 employés actifs / 2000 enrôlements
approuvés actifs ; au-delà, refus `volume_non_pris_en_charge`, jamais troncature.

Employés : whitelist015 (id, enterprise_id, matricule, first_name, last_name,
photo_url, is_active, department, position, employee_schedules). Horaires actifs,
source entreprise identique, `schedule_id` exposé sous `work_schedule_id`.
Ni coordonnées privées ni rémunération. Pas de calcul du jour/nuit fait ici.
Compter les embeddings par employee_id si un compteur d'enrôlements est nécessaire.
`maj` est la date du snapshot, pas une version individuelle ni un curseur de delta.

**Offline** : effacer/ne plus exploiter le cache après cache_expire_le, changement
d'entreprise/appareil, sortie du mode borne ou refus explicite du serveur. L'horloge
locale et son recul doivent être traités par l'application (date serveur/horloge
monotone). Une révocation serveur ne peut effacer immédiatement une tablette coupée
du réseau. Consentement, chiffrement local et politique de conservation à valider.

Le jeton borne **ne permet pas de pointer comme un salarié**. Le raccordement d'un
pointage reconnu au bon salarié et la résistance au rejeu restent à recetter ; ne
jamais fabriquer un jeton personnel à partir du snapshot.

## 3. Lecture des visages v2

```js
rpc('encheck_visage_lister_v2', {p_jeton: jeton, p_portee: 'personne'})
// ou p_portee:'borne' avec le jeton bk1_…
// {ok:true, portee, enterprise_id, employee_id, expire_le, enrolements:[...]}
```

- Personne : profil015, son titulaire seulement ; ses statuts propres sont visibles,
  mais embedding seulement si `approved` ET actif.
- Borne : même entreprise, employés actifs, enrôlements approuvés actifs seulement.
- Champs : id, employee_id, enterprise_id, status, is_active, created_at, updated_at,
  first_name, last_name, matricule, photo_url ; face_embedding selon règle ci-dessus.
- Aucun `enrollment_photo_url` dans ce résultat. `photo_url` est la photo de profil,
  distincte du périmètre de protection des photos d'enrôlement de ce lot.
- Refus `{ok:false,raison}` : ne pas revenir à l'ancienne RPC ou aux tables directes.
- Le plafond 12h vient de015 pour une session personnelle ; le bail borne est24h.
  Cela ne raccourcit pas magiquement la durée des anciennes RPC non migrées.

## 4. Photo d'enrôlement par Edge

Endpoint : `/functions/v1/pointage-enrollment-photo`, POST JSON ; API key publique
habituelle, **pas de clé serveur**, `p_jeton` personnel dans le corps. Pas de cookie.

```json
{"action":"upload","p_jeton":"JETON_PERSONNEL","jpeg_base64":"BASE64_SANS_PREFIXE_DATA"}
```

Retour : `{ok:true,photo_reference,photo_path}`. Stocker **photo_reference** dans
`enrollment_photo_url` via la RPC d'enrôlement existante ; ne stocker ni URL signée
ni URL publique. La référence `/object/authenticated/face-enrollments/...` n'est
pas une URL de téléchargement public. Ne plus faire uploadBinary/getPublicUrl.
Le client n'impose ni employee_id, ni enterprise_id, ni chemin de fichier.

Corps ≤3MiB, JPEG brut ≤2MiB, image décodée ≤8MP et limite mémoire du codec64MiB.
Réencodage pixels qualité85 sans EXIF/commentaires. Refus si bucket devenu public.
Dix réservations/heure/employé, sérialisées par verrou ; un essai échoué après
réservation consomme le quota. La RPC de tickets seule ne donne aucun accès Storage.
Les tickets anciens sont purgés après7j lors d'une nouvelle réservation ; **aucune
purge automatique de fichiers orphelins ni expiration des photos n'est implémentée**.
Upload et enregistrement de l'enrôlement ne sont pas une transaction unique.

```json
{"action":"read","p_jeton":"JETON_PERSONNEL","enrollment_id":"UUID_ENROLEMENT"}
```

Retour : `{ok:true,url,expire_dans:300}`. Signer uniquement une photo de l'enrôlement
du titulaire, même entreprise ; chemin du titulaire et origine Supabase contrôlés.
Anciennes références public/authenticated .jpg acceptées, pas d'URL arbitraire.
L'URL signée est un bearer valable5min : ne pas partager, journaliser, persister.
Ne pas envoyer de jeton borne sur cette voie personnelle.

HTTP400 format/image,403 accès/jeton,429 quota_photo,503 indisponibilité ou envoi
non confirmé. En503 upload, ne pas affirmer l'enregistrement ni boucler les retries.
`Cache-Control:no-store`. Aucune journalisation des secrets dans le handler.

Admin conserve `PhotoSignee` et sa signature habituelle (3600s), déjà compatible
avec les références authenticated. La nouvelle durée300s concerne le broker
personnel, pas toutes les images du produit. Tester photos historiques ET nouvelles.

## 5. Fermeture coordonnée — NON APPLIQUÉE

Script `supabase/outils-sql/20261026_fermer_acces_direct_photos_enrolement.sql` :
policies RESTRICTIVE, donc les anciennes policies larges ne les contournent pas.
- SELECT anon refusé ; Auth seulement admin/manager actif dans son entreprise ou
  superadmin, UID unique + session Auth valide, guard général respecté s'il existe.
- INSERT/UPDATE/DELETE directs anon/auth refusés pour ce bucket ; service_role reste
  la voie interne. Les autres buckets, notamment attendance-photos, sont inchangés.
- Le script est transactionnel/réexécutable et testé sur base isolée avec policies
  permissives préexistantes. **Ne pas le déplacer dans migrations sans feu vert.**

Ordre de bascule :
1. Pointage confirme intégration v2 + photo Edge, sans fallback direct.
2. Socle Admin/MFA opérationnel, facteur enrôlé par le titulaire, vraie borne autorisée.
3. Recette croisée : personnel PIN/QR, entre entreprises, statuts pending/rejected,
   départ d'employé, rotation/révocation, expiration/reconnexion, offline et horloge,
   horaires/jour/nuit, Admin lecture photos anciennes/nouvelles, ADMS non régressé.
4. Exécuter la fermeture Storage après accord commun ; vérifier anon interdit,
   owner Edge autorisé, autre employé interdit, Admin légitime autorisé.
5. Auditer/fermer séparément anciennes RPC visage/direct tables ; aligner TTL et
   sessions anciennes sans révoquer massivement ni casser ADMS.

Ne pas annoncer « photos entièrement privées » ou « bascule terminée » avant4/5.
Une éventuelle marche arrière doit être explicitement coordonnée ; ne jamais
rouvrir automatiquement les accès publics après une erreur applicative.

## Vérifications reproductibles

- Vitest : pointageBorneSql, pointagePhotoBroker, adminBornesUi, faceStorageClosureSql.
- `bash scripts/test-pointage-photo-codec.sh` : Deno check +2 vrais tests codec JPEG
  (EXIF supprimé, image malformée/refus de résolution excessive).
- CI : tests existants, gate ESLint, build, tests Edge IA et nouveau contrôle Deno.
- Tests SQL isolés ≠ Auth MFA native ni tablette. Aucun vrai compte modifié pour test.

Résultats locaux de ce lot : 988 tests Vitest /104 fichiers PASS ;55 tests Edge IA
PASS ;2 tests Deno JPEG PASS + type-check PASS ; build PASS ; gate ESLint0 erreur,
1 avertissement préexistant. Le lint intégral historique reste rouge (276 erreurs,
70 avertissements) ; il n'est pas la porte CI et n'a pas été masqué/modifié ici.
Les11 corps de fonctions016/017 déployés ont été comparés aux fichiers locaux
(hash normalisé hors espaces/commentaires) : concordance exacte.
