# En-Check — Diagnostic et feuille de route proposée

| | |
|---|---|
| **Destinataires** | PDG / fondateur, Direction générale (CEO), Direction produit, Direction technique, Direction conformité |
| **Statut** | Proposition, à valider par le PDG |
| **Date** | 12 octobre 2026 |
| **Sources lues** | Dossier Drive « En-Check redone » (cap CEO v2.1, roadmap technique v1.1, audit UX web et mobile, rapports du Gardien des fondations) + dépôts GitHub `Buta-ta/En-Check` (branche `main`, commit `ca17a45`) et `Buta-ta/En-Check-App-Pointage` (branche `main`, commit `cad1f3b`) |

---

## 1. En une minute (version non technique)

En-Check est un logiciel de **pointage, de paie et de gestion du personnel** pour des entreprises de terrain (gardiennage, BTP, distribution, logistique, santé) en Afrique francophone. Il est en **test réel chez des clients**, mais **pas encore lancé**.

Son idée forte : **anticiper et alerter**. Au lieu d'attendre que le gérant regarde ses tableaux, En-Check doit le prévenir avant le problème : « 3 employés sur le site B n'ont pas pointé à 8h », « un bulletin de paie n'a pas été vérifié », « un pointage de la nuit n'a pas été synchronisé ».

**Le constat central :** aujourd'hui, En-Check n'anticipe que **quand quelqu'un ouvre l'application**. Une alerte qui n'existe que si l'on regarde l'écran n'est pas une alerte, c'est un tableau de bord. Le chantier le plus important est donc de faire tourner la surveillance **en permanence, côté serveur**.

**La règle d'or :** on ne promet pas l'anticipation sur une maison sans fondations. Avant d'alerter, il faut pouvoir **sauvegarder et restaurer les données**, **tester les calculs de paie**, et **ne pas afficher de faux résultats**.

---

## 2. Ce que le produit a de solide (à protéger et à montrer)

| Atout | Exemple concret | Pourquoi c'est rare |
|---|---|---|
| **Pointage hors ligne** | Un gardien pointe sur une tablette au fond d'un chantier sans réseau. Le pointage est gardé en mémoire et envoyé dès que le réseau revient. | La plupart des outils échouent sans Internet. |
| **Horloge de confiance** (mobile) | Un employé change l'heure de son téléphone pour pointer « à 8h » alors qu'il est 9h. En-Check refuse la date antidatée. | Anti-fraude réel, pas juste un badge. |
| **Reconnaissance faciale sur le téléphone** | Le visage est reconnu sans envoyer la photo sur Internet. | Confidentialité et fonctionnement hors ligne. |
| **Fiscalité multi-pays** | Le moteur de calcul connaît déjà les règles du Bénin, de la Côte d'Ivoire, du Sénégal et du Congo (vérifié dans le code). | Peu d'outils couvrent la paie de plusieurs pays francophones. |
| **Trois façons de pointer hors ligne** | Boîtier sur site, application mobile, poste web. | Argument commercial sous-estimé. |

---

## 3. Ce qui bloque aujourd'hui (constats vérifiés dans le code)

Je classe par gravité. Chaque point a été vérifié dans les dépôts.

### 🔴 Critique — à traiter cette semaine

**C1. Des travaux annoncés par le Gardien ne sont pas encore dans `main`.**
Tests automatisés, migrations SQL, script de sauvegarde, `CONTRIBUTING.md`, `.env.example` et CI existent sous forme de patches déposés sur le Drive. Le fondateur les copie ensuite dans VS Code puis les pousse sur GitHub : c'est le flux de travail voulu. Le risque n'est donc pas un travail manquant, mais une étape manuelle à chaque copie et un décalage entre ce qui est « écrit » et ce qui est « fusionné ». La revue détaillée est dans `docs/REVUE-GARDIEN-FONDATIONS.md`.
*Action :* une branche et une Pull Request par chantier, la CI verte comme condition de fusion.

**C2. Une clé d'envoi d'e-mails (Brevo) reste visible dans l'historique public.**
Le dépôt mobile public contient un commit « suppression de la clé Brevo en clair ». Supprimer une clé du code ne la supprime pas de l'historique : **quiconque peut lire le dépôt peut la retrouver**.
*Exemple :* c'est comme retirer une clé de la porte mais laisser le double accroché au tableau, visible de la rue.
*Action :* **révoquer cette clé et en générer une nouvelle** dans Brevo, puis la stocker dans les variables d'environnement, jamais dans le code. (Je n'affiche pas la valeur ici.)

**C3. Des fichiers sensibles ou de production sont versionnés dans le dépôt web.**
- `.cert/localhost-key.pem` : une clé privée TLS est suivie par Git.
- `essai-adms/config.json` : l'adresse de production de la base est en dur.
- `dev-dist/` : fichiers générés, 14 000 lignes inutiles suivies par Git.

*Action :* les retirer du suivi Git (`git rm --cached`), les ajouter au `.gitignore`, fournir un `config.example.json`.

**C4. Le tableau de bord peut afficher « tout va bien » quand tout échoue.**
Dans `Dashboard.jsx`, la fonction `minutesDepuisMinuit` est utilisée sans être importée (dans la branche `main` actuelle, l'import est présent ; le correctif est donc bien passé, mais il faut vérifier qu'il est déployé). Par ailleurs, si la base ne répond pas, l'écran peut afficher un bandeau vert « La journée se déroule normalement ».
*Exemple :* le gérant voit « 0 retard, 0 absent » parce que le serveur ne répond pas, et il ne le sait pas.
*Action :* un état d'erreur explicite, sans jamais afficher de bandeau vert en cas d'échec (le Gardien a préparé ce correctif ; à pousser).

**C5. Témoignages clients fictifs sur le site public.**
`src/pages/en-check.jsx` (ligne ~272) cite une personne et une entreprise inventées.
*Risque :* juridique et de confiance, pour un produit dont la promesse est l'honnêteté.
*Action :* retirer en semaine 1. Remplacer par de vrais retours de testeurs ou des chiffres réels vérifiables.

### 🟠 Important — dans le mois

**I1. Pas de sauvegarde testée, pas de migrations versionnées, pas de CI.** Le Gardien a préparé un script de sauvegarde, mais il n'est pas dans le dépôt et la restauration n'a pas été démontrée. Sans cela, une erreur sur la base est irréversible.
*Exemple :* un salarié de 200 personnes dont les pointages du mois disparaissent : sans sauvegarde testée, c'est la fin de la confiance.

**I2. Les calculs de paie n'ont aucun test automatisé dans `main`.** Les 14 tests annoncés ne sont pas poussés.
*Exemple :* une erreur d'une ligne sur la CNSS peut faire payer 2 000 FCFA de trop à 100 salariés sans que personne ne le voie.

**I3. L'application mobile n'est pas publiable en l'état.**
- Identifiant technique `com.example.en_check` (identifiant d'exemple, à remplacer avant publication).
- Test Flutter qui ne compile pas (c'est le test « compteur » du modèle Flutter).
- URL de production codée en dur : tout test écrit dans la vraie base.

**I4. Les gros fichiers.** `Devis.jsx` (5 475 lignes), `Pointages.jsx` (4 351), `payrollService.js` (2 282), `pointage_screen.dart` (3 137). Modifier un écran revient à risquer de casser les autres.
*Exemple :* c'est une armoire où tout est rangé dans un seul tiroir : pour sortir une chemise, on risque de renverser le reste.

**I5. Anticipation seulement « à l'ouverture ».** Le balayage des alertes est déclenché par le navigateur, au plus une fois toutes les 5 minutes (`useNotifications.js`).

**I6. Le travail de l'application mobile n'est pas relié au reste.** Le pointage (matricule + PIN sur tablette) et l'espace employé (web, e-mail + mot de passe) ne se connaissent pas. Le code d'entreprise (ex. « SIKA ») n'a pas de mode d'emploi pour l'employé.

**I7. Deux kiosques de pointage à maintenir** (`/poste` en React et le mode tablette Flutter). Il faut en choisir un.

### 🟡 À surveiller

- Messages d'erreur bruts (« Erreur : … ») visibles par les employés.
- Accessibilité absente dans l'application mobile (lecteurs d'écran, tailles de boutons, contrastes en plein soleil).
- Identité visuelle en deux styles (noir et ambre sur le web, sable et or sur le mobile).
- Pas d'environnement de test séparé de la production.

---

## 4. Les trois pistes (cohérentes avec le cap CEO v2.1)

Pour éviter la dispersion (le plus grand risque, selon le cap), tout le travail se range dans trois pistes parallèles :

| Piste | Question à laquelle elle répond | Exemple de résultat |
|---|---|---|
| 🛡️ **Protéger** | Peut-on perdre des données ou des euros ? | Sauvegarde restaurée en moins de 30 minutes, tests de paie verts |
| 💰 **Vendre** | Un client peut-il comprendre et acheter ? | Offre claire, site honnête, paiement mobile money |
| 🔔 **Anticiper** | En-Check prévient-il avant le problème ? | Alerte envoyée même si personne n'ouvre l'application |

---

## 5. Feuille de route proposée (18 mois, 4 phases)

Les phases reprennent les « vagues » du cap CEO v2.1. Les durées sont des estimations à valider.

### Phase 0 — Assainir (semaines 1 à 2)
*Objectif : ne plus mentir et ne plus exposer de secrets.*

| Tâche | Piste | Responsable proposé | Critère « fini » |
|---|---|---|---|
| Révoquer et remplacer la clé Brevo | Protéger | Fondateur | Ancienne clé inactive, nouvelle dans les variables d'environnement |
| Retirer les fichiers sensibles du suivi Git (C3) | Protéger | Gardien des fondations | `git ls-files` ne montre plus de `.pem` ni de `config.json` de prod |
| Pousser le correctif du tableau de bord (C4) | Protéger | Gardien des fondations | Pull Request fusionnée, test manuel d'une panne simulée |
| Retirer les témoignages fictifs (C5) | Vendre | Direction produit | Aucune personne inventée sur le site |
| Pousser les travaux du Gardien (tests, scripts) | Protéger | Gardien des fondations | Présents dans `main` |
| Sécuriser l'identifiant de l'application mobile | Vendre | Ouvrier mobile | Identifiant définitif choisi |

### Phase 1 — Fondations (semaines 2 à 6)
*Objectif : pouvoir restaurer et vérifier avant d'alerter.*

1. **Sauvegarde et restauration démontrées en moins de 30 minutes**, sur un environnement de test (jamais sur la production). *Critère du cap CEO.*
   *Exemple :* on vide volontairement une base de test, on la restaure, on compte les lignes : le compte doit être identique.
2. **Tests automatisés des trois moteurs de calcul** : heures, fiscalité, paie. Lancés à chaque modification.
3. **Intégration continue** : chaque modification passe automatiquement les tests avant d'être fusionnée.
4. **Séparation test / production** : un environnement de recette avec des données fictives.
5. **Migrations versionnées** : chaque changement de base est un fichier daté, rejouable.
6. **Vérification de la fiscalité par pays** : le Congo reste bloqué tant qu'un expert-comptable local n'a pas validé (cohérent avec le code actuel, qui refuse déjà les pays non vérifiés).

### Phase 2 — Anticiper (mois 2 à 4)
*Objectif : l'alerte part sans que personne n'ouvre l'application.*

1. **Déplacer la surveillance côté serveur** : une tâche planifiée (`pg_cron`) tourne toutes les X minutes, même si personne n'est connecté.
2. **8 signaux seulement** au départ, avec des seuils prudents (le cap prévient : trop d'alertes tue l'alerte).
   *Exemples de signaux :*
   - « Absence non déclarée » : aucun pointage à l'heure habituelle, sans congé enregistré.
   - « Pointages en attente » : un appareil terrain n'a pas synchronisé depuis 3 heures.
   - « Bulletin non vérifié » : une fiche de paie est bloquée par le filet fiscal.
3. **Canaux sans coût pour démarrer** : notification push (déjà construite), e-mail quotidien, puis bot Telegram.
4. **Trois clients pilotes** pour mesurer : nombre d'alertes justes, alertes inutiles, délai de réaction.

### Phase 3 — Vendre (mois 4 à 9)
*Objectif : un premier client payant qui se fait confiance.*

1. **Offre simple à trois niveaux** (grille v2.1, prix divisés par 2,5) :
   - *Essentiel* ≈ 10 000 FCFA/mois + 400 FCFA par employé ;
   - *Terrain* ≈ 30 000 FCFA/mois + 600 FCFA par employé (alertes complètes, hors ligne, application mobile) ;
   - *Groupe* sur devis.
   Garde-fous : installation facturée à part, -10 % en cas de paiement annuel.
2. **Paiement** : Fedapay branché via Cartflox, sans commission annoncée (à vérifier avant engagement).
3. **Publication de l'application Android** (Google Play) après les corrections de la phase 0.
4. **WhatsApp officiel** seulement quand un client le paie (environ 5 à 10 FCFA par message). **Interdit :** les passerelles non officielles, risque de bannissement du numéro.

### Phase 4 — Étendre (mois 9 à 18)
*Objectif : passer de quelques clients à une offre répétable.*

1. Pays : Bénin, Côte d'Ivoire, Sénégal d'abord ; Congo après validation locale.
2. **Découpage des gros fichiers** et unification de l'identité visuelle entre web et mobile.
3. **Un seul kiosque de pointage** de référence (Flutter recommandé), l'autre gelé.
4. **Espace employé relié à l'application** (« Mon espace » depuis le pointage).
5. **Installation autonome** par le client (réduire le coût de support, protection de marge).

---

## 6. Indicateurs à suivre chaque semaine (revue de 30 minutes)

| Indicateur | Pourquoi | Cible indicative |
|---|---|---|
| Délai de restauration de la sauvegarde | Preuve que les données sont protégées | < 30 min |
| Tests verts sur `main` | Preuve que les calculs tiennent | 100 % |
| Pointages perdus | Confiance (la promesse centrale) | 0 |
| Alertes justes / alertes envoyées | Éviter la fatigue d'alerte | > 70 % au départ |
| Délai entre un événement et l'alerte | Mesure de l'anticipation | < 15 min |
| Clients pilotes actifs | Preuve de valeur | 3 puis 10 |

---

## 7. Décisions que le PDG doit prendre

1. **Valider les priorités de la phase 0**, notamment la révocation de la clé Brevo (urgente).
2. **Confirmer la source de vérité du code** : quel commit fait foi pour le Gardien des fondations ? Le travail local doit être poussé sur GitHub.
3. **Choisir le kiosque de référence** : Flutter (recommandé ici) ou React `/poste`.
4. **Valider la liste des 8 signaux** de la phase 2 avec 2 ou 3 clients pilotes.
5. **Trancher le calendrier Congo** : après validation locale, sans date promise publiquement.

---

## 8. Règles de travail entre IA et humains

- Chaque chantier a un identifiant (`VD-xx`), un responsable et un critère « fini ».
- Rien n'est « fait » tant qu'il n'est pas **fusionné dans `main`** avec tests verts.
- Une IA qui commence un chantier l'annonce ; une IA qui bloque le signale le jour même.
- Toute demande hors de cette feuille de route passe par le PDG, jamais directement dans un planning.
- Ce document est vivant : il est revu chaque semaine.

---

## 9. Ce que cette proposition ne couvre pas

- Pas de promesse chiffrée de chiffre d'affaires : aucune donnée commerciale n'a été fournie.
- Les prix sont ceux du cap CEO v2.1, à valider avec les premiers prospects.
- Les conseils fiscaux restent à valider par un expert-comptable local pour chaque pays.
- Je n'ai pas exécuté l'application mobile (pas d'émulateur) : les constats mobiles viennent du code.
