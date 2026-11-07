# En-Check comme agrégateur d'outils administratifs — recherche

> **Nature de ce document** : recherche, aucune ligne de code. La question posée :
> « Existe-t-il ailleurs des outils, des géants, qui agrègent déjà des outils
> administratifs — déclaration d'impôt, déclaration des employés — et qu'on
> pourrait brancher directement depuis En-Check ? »

---

## 1. Ce que « agrégateur » peut vouloir dire

Le mot recouvre **six métiers différents**, exercés par des acteurs différents,
avec des modèles économiques différents. Les confondre est la première erreur de
conception : on croit choisir une fonctionnalité, on choisit en réalité un rôle
réglementaire.

| # | Modèle | La promesse | Exemples |
| --- | --- | --- | --- |
| A | **Le registre de paie devenu guichet** | « Je détiens la vérité sur vos salariés, donc je produis toutes vos déclarations » | ADP, Gusto, PayFit, Silae |
| B | **Le concentrateur déclaratif** | « Un seul fichier remplace quatre-vingts formalités » | DSN / net-entreprises (France) |
| C | **La plateforme agréée (réseau d'intermédiaires)** | « L'État n'accepte que des intermédiaires immatriculés — je le suis » | Plateformes Agréées (France 2026), SFE e-MECeF (Bénin), Access Points (Nigeria) |
| D | **L'API unifiée** | « Vous ne parlez plus à trente outils, vous parlez à moi » | Merge, Apideck, Finch, Codat, Nango, Paragon |
| E | **La conformité fiscale en service** | « Je calcule, je certifie, je dépose, dans 150 pays » | Avalara, Sovos, Vertex, Fonoa, DDD Invoices |
| F | **Le guichet unique d'État et l'interopérabilité** | « L'administration elle-même n'a plus qu'un portail » | service-public.bj, monentreprise.bj, e-services DGI Bénin |

En-Check est aujourd'hui un outil du modèle A par ses données (employés,
pointages, absences, paie) **sans en exercer le rôle** : il produit des chiffres,
pas des déclarations. Tout le reste de ce document décrit ce qui existe, puis ce
que cela implique.

---

## 2. Modèle A — le registre de paie devenu guichet

### ADP : le cas le plus abouti

ADP traite la paie d'environ **un salarié américain sur six** et a construit
autour de sa paie une place de marché : **711 applications, 240 éditeurs
partenaires** (relevé novembre 2024), avec achat et essai directement dans le
catalogue ; ADP revendique par ailleurs plus de 500 intégrations préconstruites.
L'API est exposée deux fois : *ADP Marketplace* pour les éditeurs, *API Central*
pour les clients qui veulent construire leurs propres échanges.

Ce qui fait l'agrégateur n'est pas le catalogue : c'est le **registre
d'employés** en amont. Tous les autres outils ont besoin de la même donnée de
base (qui travaille, depuis quand, à quel salaire, dans quelle entité), et ADP la
détient.

### Rippling : l'agrégateur qui part de l'identité

Rippling revendique **600 à 650 intégrations**, un *App Shop* lancé en 2020, la
paie dans **50+ pays** et une promesse différente : un seul enregistrement
employé déclenche la paie, les accès logiciels (SCIM), les appareils (MDM) et la
finance. C'est l'agrégation **par événement de vie** — embauche, mutation,
départ — plutôt que par formulaire.

### Gusto et Payfit : l'agrégateur vertical

Gusto documente deux programmes distincts : *Gusto Embedded* (la paie devient
une brique dans le produit d'un autre, sans que Gusto soit visible) et *App
Integrations* (les outils tiers se branchent chez Gusto). PayFit applique la même
logique en France sur la DSN. Le point notable : **l'API est vendue séparément de
la paie**, comme un produit.

### Ce que ça coûte, ce que ça rapporte

| Plateforme | Modèle affiché | Repère public |
| --- | --- | --- |
| Gusto | abonnement + par salarié | 40–49 $/mois + 6 $/salarié |
| Rippling | par salarié, modules séparés | 8 $/salarié + modules |
| ADP | devis, marché transactionnel | commission sur les éditeurs |
| Gusto Embedded / Rippling Embedded | API embarquée | contrat séparé |

**Leçon 1** : le revenu d'agrégation ne vient pas du catalogue, il vient du fait
d'être **le point d'entrée incontournable** d'une donnée que les autres doivent
consommer.

---

## 3. Modèle B — le concentrateur déclaratif (le précédent le plus utile)

La **DSN** française est le cas d'école : un fichier mensuel produit par la paie
remplace « près de 80 procédures » (URSSAF, CPAM, retraites, France Travail,
DGFiP, organismes complémentaires, enquêtes d'effectifs…). Deux canaux
officiels : dépôt de fichier EDI, ou **API « machine to machine »** sur
net-entreprises.fr.

Trois conséquences transposables :

1. **Le logiciel de paie devient le canal de déclaration.** Ce n'est pas un
   portail de plus : c'est le logiciel métier qui dépose, l'État ne fait que
   recevoir.
2. **Le concentrateur tiers est un métier reconnu.** Les cabinets comptables et
   les éditeurs peuvent déposer pour le compte de leurs clients : c'est le rôle
   de « tiers déclarant ».
3. **L'État y gagne.** La DSN a été poussée par une recommandation de la Banque
   mondiale pour supprimer les divergences entre déclarations.

---

## 4. Modèle C — la plateforme agréée : quand l'État crée le marché

C'est le modèle qui monte partout, et c'est **exactement la place que pourrait
prendre En-Check au Bénin**.

### France, réforme 2026-2027

- Depuis le **1er septembre 2026**, toute entreprise assujettie à la TVA doit
  pouvoir **recevoir** ses factures via une **Plateforme Agréée (PA, ex-PDP)**.
- L'**émission** devient obligatoire pour les grandes entreprises et ETI à la
  même date, pour les TPE/PME au **1er septembre 2027**.
- Le **Portail Public de Facturation a été abandonné** (octobre 2024) et recentré
  sur un rôle d'annuaire et de concentrateur : l'échange est **exclusivement
  privé**.
- **155 plateformes agréées** étaient immatriculées au 13 octobre 2026 (dont
  Sage, Cegid, Odoo immatriculée le 15/04/2026, Pennylane, Qonto, Yooz, Esker,
  Sovos…).

Trois modèles économiques coexistent :

| Modèle | Principe | Repère |
| --- | --- | --- |
| La PA est le produit | abonnement ou à la facture | TPE 15–60 €/mois, PME 50–150 €, ~0,0025 €/facture chez les *pure players* |
| Freemium | palier gratuit pour les micro-entreprises | 0 € puis 8–50 €/mois |
| **Inclus dans un logiciel déjà payé** | la conformité devient une fonction du produit | Sage, Cegid, Odoo |

### Nigeria, Bénin, Côte d'Ivoire : le même mécanisme, sous d'autres sigles

- **Nigeria** : mandate B2B/B2G par vagues (grands contribuables en novembre
  2025, moyens au 1er juillet 2026, petits en 2027), format **Peppol BIS 3.0**,
  passage obligé par des **Access Point Providers** agréés, **IRN + QR code** par
  facture. La FIRS est devenue autorité Peppol nationale.
- **Côte d'Ivoire** : **FNE** en modèle *clearance* — aucune facture n'est
  juridiquement valide avant validation par la DGI ; plus de **52 000
  entreprises** inscrites en février 2026 ; l'inscription à la FNE est une
  **condition de l'attestation de régularité fiscale (ARF)**, donc de l'accès aux
  marchés publics.
- **Burkina Faso** : système certifié depuis janvier 2026 (FEC / e-FEC).
- **Niger, Mali** : SECeF. **RDC** : DEF. **Kenya** : eTIMS, rendu universel.
- **Sénégal** : toujours volontaire, mandat annoncé mais non publié.

**Leçon 2** : dans ce modèle, l'État **impose un intermédiaire privé
immatriculé**. Celui qui obtient l'immatriculation capte un flux récurrent et
obligatoire. Celui qui ne l'obtient pas devient un simple éditeur de logiciel.

---

## 5. Modèle D — l'API unifiée : vendre la plomberie

Ces sociétés ne gèrent aucune déclaration : elles vendent **une seule API pour
parler à des dizaines d'outils hétérogènes**.

| Acteur | Couverture | Positionnement | Prix public |
| --- | --- | --- | --- |
| **Merge** | ~220 intégrations, 6 catégories (HRIS, ATS, CRM, compta, ticketing, fichiers) | synchronisation + cache, entreprise | ~650 $/mois pour 10 comptes |
| **Apideck** | ~200 connecteurs, temps réel sans cache | SaaS, fintech | ~299–599 $/mois |
| **Finch** | ~220 systèmes d'emploi (paie, HRIS, avantages) | **écriture paie** — cotisations, retenues | sur devis |
| **Unified.to** | ~450 connecteurs | vie privée, temps réel | forfait |
| **Nango** | ~800 connecteurs, open source, auto-hébergé | équipes techniques | gratuit / self-hosted |
| **Paragon** | interface d'intégration *white-label* intégrée au produit | produit | ~35 $/mois, puis devis |
| **Codat** | compta, banque, commerce | fintech, prêt | sur devis |

À côté, la couche d'automatisation générique (Zapier, Workato, Make) fait la même
chose sans modèle de données métier : utile pour des enchaînements, insuffisant
pour une déclaration légale.

**Leçon 3** : il existe un métier rentable qui consiste à **exposer les données
d'un métier à d'autres logiciels**. Finch vend l'accès aux données de paie à des
prêteurs et des assureurs sans jamais faire de paie.

---

## 6. Modèle E — la conformité fiscale en service

| Acteur | Couverture revendiquée | Ce qu'il vend |
| --- | --- | --- |
| **Avalara** | 190+ pays, 1 200+ intégrations ERP | calcul de taxe, e-invoicing, déclarations |
| **Sovos** | ~200 pays, 70+ pays en *continuous transaction controls* | e-invoicing, reporting réglementaire, réseau de conformité |
| **Vertex** | détermination fiscale, connecteurs SAP/Oracle ; **Pagero** racheté (2024) pour le réseau e-invoicing | moteur fiscal entreprise |
| **Fonoa** | détermination dans 190+ juridictions, validation d'identifiants fiscaux dans 120+ pays, 50+ mandats e-invoicing ; rachat de l'Indirect Tax Edge de PwC (mai 2026) | API fiscale pour plateformes |
| **DDD Invoices** | API unique e-invoicing/fiscalisation, **Bénin inclus** | infrastructure blanche derrière l'ERP du client |

**Point clé pour En-Check** : DDD Invoices se présente non pas comme un logiciel
mais comme **une couche invisible derrière le produit d'un autre** — « la
conformité disparaît derrière votre interface ». C'est un modèle de partenariat
immédiatement accessible, sans agrément local à obtenir soi-même : En-Check
pourrait facturer la normalisation e-MECeF via ce type de fournisseur avant
d'obtenir son propre agrément.

---

## 7. Modèle F — l'État agrège déjà : le cas du Bénin

C'est la partie décisive, et elle change la conclusion.

### 7.1 Une déclaration unique paie + social existe depuis février 2020

Le Bénin a fusionné, le **3 février 2020**, la déclaration de l'**impôt sur les
salaires** et celle des **cotisations CNSS** en un **formulaire unique** sur
`eservices.impots.bj` :

- obligation pour toutes les entreprises du périmètre **SIGTAS** dès l'échéance
  de février 2020 ;
- dépôt mensuel **au plus tard le 10** du mois suivant ;
- **annexe nominative** par salarié, déposable en **fichier CSV** (modèle
  téléchargeable, séparateur point-virgule) ou saisie en ligne ;
- les entreprises hors SIGTAS, les gens de maison et les assurés volontaires
  restent au guichet CNSS ;
- en parallèle, `facile.impots.bj` gère le **télépaiement** via les banques
  partenaires.

Autrement dit : **l'agrégation déclarative paie/social est déjà faite par
l'État**. La valeur restante n'est pas « un portail de plus », elle est dans
**la production du fichier annexe exact** et dans le fait de ne jamais ressaisir.

### 7.2 La facturation électronique est un marché d'intermédiaires agréés

- Système **MECeF / e-MECeF**, piloté par le **SyGMEF** (`sygmef.impots.bj`),
  API sur `api.impots.bj/facturation` + `/informations`.
- Modèle *clearance* : la facture est transmise **avant** remise au client ; la
  DGI renvoie **NIM**, signature électronique et **QR code**.
- Un logiciel qui veut émettre doit être un **SFE (Système de Facturation
  d'Entreprise) homologué** : lettre d'approbation, numéro de référence, tests
  DGI. Exemples publics : `NFACTURE` (CONCEPTIC.IO, réf.
  `326/MEF/CAB/SGM/DGI/CGFN/BAT`), `geCloud` (SPEEDTECH, réf. `688`),
  `ECOHADA`, `OwoDesk`, `Faktoo` (agrément en cours).
- **Depuis le 20 juillet 2026, le SyGMEF impose la double authentification.**
- Archivage **10 ans** (norme OHADA), avoirs obligatoirement liés à la facture
  d'origine.
- Sanctions : **5 fois le montant non facturé, minimum 500 000 FCFA par facture**
  (article 502 du CGI 2026), 10 fois et fermeture administrative en récidive.

**Leçon 4** : c'est là que se trouve, au Bénin, l'équivalent exact du marché des
Plateformes Agréées françaises. Et les concurrents locaux y sont déjà
(CassKai, geCloud, Faktoo, NFacture, OwoDesk, ECOHADA).

### 7.3 Les guichets d'État existants

| Plateforme | Opérateur | Ce qu'elle fait | Intérêt pour En-Check |
| --- | --- | --- | --- |
| `monentreprise.bj` | APIEx / GUFE | création d'entreprise, RCCM + IFU en 3 h à 24 h, paiement mobile money | le **client** d'En-Check naît ici : identité légale, IFU |
| `service-public.bj` | État | portail unique de services, dont **déclaration des employés de maison** (CNSS + DGI + ASIN, nov. 2023), **interopérabilité ANIP** pour l'identité des personnes | précédent direct d'un portail qui agrège plusieurs administrations |
| `eservices.impots.bj` | DGI | déclaration et paiement (ITS, TVA, patente, CNSS) | le canal déclaratif à alimenter |
| `sygmef.impots.bj` / `api.impots.bj` | DGI | e-MECeF, API de facturation | le canal facturation à alimenter |
| `facile.impots.bj` | DGI | télépaiement bancaire | le paiement à déclencher |

---

## 8. Ce qui existe déjà en Afrique de l'Ouest et du Centre

### 8.1 Paie et RH avec conformité locale

| Acteur | Pays forts | Ce qu'il fait de remarquable |
| --- | --- | --- |
| **SeamlessHR** | Nigeria, Ghana, Kenya | moteurs **par pays** : PAYE, pension, NHF, ITF, NSITF (NG) ; PAYE, SSNIT (GH) ; PAYE, NHIF, NSSF (KE) |
| **Workpay** | Kenya, 40+ pays en EOR | paie multi-pays, **mobile money** (M-Pesa, MTN), ISO 27001, API |
| **PaidHR** | Nigeria | PAYE/pension multi-États, remises automatiques |
| **Bento Africa** | Nigeria | paie + services financiers embarqués |

Aucun de ces acteurs ne couvre le Bénin en moteur natif. C'est un **espace
libre**.

### 8.2 Gestion et conformité PME en Afrique francophone

| Acteur | Pays | Ce qu'il fait | À retenir |
| --- | --- | --- | --- |
| **Odoo** | large | ERP, `l10n_syscohada` communautaire, **Plateforme Agréée en France** depuis avril 2026 | la conformité est un module, pas le cœur |
| **Sage** | historique | compta, paie, PA en France | cher, orienté PME structurées |
| **Madata** | Côte d'Ivoire | SYSCOHADA natif, **FNE incluse**, paie ivoirienne, mobile money | le concurrent le plus proche du futur En-Check |
| **Sikalia** | Abidjan | facturation FNE/MECeF, compta OHADA, **paie CNPS/ITS + déclarations sociales**, **API complet** | exactement la promesse étudiée ici, déjà vendue |
| **CassKai** | OHADA | SYSCOHADA, e-MECeF, **DSF automatisée**, paie | couvre Bénin + CI |
| **JoonaPay** | UEMOA | 10 modules financiers, SYSCOHADA, mobile money, BCEAO en cours | agrégateur financier, pas déclaratif |

**Leçon 5** : « facture + SYSCOHADA + paie + déclarations » est **déjà un produit
commercial** en Afrique francophone. En-Check ne serait pas pionnier sur la
promesse, mais il part avec un actif que Madata ou Sikalia n'ont pas : **la
pointeuse, le planning et les heures réelles**.

---

## 9. Ce que cela implique pour En-Check

### 9.1 L'actif réel

| En-Check possède | Ce que les autres doivent acheter ailleurs |
| --- | --- |
| employés, contrats, départements | le registre (comme ADP) |
| pointages, pauses, retards, heures sup | la preuve d'heures (aucun agrégateur fiscal ne l'a) |
| absences, planning, jours fériés Bénin | la base de calcul des retenues |
| paie, profils, devise, pays | le net imposable et les cotisations |
| géopointage, reconnaissance faciale | la traçabilité, donc la valeur probante |

C'est **plus** que ce que Finch agrège chez les autres : En-Check produit la
donnée, il ne la lit pas seulement.

### 9.2 Les quatre portes d'entrée possibles

| Porte | Ce qu'on branche | Modèle | Effort / risque |
| --- | --- | --- | --- |
| **1. Social + fiscal** | annexe CNSS/ITS sur e-services, déclaration des nouveaux embauchés | gain de temps, inclus dans l'abonnement | **faible** : fichier CSV + procédure déjà publique |
| **2. Facturation e-MECeF** | API DGI pour émettre des factures normalisées | à la facture, ou inclus | **élevé** : homologation SFE, tests DGI, archivage 10 ans |
| **3. Place de marché** | assurance, mutuelle, avance sur salaire, prêt, télécom, comptabilité, caisse | commission, *rev-share* | **moyen** : c'est un catalogue, pas une norme |
| **4. API sortante** | les autres logiciels lisent employés/heures/paie chez En-Check | abonnement API (le modèle Finch) | **moyen** : sécurité, consentement, journalisation |

### 9.3 Séquence recommandée (sans écrire de code)

1. **Commencer par la porte 1.** Elle est entièrement documentée par la CNSS et
   la DGI, elle ne demande aucun agrément, et elle transforme immédiatement la
   paie d'En-Check en **déclaration déposée**. C'est le même raisonnement que la
   DSN : le logiciel de paie devient le canal.
2. **Puis la porte 4.** Exposer une API sortante est peu risqué et crée la
   dépendance inverse : les autres outils ont besoin d'En-Check.
3. **La porte 2 en dernier**, et de deux façons : d'abord **via un SFE déjà
   homologué** (partenariat type DDD Invoices, CassKai, geCloud), puis en
   déposant **son propre dossier SFE** quand le volume le justifie.
4. **La porte 3 seulement après** : une place de marché sans volume d'employés
   vérifiés ne se négocie pas.

---

## 10. Les contraintes à ne pas sous-estimer

| Contrainte | Détail |
| --- | --- |
| **Responsabilité** | une déclaration fausse déposée au nom du client engage En-Check. Le modèle DSN suppose un mandat écrit et une traçabilité complète. |
| **Réversibilité** | les déclarations doivent pouvoir être corrigées (déclaration rectificative CNSS prévue par e-services) ; il faut conserver l'état envoyé, pas seulement l'état calculé. |
| **Sécurité DGI** | double authentification SyGMEF obligatoire depuis le 20 juillet 2026 ; jetons API par entreprise, jamais partagés entre clients. |
| **Archivage** | 10 ans (OHADA) pour les factures ; les avoirs doivent référencer la facture d'origine. |
| **Fragmentation régionale** | chaque pays a son rail : FNE (CI), SECeF (Niger, Mali), FEC (Burkina), DEF (RDC), eTIMS (Kenya), MBS/Peppol (Nigeria). Aucun standard UEMOA contraignant à ce jour. |
| **Données personnelles** | identité, salaires, pointages biométriques : base légale, consentement, minimisation, durée de conservation. |
| **Dépendance à un fournisseur** | passer par un SFE tiers pour la facturation crée une dépendance commerciale et un point de panne unique. |

---

## 11. Réponse courte à la question posée

**Oui, ce modèle existe, et il a trois figures dominantes :**

1. **ADP / Rippling / Gusto** — le registre de paie devient la place de marché
   (711 annonces, 240 éditeurs chez ADP ; 600+ intégrations chez Rippling).
2. **DSN / net-entreprises** — un fichier mensuel remplace ~80 formalités, et le
   **logiciel de paie devient le canal de déclaration**, y compris par API.
3. **Plateformes Agréées (France), SFE e-MECeF (Bénin), Access Points (Nigeria)**
   — l'État **impose un intermédiaire privé immatriculé** ; 155 PA en France,
   plusieurs SFE déjà homologués et visibles au Bénin, des concurrents installés.

**Et deux figures de plomberie** : l'API unifiée (Merge, Finch, Apideck,
Nango) et la conformité en service (Avalara, Sovos, Fonoa, DDD Invoices).

**Pour En-Check, la conclusion est contre-intuitive** : le Bénin a déjà agrégé
la déclaration paie + social depuis 2020 (formulaire unique ITS/CNSS sur
e-services). Il ne faut donc **pas construire un portail concurrent**. Le
créneau disponible est celui de la **DSN béninoise** : être le logiciel qui
produit le fichier, dépose, paie et garde la preuve — puis, dans un second
temps, l'intermédiaire agréé de la facture électronique.

---

## Sources

**Modèle A — registre de paie / place de marché**
- ADP Marketplace, 711 annonces / 240 éditeurs : <https://appmarketplace.com/marketplaces/adp-marketplace/>
- Comparatif Rippling/ADP (500+ intégrations, API Central) : <https://www.rippling.com/blog/rippling-vs-adp-hcm-payroll-comparison>
- Rippling, 600+ intégrations, App Shop 2020 : <https://www.rippling.com/careers>
- Gusto Embedded / App Integrations : <https://unified.to/blog/25_hris_apis_to_integrate_with_in_2026_workday_bamboohr_adp_and_unified_hr_integration_apis>

**Modèle B — DSN**
- net-entreprises, DSN et API machine-to-machine : <https://www.net-entreprises.fr/declaration/dsn-info/>
- URSSAF, DSN via API : <https://www.urssaf.fr/accueil/employeur/gerer-entreprise/declaration-sociale-nominative.html>
- Cas d'API publique DSN (IPS-X) : <https://ipsoeu.github.io/ips-explorer/case/60075.html>

**Modèle C — plateformes agréées**
- Liste et volume des Plateformes Agréées 2026 : <https://comparateur-efacturation.fr/guide/liste-plateformes-agreees>
- Modèles tarifaires et PPF recentré : <https://nxlforge.com/blog/plateformes-agreees-2026-typologie-prix-criteres>
- Réforme, calendrier 2026/2027 : <https://guide-plateforme-agreee.fr/facturation-electronique-guide-complet-2026/>
- Nigeria, calendrier MBS/Peppol : <https://e-invoicing.org/nigeria/>
- Côte d'Ivoire, FNE *clearance* et ARF : <https://www.vatupdate.com/2026/05/27/briefing-document-podcast-e-invoicing-e-reporting-in-ivory-coast/>
- Burkina Faso, FEC janvier 2026 : <https://www.ensafrica.com/news/detail/11385>
- Sénégal, mandat non publié : <https://get-flowie.com/e-invoicing/senegal>

**Bénin**
- Formulaire unique ITS + CNSS, lancement 3 février 2020 : <https://www.gouv.bj/article/493/finances-et-digitalisation-lancement-du-formulaire-unique-de-declaration-des-impots-sur-salaires-et-des-cotisations-de-securite-sociale/>
- Tutoriel officiel CNSS de la déclaration unique (annexe CSV/Excel) : <https://cnss.bj/tutoriel-declaration-unique-des-impots-sur-salaires-et-des-cotisations-de-securite-sociale/>
- e-MECeF, SyGMEF, NIM, QR, SFE, sanctions : <https://dddinvoices.com/learn/e-invoicing-in-benin-facture-normalise-rules-dgi-requirements>
- 2FA SyGMEF depuis le 20 juillet 2026 : même source
- SFE homologués (NFACTURE, geCloud) : <https://conceptic.io/en/category/factures-normalisees/> et <https://gecloud.me/comment-configurer-la-facture-normalise-sur-son-compte-gecloud/>
- monentreprise.bj / APIEx-GUFE : <https://investbenin.bj/about/apiex> et <https://www.yoon.africa/guide-pratique/creer-une-entreprise-au-benin-guide-complet>
- service-public.bj, employés de maison, interopérabilité ANIP : <http://24haubenin.bj/La-plateforme-de-declaration-des-employes-de-maison-lancee-48399-48399-48399-48399-48399-48399-48399-48399-48399-48399-48399-48399-48399-48399-48399-48399>
- Télépaiement bancaire : <https://bangebj.com/fr/product/27-telepaiement-des-impots>

**Modèle D — API unifiée**
- Comparatif Merge / Apideck / Finch / Codat / Nango / Paragon : <https://www.useparagon.com/blog/top-unified-api>
- Tarifs Merge (~650 $/mois) et Apideck : <https://satvasolutions.com/blog/top-unified-accounting-api-platforms>
- Finch, 220+ systèmes d'emploi : <https://www.withampersand.com/blog/merge-alternatives>

**Modèle E — conformité fiscale**
- AvaTax, Sovos, Vertex/Pagero, Fonoa : <https://www.europeanfinancialreview.com/9-best-global-vat-compliance-services-for-multinational-businesses-in-2026/>
- Fonoa, 190+ juridictions, rachat PwC Indirect Tax Edge : <https://trykintsugi.com/blog/top-7-vat-compliance-solutions-for-global-expansion-in-2026>
- DDD Invoices, couche blanche derrière l'ERP : <https://dddinvoices.com/learn/sovos-vs-ddd-invoices-enterprise-tax>

**Afrique — paie et gestion**
- SeamlessHR, moteurs par pays : <https://seamlesshr.com/blog/why-seamlesshr-is-built-for-payroll-compliance-across-africa/>
- Workpay, 40+ pays, mobile money : <https://www.hr.software/reviews/workpay>
- Madata, FNE incluse : <https://madata.africa/fr/blog/meilleur-logiciel-gestion-comptabilite-pme-cote-divoire>
- Sikalia, paie CNPS/ITS + déclarations sociales + API : <https://sikalia.com/>
- CassKai, MECeF + DSF : <https://casskai.app/en/solutions/benin>
