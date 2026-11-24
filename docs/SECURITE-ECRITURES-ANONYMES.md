# Sécurité — les écritures anonymes sur les pauses

> Mesuré sur la production `cxggndvhwdolbtyezjde` le 23/11/2026. Chaque
> affirmation ci-dessous a été exécutée, pas déduite. Les essais d'écriture
> ont été faits sous `BEGIN … ROLLBACK` ou sur un compte `RECETTE`.

## 1. Ce qui est ouvert, exactement

L'application tablette parle à Supabase avec la **clé anonyme**, qui est
publique par construction : elle est dans le bundle JavaScript livré au
navigateur (`VITE_SUPABASE_ANON_KEY`, `src/lib/supabase.js`). « Anonyme » ne
veut donc pas dire « la tablette de l'entreprise » : cela veut dire
**n'importe qui sur Internet**.

Trois fonctions sont exécutables par ce rôle et prennent l'identité de
l'employé en paramètre, sans rien vérifier :

| Fonction | Paramètres | Ce qu'un anonyme obtient |
|---|---|---|
| `encheck_pause_fermer` | `uuid, timestamptz, text` | fermer la pause ouverte de n'importe qui, à l'heure de son choix |
| `encheck_pause_ouvrir` | `uuid, timestamptz, text` | ouvrir une pause antidatée pour n'importe qui |
| `encheck_pauses_en_cours` | `uuid` (entreprise) | **14 employés, 3 entreprises**, avec prénom, nom et matricule |

Les deux fonctions ont maintenant un remplacement par jeton (voir §4) : leur révocation ne supprime plus aucune fonctionnalité, une fois l'app basculée.

`encheck_pauses_en_cours` suffit à obtenir les identifiants employés que les
deux autres attendent : la chaîne est complète. Le contrôle de l'exécution
est fait en `SET LOCAL ROLE anon`.

Pourquoi « fermer à l'heure choisie » n'est pas anodin : `duree_minutes` et
`anomalie` sont recalculés depuis `p_fin`, et `encheck_pauses_duree_reelle`
retient ensuite cette valeur. **Une durée de pause est une donnée de paie.**

## 2. Ce qui protège encore, et ce qui ne protège pas

**La table** est correctement protégée. RLS est actif sur `encheck_pauses`,
et ce sont les politiques qui font le travail, pas les GRANT :

- `SET LOCAL ROLE anon; SELECT count(*) FROM encheck_pauses` → **0** ;
- `SET LOCAL ROLE anon; UPDATE …` → **0 ligne**.

Les GRANT `anon` sur la table (SELECT, UPDATE, TRUNCATE…) sont la posture par
défaut de Supabase, qui accorde tout à `anon`/`authenticated` sur toute table
du schéma `public`. Sans politique, cela ne donne accès à rien. **Le problème
n'est donc pas la table, ce sont les fonctions `SECURITY DEFINER`**, qui
s'exécutent avec les droits du propriétaire et ignorent RLS.

**Ce qui a déjà été corrigé** : `encheck_pauses_lire` (lecture admin,
17 colonnes) n'est pas exécutable par `anon`. C'est la décision de sécurité
du fondateur, et elle tient : vérifié sur `proacl`.

## 3. La part de ma responsabilité

La faille de `encheck_pause_ouvrir` est préexistante : je ne l'ai pas créée.
En revanche, le 22/11, j'ai ajouté `motif_fermeture` à `encheck_pause_fermer`
sans revoir ses droits — et j'ai **explicitement écarté** la question dans mon
rapport : « même signature, mêmes droits, pas de changement de sécurité ».
C'était vrai du changement de signature, et faux du contexte : cette fonction
permettait déjà à un anonyme de réécrire une durée de paie. Je ne l'ai pas
cherché.

Le fondateur avait pourtant posé la bonne question — « ne jamais ouvrir
`encheck_pauses_lire` aux anonymes ». J'y ai répondu séparément, sans regarder
les fonctions voisines, qui avaient exactement le même défaut.

**Deux dégâts réels, et leur réparation** (23/11, vérifiés) :

1. mes tests du 22/11 ont fermé une pause ouverte depuis le 17/11 sur
   **Hippo BIYOKILA** (`ENN-0002`, 150 pointages) à 7 666 minutes. Constaté :
   `encheck_pauses_duree_reelle` renvoyait `7666` et `encheck_temps_travaille`
   `4,91` h pour le 17/11. **Réparé** : `fin`, `duree_minutes`, `anomalie`,
   `statut` et `motif_fermeture` remis à leur état d'origine ; la pause est de
   nouveau ouverte, et la journée retombe sur `presumee`, 60 min.
2. mes tests ont créé le 22/11 à 23:29 une pause de **0 minute**, datée du
   23/11, sur le même employé. **Supprimée** (identifiant et horodatage
   vérifiés avant suppression).

État contrôlé après réparation : **0 pause porte un motif** (comme avant mes
tests), **27 pauses** au total. Aucune alerte n'avait été créée sur ces deux
lignes — vérifié, `encheck_alertes` ne contient rien pour Hippo depuis le 22/11.

Ces tests étaient mal conçus : ils appelaient la vraie fonction de fermeture
sur un vrai employé, au lieu d'un compte de recette. C'est corrigé côté
méthode : tout essai d'écriture passe désormais par `RECETTE`, et la preuve
d'écriture se fait sous `ROLLBACK`.

## 4. Le chemin sûr, disponible maintenant

`encheck_ma_pause_fermer(p_jeton, p_fin, p_motif)` — appliquée en production
le 23/11, donc vivante.

L'app envoie le jeton de session qu'elle possède déjà ; le serveur en déduit
l'employé. **L'employé n'est plus un paramètre.** Testé :

- jeton inventé → `42501 Session employé invalide ou expirée.` ;
- jeton valide d'un compte `RECETTE` sans pause ouverte →
  `{"ok": false, "erreur": "aucune pause ouverte"}` : la session a donc bien
  désigné l'employé.

Elle délègue à `encheck_pause_fermer` : une seule définition de « fermer une
pause », donc une seule règle.

**`encheck_ma_pause_ouvrir(p_jeton, p_debut, p_motif)`** — appliquée le 25/11.
Manquait dans la première version de ce document, qui demandait pourtant de
révoquer `encheck_pause_ouvrir` : la révocation aurait cassé « Je pars en
pause ». C'est l'App Pointage qui l'a relevé, à raison. Même modèle que la
fermeture ; testée : jeton inventé → `42501`.

**`encheck_pauses_bandeau(p_enterprise)`** — appliquée le 25/11. Remplace
`encheck_pauses_en_cours` pour le bandeau de la borne partagée, avec la sortie
réduite décidée par le fondateur : `affichage` (« Hippo B. »), `debut`,
`motif`, `duree_minutes`. **Ni identifiant, ni matricule, ni nom complet** —
contrôle sur `information_schema.parameters`. Mesuré sous `SET LOCAL ROLE
anon` : renvoie « Hippo B. » sans erreur de droits.

Elle **n'ajoute pas** `prevue_minutes` au SQL, contrairement au contrat
proposé : l'app affiche déjà ses lignes figées, et `encheck_pause_prevue` est
`STABLE SECURITY DEFINER` — l'appeler une fois par ligne ouverte multiplierait
les exécutions sur un écran qui se rafraîchit. À ajouter si l'app en a
réellement besoin.

## 5. La bascule — à faire dans cet ordre

Cette séquence **n'est pas appliquée**. L'appliquer maintenant casserait le
pointage : l'app actuelle n'a pas d'autre chemin que la fonction ouverte.

1. **Côté app Pointage** — remplacer l'appel de fermeture par
   `encheck_ma_pause_fermer(<jeton>, <fin>, <motif>)`, et l'ouverture par
   `encheck_ma_pause_ouvrir(<jeton>, <debut>, <motif>)`. Le jeton est déjà
   disponible (`enregistrerJeton`) ; l'App Pointage a confirmé qu'il est lu
   au moment de l'appel, y compris pendant une pause.
2. **Publier un APK** et vérifier sur une tablette réelle qu'une pause se
   ferme normalement. C'est la seule preuve acceptable.
3. **Seulement ensuite**, appliquer la révocation :

```sql
--  Ne PAS exécuter avant l'étape 2, ni avant que l'app soit passée aux
--  DEUX fonctions par jeton (fermeture ET ouverture).
BEGIN;
REVOKE EXECUTE ON FUNCTION public.encheck_pause_fermer(uuid, timestamptz, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.encheck_pause_ouvrir(uuid, timestamptz, text) FROM anon;
COMMIT;

--  ⛔ POINT D'ARRÊT — ne pas inclure dans la transaction ci-dessus.
--  Cette ligne n'est possible qu'une fois le bandeau de l'app basculé sur
--  `encheck_pauses_bandeau`, et la tablette vérifiée. Sinon le bandeau de
--  la borne disparaît.
REVOKE EXECUTE ON FUNCTION public.encheck_pauses_en_cours(uuid) FROM anon;
```

Les deux premières coupent l'écriture ; la troisième coupe la fuite de
prénoms, de noms et de matricules. Elle est séparée volontairement : c'est la
seule qui **retire** une fonctionnalité visible, et elle dépend d'un
déploiement d'app.

4. **Après la révocation**, vérifier que RLS et les politiques tiennent seuls,
   puis retirer les GRANT trop larges de la table si l'on veut aller au bout.

## 5 bis. Incident du 26/11 — j'ai rouvert `anon` sur `encheck_pauses_lire`

Je dois le consigner, parce que c'est la deuxième fois que je touche à cette
fonction et la première fois que je la rouvre.

En ajoutant `motif_fermeture` à `encheck_pauses_lire`, j'ai fait
`DROP` puis `CREATE`, puis `GRANT EXECUTE ... TO authenticated, service_role`.
**Un `GRANT` ne retire pas un droit existant.** La fonction recréée héritait
du `GRANT` par défaut de PostgreSQL à `PUBLIC`, et `anon` l'a de nouveau
obtenu. Mesuré juste après :

```
acl = {=X/postgres | postgres=X/postgres | anon=X/postgres | authenticated=X/postgres | ...}
```

**Ce qui m'a rattrapé** : l'App Pointage venait d'écrire « `anon` = faux sur
cette fonction, votre règle d'or tient toujours ». J'ai vérifié au lieu de
croire mon `GRANT`, et la mesure a contredit l'attendu.

Deuxième problème dans la même migration : la garde d'origine s'appelait
`IF v_email IS NOT NULL THEN ...`. Sans JWT — appel direct avec la clé
publique — **elle ne s'appliquait pas du tout** et la fonction renvoyait les
pauses de toute l'entreprise. La nouvelle version refuse d'emblée.

Corrigé le même jour : `REVOKE ALL ... FROM PUBLIC, anon` avant le `GRANT`,
garde basée sur `auth.uid()` avec repli sur l'e-mail, et un test qui échoue si
quelqu'un réintroduit un `REVOKE` sans `anon` (vérifié par mutation).

Ce que je retiens : **après tout `DROP`/`CREATE`, relire `proacl`.** Le
`GRANT` qu'on écrit ne décrit pas l'état final, il s'ajoute à ce qui existe.

## 6. Ce que je ne peux pas garantir

- Je n'ai pas vu le code de l'app Pointage ; je sais seulement qu'elle appelle
  `encheck_pause_fermer` (son défaut `p_motif` explique les pauses sans motif)
  et `encheck_pause_ouvrir`. La séquence ci-dessus suppose qu'elle peut
  passer le jeton — il faudrait qu'elle le fasse au moment de la fermeture.
- La révocation n'a pas été testée en production : je ne peux pas prouver
  qu'elle ne cassera rien, seulement qu'elle cassera si l'app n'a pas basculé.
- Aucune CI n'applique les migrations : ce document corrige par des
  procédures ce que le dépôt ne garantit pas.
