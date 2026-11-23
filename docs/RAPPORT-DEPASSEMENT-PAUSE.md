# DÉPASSEMENT DE PAUSE — ce qui est fait, ce qui reste

**Pour : l'équipe App Pointage**
**Par :** agent côté admin
**Date :** 22/11/2026
**Référence :** PR #287, migration `20261122000001_depassement_pause_trois_signaux.sql`

---

## 1. La demande d'origine, et ce qu'elle est devenue

Le fondateur a demandé de régler **le seuil de tolérance de dépassement de pause au dépointage**, par entreprise, à 15 minutes, avec la trace de qui touche au seuil.

En creusant, la demande a révélé un trou plus large : **le seuil était réglable, traçable, visible à l'écran — et sans aucun effet.** La clé `pause_tolerance_minutes` n'était lue par aucun moteur. Un administrateur pouvait régler 30 minutes, la base l'enregistrait, et rien ne changeait nulle part.

Ce rapport couvre le lot qui **branche la règle** et livre les trois signaux choisis (A + B + C).

---

## 2. La mesure exacte

Une pause est jugée **dépassée** quand :

```
durée réelle − créneau prévu de la grille > tolérance de l'entreprise
```

Trois points à ne pas confondre :

| Ce n'est pas | C'est |
|---|---|
| une durée absolue | un **écart** au créneau de la grille |
| `>=` la tolérance | **strictement** au-delà (`>`) |
| la pause « prévue » réglable | le créneau de `encheck_pause_prevue`, qui vient de la grille horaire de l'employé |

Concrètement, avec une grille de 60 min et une tolérance de 15 :

| Pause | Écart | Verdict |
|---|---|---|
| 45 min | −15 | rien (plus courte que prévu) |
| 70 min | 10 | rien |
| **75 min** | 15 | **rien** — « tolérer 15 min » veut dire que 15 passent |
| **76 min** | 16 | **dépassement** |

Et **sans grille, on ne juge pas**. Pas de créneau = pas de juge. On ne compare pas à un zéro inventé.

---

## 3. Les trois signaux livrés

### A — le badge, dans la liste des pauses (admin)

- valeur stockée : `encheck_pauses.anomalie = 'depassement'` ;
- teinte propre, ambre d'or — **pas** le rouge de `sans_reprise`, qui est une rupture et non un écart. Si le dépassement criait en rouge, l'admin apprendrait à ignorer le rouge ;
- libellé chiffré : « ⏱️ Dépassement · 18 min de plus que les 60 min prévues ».

### B — l'alerte, dans le centre d'alertes

- `type = 'pause_anomalie'`, `gravite = 'attention'`, `titre = 'Pause dépassée'` ;
- détail lisible : *« Pause de 78 min (02:00 → 03:18) pour un créneau de 60 min : 18 min de plus, tolérance 15 min. Employé : Hippo BIYOKILA. »* ;
- **une seule alerte par employé, par jour et par titre** (la déduplication existante de `encheck_alerter`). Deux pauses dépassées le même jour = **une** alerte. C'est une limite assumée, pas un bug.

### C — le chiffre pour l'employé

- `encheck_pauses_lire` remonte désormais `prevue_minutes` et `ecart_minutes` sur chaque ligne ;
- **l'écran employé n'existe pas encore.** L'espace employé n'a aucune page « mes pauses » aujourd'hui. Le chiffre est calculé et lisible ; l'affichage côté employé revient à votre équipe.

---

## 4. Où le jugement se déclenche

| Déclencheur | Quand | Effet |
|---|---|---|
| `encheck_pause_fermer(employee, fin)` | à la reprise, au dépointage | ferme la pause **puis** la juge |
| `encheck_pause_juger(pause)` | appel direct | juge une pause précise |
| `encheck_pauses_juger_lot(entreprise, jours)` | ouverture de la page Pauses | rattrape les pauses fermées avant la règle |
| `encheck_pause_depassement(...)` | — | **calcule seulement**, n'écrit rien |

**Le jugement ne peut jamais bloquer un pointage.** Dans `encheck_pause_fermer` :
1. la pause est fermée et sa durée écrite ;
2. *ensuite* elle est jugée, dans un bloc `BEGIN … EXCEPTION WHEN OTHERS` qui avale l'erreur.

Un employé qui pointe sa reprise ne verra jamais son pointage échouer à cause d'une règle de confort.

---

## 5. Ce que la base vérifie, et ce que j'ai réellement testé

Tout ce qui suit a été exécuté sur la base de production, puis **annulé par `ROLLBACK`**. État final : 27 pauses, 126 alertes — identiques à l'avant.

| Test | Résultat |
|---|---|
| 45 / 70 / 75 min | aucun signal |
| 76 min | badge + alerte |
| pause écartée | non rejugée |
| pause en cours (`fin IS NULL`) | non jugée |
| pause inconnue / `NULL` | refusée proprement |
| trois passages sur la même pause | **une seule** alerte |
| pause de 150 min sur créneau 60 | badge posé, pas de doublon d'alerte |
| `encheck_pauses_lire` sur une pause marquée | `prevue 60 / ecart 18` |
| rattrapage sur 30 jours (EN-NOUS) | 14 examinées, 0 dépassement |
| `anon` sur les nouvelles fonctions | aucun droit |

**19 tests automatisés** ajoutés (`depassementPause.test.js`). Suite entière : **2 091 tests, aucun échec**.

---

## 6. Deux pièges rencontrés, à connaître

### ① La contrainte `CHECK` refusait la nouvelle valeur

`encheck_pauses_anomalie_chk` n'acceptait que `sans_reprise` et `trop_longue`. Écrire `depassement` échouait en **23514**, et **la pause ne pouvait plus être fermée** — un employé se serait retrouvé bloqué à la reprise.

Trouvé au premier essai réel, jamais en production. La contrainte est **élargie** (pas remplacée) : les deux anciennes valeurs restent valides.

### ② `CREATE OR REPLACE` refuse de changer un type de retour

Ajouter deux colonnes à `encheck_pauses_lire` imposait un `DROP` + `CREATE`. Piège : un `DROP` sans `GRANT` remet la fonction avec les droits par défaut → **l'écran des pauses se vide en silence**, sans erreur. Le `DROP` et le `GRANT` sont dans la même transaction.

---

## 7. Ce qui reste — pour vous

### 7.1 L'écran employé (C, la moitié visible)

Le chiffre existe (`prevue_minutes`, `ecart_minutes`), le badge n'est affiché que côté admin.
**À faire :** une vue « mes pauses » dans l'espace employé, en lecture seule.

⚠️ Contrainte mesurée : `encheck_pauses_lire` est réservé aux admins (`authenticated`, et elle vérifie l'appartenance). L'app tablette tourne en `anon`. **Ne réutilisez pas cette RPC telle quelle** : il faut une lecture par employé authentifié, pas une ouverture aux anonymes.

### 7.2 Le déclencheur sur le dépointage

Aujourd'hui, le jugement passe par `encheck_pause_fermer`. Si l'app de pointage ferme les pauses **autrement** (écriture directe dans `encheck_pauses`), le jugement ne passe pas.

**À vérifier de votre côté :** est-ce que l'app appelle bien `encheck_pause_fermer` ? Aucun écran du dépôt ne l'appelle aujourd'hui. Si elle écrit en direct, il faut soit appeler la RPC, soit ajouter un déclencheur — et un déclencheur sur une table sensible est une décision, pas un détail.

### 7.3 Le dépointage *pendant* la pause

Le fondateur parlait de « dépointage en pleine pause ». Aujourd'hui :
- une pause **ouverte** n'est jamais jugée (pas de durée) ;
- le dépassement n'est constaté qu'à la fermeture.

Si le dépointage doit **fermer** la pause, c'est un choix produit à trancher avec lui : est-ce que pointer sa sortie referme la pause automatiquement, ou est-ce que la pause reste ouverte et devient « sans reprise » ?

### 7.4 Les 120 minutes

`pause_duree_max_minutes` (120) reste jugé **en durée absolue** par `encheck_pauses_controler`, séparément. Les deux règles coexistent et ne s'écrasent pas : `trop_longue` l'emporte sur `depassement` quand les deux s'appliquent.

Le texte de l'écran de réglage mérite une relecture : il dit aujourd'hui « au-delà, la pause est marquée très longue », ce qui est exact, mais ne dit pas que la tolérance, elle, se mesure **au créneau**. Un utilisateur peut confondre les deux. **À reformuler avec le fondateur.**

---

## 8. État du dépôt

- **PR #287** — CI verte, non fusionnée.
- **Migration appliquée en production** `cxggndvhwdolbtyezjde`.
- **Un trou structurel, signalé deux fois déjà :** aucune CI n'applique les migrations. Les fichiers `supabase/migrations/*.sql` du dépôt **ne partent jamais en base**. C'est la cause de la panne du 21/11. Tant que ce n'est pas réglé, chaque migration fusionnée est une migration **non appliquée** qui ressemble à une migration appliquée.

---

## 9. Sur la confiance à accorder à ce rapport

Trois choses que j'ai dites et qui étaient fausses, corrigées en route :

1. j'ai annoncé que les index uniques manquaient — **ils existaient** ;
2. j'ai cru qu'un de mes tests avait écrit une ligne en base — c'était une ligne du 16/10 ;
3. j'ai cru que le rattrapage ne trouvait rien — je regardais la **mauvaise entreprise**.

Tout ce qui est affirmé ici a été mesuré en base ou par un test qui échoue quand on casse la règle. Ce qui n'a pas été vérifié est signalé comme tel — notamment **le rendu visuel**, que je n'ai pas pu voir (pas de navigateur dans mon environnement).

---

## 10. Errata — retour du 22/11 et suite

### 10.1 Ce que le §7.4 disait de faux

Le §7.4 affirmait qu'**aucune** des deux règles ne s'applique sans grille. C'est faux pour le plafond.

Mesuré en base (`BEGIN/ROLLBACK`, aucune écriture) : Reine `bd42d04c…`, Pharmacie Blanche Gomes `ff74f1bd…`, **sans grille horaire**, pause de 150 minutes → `trop_longue`. Le plafond de 120 minutes est une durée absolue ; la grille ne lui sert à rien. La tolérance, elle, compare un créneau : sans grille, elle n'a rien à comparer.

Les deux textes de l'écran disent maintenant exactement cela, et un test échoue si la phrase fausse revient (`src/services/__tests__/seuilsPause.test.js`, mutation vérifiée).

### 10.2 Les deux ajouts serveur

Appliqués en production le 22/11, versionnés dans `supabase/migrations/20261123000001_contrat_serveur_app_pointage.sql`.

| Ajout | Ce qu'il fait | Ce qu'il refuse |
|---|---|---|
| `encheck_pauses_mes_pauses(p_jeton, p_du, p_au)` | lit les pauses de **la personne qui détient la session** ; 30 jours par défaut ; remonte prévue, écart, tolérance et créneau pour que l'écran explique | un jeton absent, vide ou expiré → `42501` |
| `motif_fermeture` + `encheck_pause_fermer(uuid, timestamptz, text)` | dit **pourquoi** la pause s'est fermée : `reprise` ou `sortie` | un motif inconnu ne bloque pas la fermeture, il retombe sur `reprise` |

Deux décisions que je défends :

1. **Pas de `p_employee`.** La demande initiale le proposait. Un identifiant employé n'est pas un secret et circule sur la tablette : avec lui, n'importe qui lit les pauses d'un collègue. La session existait déjà, elle prouve quelque chose.
2. **L'ancienne signature à 2 paramètres est supprimée, pas laissée en place.** Mesuré : deux `encheck_pause_fermer` ont coexisté dans `pg_proc` ; un appel à deux arguments prenait l'ancienne et n'écrivait jamais le motif. Le `DROP` est dans la migration.

`encheck_pauses_lire` **n'est pas** ouverte à `anon` — elle vérifie l'appartenance à l'entreprise, pas l'identité. Un test de contrat échoue si un `GRANT` la concerne.

### 10.3 Ce que l'App Pointage doit câbler

**Lot 1 (dépointage groupé)** — appeler `encheck_pause_fermer(p_employee, now(), 'sortie')` avant de fermer le pointage. Tant que ce n'est pas fait, `motif_fermeture` restera `reprise` par défaut : les données sont justes sur la durée, muettes sur la cause.

**Lot 3 (vue « mes pauses »)** — la RPC est prête et testée en base (14 pauses pour un employé, 0 pour un autre, valeurs de dépassement exactes). Il reste **l'écran**, qui n'existe pas encore côté web : `EmployeeHeures.jsx` ne lit que `attendances`.

### 10.4 Ce qui n'est toujours pas réglé

**Aucune CI n'applique les migrations.** La migration de ce lot a été appliquée à la main. C'est la troisième fois que ce trou est signalé ; il a causé la panne du 21/11. Tant qu'il est là, une migration fusionnée n'est pas une migration appliquée.

### 10.5 Correction — la sécurité de `encheck_pause_fermer`

À la livraison du 22/11, j'avais écarté la question d'une ligne : « même
signature, mêmes droits, pas de changement de sécurité ». Vérification faite
le 23/11, cette phrase est trompeuse. `anon` est le rôle de la **clé publique**,
présente dans le bundle livré au navigateur : toute fonction accordée à `anon`
est ouverte à Internet, pas à la tablette de l'entreprise.

Mesuré : `anon` peut appeler `encheck_pauses_en_cours(<entreprise>)` et
obtenir 14 employés sur 3 entreprises, avec noms et matricules ; puis appeler
`encheck_pause_fermer(<employé>, <fin arbitraire>)` et réécrire une durée de
pause. Détail complet, avec la séquence de bascule :
`docs/SECURITE-ECRITURES-ANONYMES.md`.

Le défaut est **préexistant** (`encheck_pause_ouvrir` l'a aussi) ; je l'ai
aggravé en ajoutant le motif sans revoir les droits.

Deux dégâts de mes propres tests sur **Hippo BIYOKILA** (`ENN-0002`) sont
réparés et vérifiés : une pause du 17/11 fermée à 7 666 minutes (la journée
renvoyait `4,91` h travaillées au lieu de `presumee` 60 min), et une pause de
0 minute créée le 22/11. État après réparation : 0 pause avec motif, 27
pauses, comme avant.

Le chemin sûr est disponible : `encheck_ma_pause_fermer(p_jeton, …)`, qui
déduit l'employé du jeton. La révocation des fonctions ouvertes à `anon` est
écrite mais **non appliquée** — elle casserait le pointage tant que l'app
n'a pas basculé.

### 10.6 Le trou que j'avais laissé dans ma propre séquence

Mon document de révocation demandait de révoquer `encheck_pause_ouvrir` sans
avoir fourni d'équivalent par jeton. Appliquée telle quelle, la séquence
aurait cassé « Je pars en pause ». C'est l'App Pointage qui l'a relevé.

Pire : le trou était **écrit dans ma migration du 23/11**, sous mes yeux —
« `encheck_pause_ouvrir` a le même défaut, pour la même raison » — et je n'en
ai pas tiré la conséquence dans la séquence. J'ai décrit le problème et livré
la solution à moitié.

Deux fonctions ajoutées le 25/11, toutes deux **additives** (rien de révoqué) :

| Fonction | Remplace | Sortie |
|---|---|---|
| `encheck_ma_pause_ouvrir(p_jeton, p_debut, p_motif)` | `encheck_pause_ouvrir` | `{ok, pause_id, fermees, jour}` |
| `encheck_pauses_bandeau(p_enterprise)` | `encheck_pauses_en_cours` | `affichage, debut, motif, duree_minutes` |

La seconde applique la décision du fondateur (option b) : prénom + initiale,
**ni identifiant, ni matricule, ni nom complet**. Mesuré sous `SET LOCAL ROLE
anon` : « Hippo B. », sans erreur de droits. Contrôle des paramètres de sortie
fait sur `information_schema.parameters`.

Je n'y ai **pas** ajouté `prevue_minutes`, contrairement au contrat proposé :
`encheck_pause_prevue` est `STABLE SECURITY DEFINER`, l'appeler une fois par
ligne ouverte multiplierait les exécutions sur un écran qui se rafraîchit.
L'absence se voit et se discute ; une lenteur de borne ne se voit pas.

La révocation de `encheck_pauses_en_cours` est désormais isolée derrière un
point d'arrêt explicite : c'est la seule qui retire une fonctionnalité
visible, et elle dépend d'un déploiement d'app.

### 10.7 Le motif de fermeture — ce qui a été vérifié, et ce qui ne peut pas l'être

**La chaîne fonctionne, prouvée de bout en bout.** Sur un compte `RECETTE`,
sous `BEGIN … ROLLBACK` :

```
encheck_session_ouvrir  → jeton
encheck_ma_pause_ouvrir(jeton, now() - 90 min)
encheck_ma_pause_fermer(jeton, now() - 30 min, 'sortie')
→ en base : duree_minutes 60, motif_fermeture 'sortie'
```

**Aucune pause réelle ne porte de motif — et c'est normal.** Mesuré le 28/11 :
27 pauses, **27 à `NULL`**. Leur dernière création date du **20/11**, trois
jours avant l'ajout de la colonne. Les 8 pauses pointées sont toutes
antérieures. Les deux seules lignes qui ont porté un motif étaient celles de
mes propres tests du 22/11, annulées depuis.

Conséquence : **le badge ne s'affichera pas tant qu'une vraie pause n'aura pas
été prise après le 23/11.** Ce n'est pas un défaut d'affichage, c'est un
manque d'écriture. Il faut une pause réelle sur tablette pour le voir.

**La reconstitution du passé est impossible, pas seulement risquée.** J'ai
cherché, pour chaque pause fermée, le pointage présent à moins de deux minutes
de son heure de fin :

| Pauses réelles fermées | Avec un pointage à la fermeture |
|---|---|
| 7 | **2** |

Cinq pauses ont donc été fermées **sans pointage** : action d'administrateur,
correction manuelle, import. Leur attribuer `reprise` ou `sortie` serait
fabriquer une donnée dans un écran qui sert à trancher des paies. Elles
restent à `NULL`, et l'écran n'affiche rien — c'est la seule réponse honnête.

**Ce que ça implique pour la suite :** la valeur de ce motif se jugera dans
quelques semaines, sur des pauses réellement prises. Aujourd'hui, le seul
verdict possible est « la mécanique est en place », pas « le résultat est
utile ».

### 10.8 Preuves

- 153 fichiers de test, **2 116 tests** ✓ ; build ✓ ; ESLint propre sur les fichiers touchés.
- **24 tests de contrat** (`contratAppPointage.test.js` et `bandeauPauses.test.js`), dont deux vérifiés par mutation (retirer le `DROP` les fait échouer) et six sur le nouveau chemin par jeton.
- `encheck_ma_pause_fermer` appliquée en production et testée : jeton inventé → `42501`, jeton valide d'un compte `RECETTE` → `aucune pause ouverte` (donc l'employé a bien été résolu).
- Réparation vérifiée en base : `encheck_pauses_duree_reelle` du 17/11 repasse de `7666` à `presumee 60`, `encheck_temps_travaille` de `4,91` à son état d'origine, et 0 pause porte un motif.
- En base : jetons inventé / vide / `NULL` → `42501` trois fois ; session de test créée puis **supprimée** (0 restante sur 191).

---

## 11 — Les gardes d'écriture s'ouvraient sans session (23/11)

### 11.1 Ce que j'ai trouvé en cherchant autre chose

Je vérifiais les droits sur les fonctions de pause pour préparer la
révocation d'`encheck_pauses_en_cours`. J'ai supposé un problème de droits.
C'était pire : le problème était dans le code.

**Erratum du même jour.** J'ai d'abord écrit ici que ces cinq fonctions
étaient « appelables par `anon` ». C'était vrai pour **une seule**
(`encheck_pauses_annuler_decision`) et faux pour les quatre autres, dont
l'ACL exclut `anon`. J'avais conclu d'une ligne de tableau (`anon_peut_executer`)
sans lire l'ACL complète. La conclusion — « la garde échoue ouverte » —
restait juste, mais l'exposé était faux, et il a été relevé par le lot
App Pointage avant que je le corrige. C'est leur reproche, et il porte.

La garde, présente à l'identique dans cinq fonctions :

```sql
IF NULLIF(coalesce(auth.jwt() ->> 'email', ''), '') IS NOT NULL
   AND NOT public.encheck_est_admin_de(p_enterprise) THEN
  RAISE EXCEPTION 'non autorisé';
END IF;
```

**L'intention :** « si quelqu'un est connecté, on vérifie ses droits ».
**L'exécution :** sans JWT, l'email est `NULL`. `NULL AND FALSE` vaut `NULL`.
Un `IF` ne s'exécute pas sur `NULL`. **La garde ne se déclenchait jamais
dans le cas qu'elle devait fermer** — et seulement dans celui-là.

C'est le même défaut que celui corrigé sur `encheck_pauses_lire`, où la
garde `IF v_email IS NOT NULL` échouait ouverte. Deux fois la même erreur,
à deux endroits, écrite par la même main. Ce n'est pas de la malchance :
c'est un raisonnement qui paraît juste et qui ne l'est pas.

### 11.2 La mesure, faite avant toute correction

Sous `BEGIN … ROLLBACK`, rôle `anon`, sans JWT :

```
encheck_pause_creer(REC-0002, now()-3h, now()-2h)  → {"ok": true, "pause_id": "f3ce883f-…"}
encheck_pauses_annuler_decision([…])                → 1
```

Aucune trace en base après `ROLLBACK` — vérifié (`0` ligne restante).

Détail qui compte : `anon` ne peut pas inventer d'identifiant. J'ai essayé
une valeur au hasard, réponse `employé inconnu ou inactif`. Il faut
**connaître** un identifiant existant. La faille est donc réelle mais pas
ouverte à un inconnu : elle demande un identifiant, ce qu'un ancien
salarié ou une personne ayant eu accès à la base possède.

### 11.3 La correction

```sql
IF auth.uid() IS NULL
   AND NULLIF(coalesce(auth.jwt() ->> 'email', ''), '') IS NULL THEN
  RAISE EXCEPTION 'non authentifié …' USING ERRCODE = '42501';
END IF;
IF NOT public.encheck_est_admin_de(p_entreprise) THEN RAISE … 42501; END IF;
```

Deux tests explicites au lieu d'un test à trois états. On exige l'identité,
**puis** on vérifie les droits — l'ordre est ce qui empêche le retour du
défaut.

**Ce qui était réellement atteignable par `anon`, ACL en main :**

| Fonction | `anon` dans l'ACL | Comportement mesuré |
|---|---|---|
| `encheck_pauses_annuler_decision` | **oui** | refusait déjà (`42501` possible) — **atteignable** |
| `encheck_pauses_statuer` | non | `42501 permission denied for function` |
| `encheck_pauses_supprimer` | non | `42501 permission denied for function` |
| `encheck_pauses_restaurer` | non | `42501 permission denied for function` |
| `encheck_pause_creer` | oui | portait la garde fautive **et** n'avait de toute façon pas besoin de session pour écrire |

La correction reste justifiée : la garde d'`annuler_decision` était la seule
barrière, et `pause_creer` la portait sans être protégée par l'ACL.

**Trois pièges rencontrés en écrivant la migration :**

1. `CREATE OR REPLACE` **refuse** de retirer une valeur par défaut (`42P13`).
   Les quatre signatures portaient `DEFAULT NULL::text` : les recopier sans
   le défaut échoue.
2. Les fonctions portaient `SET search_path TO 'public', 'pg_temp'`. Ce
   n'est pas décoratif : c'est ce qui empêche un schéma malveillant de
   passer devant `public`. Le perdre en réécrivant la fonction aurait
   fermé une porte et ouvert une autre. Un test le vérifie désormais.
3. Un commentaire d'explication citant la garde fautive faisait échouer ma
   propre vérification — elle cherchait la chaîne, et la trouvait dans la
   documentation. Corrigé en testant l'absence réelle, pas l'absence de
   mention.

### 11.4 Vérification, sur la production

| Appel | Avant | Après |
|---|---|---|
| `anon` → `encheck_pause_creer` | `{"ok": true, "pause_id": …}` | **42501 non authentifié** |
| `anon` → `encheck_pauses_statuer` | passait | **42501** |
| `anon` → `encheck_pauses_supprimer` | passait | **42501** |
| `anon` → `encheck_pauses_annuler_decision` | `1` | **42501** |
| `anon` → `encheck_pauses_restaurer` | passait | **42501** |
| `anon` → `encheck_pause_fermer` | passait | **passait encore** — non gérée par ce lot |
| Admin connecté → `encheck_pause_creer` | `ok: true` | **`ok: true`** (inchangé) |

L'admin connecté a été testé avec un JWT simulé (`set_config('request.jwt.claims')`)
sous `BEGIN … ROLLBACK`. Rien n'a été écrit.

**22 tests** (`gardesEcriturePauses.test.js`), dont `it.each` sur les cinq
fonctions et trois vérifications par mutation : remettre la garde fautive
dans une seule fonction fait échouer trois tests.

### 11.5 La pause de 5,9 jours — et pourquoi elle n'était pas indéterminée

Le bandeau allait afficher `Hippo B. 141:07`. Une pause ouverte depuis le
17/11 15:42, jamais fermée.

J'ai failli la traiter comme les 27 `NULL` du §10.7, en laissant la décision
au fondateur. **C'était une erreur** : j'avais les pointages du 17/11 sous
la main et je ne les avais pas lus.

```
17/11 12:26:24  in   (pin)
17/11 15:42:58  ← début de la pause
17/11 17:20:43  out  (pin)   ← la pause courait encore
```

Une **sortie** pointée pendant que la pause courait : c'est exactement le
cas `sortie` documenté, celui que l'app Pointage produit à
`pointage_screen.dart:6034`. Il n'y avait rien à inventer. Fermée à
`17:20:43`, soit 98 minutes, motif `sortie`, tracée au journal
(`pause_fermee_correction`, id 41).

Après : **0 pause ouverte** en base, et `encheck_pauses_bandeau` renvoie une
liste vide.

**Ce que je ne dois pas laisser croire :** ce n'est pas une déduction
certaine, c'est la lecture la plus probable d'un enchaînement cohérent. Un
employé qui badge sa sortie à 17:20 reste exceptionnellement longtemps en
pause ; l'alternative — qu'il ait pointé sa sortie en étant en pause et
soit revenu plus tard sans pointer de reprise — n'est pas distinguable.
L'heure, elle, n'est pas inventée : elle vient du pointage.

### 11.6 Ce que cette pause dit du système, et qui est plus gênant

`encheck_pauses_controler` tourne **toutes les 10 minutes** (tâche
`encheck-alertes-scan` → `encheck_alertes_scan` → `encheck_pauses_controler`).
Il a bien produit l'alerte :

> **« Pause sans reprise »** — *Pause débutée à 16:42 toujours sans pointage
> de reprise (75 min de rappel dépassées).* Créée le 17/11 à 17:00.

Donc le moteur a fait son travail **dès le premier quart d'heure**. Ce qui a
manqué n'est pas la détection, c'est **la fermeture** : une alerte signale,
elle ne corrige pas. Et rien, nulle part, ne ferme automatiquement une
pause dont la sortie est pointée.

C'est un défaut de conception, pas un bug. Je ne le corrige pas ici : fermer
automatiquement une pause au pointage de sortie changerait la paie sans
qu'aucun humain ne voie la ligne, et c'est exactement ce qu'on refuse depuis
le début de ce lot. **À discuter, pas à décider seul.**

### 11.7 Ce qui reste ouvert, et ce n'est pas de mon fait

`encheck_pauses_en_cours(p_enterprise)` reste appelable par `anon` **sans
aucune garde** et renvoie, pour chaque pause en cours :
`{employé_id, prénom, nom complet, matricule, début, motif, durée}`.

Mesuré sous rôle `anon` : `Hippo`, `BIYOKILA`, `ENN-0002`. C'est
exactement ce que le bandeau a corrigé — sauf que le bandeau est une
**nouvelle** fonction, et que l'ancienne n'a pas été fermée.

Elle attend l'APK de l'app Pointage. Tant qu'elle n'est pas révoquée,
l'identité d'un salarié reste lisible avec la seule clé publique.

### 11.8 Ce qui reste atteignable par `anon`, mesuré le 23/11 après correction

Rien ne le dit mieux qu'un tableau — et cette fois l'ACL a été lue
ligne par ligne, puis chaque appel **exécuté** sous `SET LOCAL ROLE anon`
dans sa propre transaction :

| Fonction | `anon` peut exécuter | Effet réel |
|---|---|---|
| `encheck_pause_fermer` | **oui** | ferme la pause ouverte d'un employé, **sans session** |
| `encheck_pause_ouvrir` | **oui** | ouvre une pause, **sans session** |
| `encheck_pauses_en_cours` | **oui** | **lit prénom, nom complet, matricule** |
| `encheck_pauses_mes_pauses` | **oui** | ne rend rien sans jeton (`42501` côté employé) |
| les quatre fonctions d'écriture corrigées | **non** | `42501 permission denied for function` |

La fuite noms + matricules est donc **toujours ouverte**, comme le dit le
lot App Pointage. Trois revokes l'arrêteraient. Ils attendent leur
déploiement : c'est un point d'arrêt assumé, pas un oubli.

### 11.9 La règle « une pause écartée n'existe plus pour l'employé »

Cette règle est arrivée sans être décidée. En écrivant la vue web, j'ai
écrit ce filtre de moi-même — puis l'ai présenté comme une règle, ce qui
lui a donné l'apparence d'une décision.

Elle n'est pas anodine : **3 pauses en base portent aujourd'hui le statut
`ecartee`** (2, 0 et 1 minute). Si l'écartement n'est que de l'affichage,
la vue employé crée un **écart de périmètre** — l'employé ne voit pas une
pause que l'administration a écartée pour lui. Si c'est une vraie décision
d'administration, la règle est juste.

Je ne tranche pas : la règle a été alignée dans l'app Pointage (`5a1f08b`,
3 fichiers) et le web, et **décider maintenant changerait la paie sans
regarder les lignes**. C'est à vérifier sur ces 3 pauses avant d'être
affirmé comme règle. À soumettre avec le reste.

---

## 12 — Le filet « une sortie ferme la pause » (23/11)

### 12.1 Un chantier qui est arrivé par la porte de service

Le lot App Pointage a écrit **et appliqué en production** un déclencheur qui
ferme la pause ouverte au moment où une sortie est pointée. Ils me l'ont
transmis pour que je le committe ici. La validation du fondateur couvre le
principe ; **la mise en production, elle, n'est pas passée par ce dépôt.**

Conséquence concrète : jusqu'à cette migration, l'état décrit par le code ne
correspondait pas à l'état de la base. Une base recréée depuis le dépôt
n'aurait pas eu le filet.

### 12.2 Ce qu'il fait vraiment — testé, pas relu

Leur description annonçait le cas nominal. J'ai testé **le chemin complet**,
par le vrai déclencheur, en transaction :

```
INSERT encheck_pauses (RECETTE, début = now() - 50 min)
INSERT attendances (check_type 'out', check_time = now() - 10 min)
→ pause fermée : fin = check_time, duree_minutes 40, motif_fermeture 'sortie'
```

Le déclencheur fait bien son travail, et le pointage passe.

**Deux cas piégeux testés :**

| Cas | Résultat |
|---|---|
| sortie dont l'heure est **antérieure** au début de la pause | pause **laissée ouverte** (`heure de reprise invalide`) — rien de cassé, rien d'inventé |

C'est le bon comportement : `encheck_pause_fermer` refuse une fin incohérente,
le filet ne fabrique pas une durée négative pour faire bonne figure. Mais
**la pause reste ouverte** — le filet ne bouche donc pas tous les trous, et
c'est assumé (une heure incohérente est un problème d'horloge à traiter, pas
un cas à masquer).

### 12.3 Ce que j'ai corrigé de leur version

Leur ACL laissait **`anon` et `authenticated`** exécuter les deux fonctions.
`encheck_pause_clore_sortie` est `SECURITY DEFINER` : laissée ouverte à
`anon`, elle permet de fermer la pause de n'importe qui **sans session** —
exactement le défaut corrigé au §11, une fonction plus loin.

Vérification avant de fermer : **0 appel** dans les 90 fichiers Dart de
`3826078`. Les deux fonctions ne servent qu'en interne, par le déclencheur.

Après correction, mesuré en base :

```
encheck_pause_clore_sortie  → {postgres=X/postgres,service_role=X/postgres}
encheck_pause_filet_sortie  → {postgres=X/postgres,service_role=X/postgres}
```

### 12.4 Les trois garde-fous tenus

- **Borné** : `NEW.check_time`, jamais `now()`. Un test le verrouille — sur
  un import rejoué le lendemain, `now()` aurait inventé une pause d'un jour.
- **Visible** : motif `sortie` + trace `pause_fermee_sortie_auto`.
- **Rattrapable** : aucune suppression. Un test vérifie qu'il n'y a pas de
  `DELETE` dans la migration : fermer et effacer ne sont pas la même
  décision, et une pause effacée ne peut plus être rouverte par le manager.

**9 tests** (`filetSortiePause.test.js`).

### 12.5 Ce que ce filet change pour la suite

La révocation `anon` devient possible : `encheck_pauses_en_cours` est désormais
appelée par l'app Pointage **et** par rien d'autre côté web — mon bandeau
utilise `encheck_pauses_bandeau`. Le point d'arrêt reste le test tablette,
parce que c'est l'app qui décide.

**Reste ouvert, et visible dans les mesures :** la fuite noms + matricules
par `encheck_pauses_en_cours` en `anon`.

---

## 13 — La fuite noms + matricules est fermée (23/11)

### 13.1 Ce qui fuyait

`encheck_pauses_en_cours(p_enterprise)` était exécutable par `anon`, la clé
publique qui part dans le navigateur **et dans l'APK**. Elle renvoyait, pour
chaque pause en cours : `employe_id`, `prenom`, `nom`, `matricule`, `debut`,
`motif`, `duree_minutes`.

Mesuré sous `SET LOCAL ROLE anon` : `Hippo`, `BIYOKILA`, `ENN-0002`.
Sans compte, sans session.

### 13.2 La correction de diagnostic que j'avais ratée depuis le début

J'ai écrit plusieurs fois, dans ce rapport et dans mes messages, que ces
fonctions renvoyaient des identités « parce qu'elles étaient ouvertes à
`anon` ». **C'est faux.**

En PostgreSQL, une fonction `SECURITY DEFINER` s'exécute avec les droits de
**son propriétaire**. L'ACL ne décide pas de ce que la fonction peut lire —
elle décide de **qui peut l'appeler**.

Conséquence, vérifiée : `encheck_pauses_bandeau` — ma fonction, celle qui ne
renvoie qu'un prénom et une initiale — est **aussi** exécutable par `anon`.
Elle ne fuit pas parce que son corps est écrit pour ne pas fuir.

Donc : **la révocation ne protège pas contre un appelant, elle ferme un
chemin.** Le vrai correctif était le corps des fonctions, et il était déjà
fait depuis le 30/11 (`bandeau` remplace `en_cours`). La révocation arrive
après — elle empêche qu'on rappelle l'ancienne, elle ne rend pas la nouvelle
sûre.

### 13.3 Avant de révoquer, ce que j'ai vérifié dans leur code

La révocation pouvait casser la tablette en production. J'ai lu
`lib/services/pause_service.dart` à `3826078` :

- **Le bandeau** : la tablette appelle `encheck_pauses_bandeau` **en
  premier** et s'arrête là. Elle ne tombe sur `en_cours` que sur `PGRST202`
  — impossible, `bandeau` est livrée et vérifiée.
- **Ouvrir / fermer** : la variante par **jeton** est appelée en premier ;
  l'ancien chemin n'est qu'un repli `PGRST202`.
- Leur client est `Supabase.initialize(anonKey:)` **sans `signIn`** : la
  tablette est en rôle `anon` en permanence.
- **Aucun objet de la base** (fonction, vue) ne dépend d'`en_cours` —
  vérifié par recherche dans `pg_proc.prosrc`.

### 13.4 Mesure après révocation

| Appel en rôle `anon` | Avant | Après |
|---|---|---|
| `encheck_pauses_en_cours` | renvoyait `Hippo / BIYOKILA / ENN-0002` | **`42501 permission denied`** |
| `encheck_pause_ouvrir` | exécutable | **révoqué** |
| `encheck_pause_fermer` | exécutable | **révoqué** |
| `encheck_pauses_bandeau` | exécutable | **exécutable** (voulu) |
| `encheck_ma_pause_ouvrir` (jeton invalide) | `42501 Session employé invalide` | **inchangé** |

La tablette garde son bandeau et ses chemins par jeton.

### 13.5 Ce qui reste vrai, et qu'il faut dire

Leurs trois replis `PGRST202` tombent désormais en **`42501`**. Les trois sont
rattrapés côté app : état local pour le bandeau, file d'attente pour les
gestes. Mais **après un vidage de cache ou une réinstallation, une tablette
sans jeton ne peut plus ouvrir ni fermer de pause hors ligne** — le geste
reste en file jusqu'à la prochaine identification.

Ce n'est pas une régression cachée : c'est le comportement voulu, et il est
inscrit dans la migration. Le dire vaut mieux que de laisser quelqu'un le
découvrir sur une tablette, un matin.

**8 tests** (`revocationPausesAnon.test.js`), dont un qui vérifie que les
chemins par jeton **ne sont pas** révoqués — la révocation ne doit pas
devenir un excès.
