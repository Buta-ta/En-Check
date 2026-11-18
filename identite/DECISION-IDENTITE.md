# Décision d'identité — sable, terre cuite, argile

**Statut : direction B « Sable & argile » retenue par le fondateur, le 18 novembre 2026.**
Voir `REGISTRE.md` (D-001) et **`CHARTE.md`**, le rapport de référence. Les planches
sont des images : aucune ligne de code n'a encore changé (relevé d'entrée au 18/11/2026 :
4 661 couleurs en dur, 53 tailles de texte).

---

## 1. Les vingt-huit planches — et quoi regarder dans chacune

| Fichier | La question à laquelle elle répond |
|---|---|
| `01-palettes.png` | **Quelle palette ?** Trois directions, mêmes mesures, contrastes calculés |
| `02-ecrans.png` | **Ce que ça donne sur un vrai écran**, en clair et en sombre |
| `03-preuve.png` | **Ce que ça donne sur ce que tu vends** : le billet de pointage |
| `04-decision.png` | **Le tableau de décision** : six couleurs, un verdict par direction |
| `05-motifs.png` | **Les six motifs déjà en service** et la grammaire qui les tient ensemble |
| `06-motifs-regles.png` | **Comment poser un motif** : bandeau nu / passe-partout / illustration |
| `07-theme.png` | **Clair, sombre ou automatique ?** Administration + kiosque, cinq critères |
| `08-kente.png` | Le kente étiré ×2,7 — les trois poses possibles |
| `09-interrupteur.png` | L'interrupteur et sa mémoire : où, combien d'états, quelles couches |
| `10-bouton.png` | **Un seul bouton** : ce que son icône raconte, et sa fiche technique |
| `11-police.png` | **La police** : trois candidates, et la mesure des colonnes de chiffres |
| `12-logotype.png` | **Le logotype** : l'empreinte existante, ses trois échecs, trois pistes — *conservé tel quel (D-007)* |
| `13-images.png` | **Les images** : inventaire réel, trois natures, la règle proposée |
| `14-illustration.png` | **L'illustration sur le sable** : quatre poses du même dessin, et la mesure du cadre |
| `15-preuve-document.png` | **La preuve** : billet, bulletin, rapport — et le test du noir et blanc |
| `16-verification.png` | **La page de vérification** : niveau complet, quatre garde-fous, risque résiduel |
| `17-langues.png` | **Les langues** : ce que la police peut écrire, et les trois portées possibles |
| `18-bonjour.png` | **Le bonjour par pays** : quatre accueils, l'orthographe, et le mécanisme |
| `19-perimetre.png` | **Le périmètre** : identité, système d'interface, tendances — et le bouton qui découle |
| `20-tendances.png` | **Les quatre tendances** : ce qu'on prend, ce qu'on refuse, et la couche où chacune vit |
| `21-apple-defaut.png` | **Le défaut mesuré** : une page Apple démontée, et ce que le kit doit reprendre |
| `22-kit.png` | **Le kit** : six objets, une forme chacun — le point de départ |
| `23-quatre-peaux.png` | **Quatre peaux du même kit**, une seule retenue |
| `24-brut-adouci.png` | **La peau D sur les dix-huit formes** (D-016, D-017) |
| `25-paie-brut-adouci.png` | **La même page de paie**, avant / après — et la densité à 25 lignes |
| `26-dashboard-sidebar.png` | **Le dashboard et la barre latérale** (D-018), les deux états |
| `27-modale.png` | **La modale** (D-020) : trois cas, trois largeurs, le téléphone |
| `28-mecanisme.png` | **Le mécanisme** : le cycle en six temps, les trois portes, la note, le contrat de page |

Toutes sont régénérables : `python3 planche.py all` (script dans ce dossier).

---

## 2. Les trois directions

| | **A — Sable & or** | **B — Sable & argile** | **C — Neutre chaud** |
|---|---|---|---|
| **Origine** | Le code actuel (`src/index.css`) | **Prélevée sur le motif bogolan validé** | Référentiel v0.1 de l'IA UX |
| **Fond** | `#FFFBF5` | `#F3E9DA` | `#F4F1EB` |
| **Cartes** | `#E5D4C0` | `#FBF4E9` | `#FFFDF9` |
| **Texte** | `#1C1C1C` | `#2A1708` | `#241F19` |
| **Texte secondaire** | `#9E9E9E` → **2,60:1 échec** | `#6B4A32` → 6,59:1 | `#71685E` → 4,85:1 |
| **Marque** | `#D4AF37` (or) | `#A26537` (terre cuite) | `#B4703A` (choisi ici, absent du document) |
| **Marque en texte** | `#8B6914` → 4,93:1 | `#7E4A26` → 6,04:1 | `#8A5A14` → 5,24:1 |
| **Contrôles AA réussis** | **2 / 5** | **4 / 5** | **3 / 5** |

---

## 3. Recommandation : B, avec deux corrections

1. **Adopter B comme socle.** Ses six couleurs ne sont pas inventées : elles sont
   échantillonnées sur `public/images/paie-bogolan-haut.webp`, un motif déjà
   validé. Terre cuite `#A26537`, brun `#2A1708`, sable `#CEA872`, argile `#683C1E`.
2. **L'argile claire n'écrit jamais.** `#A26537` sert d'aplat (boutons, repères) ;
   le texte, les liens et les numéros prennent l'argile profonde `#7E4A26` (6,04:1).
3. **Accueillir deux couleurs secondaires issues des motifs** : indigo `#0C1C35`
   (Adinkra) et vert forêt `#21624F` (Zoulou). Sans elles, trois pages sur six
   resteront en conflit avec la charte — et on ne redessine pas un motif validé.

### Tokens proposés (clé → valeur)

| Rôle | Clair | Sombre |
|---|---|---|
| `--fond` | `#F3E9DA` | `#1C1109` |
| `--surface` | `#FBF4E9` | `#2A1B10` |
| `--surface-2` | `#EADCC7` | `#352316` |
| `--bordure` | `#D8C6AC` | `#463020` |
| `--encre` | `#2A1708` | `#F3E9DA` |
| `--encre-douce` | `#6B4A32` | `#C9B49A` |
| `--marque` (aplat) | `#A26537` | `#CEA872` |
| `--marque-texte` | `#7E4A26` | `#D9B98C` |
| `--secondaire-indigo` | `#0C1C35` | `#8FA3C8` |
| `--secondaire-vert` | `#21624F` | `#7FB08F` |
| `--succes` | `#3F6B4C` | `#7FB08F` |
| `--alerte` | `#8A5A14` | `#E0B36A` |
| `--erreur` | `#9B2C2C` | `#E08A8A` |

---

## 4. La règle commune (le point urgent)

Le problème n'est pas de choisir une jolie palette : c'est qu'aujourd'hui
**n'importe quel écran peut introduire sa propre couleur**. On ne l'interdit pas
avec un document — on l'interdit avec une liste fermée et une vérification.

> **Règle 1 — Six couleurs de socle, pas une de plus.**
> Toute couleur d'interface vient des tokens ci-dessus. Aucun composant n'écrit
> une valeur hexadécimale en dur.

> **Règle 2 — Aucun texte sous 4,5:1.** Le rapport est calculé, jamais estimé.

> **Règle 3 — Une bande de motif par page**, jamais derrière du texte, jamais
> étirée, jamais deux motifs forts dans la même zone.

> **Règle 4 — Un fait = un emplacement.** Aucun chiffre répété dans deux cartes.

### Comment on la rend vérifiable (et non déclarative)

Trois contrôles automatiques, dans la porte de lint déjà en place :

1. **Interdire les hex en dur** hors du fichier de tokens (`src/index.css`) —
   un test lit les sources et échoue à la première couleur inventée.
2. **Mesurer les paires de tokens** et échouer si l'une passe sous 4,5:1.
3. **Compter les bandes de motif** par page et échouer au-delà d'une.

C'est la différence entre une charte et une règle : la charte se contredit dans
six mois, la règle casse la CI le jour même.

---

## 5. Ce qui reste ouvert (voir `REGISTRE.md` pour les numéros de décision)

| # | Sujet | Pourquoi ce n'est pas urgent |
|---|---|---|
| 1 | **Thème par défaut** | Sombre pour le kiosque Pointage, clair pour l'administration — argument d'usage, pas de goût |
| 2 | **Police de référence** | Aujourd'hui une pile système (`Segoe UI, Tahoma…`) : trois rendus différents selon l'appareil |
| 3 | **Logotype** | Écrire « En-Check » une fois pour toutes, et décider si les deux produits portent la même marque |
| 4 | **Photographie** | Uniquement au premier lancement ; jamais dans une zone opérationnelle |
| 5 | **Identité de la preuve** | Voir `03-preuve.png` : billet, fiche de paie, rapport exporté — c'est le vrai différenciant |
| 6 | **Langues** | Français seul, ou accueil en fon / yoruba sur le kiosque |

---

## 6. Registre

| Élément | État | Preuve |
|---|---|---|
| Planches de décision (19) | **fait** | `identite/*.png` |
| Palette de socle — B « Sable & argile » | **validée** (D-001) | `04-decision.png`, `REGISTRE.md` |
| Tokens dans le code | à faire | — |
| Contrôles CI (hex, contraste, motifs) | à faire | — |
| Thème par défaut | **validée** (D-005) — clair, un bouton | `10-bouton.png` |
| Logotype, police, preuve | à décider | — |

**Aucune ligne ne passe à « validé » sans ta décision explicite** — même règle que
le registre du dossier « IA ANALYSE ».
| 20 | `20-tendances.png` | Bento, Apple, Awwwards 3D : le même accueil en trois traitements, comparaison, test d'arbitrage, D-013 à D-015 |
| 21 | `21-apple-defaut.png` | D-013 validée : le relevé du dépôt (53 tailles de texte, 41 marges, 27 rayons), l'échelle qui les remplace, l'écran de paie après |
| 22 | `22-kit.png` | D-011 : les six composants du kit, tous leurs états, mesures et contrastes |
| 24 | `24-brut-adouci.png` | peau D retenue : trois formes pour chacun des six objets, avec leur emploi |
| 25 | `25-paie-brut-adouci.png` | la page de paie entière en peau D : bande Bogolan, 3 tuiles, 1 message, tableau 40 lignes paginé |
| 26 | `26-dashboard-sidebar.png` | le dashboard en peau D et la barre latérale réglée : kente, actif ivoire, 5 teintes, défaut de contraste mesuré |
| 27 | `27-modale.png` | la modale en trois cas, la règle en trois phrases, le téléphone et les trois largeurs |
