# Feuille de route — de la pointeuse à la preuve

> **Version 1 — proposition soumise à validation du chef de projet.**
> Rien dans ce document n'est « résolu et validé ». Chaque chantier porte un
> critère d'acceptation vérifiable ; il ne passera à « validé » qu'après
> réalisation constatée **et** confirmation explicite du fondateur.
>
> Aucune ligne de code n'est engagée par ce document. Il décide de l'ordre.

---

## 0. La phrase qui tient tout

> **En-Check est le radar du dirigeant qui ne peut pas être là : il prouve ce
> qui s'est passé, et il signale ce qui va mal tourner.**

Trois conséquences, et elles commandent tout le reste :

1. **Prouver** n'est pas afficher. Une preuve se constitue, se scelle, se
   conserve et se restitue. C'est un chantier, pas un écran.
2. **Signaler** n'est pas prédire. Signaler, c'est comparer le réel à une
   règle et montrer l'écart. C'est faisable dès maintenant, sans apprentissage
   automatique.
3. **« Qui ne peut pas être là »** n'est pas un adjectif commercial : c'est le
   critère de conception. Tout écran doit être lisible par quelqu'un qui
   découvre la situation à distance, six mois plus tard.

**La distinction ne vient pas des fonctionnalités.** Elle vient de trois
actifs que le code ne fabrique pas : le métier choisi, l'historique accumulé,
et le canal de distribution. Cette feuille de route est construite pour
fabriquer les deux premiers et n'obérer ni le troisième.

---

## 1. Où nous en sommes — constaté, pas supposé

Relevé dans le dépôt à la rédaction de ce document.

| Brique | État constaté | Où c'est | Ce qui manque |
| --- | --- | --- | --- |
| Prédictions | **Existant**, 5 familles : durée, charge salarié, charge équipe, impact absence, besoin d'effectif | `src/services/predictionService.js` (817 l.), `src/pages/Predictions.jsx` (600 l.) | Aucune règle de **temps de travail** (repos, plafonds, séries de jours) ; aucune règle d'**échéance** (le 10) ; aucune règle de **matériel** (borne hors ligne) |
| Verrou de facturation | **Existant** — `FEATURES.PREDICTIONS` | `src/services/featureService.js` | Le flag existe mais n'est pas utilisé comme interrupteur d'expérimentation |
| Accès multi-entreprises | **Existant côté base** — table `admin_entreprises`, fonction `admin_has_access_to_enterprise(uuid)`, rôle `super_admin` | `supabase/migrations/20261025000009_admin_identity_channels.sql` | Aucune **expérience** cabinet : pas de sélecteur de dossier, pas de tableau d'échéances, pas de mandat par dossier |
| Vue « toutes entreprises » | **Partielle** — utilisée pour les motifs d'absence | `src/contexts/MotifsAbsenceContext.jsx` | Ce n'est pas une vue cabinet : elle ne porte ni échéances ni clôtures |
| Export PDF | **Existant mais hors sujet** — analytics uniquement (jsPDF) | `src/services/pdfExportService.js` | Aucun **dossier de présence** exportable |
| Cache de prédictions | Écrit par `savePredictionCache` | `src/services/predictionService.js:99` | La table n'apparaît pas dans les migrations du dépôt — **à vérifier** avant d'en dépendre |
| Dossier de preuve | **Inexistant** | — | Tout le chantier |
| Mode inspecteur | **Inexistant** | — | Tout le chantier |
| Intégrité de synchronisation | **Défaut ouvert** | Rapport d'analyse du 5 novembre 2026, dépôt `En-Check-App-Pointage` | Le préalable à tout le reste |

**Ce que ce tableau dit, en clair :** deux des trois chantiers demandés partent
de zéro, le troisième (l'anticipateur) part d'une base réelle mais orientée
tâches, pas présence. Ce n'est pas un handicap — c'est ce qui permet de dire
précisément ce qu'on ajoute au lieu de refaire.

---

## 2. L'ordre, et pourquoi cet ordre

```
   Lot 0            Lot 1              Lot 2            Lot 3           Lot 4
 Intégrité  ───▶  Dossier du 10  ───▶  Cabinet  ───▶  Inspecteur  ───▶  Anticipateur
 (préalable)      (la preuve)        (le canal)      (la restitution)    (le signal)
```

Cet ordre n'est pas négociable, pour trois raisons mécaniques :

- **Le mode cabinet sans le dossier du 10** n'a rien à montrer : le cabinet
  n'a aucune raison de se connecter si la page ne dit pas « ce dossier est
  prêt, celui-là ne l'est pas ».
- **Le mode inspecteur sans intégrité** produit un document qu'on peut
  contredire : un dossier qui oublie des pointages perd toute valeur le jour
  où l'on découvre le trou.
- **L'anticipateur sans intégrité** signale des écarts qui n'existent pas, ou
  rate ceux qui existent. Un moteur qui crie au loup est désactivé en trois
  semaines et ne se rallume jamais.

**Corollaire assumé :** l'anticipateur, qui est le plus enthousiasmant, est le
**dernier**. Ce n'est pas un manque d'ambition : c'est la seule façon qu'il
soit cru quand il parle.

---

## 3. Lot 0 — L'intégrité (préalable, non négociable)

**Objectif :** aucun geste de pointage ne peut disparaître, et l'écran ne dit
jamais « terminé » avant l'acquittement du serveur.

**Périmètre :** dépôt `Buta-ta/En-Check-App-Pointage`. Ce dépôt-ci (Admin)
n'embarque **pas** ce chantier : il n'y touche pas, conformément à la règle
« ne pas modifier l'application Admin dans ce chantier ».

| # | Exigence | Critère d'acceptation |
| --- | --- | --- |
| 0.1 | Chaque geste reçoit un identifiant local immuable, conservé jusqu'à l'acquittement | Un geste rejoué deux fois ne crée pas deux pointages |
| 0.2 | Un geste refusé reste visible avec son motif, il n'est jamais retiré silencieusement | Couper le réseau puis envoyer une réponse d'erreur : le geste est encore dans la file, avec son état |
| 0.3 | L'état affiché distingue trois choses : en attente, acquitté par le serveur, refusé | La pastille ne représente plus le type de réseau |
| 0.4 | « Synchronisation terminée » n'apparaît qu'après acquittement de **tous** les gestes | Test avec 3 gestes dont 1 en échec : aucun message de fin |
| 0.5 | Les pauses locales sont filtrées par entreprise | Sur une borne réaffectée, aucun nom d'une autre entreprise n'apparaît |
| 0.6 | Le logo client précédent est effacé quand la nouvelle entreprise n'en a pas | Bascule entreprise A (logo) → B (sans logo) : aucun reste de A |
| 0.7 | Le refus de pause est proposé avec confirmation/annulation sur **tous** les accès, y compris l'accueil | Parcours identique depuis l'historique et depuis l'accueil |

**Ce que ce lot ne fait pas :** il ne change aucun écran validé, il ne
redessine aucun motif, il ne touche pas à l'apparence.

**Pourquoi c'est le préalable :** les lots 1 à 4 vendent tous « la preuve ».
Une preuve qui perd des pièces n'est pas une preuve.

---

## 4. Lot 1 — Le dossier du 10 (la preuve)

**Objectif :** transformer la fin de mois en un acte unique et vérifiable.

### 4.1 Ce que le dirigeant obtient

Un bouton, une fois par mois. Il produit :

1. **La clôture** — les heures du mois sont figées ; plus aucune modification
   silencieuse. Un correctif ultérieur est possible mais **tracé** (qui, quand,
   pourquoi), jamais invisible.
2. **L'annexe** — le fichier nominatif ITS + CNSS, au format attendu par le
   dépôt, prêt à être déposé. **En-Check produit le fichier ; le client le
   dépose.** (Voir §8 : ce n'est pas un agrément.)
3. **Le récapitulatif** — ce qui va être déclaré, en clair, avec les écarts
   signalés avant validation (heures non justifiées, absences non
   documentées, pointages manquants).
4. **L'archive** — le mois clos est conservé, scellé, et reste consultable.

### 4.2 Critères d'acceptation

| # | Critère |
| --- | --- |
| 1.1 | Un gérant seul, sans assistance, passe de « rien n'est prêt » à « mois clos » en **moins d'une heure** |
| 1.2 | Un mois clos ne peut plus être modifié sans laisser une trace nominative |
| 1.3 | Le fichier produit est relu par un comptable extérieur **sans retouche** |
| 1.4 | Un pointage manquant est signalé **avant** la clôture, jamais après |
| 1.5 | L'archive d'un mois clos se rouvre à l'identique, trois mois plus tard |

### 4.3 Ce que ce lot ne fait pas

- Il ne dépose rien sur le portail fiscal, il ne paie rien, il ne signe rien.
- Il ne remplace pas le comptable : il lui donne un fichier propre.
- Il ne couvre pas la paie française (voir §8).

---

## 5. Lot 2 — Le mode cabinet

**Objectif :** faire d'un cabinet comptable un canal de distribution, pas un
utilisateur de plus.

**La plomberie existe déjà** (`admin_entreprises`, `admin_has_access_to_enterprise`,
`super_admin`). Ce lot construit **l'expérience**, pas l'architecture.

### 5.1 Ce que le cabinet voit, sur une seule page

| Colonne | Contenu |
| --- | --- |
| Dossier | Nom de l'entreprise cliente |
| État du mois | clos / en préparation / en retard |
| Échéance | jours restants avant le 10 |
| Ce qui bloque | « 4 pointages sans sortie », « 2 absences non documentées », « borne hors ligne depuis 3 j » |
| Action | ouvrir le dossier, produire l'annexe, relancer le client |

Et un total en haut : **« 7 dossiers sur 12 prêts »**. C'est cette phrase qui
fait revenir le comptable chaque matin.

### 5.2 Règles de sécurité, non négociables

| # | Règle |
| --- | --- |
| 2.1 | Un cabinet n'est **jamais** `super_admin`. L'accès multi-dossiers passe par un mandat explicite, dossier par dossier |
| 2.2 | Le mandat est daté, révocable, et visible par l'entreprise cliente |
| 2.3 | Chaque ouverture de dossier est journalisée (qui, quand, quel dossier) |
| 2.4 | Un cabinet peut **lire et préparer**, jamais supprimer un pointage ni modifier une heure |
| 2.5 | Le retrait du mandat coupe l'accès immédiatement, sans migration de données |

### 5.3 Critères d'acceptation

| # | Critère |
| --- | --- |
| 2.6 | Un cabinet de 10 dossiers voit son état complet **sans ouvrir un seul dossier** |
| 2.7 | Produire les 10 annexes prend moins de temps que les produire une par une, mesuré sur le terrain |
| 2.8 | Une entreprise cliente voit, dans son propre espace, **qui** a accès à ses données et **depuis quand** |
| 2.9 | Révoquer un mandat bloque l'accès en moins d'une minute |

### 5.4 Ce que ce lot ne fait pas

- Pas de tenue de comptabilité, pas de bilan, pas de liasse fiscale.
- Pas de facturation du cabinet envers ses clients.
- Pas de partage de données entre dossiers : chaque dossier reste étanche.

---

## 6. Lot 3 — Le mode inspecteur et le dossier opposable

Deux choses portent le même nom et il faut les distinguer :

- **Le dossier** : ce que le client produit pour lui-même ou pour un tiers.
- **Le mode inspecteur** : l'accès temporaire, en lecture seule, donné à
  quelqu'un de l'extérieur (inspecteur du travail, donneur d'ordre, auditeur,
  avocat).

### 6.1 Le dossier de présence — ce qu'il contient

| Élément | Pourquoi |
| --- | --- |
| Période et périmètre couverts | On ne prouve jamais « tout », on prouve un cadre |
| Qui était présent, quand, où | Le fait |
| La photo associée, à sa place | Le contexte du geste, pas une pièce isolée |
| Une empreinte par enregistrement | Prouve que la ligne n'a pas été modifiée après coup |
| **La page de méthode** | **Comment** la preuve a été constituée : source, scellement, conservation, ce qui n'est pas couvert |
| Le journal des consultations | Qui a ouvert le dossier, et quand |
| Ce qui manque, explicitement | Un dossier qui avoue un trou est plus crédible qu'un dossier parfait |

**La page de méthode est l'élément différenciant.** Tout le monde produit un
PDF. Personne n'explique comment le sien a été fabriqué, ni ce qu'il ne prouve
pas. C'est cette honnêteté qui fait tenir un dossier devant quelqu'un qui le
conteste.

### 6.2 Le mode inspecteur — la forme de l'accès

| # | Règle |
| --- | --- |
| 3.1 | Lien **daté** : il expire tout seul, sans intervention |
| 3.2 | Lien **portée limitée** : une entreprise, une période, un périmètre — jamais « tout » |
| 3.3 | **Lecture seule**, sans exception. Aucun bouton d'édition, aucun export de données brutes non prévu |
| 3.4 | **Filigrane** au nom du destinataire sur chaque page |
| 3.5 | **Journalisé** : chaque ouverture, chaque page consultée, l'adresse IP |
| 3.6 | **Révocable** à tout instant, effet immédiat |
| 3.7 | **Page de vérification** : un tiers peut vérifier l'empreinte d'un enregistrement **sans compte** |

### 6.3 Critères d'acceptation

| # | Critère |
| --- | --- |
| 3.8 | De la demande à la remise du dossier : **moins de 3 minutes**, sans assistance |
| 3.9 | Un lien expiré ne donne plus rien, et le dit clairement |
| 3.10 | Le dossier remis ne contient **aucune** donnée hors du périmètre demandé |
| 3.11 | La page de vérification permet de contrôler une ligne précise sans révéler les autres |

### 6.4 La réserve juridique, à ne pas escamoter

> **Affirmer qu'un inspecteur du travail béninois accepte ce dossier sans
> formalisme supplémentaire est aujourd'hui une hypothèse, pas un fait.**

Ce point n'est pas vérifié. Deux démarches, avant d'en faire un argument
commercial : un entretien avec un inspecteur du travail, et un avis d'avocat
en droit du travail béninois sur la valeur probante d'un enregistrement
numérique horodaté et scellé.

**Tant que ce n'est pas fait, la promesse reste : « un dossier complet et
cohérent », pas « un dossier incontestable ».**

### 6.5 Ce que ce lot ne fait pas

- Aucun lien anonyme, jamais.
- Aucun accès en écriture, même temporaire.
- Aucune suppression de pièce d'un dossier déjà remis : on produit une
  version suivante, on ne réécrit pas l'histoire.

---

## 7. Lot 4 — L'anticipateur

**Objectif :** signaler à temps, avec preuve, et sans bruit.

### 7.1 Ce qui existe et ce qu'on en garde

`predictionService.js` fournit déjà cinq familles statistiques, orientées
**tâches et absences**. On les conserve. On leur ajoute ce qu'un moteur de
présence doit savoir et qu'aucune ne couvre aujourd'hui : **le temps de
travail, l'échéance, et le matériel.**

### 7.2 Niveau 1 — les règles (disponible sans apprentissage automatique)

| Famille | Exemple d'alerte |
| --- | --- |
| Repos | « Ce salarié a pointé 14 jours d'affilée sans repos » |
| Plafond | « Les heures de la semaine dépassent le plafond que vous avez fixé » |
| Motif d'absence | « Les absences de ce salarié tombent 6 fois sur 8 un lundi » |
| Site muet | « Aucun pointage sur ce site depuis 3 jours » |
| Borne | « Cette borne est hors ligne depuis 48 h avec 12 pointages en attente » |
| Salarié silencieux | « Ce salarié n'a plus pointé depuis 8 jours, sans absence déclarée » |
| Doublon | « Deux salariés ont pointé sur la même borne à 4 secondes d'intervalle » |
| Écart | « 6 h d'écart entre les heures pointées et les heures payées » |
| Échéance | « À J-3 du 10, ce dossier n'est pas clos » |

### 7.3 Les trois règles de conduite du moteur

| # | Règle | Pourquoi |
| --- | --- | --- |
| 4.1 | **Précision avant rappel.** Mieux vaut rater dix anomalies qu'en signaler une fausse | Un moteur qui crie au loup est coupé en trois semaines |
| 4.2 | **Toute alerte montre sa preuve** : les lignes, les dates, l'écart chiffré | Une alerte invérifiable n'est pas crue, et discrédite les suivantes |
| 4.3 | **Le silence est une fonctionnalité** : 3 alertes par mois par défaut, pas 30 | Au-delà, plus personne ne lit |

Plus deux garde-fous :

- **« C'est normal »** : un bouton qui apprend à ne plus signaler ce cas.
- **La machine suggère, l'employeur décide.** Aucune alerte ne produit jamais
  une sanction, une retenue ou un licenciement automatique.

### 7.4 Niveaux 2 et 3 — ce qu'on ne promet pas

| Niveau | Contenu | Condition | Ce qu'on en dit |
| --- | --- | --- | --- |
| 2 — comparaison | « Votre absentéisme est le double des entreprises comparables » | 30+ entreprises, 12 mois d'historique | Utile, mais **pas avant** d'avoir le volume |
| 3 — prédiction | « Cette équipe va se disloquer dans 3 mois » | Non démontré sur des données aussi jeunes | **On ne le promet pas** |

### 7.5 Critères d'acceptation

| # | Critère |
| --- | --- |
| 4.4 | Sur une entreprise réelle, le niveau 1 produit **au moins une alerte que le dirigeant ne connaissait pas**, dans le premier mois |
| 4.5 | Sur 100 alertes, **moins de 5** sont fausses |
| 4.6 | Chaque alerte affiche sa preuve : au moins une ligne source cliquable |
| 4.7 | Un utilisateur peut couper une alerte en un clic, et elle ne revient pas |

### 7.6 Ce que ce lot ne fait pas

- Pas d'assistant conversationnel générique (« demandez ce que vous voulez »).
- Pas de score unique et opaque (« risque 7/10 »).
- Pas de prédiction avant d'avoir l'historique.
- Pas d'alerte sans preuve jointe.

---

## 8. Ce que cette feuille de route exclut

| Exclu | Motif | Depuis quand |
| --- | --- | --- |
| Facturation normalisée **pour les clients** | Agrément SFE requis ; marché déjà couvert | décision du fondateur |
| Facturation des abonnements En-Check par nos outils | Le portail DGI gratuit suffit | décision du fondateur |
| Paie française, DSN, conventions collectives | Autre métier, autre complexité | analyse diaspora |
| Géolocalisation active en France | Interdite pour le contrôle du temps de travail | analyse CNIL |
| Reconnaissance faciale mise en avant | Autorisation APDP préalable ; interdite en France pour le pointage | analyse APDP |
| Transfert d'argent, paiement des salaires | Métier réglementé (BCEAO) | analyse diaspora |
| Annonces / publicité | Distraction avant le produit | analyse de positionnement |
| Refonte visuelle, motifs, finitions | Fait et validé — on n'y touche plus | consigne du fondateur |
| Suite RH (recrutement, entretiens) | Autre acheteur, autre rythme | analyse de positionnement |

---

## 9. Calendrier — hypothèses, pas engagements

Hypothèse de travail : **un développeur à plein temps**, périmètre tel que
décrit, sans découverte majeure en cours de route.

| Lot | Durée estimée | Dépend de |
| --- | --- | --- |
| 0 — Intégrité | 2 à 3 semaines | Dépôt Pointage |
| 1 — Dossier du 10 | 4 à 6 semaines | Lot 0 |
| 2 — Cabinet | 3 à 4 semaines | Lot 1, mandat défini |
| 3 — Inspecteur | 3 à 4 semaines | Lot 1, avis juridique |
| 4 — Anticipateur niveau 1 | 4 à 6 semaines | Lot 0, vertical choisi |

**Total indicatif : 4 à 5 mois.** Ce chiffre n'est pas un engagement : c'est
l'ordre de grandeur qui permet de décider si l'on veut tenir cette séquence ou
la réduire.

**Jalons de décision** (et non de livraison) :

- **Fin du lot 0** : si un pointage peut encore disparaître, on ne passe pas à
  la suite. On répare.
- **Fin du lot 1** : si le comptable pilote retouche le fichier, le format est
  faux. On corrige avant d'ouvrir le lot 2.
- **Fin du lot 2** : si le cabinet pilote ne revient pas la deuxième semaine,
  le mode cabinet ne sert à rien. On s'arrête et on écoute.
- **Fin du lot 4** : si le dirigeant n'apprend rien, on coupe le moteur.

---

## 10. Ce qui reste à trancher avant de coder

| # | Question | Qui décide | Bloque |
| --- | --- | --- | --- |
| D1 | **Quel métier en premier** (gardiennage, BTP, santé, hôtellerie ?) | Fondateur | Lot 4 — les règles en dépendent |
| D2 | **Hébergement et transfert de données** (autorisation APDP) | Fondateur + APDP | Lot 2/3 en diaspora |
| D3 | **Portée du mandat cabinet** : qui signe, pour quoi, combien de temps | Fondateur | Lot 2 |
| D4 | **Forme du mode inspecteur** : lien temporaire ou PDF seul | Fondateur | Lot 3 |
| D5 | **Valeur probante** du dossier numérique au Bénin | Avocat / inspection du travail | La promesse commerciale du lot 3 |

**D1 est la plus urgente.** Sans métier choisi, l'anticipateur reste
généraliste — donc copiable, donc sans distinction.

---

## 11. Comment on saura que c'est réussi

Quatre tests falsifiables. S'ils échouent, la feuille de route est fausse et
il faut la réécrire, pas la prolonger.

| # | Test | Échec si |
| --- | --- | --- |
| T1 | Couper le réseau entre l'enregistrement et l'acquittement d'un pointage | Un geste disparaît sans trace → lot 0 non terminé |
| T2 | Un gérant seul produit son mois clos en moins d'une heure | Il appelle à l'aide → lot 1 non terminé |
| T3 | Un cabinet de 10 dossiers revient le deuxième matin sans qu'on le relance | Il ne revient pas → lot 2 sans valeur |
| T4 | Sur 100 alertes du moteur, moins de 5 fausses | Plus de 5 → lot 4 coupé jusqu'à recalibrage |

Et un test de positionnement, indépendant du code : **dix prospects à qui
l'on présente deux argumentaires, l'un sur la fiabilité, l'autre sur la
preuve opposable.** Si le second est reformulé spontanément, la distinction
est trouvée. Sinon, elle ne l'est pas encore.

---

## 12. Registre

| Chantier | État | Preuve de réalisation | Confirmation du fondateur |
| --- | --- | --- | --- |
| Lot 0 — Intégrité | à faire | — | — |
| Lot 1 — Dossier du 10 | à faire | — | — |
| Lot 2 — Mode cabinet | à faire | — | — |
| Lot 3 — Mode inspecteur | à faire | — | — |
| Lot 4 — Anticipateur niveau 1 | à faire | — | — |

**Aucune ligne ne passera à « résolu et validé » sans réalisation constatée
et confirmation explicite.** Une PR fusionnée, une compilation verte ou une
déclaration d'intention ne constituent pas une preuve de réalisation.

---

## 13. En une phrase

**On ne vend plus une pointeuse : on vend un dossier qui tient et un signal
qui prévient.** Le dossier se construit une fois ; le signal se nourrit de
l'historique ; le cabinet décide si quelqu'un d'autre que nous le vend.
