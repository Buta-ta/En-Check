# RECONNAISSANCE FACIALE — les fiches du visage et leurs règles

> Les enrôlements faciaux et la configuration du module ne font plus qu'une
> page. Le dessin est celui du velours kuba : terre brune, raphia, écru, des
> losanges qui s'emboîtent et des chevrons en lisière. La mécanique n'a pas
> bougé : mêmes tables, mêmes colonnes, même photo signée.

La planche est dans le dépôt : `docs/design/refonte-reconnaissance-faciale.png`.

---

## 1. Ce qui a fusionné

| Avant | Après |
| --- | --- |
| `Enrôlements faciaux` → `/enrollements-faciaux` (`GestionEnrolements.jsx`) | **Reconnaissance faciale** → `/reconnaissance-faciale` (`ReconnaissanceFaciale.jsx`) |
| `Configuration faciale` → `/config-reco-faciale` (`ConfigRecoFaciale.jsx`, écran noir à part) | la même page, sous l'onglet **Réglages** |

- **le menu** n'a plus qu'une entrée : **Reconnaissance faciale** (section
  *Outils*, icône `ScanFace`) ;
- **deux adresses restent vivantes** pour les signets et les liens déjà
  partagés : `/enrollements-faciaux` et `/config-reco-faciale` redirigent
  (`replace`) vers `/reconnaissance-faciale` ;
- **les deux anciennes pages sont supprimées** : elles étaient écrites en
  styles inline sur fond `#0A0A0F`, avec des emojis de statut. Il n'en reste
  rien ;
- **le verrou des options payantes** : `/reconnaissance-faciale` dépend de
  `module_reconnaissance_faciale` — une seule clé, un seul verrou ;
- **l'assistant** (`face_enrollment`) et **la recherche** envoient sur la page
  unique ;
- **les deux adresses retirées gardent le motif kuba** : un signet qui
  redirige ne change pas d'identité en chemin.

## 2. Le velours kuba

Planning et Reconnaissance faciale partagent le même bandeau
(`public/images/planning-kuba.webp`) : c'est le motif du produit, pas un
décor de circonstance. Les deux pages restent distinctes par leur mise en
page — Planning est un calendrier, celle-ci un registre de fiches — et par
leurs jetons de couleur (`--rf-*` contre `--pl-*`).

| Rôle | Nuit | Jour |
| --- | --- | --- |
| fond | `#171009` terre | `#f2e7d4` écru |
| panneau | `#241a12` | `#fbf4e7` |
| matière d'accent | `#c98a4b` raphia | `#a4652a` |
| encre | `#f1e3c8` écru | `#2b1d10` terre |

- la **lisière** sous le bandeau est une frise de chevrons dessinée en SVG
  (data-URI), pas une image ;
- le **blason** (`KubaSvg.jsx`) est un losange concentrique dans un carré
  bordé de chevrons, traversé de quatre fils ;
- la **bascule clair/sombre** est propre à la page (`aria-checked`) et
  retourne toute la palette, pas seulement le fond ;
- les couleurs d'**état** restent celles du produit : vert validée, ambre
  en attente, rouge refusée.

## 3. L'écran, de haut en bas

1. **le bandeau kuba** (76 px en haut, 32 px en bas), puis la lisière ;
2. **l'en-tête** — retour au tableau de bord, blason, titre, sous-titre,
   pastille « n à valider », bascule de thème ;
3. **le seuil** — l'entreprise (et son nombre de fiches actives) à gauche,
   les raccourcis vers les autres pages à droite ;
4. **les quatre registres** — Fiches faciales, À valider, Validées, Refusées,
   avec ce que chaque chiffre veut dire ;
5. **le sommaire** — deux onglets : *Enrôlements*, *Réglages* (avec un point
   quand des réglages ne sont pas enregistrés) ;
6. **la vue Enrôlements** — folio, chiffres de rappel, recherche, entreprise
   (`super_admin`), quatre clés de statut, *Actualiser*, puis le registre des
   fiches : portrait signé, nom, matricule, entreprise, date, motif de refus
   éventuel, sceau d'état, et les gestes en mots ;
7. **la vue Réglages** — quatre feuillets : *La sécurité* (seuil, vivant),
   *L'enrôlement* (validation, borne), *En cas d'échec* (tentatives, autre
   mode, avertissement), *Le mode de pointage* (trois cartes radio) ; au pied,
   l'état des changements et les deux boutons ;
8. **le pied** — la bande kuba en bas.

## 4. Les gestes, et ce qu'ils écrivent

| Geste | Écriture | Retour à l'écran |
| --- | --- | --- |
| **Valider** | `status: approved`, `approved_by`, `approved_at`, `updated_at` | « La fiche de X est validée : son visage sert désormais au pointage. » |
| **Refuser** | `status: rejected`, `rejection_reason` (**obligatoire**), `updated_at` | le motif est relu dans la ligne ; un refus sans motif ne part pas |
| **Ré-enrôler** | `is_active: false`, `updated_at` | « Ré-enrôlement demandé pour X : sa fiche est désactivée… » |
| **Supprimer** | `delete` sur `face_enrollments.id`, après confirmation | « La fiche de X est supprimée. X devra se ré-enrôler. » |
| **Enregistrer les réglages** | `upsert(..., { onConflict: 'enterprise_id' })` + `updated_at` | « Réglages enregistrés pour <entreprise>. » |

Aucun geste ne part sans son retour : l'avis est daté par son texte, au ton
vert ou rouge, et un refus de la base est dit en français. Les fenêtres se
ferment par `Échap` ou par le voile, et bloquent le défilement du fond.

## 5. Les contrats de données (inchangés)

### `face_enrollments`

- statuts : `pending`, `approved`, `rejected` ;
- colonnes lues : `is_active`, `enrollment_photo_url`, `rejection_reason`,
  `approved_by`, `approved_at`, `updated_at`, `enterprise_id`, `created_at` ;
- lecture jointe : `employees(id, first_name, last_name, matricule, photo_url)`
  et `enterprises(id, name)`, tri `created_at desc` ;
- filtre `enterprise_id` ; le filtre de statut et la recherche se font sur la
  liste déjà chargée, sans nouvelle requête ;
- les photos passent par `PhotoSignee` (bucket privé, signature à l'heure) ;
  une fiche sans photo affiche ses initiales, pas une image cassée.

### `face_recognition_config`

Une ligne par entreprise, jamais deux :

| Clé | Bornes / valeurs | Défaut |
| --- | --- | --- |
| `confidence_threshold` | `0.60` → `0.95`, pas `0.01` | `0.80` |
| `liveness_required` | booléen | `true` |
| `admin_approval_required` | booléen | `true` |
| `fallback_allowed` | booléen | `true` |
| `max_attempts` | `1` → `10` | `3` |
| `kiosk_mode_enabled` | booléen | `false` |
| `pointage_mode` | `free` · `face_required` · `face_exclusive` | `free` |

`fallback_allowed: false` affiche l'avertissement : « Sans autre mode, un
employé non reconnu ne peut pas pointer du tout. » Un réglage appartient à une
entreprise : le `super_admin` doit en choisir une avant de régler quoi que ce
soit — « Toutes les entreprises » n'a pas de seuil.

## 6. Ce que les tests tiennent

`src/services/__tests__/reconnaissanceFaciale.test.jsx` — **33 tests** :

- une seule route, deux redirections, une entrée de menu, un verrou ;
- l'entreprise retenue par l'en-tête est reprise à l'ouverture ;
- le motif kuba pour la page et pour les deux anciennes adresses, le vrai
  bandeau, le blason dessiné ;
- les contrats de lecture et d'écriture, les bornes, `onConflict` ;
- les quatre décisions avec une fausse base qui journalise chaque écriture ;
- le refus sans motif qui ne part pas, le refus avec motif qui part ;
- les réglages lus, bornés, enregistrés sur la bonne entreprise, et le bouton
  qui reste inerte tant que rien n'a changé ;
- le survol qui ne touche ni le fond, ni la couleur, ni l'opacité ;
- aucun mot d'atelier, aucun nom technique, aucun emoji d'état à l'écran ;
- une planche de référence qui existe dans le dépôt.

État de la suite : **127 fichiers / 1 447 tests ✓**, `vite build` ✓,
`eslint src --config eslint.gate.config.js` : **0 erreur** (1 avertissement
d'origine dans `EnterpriseSelectorModal.jsx`).
