#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Maquette « allégée » de la fiche employé(e) — 22/11.

La consigne du fondateur, mot pour mot :
  « la page est lourde, mal faite, c'est énergivore. recommence en partant sur
   une nouvelle maquette, enlève la 3D, le fond bogolan, etc.
   Inspire toi de la page employée qu'on a très bien réussi »

Ce que ça impose, dans ce fichier :
  - PAS DE FOND BOGOLAN. Le motif n'apparaît qu'une fois, en panneau vertical de
    76 px dans l'en-tête, exactement comme `.empv3-d-panneau` de la page Employés
    (qui fait `background-size: 78px auto` sur `bogolan-vertical.webp`, fichier
    natif de 76x1536). Ici on le montre à sa taille native, 76 px, sans étirer.
    Sur téléphone : pas de panneau du tout (règle déjà écrite dans le dépôt :
    « la lanière doit disparaître sur téléphone »).
  - PAS DE 3D : aucun flou, aucun `backdrop-filter`, aucune rotation, aucune
    inclinaison, aucune double ombre, aucun `background-attachment: fixed`.
  - DES CARTES CARRÉES : `zoulou.css` interdit la carte à ombre et à coin arrondi
    pour poser du contenu ; seul un bouton garde sa forme de pilule.
  - L'ESPACEMENT ET LES COULEURS VIENNENT DE `tokens.css` : rien d'inventé.

Tout se dessine dans UNE seule commande ImageMagick (formes et texte dans le
même passage), puis le panneau de motif est posé avec `composite`. La version
précédente empilait six calques de texte dans un `convert` : `-composite`
n'appliquait que la dernière paire, tout le texte disparaissait du fichier.
"""

import os
import subprocess

RACINE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BOGOLAN = os.path.join(RACINE, "public", "images", "bogolan-vertical.webp")
SORTIE = os.path.join(RACINE, "maquettes")

# Palette : uniquement des valeurs déjà dans src/styles/tokens.css / zoulou.css.
PAPIER = "#f5f0e6"     # fond du registre perlé
SURFACE = "#fffdf7"    # --charte-surface
DOUX = "#f7f1e6"       # aplat léger (`.empv3-encart`)
ENCRE = "#1c140d"      # --charte-encre
DOUCE = "#42342a"      # --charte-douce
MODEREE = "#6b5c44"    # --charte-moderree
BRUN = "#8a5216"       # --charte-brun
CUIVRE = "#8f4d1d"     # --charte-terre : seul aplat d'action de la page
SARCELLE = "#2b6a5f"   # --charte-sarcelle
SAUGE = "#56652a"      # --charte-sauge
CORAIL = "#a2452e"     # --charte-corail
OR = "#c9a961"         # --charte-or : le cerné de la photo, validé le 21/11
FILET = "#e3d8c6"      # --charte-filet-doux
BOIS = "#3a2416"       # brun profond du panneau de la page Employés

REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
GRAS = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
LARGEUR_GRAS, LARGEUR_REG = 0.62, 0.58


def largeur(texte, taille, gras=True):
    return int(len(texte) * taille * (LARGEUR_GRAS if gras else LARGEUR_REG))


class Toile:
    """Une image construite en empilant des instructions dans UN seul `convert`."""

    def __init__(self, w, h):
        self.w, self.h = w, h
        self.ops = ["-size", "%dx%d" % (w, h), "xc:%s" % PAPIER]
        self.poses = []          # superpositions (le panneau de motif)

    # — formes —
    def fond(self, x, y, w, h, couleur):
        self.ops += ["-fill", couleur, "-stroke", "none",
                     "-draw", "rectangle %d,%d %d,%d" % (x, y, x + w - 1, y + h - 1)]

    def carte(self, x, y, w, h, fond=SURFACE, bord=FILET, ep=1, r=0):
        self.ops += ["-fill", fond or "none", "-stroke", bord or "none",
                     "-strokewidth", str(ep)]
        form = ("roundrectangle %d,%d %d,%d %d,%d" % (x, y, x + w - 1, y + h - 1, r, r)
                if r else "rectangle %d,%d %d,%d" % (x, y, x + w - 1, y + h - 1))
        self.ops += ["-draw", form, "-stroke", "none"]

    def filet(self, x, y, w, couleur=FILET, ep=1):
        self.ops += ["-stroke", couleur, "-strokewidth", str(ep), "-fill", "none",
                     "-draw", "line %d,%d %d,%d" % (x, y, x + w - 1, y), "-stroke", "none"]

    def montant(self, x, y, h, couleur=FILET, ep=1):
        self.ops += ["-stroke", couleur, "-strokewidth", str(ep), "-fill", "none",
                     "-draw", "line %d,%d %d,%d" % (x, y, x, y + h - 1), "-stroke", "none"]

    def pastille(self, cx, cy, r, remplissage=BOIS, anneau=None, ep=3):
        self.ops += ["-fill", remplissage or "none", "-stroke", anneau or "none",
                     "-strokewidth", str(ep),
                     "-draw", "circle %d,%d %d,%d" % (cx, cy, cx, cy - r),
                     "-stroke", "none"]

    # — textes — (gravity Nord-Ouest : (x, y) = coin haut-gauche du libellé)
    def txt(self, x, y, s, taille=15, couleur=ENCRE, gras=True):
        self.ops += ["-font", GRAS if gras else REG, "-pointsize", str(taille),
                     "-fill", couleur, "-gravity", "NorthWest",
                     "-annotate", "+%d+%d" % (int(x), int(y)), s]

    # — composants —
    def puce(self, x, y, s, couleur=DOUCE, fond=SURFACE, bord=FILET, taille=13):
        l, h = largeur(s, taille, False) + 26, taille + 15
        self.carte(x, y, l, h, fond, bord, 1, h // 2)
        self.txt(x + 13, y + 8, s, taille, couleur, False)
        return l

    def bouton(self, x, y, s, taille=14, fond=CUIVRE, texte=DOUX):
        l, h = largeur(s, taille) + 36, taille + 20
        self.carte(x, y, l, h, fond, fond, 1, h // 2)
        self.txt(x + 18, y + 10, s, taille, texte, True)
        return l

    def actions_calmes(self, droit, y, libelles):
        """Les actions secondaires sont des mots, pas des boutons (zoulou.css)."""
        for a in libelles:
            l = largeur(a, 13, False)
            droit -= l
            self.txt(droit, y, a, 13, CUIVRE, False)
            self.filet(droit, y + 19, l, CUIVRE, 1)   # le soulignement
            droit -= 26

    def ligne_registre(self, x, y, w, libelle, valeur, couleur=ENCRE, gras=False):
        self.txt(x, y + 3, libelle, 12, MODEREE, False)
        self.txt(x + w * 0.40, y, valeur, 15, couleur, gras)
        self.filet(x, y + 27, w)

    def tuile(self, x, y, w, h, valeur, libelle, note=None, couleur=ENCRE):
        self.carte(x, y, w, h)
        self.txt(x + 18, y + 14, libelle, 12, MODEREE, False)
        self.txt(x + 18, y + 37, valeur, 25, couleur, True)
        if note:
            self.txt(x + 18, y + h - 28, note, 12, DOUCE, False)

    def titre(self, x, y, s):
        self.txt(x, y, s, 12, MODEREE, True)


# ---------------------------------------------------------------------- en-tête
def en_tete(t, x, y, w, fil, nom, contexte, statut, actions, mobile=False):
    h = 150 if mobile else 164
    t.carte(x, y, w, h)
    if not mobile:
        # Le seul motif de la page : un panneau de 76 px, posé sur le brun
        # profond, comme sur la page Employés. Jamais derrière du texte.
        t.fond(x + 1, y + 1, 78, h - 2, BOIS)
        t.poses.append((x + 2, y + 2, 76, h - 4, "/tmp/panneau.png"))
    gauche = x + (20 if mobile else 118)
    t.txt(gauche, y + 14, fil, 14, BRUN, False)
    l_bouton = largeur("Pointer", 14) + 36
    t.bouton(x + w - 20 - l_bouton, y + 11, "Pointer", 14)
    t.txt(gauche, y + (52 if mobile else 56), nom, 21 if mobile else 25, ENCRE, True)
    t.txt(gauche, y + (80 if mobile else 90), contexte, 13, MODEREE, False)
    bas = y + (106 if mobile else 118)
    t.puce(gauche, bas, statut, couleur=SAUGE)
    t.actions_calmes(x + w - 20, bas + 3, actions)
    if not mobile:
        # la photo : un disque cerclé d'or posé sur le panneau (cerné validé le 21/11)
        t.pastille(x + 40, y + 56, 26, BOIS, OR, 3)
        t.txt(x + 40 - 15, y + 56 - 9, "AT", 19, DOUX, True)
    return h


def rangee_tuiles(t, x, y, w, mobile, quatre):
    ecart = 12
    h = 88
    if mobile:
        l = (w - ecart) / 2
        positions = [(x, y), (x + l + ecart, y), (x, y + h + ecart),
                     (x + l + ecart, y + h + ecart)]
    else:
        l = (w - 3 * ecart) / 4
        positions = [(x + i * (l + ecart), y) for i in range(4)]
    for (px, py), (val, lab, note, col) in zip(positions, quatre):
        t.tuile(int(px), int(py), int(l), h, val, lab, note, col)
    return int(h * (2 if mobile else 1) + ecart)


# --------------------------------------------------------------------- le desktop
def construire_desktop():
    W, M = 1150, 40
    L, R = M, W - M
    LG = R - L
    t = Toile(W, 1180)

    h = en_tete(t, L, 24, LG, "Annuaire · Aïcha TRAORÉ", "Aïcha TRAORÉ",
                "Opératrice — ligne 2 · Cotonou · Équipe A · matricule EC-0421",
                "EN LIGNE", ["Documents de paie", "Modifier"], False)
    y = 24 + h + 22

    # La rangée de chiffres qui manquait : ce que le fondateur regarde en premier.
    y += rangee_tuiles(t, L, y, LG, False, [
        ("12 j", "CONGÉS ACQUIS", "sur 30 · 2 déjà posés", ENCRE),
        ("4 j", "REPOS COMPENSATEUR", "2 pris · 2 à solder", ENCRE),
        ("12 ans", "ANCIENNETÉ", "depuis le 14/02/2014", ENCRE),
        ("0", "INCIDENTS", "sur 24 derniers mois", SAUGE),
    ]) + 22

    # Deux colonnes, 60/40, comme la page Employés.
    wg = int((LG - 14) * 0.60)
    wd = LG - 14 - wg
    y0 = y
    hh = 456
    x = L
    t.carte(x, y0, wg, hh)
    t.titre(x + 20, y0 + 16, "CARTE D'IDENTITÉ")
    t.actions_calmes(x + wg - 20, y0 + 15, ["Tout afficher"])
    t.filet(x + 1, y0 + 40, wg - 2)
    t.txt(x + 20, y0 + 56, "6 pièces · 2 à renouveler", 13, DOUCE, False)
    ry = y0 + 88
    for lib, val, col, g in [
        ("Matricule", "EC-0421", ENCRE, False),
        ("Contrat", "CDI depuis le 14/02/2014", ENCRE, False),
        ("Fonction", "Opératrice — ligne 2", ENCRE, False),
        ("Service", "Production · Équipe A", ENCRE, False),
        ("Responsable", "Kossi ADJOVI", SARCELLE, True),
        ("Téléphone", "+229 01 97 44 20 18", ENCRE, False),
        ("Courriel", "a.traore@en-check.bj", ENCRE, False),
        ("Pièce d'identité", "CNI · expire le 03/2029", CORAIL, False),
    ]:
        t.ligne_registre(x + 20, ry, wg - 40, lib, val, col, g)
        ry += 36
    t.fond(x + 20, ry + 8, wg - 40, 46, DOUX)
    t.txt(x + 32, ry + 20, "2 pièces demandées pour le renouvellement", 13, CUIVRE, False)

    # et le fil des évènements, à droite
    x = L + wg + 14
    t.carte(x, y0, wd, hh)
    t.titre(x + 20, y0 + 16, "ACCÈS & MATÉRIEL")
    by = y0 + 52
    for lib, val, col in [
        ("BADGE", "EC-B-0421 · actif", SAUGE),
        ("POINTEUSE", "Poste 3 — Cotonou", ENCRE),
        ("MACHINE À COUDRE", "n° 12 · attribuée le 03/2019", ENCRE),
        ("EPI", "livrés le 03/2026", ENCRE),
        ("SYNDICAT", "Non syndiquée", MODEREE),
    ]:
        t.txt(x + 20, by, lib, 11, MODEREE, False)
        t.txt(x + 20, by + 19, val, 15, col, False)
        t.filet(x + 20, by + 46, wd - 40)
        by += 62
    t.fond(x + 20, by + 4, wd - 40, 74, DOUX)
    t.txt(x + 32, by + 18, "SALLE DE PAUSE — POSTE 3", 11, MODEREE, True)
    t.txt(x + 32, by + 36, "6 personnes · 12:24", 17, ENCRE, True)
    y = y0 + hh + 22

    # Le parcours : un rail, cinq étapes, des cartes plates.
    hb = 194
    t.carte(L, y, LG, hb)
    t.titre(L + 20, y + 16, "PARCOURS")
    t.actions_calmes(L + LG - 20, y + 15, ["Tout afficher"])
    t.filet(L + 1, y + 40, LG - 2)
    rail = y + 126
    t.filet(L + 20, rail, LG - 40, OR, 1)
    etapes = [("14/02/2014", "Entrée — ligne 4", None),
              ("02/09/2016", "Reclassement échelon 4", None),
              ("17/06/2019", "Formation contrôle qualité", None),
              ("14/08/2021", "Passage sur la ligne 2", None),
              ("12/04/2026", "Chef d'équipe — en cours", CORAIL)]
    ecart, depart = 12, L + 20
    lc = (LG - 40 - ecart * (len(etapes) - 1)) / len(etapes)
    for i, e in enumerate(etapes):
        cx = int(depart + i * (lc + ecart))
        t.fond(cx, rail - 66, int(lc), 50, DOUX)
        t.txt(cx + 12, rail - 58, e[0], 14, ENCRE, True)
        t.txt(cx + 12, rail - 38, e[1], 12, e[2] or DOUCE, False)
        t.pastille(cx, rail, 5, PAPIER, SARCELLE, 2)
    t.pastille(int(depart + len(etapes) * lc + (len(etapes) - 1) * ecart), rail, 5,
               PAPIER, SARCELLE, 2)
    t.txt(L + 20, rail + 24, "Cinq évènements · le dernier est en attente de validation RH",
          12, MODEREE, False)
    y += hb + 18
    t.filet(L, y, LG, OR, 1)
    t.txt(L, y + 10, "Registre interne · données au 22/11/2026", 12, MODEREE, False)
    t.txt(R - largeur("Modifié par L. Dossou · 22/11/2026", 12, False), y + 10,
          "Modifié par L. Dossou · 22/11/2026", 12, MODEREE, False)
    return t, y + 38


# ---------------------------------------------------------------------- le mobile
def construire_mobile():
    W, M = 390, 14
    L, R = M, W - M
    LG = R - L
    t = Toile(W, 1180)

    h = en_tete(t, L, 14, LG, "Annuaire", "Aïcha TRAORÉ",
                "Opératrice — ligne 2 · Cotonou · EC-0421",
                "EN LIGNE", [], True)
    y = 14 + h + 16
    y += rangee_tuiles(t, L, y, LG, True, [
        ("12 j", "CONGÉS ACQUIS", None, ENCRE),
        ("4 j", "REPOS COMP.", None, ENCRE),
        ("12 ans", "ANCIENNETÉ", None, ENCRE),
        ("0", "INCIDENTS", None, SAUGE),
    ]) + 16

    t.carte(L, y, LG, 372)
    t.titre(L + 16, y + 14, "CARTE D'IDENTITÉ")
    t.filet(L + 1, y + 36, LG - 2)
    t.txt(L + 16, y + 48, "6 pièces · 2 à renouveler", 13, DOUCE, False)
    ry = y + 78
    for lib, val in [("Matricule", "EC-0421"), ("Contrat", "CDI · 14/02/2014"),
                     ("Fonction", "Opératrice — ligne 2"), ("Service", "Production · Équipe A"),
                     ("Responsable", "Kossi ADJOVI"), ("Téléphone", "+229 01 97 44 20"),
                     ("Courriel", "a.traore@en-check.bj"),
                     ("Pièce d'identité", "CNI · 03/2029")]:
        t.txt(L + 16, ry + 3, lib, 11, MODEREE, False)
        t.txt(L + 16 + (LG - 32) * 0.40, ry, val, 14, ENCRE, False)
        t.filet(L + 16, ry + 25, LG - 32)
        ry += 36
    y += 372 + 16

    t.carte(L, y, LG, 112)
    t.titre(L + 16, y + 14, "SALLE DE PAUSE")
    t.filet(L + 1, y + 36, LG - 2)
    t.txt(L + 16, y + 52, "6 personnes · 12:24", 18, ENCRE, True)
    t.txt(L + 16, y + 80, "Poste 3 · Cotonou", 12, MODEREE, False)
    y += 112 + 16

    # Sur téléphone, le parcours ne peut plus tenir en cinq colonnes :
    # le rail passe à la verticale, trois étapes et un lien.
    hb = 236
    t.carte(L, y, LG, hb)
    t.titre(L + 16, y + 14, "PARCOURS")
    t.txt(R - 96, y + 14, "Tout afficher", 12, CUIVRE, False)
    t.filet(L + 1, y + 36, LG - 2)
    etapes = [("14/02/2014", "Entrée — ligne 4"),
              ("14/08/2021", "Passage sur la ligne 2"),
              ("12/04/2026", "Chef d'équipe — en cours")]
    ry = y + 56
    t.montant(L + 23, ry + 5, 2 * 54, OR, 1)
    for i, (dat, lib) in enumerate(etapes):
        t.pastille(L + 23, ry + 5, 5, PAPIER, SARCELLE, 2)
        t.txt(L + 44, ry, dat, 14, ENCRE, True)
        t.txt(L + 44, ry + 21, lib, 12, CORAIL if i == 2 else DOUCE, False)
        ry += 54
    y += hb + 16
    t.filet(L, y, LG, OR, 1)
    t.txt(L, y + 10, "Registre interne · 22/11/2026", 12, MODEREE, False)
    return t, y + 34


def ecrire(nom, t, hauteur_reelle):
    brut = "/tmp/%s_brut.png" % nom
    subprocess.run(["convert"] + t.ops + [brut], check=True)
    courant = brut
    cible = "/tmp/%s_coupe.png" % nom
    subprocess.run(["convert", courant, "-crop", "%dx%d+0+0" % (t.w, hauteur_reelle),
                    "+repage", cible], check=True)
    courant = cible
    for i, (px, py, pw, ph, fichier) in enumerate(t.poses):
        etape = "/tmp/%s_pose%d.png" % (nom, i)
        subprocess.run(["composite", "-compose", "over",
                        "-geometry", "+%d+%d" % (px, py), fichier, courant, etape],
                       check=True)
        courant = etape
    subprocess.run(["convert", courant, os.path.join(SORTIE, nom + ".png")], check=True)
    dims = subprocess.run(["identify", "-format", "%wx%h", os.path.join(SORTIE, nom + ".png")],
                          stdout=subprocess.PIPE, check=True).stdout.decode()
    poids = os.path.getsize(os.path.join(SORTIE, nom + ".png"))
    print("%-32s %s px · %d Ko" % (nom + ".png", dims, poids // 1024))


def poser_panneau(hauteur):
    """Le VRAI fichier de l'app, tuilé à sa largeur native de 76 px (l'app le
    affiche à 78 px : 2 px d'écart, pas un motif réinventé)."""
    subprocess.run(["convert", BOGOLAN, "-resize", "76x", "/tmp/_tuileV.png"], check=True)
    subprocess.run(["convert", "-size", "76x%d" % hauteur, "tile:/tmp/_tuileV.png",
                    "/tmp/panneau.png"], check=True)


if __name__ == "__main__":
    poser_panneau(160)
    t, h = construire_desktop()
    ecrire("fiche-E-allegee-desktop", t, h)
    t, h = construire_mobile()
    ecrire("fiche-E-allegee-mobile", t, h)
