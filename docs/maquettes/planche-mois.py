#!/usr/bin/env python3
"""
En-Check — planches de decision : le MODE MOIS du Planning, deux directions.

Ce n'est PAS une image generee par un modele. Chaque valeur est LUE dans le depot :
  · les couleurs, dans src/styles/tokens.css (les jetons --charte-*, theme clair) ;
  · les teintes des cases, dans ENCHECK_COLOR_PALETTE (src/pages/Planning.jsx) —
    exactement les huit couleurs que l'utilisateur a dans sa fenetre ;
  · la police, dans identite/fonts (IBM Plex Sans et Mono, les vrais .ttf) ;
  · la geometrie, dans la regle de la peau : contour d'encre 2 px, ombre dure
    decalee de 3 px sans flou, bande de colle 14 px, pli 14 px, rayon zero,
    ecarts 4-8-12-16-24, et sept colonnes rigoureusement egales.
Les deux maquettes HTML (planning-mois-A.html, planning-mois-B.html) servent les
feuilles relles ; cette planche, elle, se regarde sans serveur.

  /tmp/.venv-planche/bin/python docs/maquettes/planche-mois.py

Sorties : docs/maquettes/choix-mois-A.png et docs/maquettes/choix-mois-B.png
"""
import os
import re

from PIL import Image, ImageDraw, ImageFont

RACINE = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
S = 3  # dessin a 3x, puis reduction : aucun arrondi d'artefact
L = 1240  # la largeur logique de la planche
PAD = 20  # l'espace interieur de la carte
GAP = 8  # l'ecart entre cases
COLLE = 14  # la bande de colle
PLI = 14  # le pli bas-droit
TRAIT = 2  # le contour d'encre du kit
H_CASE_A = 92  # la case, en A (le mois doit tenir a l'ecran)
H_CASE_B = 118  # la case, en B (quatre rangs et leur anomalie)


# ── les valeurs, lues dans le depot ────────────────────────────────────────

def lire(chemin):
    with open(os.path.join(RACINE, chemin), encoding="utf-8") as f:
        return f.read()


def jetons():
    out = {}
    css = lire("src/styles/tokens.css")
    clair = css[: css.index("[data-theme")] if "[data-theme" in css else css
    for nom, hexa in re.findall(r"(--charte-[a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})", clair):
        out.setdefault(nom[2:], hexa.upper())
    return out


def palette():
    src = lire("src/pages/Planning.jsx")
    bloc = src[src.index("ENCHECK_COLOR_PALETTE = [") :]
    bloc = bloc[: bloc.index("];")]
    return {
        label: hexa.upper()
        for label, hexa in re.findall(r'label:\s*"([^"]+)",\s*value:\s*"(#[0-9A-Fa-f]{6})"', bloc)
    }


J = jetons()
T = palette()


def melange(base, autre, part):
    """color-mix(in srgb, autre part%, base) — le melange sRGB, pas un aplat."""
    b = [int(base[i : i + 2], 16) for i in (1, 3, 5)]
    a = [int(autre[i : i + 2], 16) for i in (1, 3, 5)]
    return "#%02X%02X%02X" % tuple(round(x * part / 100 + y * (100 - part) / 100) for x, y in zip(a, b))


ENCRE = J["charte-encre"]
PAPIER = J["charte-surface"]
PAPIER2 = J["charte-surface2"]
FILET = J["charte-bordure"]
DOUX = J["charte-douce"]
TEXTE = J["charte-texte"]
BLANC = J["charte-blanc"]
SABLE = J["charte-sable"]
ALERTE = J["charte-alerte"]
ABSENT = J["charte-statut-absent"]
A_L_HEURE = J["charte-succes"]

POLICES = {
    "sans": ("plex-sans-400.ttf", 11),
    "semibel": ("plex-sans-600.ttf", 10.5),
    "fort": ("plex-sans-700.ttf", 11),
    "micro": ("plex-sans-700.ttf", 9),
    "nombre": ("plex-mono-700.ttf", 15),
    "mono": ("plex-mono-700.ttf", 10),
    "mono-400": ("plex-mono-400.ttf", 10),
}
F = {
    cle: ImageFont.truetype(os.path.join(RACINE, "identite/fonts", nom), round(t * S))
    for cle, (nom, t) in POLICES.items()
}
_JUGE = ImageDraw.Draw(Image.new("RGB", (8, 8)))


def mesure(s, cle, espace=0.0, maj=False):
    """Largeur d'un mot, interlettrage du kit compris — sans quoi il déborde de son trait."""
    if maj:
        s = s.upper()
    return _JUGE.textlength(s, font=F[cle]) / S + espace * max(0, len(s) - 1)


def poser(d, x, y, s, cle, couleur, espace=0.0, maj=False):
    """Un mot posé lettre par lettre : Pillow ne connaît pas l'interlettrage du kit."""
    if maj:
        s = s.upper()
    px, py = x * S, y * S
    for ch in s:
        d.text((px, py), ch, font=F[cle], fill=couleur)
        px += d.textlength(ch, font=F[cle]) + espace * S
    return px / S


# ── le mois : novembre 2026, donnees d'exemple ─────────────────────────────
# Le 1er novembre 2026 tombe un dimanche, la semaine commence un lundi :
# six encoches avant le 1, et le 30 seul sur la derniere rangee.

VIOLET, CUVRE, OCEAN, EMERAUDE, ARDOISE = T["Violet"], T["Cuivre"], T["Océan"], T["Émeraude"], T["Ardoise"]

# numero de jour -> (teinte du jour, postes, heures, tampons, couverture)
MOIS = {
    1: (ARDOISE, 0, "0 h", [("Repos · férié", ARDOISE)], None),
    2: (VIOLET, 4, "32 h", [], "total"),
    3: (VIOLET, 4, "32 h", [], "total"),
    4: (VIOLET, 4, "24 h 30", [("Oubli · Mariam S.", ALERTE)], "partiel"),
    5: (VIOLET, 4, "32 h", [], "total"),
    6: (OCEAN, 5, "39 h", [("Retard 08:38", ALERTE), ("+1 h 43 · Awa D.", A_L_HEURE)], "partiel"),
    7: (CUVRE, 1, "6 h 20", [], None),
    8: (None, 0, "0 h", [], None),
    9: (VIOLET, 4, "32 h", [], "total"),
    10: (VIOLET, 4, "28 h 45", [("Non pointé · Kossi M.", ABSENT)], "partiel"),
    11: (ARDOISE, 0, "0 h", [("Armistice 1918", ARDOISE)], None),
    12: (VIOLET, 4, "32 h", [], "total"),
    13: (VIOLET, 3, "20 h 30", [("Congé · Paul A.", TEXTE)], "partiel"),
    14: (CUVRE, 1, "6 h 20", [], None),
    15: (None, 0, "0 h", [], None),
    16: (VIOLET, 4, "32 h", [], "total"),
    17: (VIOLET, 4, "24 h", [("Sortie manquante", ALERTE)], "partiel"),
    18: (VIOLET, 4, "32 h", [], "total"),
    19: (EMERAUDE, 1, "8 h", [("Repos d'équipe", ARDOISE)], None),
    20: (OCEAN, 2, "12 h 40", [], "total"),
    21: (None, 0, "0 h", [], None),
    22: (None, 0, "0 h", [], None),
    23: (EMERAUDE, 4, "31 h 30", [("Écart -00:29 · Franck H.", ALERTE)], "partiel"),
    24: (VIOLET, 5, "40 h", [("Retard 09:12", ALERTE)], None),
    25: (VIOLET, 4, "32 h", [], "total"),
    26: (VIOLET, 4, "32 h", [], "total"),
    27: (VIOLET, 4, "30 h 15", [("Absent · Kossi M.", ABSENT)], "partiel"),
    28: (CUVRE, 1, "6 h 20", [], None),
    29: (None, 0, "0 h", [], None),
    30: (VIOLET, 4, "32 h", [], "total"),
}

JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]


def minutes(chaine):
    """« 24 h 30 » -> 1470. Le total d'une case se recount, il ne s'invente pas."""
    m = re.match(r"(\d+)\s*h(?:\s*(\d+))?", chaine)
    return int(m.group(1)) * 60 + int(m.group(2) or 0)


def heure_compacte(mins):
    h, m = divmod(mins, 60)
    return f"{h} h" if not m else f"{h} h {m:02d}"


EFFECTIF_NOMS = ["Awa Dossou", "Franck Hounsa", "Mariam Sica", "Paul Adjovi", "Kossi Mensah"]


def effectif_jour(numero):
    """Un rang par personne : les heures se répartissent le total du jour, et
    l'anomalie s'accroche AU NOM qu'elle concerne — pas au premier venu."""
    teinte, postes, heures, tampons, _ = MOIS[numero]
    if not postes:
        return []
    total = minutes(heures)
    chacun = max(5, (total // postes) // 5 * 5)
    marques = {m: t for t, m in ((t[0], t[1]) for t in tampons)}
    rangs = []
    reste = total
    for i in range(postes):
        nom = EFFECTIF_NOMS[(numero + i) % len(EFFECTIF_NOMS)]
        if i == postes - 1:
            valeur = reste
        else:
            valeur = min(chacun, reste - 5 * (postes - 1 - i)) if reste - 5 * (postes - 1 - i) > 0 else reste
            reste -= valeur
        motif = None
        for mot, couleur in tampons:
            if nom.split()[0] in mot or nom.split()[-1] in mot:
                motif = mot.split(" · ")[0]
        rangs.append((nom, heure_compacte(valeur) if valeur else "0 h", motif))
    return rangs


def grille():
    """42 cases : 6 encoches, les 30 jours, 6 encoches. Jamais un jour peint hors du cadre."""
    cases = [None] * 6 + [n for n in range(1, 31)] + [None] * 6
    return [cases[i : i + 7] for i in range(0, 42, 7)]


# ── les pieces ─────────────────────────────────────────────────────────────

def colonnes():
    """Sept colonnes RIGOUREUSEMENT égales : c'est la réparation du débordement."""
    utile = L - 2 * PAD - 6 * GAP
    w = utile // 7
    return [w] * 6 + [utile - 6 * w]


def abscisses(cols):
    x, out = PAD, []
    for w in cols:
        out.append(x)
        x += w + GAP
    return out


def feuille(d, ox, oy, w, h):
    """Le cadre : papier, encre 2 px, double feutre, bande de colle, pli. Aucun flou."""
    X = lambda v: (v + ox) * S
    Y = lambda v: (v + oy) * S
    # le double feutre du kit : deux assises dures empilées, flou à zéro (D-016)
    d.rectangle([X(3), Y(3), X(w + 8), Y(h + 8)], fill=ENCRE)
    d.rectangle([X(3), Y(3), X(w + 6), Y(h + 6)], fill=melange(SABLE, ENCRE, 9))
    d.rectangle([X(0), Y(0), X(w), Y(h)], fill=PAPIER, outline=ENCRE, width=TRAIT * S)
    # la bande de colle, À L'INTÉRIEUR, avec son filet d'encre au pied
    d.rectangle([X(TRAIT), Y(TRAIT), X(w - TRAIT), Y(TRAIT + COLLE)], fill=melange(PAPIER, BLANC, 42))
    d.line([(X(TRAIT), Y(TRAIT + COLLE)), (X(w - TRAIT), Y(TRAIT + COLLE))], fill=melange(PAPIER, ENCRE, 20), width=S)
    # le pli bas-droit : la découpe est au fond de page, le rabat est le dos de la feuille
    d.polygon([(X(w), Y(h)), (X(w - PLI), Y(h)), (X(w), Y(h - PLI))], fill=SABLE)
    d.polygon(
        [(X(w - PLI), Y(h - PLI)), (X(w - PLI), Y(h)), (X(w), Y(h - PLI))],
        fill=melange(PAPIER, BLANC, 24),
    )
    d.line([(X(w - PLI), Y(h - PLI)), (X(w), Y(h - PLI))], fill=melange(PAPIER, ENCRE, 30), width=S)


def tampons(d, x, y, w_dispo, liste):
    """Le badge « tampon » du kit : lavis 18 %, trait de la couleur, mot en encre lavée."""
    for mot, couleur in liste:
        fond = melange(PAPIER, couleur, 18)
        encre = melange(couleur, ENCRE, 82)
        large = mesure(mot, "micro", espace=0.3, maj=True) + 12
        while mot and large > w_dispo:
            mot = mot[:-1]
            large = mesure(mot, "micro", espace=0.3, maj=True) + 12
        while False:
            if large <= w_dispo:
                break
            mot = mot[:-1]
        d.rectangle([x * S, y * S, (x + large) * S, (y + 15) * S], fill=fond, outline=couleur, width=S)
        poser(d, x + 6, y + 3, mot, "micro", encre, espace=0.3, maj=True)
        y += 17
    return y


def case_a(d, x, y, w, h, numero, fin_semaine):
    teinte, postes, heures, tampon_liste, couverture = MOIS[numero]
    fond = melange(PAPIER, PAPIER2, 45) if fin_semaine else PAPIER
    actif = numero in (23, 2)
    d.rectangle([x * S, y * S, (x + w) * S, (y + h) * S], fill=fond, outline=ENCRE if actif else FILET, width=(TRAIT if numero == 23 else 1) * S)
    if teinte:  # la teinte du JOUR : 6 px de bande, pas un fond peint
        d.rectangle([(x + 1) * S, (y + 1) * S, (x + w - 1) * S, (y + 7) * S], fill=melange(fond, teinte, 66))
    poser(d, x + 8, y + 11, str(numero), "nombre", ENCRE)
    if numero == 23:
        mot = "AUJOURD'HUI"
        wm = mesure(mot, "micro", espace=1) + 10
        d.rectangle([(x + w - 8 - wm) * S, (y + 10) * S, (x + w - 8) * S, (y + 24) * S], fill=ENCRE)
        poser(d, x + w - 8 - wm + 5, y + 12, mot, "micro", BLANC, espace=1)
    bas = y + h
    if postes:
        titre = f"{postes}"
        largeur1 = mesure(titre, "mono")
        poser(d, x + 8, y + 34, titre, "mono", ENCRE)
        poser(d, x + 8 + largeur1 + 3, y + 35, f"{'poste' if postes == 1 else 'postes'} · {heures}", "sans", DOUX)
    else:
        poser(d, x + 8, y + 35, "Aucun poste", "sans", melange(PAPIER, DOUX, 62))
    if tampon_liste:
        tampons(d, x + 8, bas - 8 - 17 * len(tampon_liste), w - 16, tampon_liste)
    if couverture:  # la règle du bas : la journée couvre, ou couvre mal
        c = melange(ENCRE, PAPIER, 16) if couverture == "total" else melange(teinte or FILET, PAPIER, 48)
        d.rectangle([(x + 1) * S, (bas - 3) * S, (x + w - 1) * S, bas * S], fill=c)
    if numero == 2:  # la case survolée : le mot d'entrée, pas un ✕ à côté
        poser(d, x + 8, bas - 16, "OUVRIR LA JOURNÉE", "micro", TEXTE, espace=0.9)


def case_b(d, x, y, w, h, numero, fin_semaine):
    teinte, postes, heures, tampon_liste, _ = MOIS[numero]
    fond = melange(PAPIER, PAPIER2, 45) if fin_semaine else PAPIER
    actif = numero in (23, 2)
    d.rectangle([x * S, y * S, (x + w) * S, (y + h) * S], fill=fond, outline=ENCRE if actif else FILET, width=(TRAIT if numero == 23 else 1) * S)
    if teinte:
        d.rectangle([(x + 1) * S, (y + 1) * S, (x + w - 1) * S, (y + 7) * S], fill=melange(fond, teinte, 66))
    poser(d, x + 8, y + 11, str(numero), "nombre", ENCRE)
    if numero == 23:
        mot = "AUJOURD'HUI"
        wm = mesure(mot, "micro", espace=1) + 10
        d.rectangle([(x + w - 8 - wm) * S, (y + 10) * S, (x + w - 8) * S, (y + 24) * S], fill=ENCRE)
        poser(d, x + w - 8 - wm + 5, y + 12, mot, "micro", BLANC, espace=1)
    elif postes:
        # une case vide ne s'annonce pas par un zéro : « 0 · 0 h » est un bruit
        droit = f"{postes} · {heures}"
        largeur_droit = mesure(droit, "mono")
        poser(d, x + w - 8 - largeur_droit, y + 14, droit, "mono", DOUX)
    if not postes:
        if tampon_liste:  # un férié se NOMME, il ne devient pas un « Aucun poste »
            tampons(d, x + 8, y + 32, w - 16, tampon_liste)
        else:
            poser(d, x + 8, y + 34, "Aucun poste", "sans", melange(PAPIER, DOUX, 62))
        return
    rang = y + 32
    rangs = effectif_jour(numero)
    for i, (nom, hrs, motif) in enumerate(rangs[:4]):
        d.rectangle([(x + 8) * S, (rang + 3) * S, (x + 15) * S, (rang + 10) * S], fill=melange(fond, teinte or FILET, 74), outline=ENCRE, width=S)
        dispo = w - 16 - 8 - 11 - mesure(hrs, "mono-400") - 6
        while nom and mesure(nom, "semibel") > dispo:
            nom = nom[:-1]
        poser(d, x + 19, rang, nom, "semibel", ENCRE)
        poser(d, x + w - 8 - mesure(hrs, "mono-400"), rang, hrs, "mono-400", DOUX)
        if motif:  # l'anomalie est collée AU nom qu'elle concerne
            poser(d, x + 19, rang + 12, motif, "micro", melange(PAPIER, ALERTE, 84), espace=0.4, maj=True)
            rang += 12
        rang += 15
    vus = {nom for nom, _, _ in rangs[:4]}
    orphelines = [t for t, _ in tampon_liste if not any(prenom in t for prenom in (n.split()[0] for n in vus))]
    if orphelines:  # un tampon qui ne trouve pas son nom ne se jette pas : il descend seul
        tampons(d, x + 8, rang, w - 16, [(t.split(" · ")[0], ALERTE) for t in orphelines])
        rang += 17 * len(orphelines)
    if postes > 4:
        poser(d, x + 8, rang, f"+{postes - 4} · OUVRIR LA JOURNÉE", "micro", TEXTE, espace=0.7)
    elif numero == 2:
        poser(d, x + 8, rang, "OUVRIR LA JOURNÉE", "micro", TEXTE, espace=0.9)


def entete(d, xs, cols, y):
    for i, nom in enumerate(JOURS):
        w = cols[i]
        x = xs[i] + (w - mesure(nom, "micro")) / 2
        poser(d, x, y, nom, "micro", ENCRE if i >= 5 else DOUX, espace=1.2, maj=True)
    d.line([(PAD * S, (y + 17) * S), ((L - PAD) * S, (y + 17) * S)], fill=ENCRE, width=TRAIT * S)
    return y + 25


def pied(d, y):
    lignes = [
        ("S44 · lun 26 oct au 1 nov", "1 jour porté", "0 h"),
        ("S45 · lun 2 au dim 8 nov", "19 postes", "165 h 50"),
        ("S46 · lun 9 au dim 15 nov", "13 postes · 1 férié", "113 h 15"),
        ("S47 · lun 16 au dim 22 nov", "15 postes", "133 h 20"),
        ("S48 · lun 23 au dim 29 nov", "22 postes · 3 à vérifier", "184 h 35"),
        ("S49 · lun 30 nov", "4 postes", "32 h"),
    ]
    h = 23
    d.rectangle([PAD * S, y * S, (L - PAD) * S, (y + h * len(lignes) + 1) * S], fill=FILET)
    for i, (gauche, milieu, droit) in enumerate(lignes):
        yy = y + 1 + i * h
        d.rectangle([(PAD + 1) * S, yy * S, (L - PAD - 1) * S, (yy + h - 1) * S], fill=melange(PAPIER, BLANC, 12))
        poser(d, PAD + 10, yy + 6, gauche, "sans", DOUX)
        wd = mesure(droit, "mono")
        poser(d, L - PAD - 10 - wd, yy + 6, droit, "mono", ENCRE)
        poser(d, L - PAD - 14 - wd - mesure(milieu + " ·", "sans"), yy + 6.5, milieu + " ·", "sans", DOUX)
    return y + h * len(lignes) + 8


def legende(d, y):
    items = [
        (VIOLET, "poste planifié, teinte de l'équipe"),
        (ALERTE, "oubli · retard — à vérifier"),
        (ABSENT, "non pointé après la fin du poste"),
        (ARDOISE, "repos · férié"),
    ]
    x = PAD
    for couleur, mot in items:
        d.rectangle([x * S, (y + 2) * S, (x + 10) * S, (y + 12) * S], fill=couleur, outline=ENCRE, width=S)
        x = poser(d, x + 15, y + 1, mot, "sans", DOUX) + 20
    return y + 22


def planche(mode, titre, chapeau, sortie):
    cols = colonnes()
    xs = abscisses(cols)
    h_case = H_CASE_A if mode == "A" else H_CASE_B
    lignes_pied = 6 * 23 + 8
    h = COLLE + TRAIT + 20 + 20 + 15 * 2 + 26 + len(grille()) * (h_case + GAP) + lignes_pied + 30 + TRAIT
    tole = 14  # l'air autour de la feuille : l'assise du cadre doit avoir où se poser
    img = Image.new("RGB", ((L + 2 * tole) * S, (h + 2 * tole) * S), SABLE)
    d = ImageDraw.Draw(img)
    feuille(d, tole, tole, L, h)
    y = COLLE + TRAIT + 12
    poser(d, PAD, y, titre, "fort", ENCRE, espace=-0.1)
    y += 22
    for ligne in chapeau.split("\n"):
        poser(d, PAD, y, ligne, "sans", DOUX)
        y += 15
    y += 12
    y = entete(d, xs, cols, y)
    for rang in grille():
        for i, numero in enumerate(rang):
            if numero is None:  # hors du mois : une encoche, pas une fausse case
                d.rectangle(
                    [xs[i] * S, y * S, (xs[i] + cols[i]) * S, (y + h_case) * S],
                    outline=melange(FILET, PAPIER, 40),
                    width=S,
                )
                continue
            (case_a if mode == "A" else case_b)(d, xs[i], y, cols[i], h_case, numero, i >= 5)
        y += h_case + GAP
    y += 10
    y = pied(d, y)
    legende(d, y)
    img = img.resize((L + 2 * tole, h + 2 * tole), Image.LANCZOS)
    chemin = os.path.join(RACINE, "docs/maquettes", sortie)
    img.save(chemin)
    print(f"Écrit : docs/maquettes/{sortie} · {L + 2 * tole}×{h + 2 * tole} · {len(cols)} colonnes de {cols[0]} px · égales à 1 px près")


if __name__ == "__main__":
    planche(
        "A",
        "A · le mois ne dit que ce qui dépasse",
        "Novembre 2026 — équipe « Accueil + Atelier », cinq collaborateurs. La norme se tait : une case conforme porte\nla bande de teinte du jour, deux chiffres et une règle en pied. Ne parlent que les tampons et le compte, semaine par semaine.",
        "choix-mois-A.png",
    )
    planche(
        "B",
        "B · le mois dit qui est là",
        "Novembre 2026 — même cadre, même géométrie réparée, autre lecture : un rang par collaborateur, le nom lisible,\nles heures à droite en colonnes serrées, l'anomalie collée au nom qui la porte, et le « +3 » qui ouvre la journée.",
        "choix-mois-B.png",
    )
