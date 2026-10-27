# MESSAGES SYSTÈME — les annonces, les push et les courriels sur une seule toile

> Deux pages tenaient la même promesse sans se parler : **Messages
> système** publiait des annonces affichées dans le tableau de bord,
> **Notifications push** envoyait des alertes aux téléphones. Elles font
> maintenant **une page**, dessinée comme une toile de korhogo — la même
> famille qu'Entreprises, Configuration pointeuse et Analytics du site.
> Et « Mon compte » quitte la barre latérale : « Administrateurs »
> l'accueille déjà.

La planche est dans le dépôt : `docs/design/refonte-messages-systeme.png`
(1500 × 2716).

---

## 1. Ce qui a fusionné

| Avant | Après |
| --- | --- |
| `SystemMessages` → `/system-messages` (1 003 lignes, styles en ligne) | **Messages système** → `/system-messages`, vue *Annonces* |
| `PushNotifications` → `/push-notifications` (1 142 lignes, deux onglets `push`/`email`) | la même page, vues *Notifications push* et *E-mails* |
| `EmailDeliveryMonitor` (887 lignes, 7 cartes de chiffres, listes en styles en ligne) | **remplacé** : `CourrielsSysteme` + `lib/courriels.js`, vue *E-mails* |

- **une seule entrée de menu** : **Messages système** (icône `Bell`) ;
  « Notifications push » disparaît de la barre ;
- **une seule adresse** : `/system-messages` — `/push-notifications`
  redirige vers `/system-messages?vue=push` ;
- les deux anciens fichiers de page sont supprimés
  (`SystemMessages.jsx`, `PushNotifications.jsx`) ; aucun pointeur
  `/push-notifications` ne subsiste hors de la redirection ;
- **aucune fonction serveur nouvelle** : `messages_systeme`, `push_logs`,
  `encheck_email_logs` gardent leurs colonnes, l'edge `send-push` garde son
  contrat (`{ user_type, enterprise_id, user_ids, title, body, url, tag,
  severity, requireInteraction, vibrate }` → `{ sent, failed, total }`).

## 2. « Mon compte » quitte la barre

Demandé tel quel : la page « Administrateurs » intègre déjà « mon compte ».

- l'entrée `Mon compte` (`/mon-compte`) est retirée de
  `DashboardExperience.jsx` ;
- **la route reste** : `App.jsx` sert toujours `/mon-compte`
  (`MyAdminAccount`), et `AdminAccounts` y mène par un lien
  `to="/mon-compte"` ;
- les autres appelants ne bougent pas : `AdminAccountPreferences`,
  `AdminVerifiedEmail`, `Login.jsx` (`home_path`), `culturalMotif.js`
  (motif `abomey`).

## 3. La toile de korhogo

| Jeton | Nuit | Jour | Rôle |
| --- | --- | --- | --- |
| `--ms-fumee` | `#171310` | `#f4ecdc` | le mur |
| `--ms-carte` | `#241d18` | `#fbf6ea` | la planche |
| `--ms-creux` | `#100c0a` | `#f1e8d7` | le fond des champs |
| `--ms-coton` | `#f2e8d5` | `#241c16` | le texte |
| `--ms-coton-doux` | `#cbbda4` | `#4a3c2f` | le texte secondaire |
| `--ms-faible` | `#9a8b73` | `#7a6a55` | les libellés |
| `--ms-ocre` | `#c9773c` | `#a8581f` | l'accent, l'onglet ouvert |
| `--ms-terre` | `#8b3e1d` | `#7d3517` | la lisière |
| `--ms-or` | `#c9a961` | `#8a6a20` | les traits, le focus |
| `--ms-vert` | `#10b981` | `#0f7a58` | accepté |
| `--ms-attente` | `#f59e0b` | `#a35a06` | à surveiller |
| `--ms-alerte` | `#ef4444` | `#9b1c1c` | échec |
| `--ms-ecru` | `#efe4cf` | `#fbf6ea` | le cartouche à écrire |

- angles courts, cadres tracés au trait, lisière de chevrons en haut ;
- aucune couleur de survol : `:hover` ne touche ni le fond, ni la couleur
  du texte, ni l'opacité — seulement le trait et le soulignement ;
- bascule **clair/sombre** propre à la page (`useTheme`, `.ms-clair`) ;
- quatre points de rupture : 1180, 980, 720 px, plus
  `prefers-reduced-motion`.

## 4. Les trois vues

Le sommaire porte des compteurs réels, et l'adresse garde la vue choisie
(`?vue=annonces|push|emails`).

### Annonces — ce qui s'affiche sur les écrans

- formulaire dans un cartouche d'écru : type (`info`, `maintenance`,
  `mise_a_jour`), priorité, cible (`tous`, `admins`, `employes`), fenêtre
  `date_debut` / `date_fin`, titre, message ;
- **aperçu du bandeau** à droite, qui suit la saisie ;
- état calculé : `active`, `a_venir`, `terminee`, `coupee` ;
- interrupteur pour couper/rallumer, corbeille pour supprimer (fenêtre de
  confirmation) ;
- le bandeau lui-même (`SystemMessageBanner`) n'est pas modifié : il lit
  toujours `messages_systeme` avec `is_active`, sa cible et sa plage.

### Notifications push — ce qui part vers les téléphones

- composeur : cible (`all`, `admins`, `employees`, `enterprise`,
  `admin`, `employee`), gravité, « Sonne même en veille », aperçu
  téléphone ;
- **« Qui sera touché »** : le compte est dit avant l'envoi
  (`resumeDestinataires`), jamais après ;
- envoi : `POST ${VITE_SUPABASE_URL}/functions/v1/send-push` avec
  `Authorization: Bearer <access_token>` issu de
  `supabase.auth.getSession()` — l'absence de session est dite
  (« Session expirée »), pas ignorée ;
- l'historique de la période se filtre par gravité et par destinataire
  **sans rappeler le serveur**, s'exporte en CSV (`;`, 7 colonnes, BOM),
  et se vide après saisie du mot **`EFFACER`** ;
- le son de confirmation reste dans `localStorage['push_sound_enabled']`.

### E-mails — ce qui arrive par courriel

Le moniteur de 887 lignes n'est plus embarqué : il a été **repris de
zéro** dans `CourrielsSysteme` (planche :
`docs/design/refonte-courriels.png`, 1500 × 1900). Rien n'est perdu, tout
est redessiné.

- **lisière de santé** sur un seul trait : Expéditeur, Brevo/SMTP, Origine
  du site, Secret SQL, chaque critère avec son point et son verdict ; le
  détail bloque l'envoi et le dit ;
- **registre à sept compteurs** sur une ligne de fumée — tentatives,
  acceptés, échecs, partiels, non envoyés, bloqués, aujourd'hui — au lieu
  de sept cartes séparées ;
- **note de lecture** : les chiffres portent sur les tentatives chargées,
  et « accepté » ne veut pas dire « reçu » ;
- **journal** : un cartouche par tentative, rail coloré par statut,
  sujet, date, entreprise, source, adresses, compteurs, erreur ;
  - détail déplié : résultat **par adresse**, trace technique
    (fournisseur, identifiant, durée, archivé le), contenu enregistré,
    contrôle du routage ;
  - gestes : Relancer (confirmation en ligne), Corriger, Archiver /
    Restaurer, Détail ;
- **filtres** : recherche, statut, source, voir les archivés — tout se
  fait sur les lignes chargées, **sans rappeler le serveur** ; export CSV
  de la vue ;
- **pagination réelle** : « Charger les 250 tentatives plus anciennes »
  interroge la page suivante (`range`) ;
- **composeur** dans la fenêtre partagée (`FenetreModale`, taille
  `large`) : mode (mon adresse, un administrateur, des adresses, une
  entreprise), sujet, lien, lignes d'alerte éditables, **aperçu
  obligatoire** des destinataires réels, puis saisie de **`ENVOYER`**
  avant l'envoi. Le résultat du fournisseur est dit (accepté, partiel,
  échec), et un journal indisponible est signalé au lieu d'être masqué.

Deux corrections de fond au passage : la vue lisait `created_at`, qui
n'existe pas dans `encheck_email_logs` — la colonne réelle est `cree_le` ;
et la stèle de la page ne compte plus les tentatives archivées.

## 5. La bibliothèque

`src/lib/messagesSysteme.js` — aucune dépendance React, aucune requête :

| Groupe | Fonctions |
| --- | --- |
| mots | `MOT_CONFIRMATION`, `TYPES_ANNONCE`, `PRIORITES`, `CIBLES`, `GRAVITES`, `CIBLES_ENVOI`, `PERIODES` |
| annonces | `etatAnnonce`, `compterAnnonces`, `trierAnnonces`, `plageAnnonce` |
| envois | `graviteDe`, `libelleCibleLog`, `filtrerEnvois`, `resumeEnvois`, `partPourcent` |
| courriels | `statutCourriel`, `resumeCourriels` (déplacés dans `lib/courriels.js`) |
| sortie | `construireCSV`, `dateHeure`, `dateCourte`, `tempsRelatif` |
| garde-fous | `confirmationValide`, `resumeDestinataires`, `nomPersonne` |

Le CSV tient en sept colonnes : `Quand ; Titre ; Message ; Gravité ;
Destinataires ; Envoyés ; Échecs`.

`src/lib/courriels.js` — même règle, aucune dépendance :

| Groupe | Fonctions |
| --- | --- |
| mots | `STATUTS_COURRIEL`, `SOURCES_COURRIEL`, `GRAVITES_LIGNE`, `MODES_ENVOI`, `MOT_ENVOI`, `TAILLE_PAGE` |
| lecture | `statutCourriel`, `metaStatut`, `sourceDe`, `metaSource`, `adressesDe`, `resultatsDe`, `lignesDe`, `analyseDe` |
| compte | `compteCourriels`, `resumeCourriels`, `filtrerCourriels` |
| gestes | `peutRelancer`, `peutCorriger`, `adressesRelance` |
| santé | `santeCourriels` (critères, manquants, `peutEnvoyer`, `envoisAuto`) |
| brouillon | `adressesValides`, `brouillonVide`, `brouillonRelance`, `destinatairesBrouillon`, `resumeBrouillon`, `requeteCourriel` |
| sortie | `confirmationEnvoiValide`, `construireCSV`, `dateCourriel`, `dureeCourriel` |

## 6. Vérifications

- `src/services/__tests__/courrielsSysteme.test.jsx` — **44 tests** :
  statuts et sources, adresses et résultats, dates et durées, compte des
  sept familles sur `cree_le`, filtres et recherche, relance/correction,
  santé de la fonction, brouillon et corps envoyé, CSV, puis la vue :
  lisière, registre, journal, détail, archivage, export, pagination,
  aperçu obligatoire, `ENVOYER`, succès et échec dits, et la lecture du
  dessin (styles en ligne, emoji, survols, responsive, fenêtre partagée) ;
- `src/services/__tests__/messagesSysteme.test.jsx` — **43 tests** :
  fusion et redirection, disparition des entrées de menu, « Mon compte »
  hors barre mais page vivante, motif korhogo, bibliothèque, publication,
  coupure, suppression, aperçu, composeur, envoi réel (fetch simulé),
  échec dit, filtres locaux, export CSV, vidage après `EFFACER`, son,
  moniteur e-mail, styles en ligne, emoji, survols, responsive, position
  des raccourcis ;
- `adminAccounts.test.jsx` est mis à jour : la barre ne porte plus
  `/mon-compte`, la route et le lien depuis « Administrateurs » restent ;
- `eslint src` — 0 erreur (1 avertissement d'origine) ;
- `vite build` — passe.

## 7. Ce qui n'a pas bougé

`SystemMessageBanner.jsx`, `supabase/functions/send-email`,
`supabase/functions/send-push/index.ts`, les tables `messages_systeme`,
`push_logs`, `encheck_email_logs`, `PageCulturalBand`, `RaccourcisPages`,
`ThemeContext`, `KorhogoSvg`.
