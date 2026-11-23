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

### 10.7 Preuves

- 153 fichiers de test, **2 116 tests** ✓ ; build ✓ ; ESLint propre sur les fichiers touchés.
- **24 tests de contrat** (`contratAppPointage.test.js` et `bandeauPauses.test.js`), dont deux vérifiés par mutation (retirer le `DROP` les fait échouer) et six sur le nouveau chemin par jeton.
- `encheck_ma_pause_fermer` appliquée en production et testée : jeton inventé → `42501`, jeton valide d'un compte `RECETTE` → `aucune pause ouverte` (donc l'employé a bien été résolu).
- Réparation vérifiée en base : `encheck_pauses_duree_reelle` du 17/11 repasse de `7666` à `presumee 60`, `encheck_temps_travaille` de `4,91` à son état d'origine, et 0 pause porte un motif.
- En base : jetons inventé / vide / `NULL` → `42501` trois fois ; session de test créée puis **supprimée** (0 restante sur 191).
