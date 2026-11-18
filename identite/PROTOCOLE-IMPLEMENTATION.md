# EN-CHECK — PROTOCOLE D'IMPLÉMENTATION

## Comment plusieurs agents IA codent la même charte, page par page

**Version 1.0 — 18 novembre 2026.** S'applique à tout développement d'interface, humain ou IA, sur le dépôt `En-Check`.

---

## 0. Le problème, dit franchement

Plusieurs agents travaillent en parallèle, chacun sur une page. Ils ne se parlent pas, ne voient ni le travail des autres, ni le fondateur, ni le résultat à l'écran. Chacun, livré à lui-même, produira une page « jolie » et **différente** — c'est exactement ce qui a donné les 53 tailles de texte et les 4 661 couleurs en dur du dépôt actuel.

Une charte ne se transmet pas par la lecture : elle se transmet par **une porte qui refuse**. Ce protocole installe cette porte. Il tient en trois pièces :

| Pièce | Rôle | Fichier |
|---|---|---|
| **Le contrat de page** | dit à l'agent ce qu'il a le droit de faire, page par page | `identite/fiche-page-TEMPLATE.md` |
| **Le vérificateur** | mesure le résultat, refuse sans discuter | `scripts/charte-check.mjs` |
| **La notation** | dit où en est chaque page, et ce qui bloque une fusion | ce document, §4 et §5 |

Et une phrase à afficher dans chaque prompt d'agent :

> **Tu n'améliores pas la charte. Tu l'appliques. Si elle t'empêche de faire quelque chose, tu t'arrêtes et tu le signales — tu ne contournes pas.**

---

## 1. Le contrat de page (ce que reçoit chaque agent)

Aucun agent ne commence sans une fiche remplie. Une fiche = une page = une branche = un agent. **Jamais deux agents sur la même page.**

La fiche (modèle : `identite/fiche-page-TEMPLATE.md`) contient :

1. **La page** et la route qu'elle occupe.
2. **Les planches de référence** — les images qu'il doit ouvrir avant d'écrire une ligne. Pas la charte entière : *les trois planches qui le concernent*.
3. **Le motif** assigné (§1.2 de la charte) et donc la bande de page.
4. **Les objets du kit autorisés** pour cette page, parmi les dix-huit formes.
5. **Les jetons** qu'il peut utiliser : `src/styles/tokens.css` (couleurs, espace, rayons, tailles). Il n'écrit **aucune** valeur de couleur.
6. **Les cinq critères de recette** (§4.2), écrits en clair, applicables tels quels.
7. **Ce qui est interdit sur cette page** — explicitement, en trois ou quatre lignes. C'est la partie qui évite 80 % des écarts.

> **Exemple, page Pointages.**
> Motif : Adinkra. Tableau : forme « grille ». Objets autorisés : bouton pleine et contour, champ cadre, badge pilule et tampon, message bandeau, tuile chiffre+repère.
> Interdits : pas de tuile bento, pas de badge onglet, pas de troisième densité de bouton, pas de couleur pour dire « en retard » (le mot est obligatoire), pas de modale de plus de 8 champs.
> Recette : la page doit tenir **40 lignes** de relevés et se lire **sans couleur**.

---

## 2. Le cycle en six temps

| Temps | Ce que fait l'agent | Ce qui est vérifié | Qui peut le refuser |
|---|---|---|---|
| **1. Lire** | ouvre la fiche + les 3 planches + les jetons | la fiche existe et est datée | le vérificateur (temps 4) |
| **2. Structurer** | bande, en-tête, corps, une action principale | la structure contre la planche de la page type | revue humaine |
| **3. Habiller** | utilise **uniquement** les formes du kit et les jetons | C8, C11, C12 | revue humaine |
| **4. Mesurer** | lance `npm run charte` sur sa page | C1, C2, C6, C9, C10 | **le script** |
| **5. Capturer** | joint **deux** captures : clair et sombre, 1440 px | C3, C4, C5, C7 + les 5 critères | revue de capture |
| **6. Déclarer** | remplit la section « résultat » de la fiche | la cohérence chiffres/capture | revue humaine |

**Rien ne se code avant le temps 2 validé.** Un agent qui commence par le CSS produira une page à sa façon, qu'on ne pourra plus rattacher à aucune planche — c'est le scénario le plus coûteux, et le plus fréquent.

---

## 3. Le vérificateur

```bash
npm run charte            # rapport lisible
npm run charte -- --json  # sortie machine, pour la CI et le tableau de bord
npm run charte -- --strict  # code de sortie 1 si NON CONFORME
```

Il lit le dépôt, jamais le navigateur : il ne juge donc que **ce qui est dans le code**. Il produit un verdict (`CONFORME` / `NON CONFORME`), trois compteurs (conformes, en écart, non applicables) et les cinq pires fichiers de chaque écart.

**Ce qu'il ne sait pas faire, et qu'il ne faut pas lui demander :**
- il ne voit pas la page rendue : une bande de motif étirée lui échappe (C3, C4) ;
- il ne lit pas le sens : un badge rouge sans mot passe C9 et C10, et viole C7 ;
- il ne juge pas la hiérarchie : deux actions principales de même poids ne sont pas une erreur de syntaxe ;
- **un dessin n'est pas un test** : il ne dira jamais si la page est *bonne*, seulement si elle est *dans les clous*.

C'est pourquoi il y a deux autres portes. Un contrôle automatique seul fabrique des pages conformes et illisibles ; un œil seul fabrique des pages belles et intenables.

---

## 4. La notation

### 4.1 Les douze contrôles → 60 points

Six contrôles automatiques, **10 points chacun**, mais **chacun est un veto** : un seul échec ⇒ la page ne fusionne pas, quel que soit le score.

C1 aucun `#hex` hors des jetons · C2 contraste ≥ 4,5:1 · C6 aucune police tierce · C9 aucune ombre floue · C10 rayons dans la liste · C8 aucune forme hors kit.

### 4.2 Les cinq critères visuels → 40 points (8 chacun)

Ils s'appliquent sur la capture, et un humain doit pouvoir répondre par oui ou non en dix secondes :

| # | Critère | Question posée à la capture |
|---|---|---|
| **V1** | Reconnaissable | si je masque le titre et le logo, est-ce que je sais que c'est En-Check ? |
| **V2** | Une action | y a-t-il **une** chose à faire, et une seule, qui saute aux yeux ? |
| **V3** | Trois niveaux | est-ce que je distingue le titre, le corps et la légende sans effort ? |
| **V4** | Aucune invention | est-ce que je retrouve chaque objet sur la planche 24 (les 18 formes) ? |
| **V5** | Tenue | la page tient-elle 40 lignes sans que je perde la ligne que je lis ? |

Un critère se note **0 ou 8** : pas de demi-point, pas de « presque ». Le doute vaut 0.

### 4.3 Le seuil

| Score | Décision |
|---|---|
| **100** | fusion immédiate, la page entre dans la référence |
| **≥ 85** | fusion, avec les écarts notés dans la fiche |
| **60 – 84** | retour à l'agent avec **les critères nommés**, pas « à revoir » |
| **< 60** | le temps 2 (structure) est repris ; le code est jeté |

Le score sert à **suivre une progression**, pas à négocier. Un veto n'est pas compensable par un bon score.

---

## 5. Les trois portes qui bloquent une fusion

| Porte | Qui | Quand | Ce qu'elle refuse |
|---|---|---|---|
| **1. Le script** | automatique, à chaque envoi | sur la branche | un veto (C1, C2, C6, C8, C9, C10) |
| **2. La revue de capture** | l'agent lead ou un humain | sur la demande de fusion | V1 à V5, C3, C4, C5, C7 |
| **3. La revue humaine** | le fondateur | par lots, pas par page | les inventions, les écarts aux décisions entérinées |

**Porte 1 :** la CI exécute `npm run charte -- --strict`. Tant que le kit n'est pas écrit, l'étape est en **rapport seulement** (elle affiche, elle ne bloque pas) — exactement la logique du lint de ce dépôt : *« une porte rouge le premier jour reste rouge pour toujours »*. Elle devient bloquante à la page qui rend le dépôt conforme, et pas avant.

**Porte 2 :** deux captures obligatoires, jointes à la demande de fusion. Une page sans capture n'est pas relue. C'est là que meurent les bandes étirées.

**Porte 3 :** le fondateur ne relit pas 40 pages. Il relit **un lot** — cinq pages, une par écran du même type — et il tranche sur les écarts récurrents, une fois pour toutes. C'est ainsi qu'une charte reste vivante sans devenir un goulot.

---

## 6. La dérogation

Une charte appliquée sans exception casse sur le premier cas réel. La dérogation existe, elle est **écrite, datée, justifiée, et révocable** :

1. l'agent constate que la charte l'empêche de faire quelque chose ;
2. il **s'arrête** sur ce point, continue le reste, et ouvre une ligne dans `identite/DEROGATIONS.md` : page, contrôle concerné, raison, proposition ;
3. le fondateur répond par une décision numérotée (D-021, D-022…) ;
4. la dérogation vaut pour **une page**, pas pour le produit. Deux pages qui demandent la même chose déclenchent une décision générale.

**Interdit :** une valeur « en attendant », un commentaire `// TODO charte`, une couleur écrite à la main dans un composant. Si un agent écrit une couleur, c'est un veto — pas une dette.

---

## 7. Le tableau de bord de conformité

Une page = une ligne, dans `identite/conformite.md` :

| Page | Motif | Score | Veto | Captures | Date |
|---|---|---|---|---|---|
| Dashboard | Bogolan | — | C1, C9, C10 | — | à faire |
| Pointages | Adinkra | — | C1, C9, C10 | — | à faire |
| … | | | | | |

Une ligne ne passe à « fait » que si le score est ≥ 85 **et** que les deux captures sont jointes. C'est le seul tableau qui dit la vérité sur l'avancement — pas le nombre de fichiers modifiés.

---

## 8. L'ordre (D-019), et pourquoi il compte

Dashboard → pages de travail → pages de réglage → modales.

C'est l'ordre du **risque**, pas de la facilité. Le dashboard fixe le vocabulaire visuel que les autres pages copieront : s'il est faux, l'erreur se réplique vingt fois. Les modales viennent en dernier parce qu'elles héritent des formes déjà éprouvées sur les pages.

**Une page ne peut pas être déclarée « dans la charte » si la précédente ne l'est pas.** Un agent qui se retrouve bloqué par une page non faite le signale ; il ne réinvente pas le composant manquant.

---

## 9. Les trois pièges à connaître

| Piège | Symptôme | Parade |
|---|---|---|
| **L'agent styliste** | il « améliore » la planche : un rayon 12 devient 14, « ça respire mieux » | C10 le refuse ; V4 le refuse |
| **L'agent prudent** | il garde l'ancien composant « pour ne rien casser » | la fiche liste les formes autorisées ; le reste est un veto |
| **L'agent pressé** | il livre une page sans capture, « ça marche chez moi » | porte 2 : sans capture, pas de relecture, donc pas de fusion |

Ces trois-là sont la cause de la quasi-totalité des écarts constatés dans le dépôt. Ils ne se corrigent pas par la pédagogie, mais par le fait que la porte ne s'ouvre pas.

---

## 10. Ce que ce protocole ne fait pas

Il ne remplace pas le goût. Il garantit seulement qu'un agent qui ne connaît ni le produit, ni le fondateur, ni les autres pages, **ne peut pas s'écarter en silence**. Le jugement reste humain — mais il intervient sur un lot de cinq pages déjà mesurées, pas sur quarante pages à rattraper.
