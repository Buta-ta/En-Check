#!/usr/bin/env python3
"""
En-Check — planches de décision d'identité visuelle.

Rend des PNG nets (dessin à 3x puis réduction) : couleurs exactes, contrastes
mesurés, aucun arrondi d'artefact IA. Les valeurs de la direction A sont celles
du code (`src/index.css`) ; celles de B sont prélevées sur le motif bogolan
déjà validé (`public/images/paie-bogolan-haut.webp`) ; celles de C sont celles
du référentiel v0.1 de l'IA UX (accent non chiffré dans le document).

Usage : python planche.py [1|2|3|4|all]
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
S = 3  # facteur de suréchantillonnage
W = 1600

# ─────────────────────────────────────────────── polices
FAMILLES = {
    "inter": {400: "Inter-400.ttf", 500: "Inter-500.ttf", 600: "Inter-600.ttf",
              700: "Inter-700.ttf", 800: "Inter-800.ttf"},
    "plex": {400: "plex-sans-400.ttf", 600: "plex-sans-600.ttf", 700: "plex-sans-700.ttf"},
    "work": {400: "work-sans-400.ttf", 600: "work-sans-600.ttf", 700: "work-sans-700.ttf"},
    "mono": {400: "plex-mono-400.ttf", 600: "plex-mono-600.ttf", 700: "plex-mono-700.ttf"},
}
FAMILLE = "inter"


def F(weight, size):
    fam = FAMILLES[FAMILLE]
    if weight not in fam:
        weight = max(fam)
    return ImageFont.truetype(os.path.join(HERE, "fonts", fam[weight]), int(size * S))


# ─────────────────────────────────────────────── contraste (WCAG 2.1)
def _lum(hexa):
    h = hexa.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def contraste(a, b):
    la, lb = _lum(a), _lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return round((hi + 0.05) / (lo + 0.05), 2)


# ─────────────────────────────────────────────── palettes
A = dict(  # ce que le code utilise aujourd'hui
    nom="Sable & or",
    sous="Aujourd'hui, dans le code",
    intention="L'identité en service :\nblanc cassé, sable, or, brun.",
    fond="#FFFBF5", surface="#E5D4C0", surface2="#F5E9DA", bordure="#E5D4C0",
    encre="#1C1C1C", douce="#9E9E9E", accent="#D4AF37", accent_texte="#8B6914",
    succes="#4A7C59", alerte="#B8791F", erreur="#9B2C2C",
    sur_accent="#FFFBF5",
    origine="Valeurs réelles de src/index.css",
)
B = dict(  # la direction demandée : sable, terre cuite, argile
    nom="Sable & argile",
    sous="Ta direction, prélevée sur le motif",
    intention="Sable, terre cuite, argile :\nles couleurs du bogolan déjà validé.",
    fond="#F3E9DA", surface="#FBF4E9", surface2="#EADCC7", bordure="#D8C6AC",
    encre="#2A1708", douce="#6B4A32", accent="#A26537", accent_texte="#7E4A26",
    succes="#3F6B4C", alerte="#8A5A14", erreur="#9B2C2C",
    sur_accent="#FFFDF7",
    origine="Prélevées sur le motif bogolan",
)
C = dict(  # ce que propose le référentiel v0.1
    nom="Neutre chaud",
    sous="Référentiel v0.1 de l'IA UX",
    intention="Gris chauds et ambre :\n« proposition à calibrer ».",
    fond="#F4F1EB", surface="#FFFDF9", surface2="#EEE8DE", bordure="#DED6C9",
    encre="#241F19", douce="#71685E", accent="#B4703A", accent_texte="#8A5A14",
    succes="#4A7C59", alerte="#B8791F", erreur="#9B2C2C",
    sur_accent="#FFFDF9",
    origine="§2 du référentiel (accent non chiffré)",
)
DIRECTIONS = [A, B, C]

# versions sombres
A_D = dict(fond="#171310", surface="#221C16", surface2="#2C241C", bordure="#3A2F24",
           encre="#F7EFE2", douce="#9E9E9E", accent="#D4AF37", accent_texte="#E3C766",
           succes="#7FB08F", alerte="#E0B36A", erreur="#E08A8A", sur_accent="#1C1C1C")
B_D = dict(fond="#1C1109", surface="#2A1B10", surface2="#352316", bordure="#463020",
           encre="#F3E9DA", douce="#C9B49A", accent="#CEA872", accent_texte="#D9B98C",
           succes="#7FB08F", alerte="#E0B36A", erreur="#E08A8A", sur_accent="#1C1109")
C_D = dict(fond="#171613", surface="#211F1B", surface2="#29251F", bordure="#433B31",
           encre="#F5F0E7", douce="#BEB3A3", accent="#C98A4B", accent_texte="#D9A063",
           succes="#7FB08F", alerte="#E0B36A", erreur="#E08A8A", sur_accent="#171613")

# ─────────────────────────────────────────────── primitives
def canevas(h, bg="#FFFFFF"):
    return Image.new("RGB", (int(W * S), int(h * S)), bg)


def rr(d, box, r, fill=None, outline=None, width=1):
    d.rounded_rectangle([v * S for v in box], radius=int(r * S),
                        fill=fill, outline=outline, width=max(1, int(width * S)))


def txt(d, xy, s, font, fill, anchor="lt"):
    d.text((xy[0] * S, xy[1] * S), s, font=font, fill=fill, anchor=anchor)


def largeur(d, s, font):
    return d.textlength(s, font=font) / S


def caps(d, xy, s, font, fill, tracking=1.5):
    x = xy[0]
    for ch in s:
        d.text((x * S, xy[1] * S), ch, font=font, fill=fill, anchor="lt")
        x += largeur(d, ch, font) + tracking
    return x


def ombre(douche, box, r, flou=10, alpha=26, dy=3):
    calque = Image.new("RGBA", douche.size, (0, 0, 0, 0))
    dd = ImageDraw.Draw(calque)
    dd.rounded_rectangle([(box[0]) * S, (box[1] + dy) * S, (box[2]) * S, (box[3] + dy) * S],
                         radius=r * S, fill=(28, 18, 10, alpha))
    calque = calque.filter(ImageFilter.GaussianBlur(flou * S))
    douche.alpha_composite(calque) if douche.mode == "RGBA" else None
    return calque


def coller_ombre(img, box, r, flou=10, alpha=26, dy=3):
    base = img.convert("RGBA")
    calque = ombre(base, box, r, flou, alpha, dy)
    base.alpha_composite(calque)
    return base


def pastille(d, x, y, texte, fg, bg, taille=10.5, pad=(8, 4), radius=20):
    f = F(600, taille)
    w = largeur(d, texte, f) + pad[0] * 2
    h = taille + pad[1] * 2
    rr(d, (x, y, x + w, y + h), radius, fill=bg)
    txt(d, (x + pad[0], y + pad[1]), texte, f, fg)
    return w, h


def verdict(d, x, y, ratio, seuil=4.5):
    ok = ratio >= seuil
    fg, bg = ("#1E5B36", "#DDF0E3") if ok else ("#8C2020", "#F8E0DE")
    libelle = f"{ratio:.2f}:1".replace(".", ",")
    w = largeur(d, libelle, F(600, 11))
    rr(d, (x, y, x + w + 16, y + 20), 6, fill=bg)
    txt(d, (x + 8, y + 4), libelle, F(600, 11), fg)
    return ok


# ─────────────────────────────────────────────── figure 1 — palettes
def figure1():
    H = 1054
    img = canevas(H)
    d = ImageDraw.Draw(img)
    M = 64
    encre, douce, hair = "#14100C", "#6B6259", "#E8E2D8"
    mot = "#8A6A3A"

    caps(d, (M, 44), "EN-CHECK  ·  PLANCHE DE DÉCISION  ·  IDENTITÉ VISUELLE", F(600, 11), mot)
    txt(d, (M, 66), "Trois directions, une décision", F(700, 40), encre)
    txt(d, (M, 122), "Même contenu, mêmes mesures. Seules les couleurs changent — et les contrastes sont calculés, pas estimés.",
        F(400, 15), douce)
    txt(d, (M, 146), "La direction B n'invente rien : ses six couleurs sont prélevées sur le motif bogolan que tu as déjà validé.",
        F(400, 15), douce)

    col_w = (W - 2 * M - 2 * 30) / 3
    y0 = 196
    for i, p in enumerate(DIRECTIONS):
        x = M + i * (col_w + 30)
        lettre = "ABC"[i]
        # cadre
        rr(d, (x, y0, x + col_w, y0 + 584), 14, fill="#FFFFFF", outline=hair, width=1)
        # entête
        txt(d, (x + 22, y0 + 18), lettre, F(800, 34), p["accent"])
        txt(d, (x + 62, y0 + 22), p["nom"], F(700, 20), encre)
        txt(d, (x + 62, y0 + 48), p["sous"], F(500, 12), mot)
        yy = y0 + 76
        for ligne in p["intention"].split("\n"):
            txt(d, (x + 22, yy), ligne, F(400, 13), douce)
            yy += 19

        # nuancier 3 x 2
        sw = [("Fond", p["fond"]), ("Surface", p["surface"]),
              ("Texte principal", p["encre"]), ("Texte secondaire", p["douce"]),
              ("Marque", p["accent"]), ("Marque lisible", p["accent_texte"])]
        cw = (col_w - 44 - 2 * 10) / 3
        yb = y0 + 136
        for j, (role, val) in enumerate(sw):
            cx = x + 22 + (j % 3) * (cw + 10)
            cy = yb + (j // 3) * 84
            rr(d, (cx, cy, cx + cw, cy + 44), 8, fill=val, outline="#E8E2D8", width=1)
            txt(d, (cx, cy + 50), role, F(500, 10.5), douce)
            txt(d, (cx, cy + 64), val.upper(), F(600, 10.5), encre)

        # contrastes
        yc = y0 + 348
        txt(d, (x + 22, yc - 24), "CONTRASTE MESURÉ", F(600, 10), mot)
        lignes = [
            ("Texte principal / fond", p["encre"], p["fond"]),
            ("Texte secondaire / fond", p["douce"], p["fond"]),
            ("Marque en texte / fond", p["accent"], p["fond"]),
            ("Marque lisible / fond", p["accent_texte"], p["fond"]),
            ("Fond sur bouton marque", p["sur_accent"], p["accent"]),
        ]
        for k, (lib, fg, bg) in enumerate(lignes):
            ry = yc + k * 28
            txt(d, (x + 22, ry), lib, F(400, 12), "#3B342C")
            ratio = contraste(fg, bg)
            verdict(d, x + col_w - 22 - 64, ry - 3, ratio)
        # échantillon vivant
        rr(d, (x + 22, yc + 150, x + col_w - 22, yc + 212), 10, fill=p["surface"], outline=p["bordure"], width=1)
        txt(d, (x + 36, yc + 162), "Aa  En retard", F(600, 15), p["encre"])
        txt(d, (x + 36, yc + 184), "Heure serveur 08:04 · borne 1", F(400, 11.5), p["douce"])
        bw = min(120, col_w - 60)
        rr(d, (x + col_w - 22 - bw, yc + 170, x + col_w - 22 - bw + bw, yc + 198), 8, fill=p["accent"])
        txt(d, (x + col_w - 22 - bw / 2, yc + 176), "Traiter", F(600, 12), p["sur_accent"], anchor="mt")

        # verdict de colonne
        p["_ok"] = sum(1 for _, f, b in lignes if contraste(f, b) >= 4.5)

    # bandeau motif
    y_m = y0 + 610
    txt(d, (M, y_m), "D'OÙ VIENNENT LES COULEURS DE B", F(600, 10), mot)
    band = Image.open(os.path.join(HERE, "motif-bogolan.webp")).convert("RGB")
    bw = W - 2 * M
    bh = round(band.height * bw / band.width)
    img.paste(band.resize((int(bw * S), int(bh * S)), Image.LANCZOS), (int(M * S), int((y_m + 22) * S)))
    txt(d, (M, y_m + 22 + bh + 12),
        "public/images/paie-bogolan-haut.webp — le motif validé, repris tel quel (jamais redessiné). "
        "Terre cuite #A26537, brun #2A1708, sable #CEA872, argile #683C1E.", F(400, 12), douce)

    # pied
    y_f = y_m + 22 + bh + 44
    caps(d, (M, y_f), "SOURCE DES VALEURS", F(600, 10), mot)
    pied = [("A", "relevées dans src/index.css (main)"),
            ("B", "échantillonnées sur le motif (quantification médiane)"),
            ("C", "§2 du référentiel v0.1 — accent « à calibrer », valeur choisie ici pour l'exemple")]
    yy = y_f + 20
    for lettre, s in pied:
        txt(d, (M, yy), lettre, F(700, 12), "#8A6A3A")
        txt(d, (M + 18, yy), s, F(400, 12.5), "#3B342C")
        yy += 19
    txt(d, (W - M - 260, y_f + 20), "Seuil WCAG AA : 4,5:1", F(600, 11), "#8C2020")
    txt(d, (W - M - 260, y_f + 38), "pour du texte courant", F(400, 11), douce)

    sortie = img.resize((W, H), Image.LANCZOS)
    chemin = os.path.join(HERE, "01-palettes.png")
    sortie.save(chemin, optimize=True)
    print("écrit", chemin)




# ─────────────────────────────────────────────── briques d'écran
def bande_motif(img, box, hauteur=16, fichier="motif-bogolan.webp"):
    """repeat-x aux proportions d'origine : on ne redimensionne jamais en largeur."""
    band = Image.open(os.path.join(HERE, fichier)).convert("RGB")
    r = hauteur / band.height
    band = band.resize((max(1, int(band.width * r * S)), int(hauteur * S)), Image.LANCZOS)
    largeur = max(1, int((box[2] - box[0]) * S))
    tuile = Image.new("RGB", (largeur, band.height))
    x = 0
    while x < largeur:
        tuile.paste(band, (x, 0))
        x += band.width
    img.paste(tuile, (int(box[0] * S), int(box[1] * S)))


def ecran(img, x, y, w, h, p, legende=None):
    """Mini-écran d'administration : le même contenu dans chaque direction."""
    d = ImageDraw.Draw(img)
    rr(d, (x, y, x + w, y + h), 12, fill=p["fond"], outline=p["bordure"], width=1)
    # barre haute
    d.rectangle([x * S, y * S, (x + w) * S, (y + 30) * S], fill=p["surface"])
    txt(d, (x + 12, y + 9), "En-Check", F(800, 12.5), p["encre"])
    txt(d, (x + w - 12, y + 10), "Boutique A · 08:04", F(500, 9.5), p["douce"], anchor="rt")
    d.line([x * S, (y + 30) * S, (x + w) * S, (y + 30) * S], fill=p["bordure"], width=1)
    bande_motif(img, (x, y + 31, x + w, y + 47), 16)

    pad = 12
    yy = y + 58
    cw = (w - pad * 3) / 2
    # carte KPI
    rr(d, (x + pad, yy, x + pad + cw, yy + 92), 9, fill=p["surface"], outline=p["bordure"], width=1)
    txt(d, (x + pad + 11, yy + 11), "AYANT POINTÉ", F(600, 8.5), p["douce"])
    txt(d, (x + pad + 11, yy + 26), "4 / 6", F(700, 32), p["encre"])
    txt(d, (x + pad + 11, yy + 66), "à heure égale : 5", F(400, 9.5), p["douce"])
    # petites barres
    for i, hh in enumerate([10, 16, 22, 14, 26]):
        bx = x + pad + cw - 54 + i * 9
        d.rectangle([bx * S, (yy + 62 - hh) * S, (bx + 5) * S, (yy + 62) * S], fill=p["accent"])
    # carte à traiter
    x2 = x + pad * 2 + cw
    rr(d, (x2, yy, x2 + cw, yy + 92), 9, fill=p["surface"], outline=p["bordure"], width=1)
    txt(d, (x2 + 11, yy + 11), "À TRAITER", F(600, 8.5), p["douce"])
    txt(d, (x2 + 11, yy + 26), "2 oublis de sortie", F(600, 11), p["encre"])
    rr(d, (x2 + 11, yy + 60, x2 + 11 + 74, yy + 84), 7, fill=p["accent"])
    txt(d, (x2 + 48, yy + 66), "Traiter", F(600, 10.5), p["sur_accent"], anchor="mt")
    # lignes du registre
    yy += 104
    lignes = [("Mariam ADJOVI", "07:58 · Borne 1", "En poste", p["succes"]),
              ("Koffi DANSOU", "08:12 · Borne 1", "En retard", p["alerte"]),
              ("Awa SÈNOU", "06:45 · Borne 2", "Sortie manquante", p["erreur"])]
    for nom, meta, etat, coul in lignes:
        rr(d, (x + pad, yy, x + w - pad, yy + 34), 7, fill=p["surface"], outline=p["bordure"], width=1)
        rr(d, (x + pad + 9, yy + 9, x + pad + 25, yy + 25), 8, fill=p["surface2"])
        txt(d, (x + pad + 34, yy + 7), nom, F(600, 10.5), p["encre"])
        txt(d, (x + pad + 34, yy + 20), meta, F(400, 8.5), p["douce"])
        bw = largeur(d, etat, F(500, 8.5))
        bx = x + w - pad - 9 - bw
        d.ellipse([(bx - 10) * S, (yy + 14) * S, (bx - 4) * S, (yy + 20) * S], fill=coul)
        txt(d, (bx, yy + 12), etat, F(500, 8.5), p["encre"])
        yy += 40
    # pied
    txt(d, (x + pad, y + h - 20), "Heure serveur 08:04 · synchronisé", F(400, 8.5), p["douce"])
    if legende:
        txt(d, (x + pad, y + h - 20), legende, F(400, 8.5), p["douce"])


def figure2():
    H = 985
    img = canevas(H)
    d = ImageDraw.Draw(img)
    M = 64
    encre, douce, hair, mot = "#14100C", "#6B6259", "#E8E2D8", "#8A6A3A"
    caps(d, (M, 44), "EN-CHECK  ·  PLANCHE DE DÉCISION  ·  LE MÊME ÉCRAN", F(600, 11), mot)
    txt(d, (M, 66), "Ce que ça donne sur un écran", F(700, 38), encre)
    txt(d, (M, 120), "Même données, même hiérarchie, même texte. On ne compare que la couleur — pas la mise en page.",
        F(400, 15), douce)

    col_w = (W - 2 * M - 2 * 30) / 3
    y = 205
    for rang, (mode, suffixe) in enumerate([("Clair", ""), ("Sombre", "_D")]):
        txt(d, (M, y - 46), mode.upper(), F(700, 12), mot)
        for i, p in enumerate(DIRECTIONS):
            q = dict(p)
            if suffixe:
                q.update(eval(f"{'ABC'[i]}{suffixe}"))
            x = M + i * (col_w + 30)
            txt(d, (x, y - 26), f"{'ABC'[i]} · {p['nom']}", F(500, 11.5), "#3B342C")
            ecran(img, x, y, col_w, 300, q)
        y += 410

    txt(d, (M, H - 40), "Les valeurs sombres sont mesurées aussi : le texte secondaire doit rester lisible sur le fond comme sur les cartes.",
        F(400, 12), douce)
    sortie = img.resize((W, H), Image.LANCZOS)
    chemin = os.path.join(HERE, "02-ecrans.png")
    sortie.save(chemin, optimize=True)
    print("écrit", chemin)

# ─────────────────────────────────────────────── figure 3 — la preuve
def qr(d, x, y, taille, couleur, fond):
    """Motif de vérification décoratif (ce n'est pas un QR réel)."""
    import hashlib
    graine = hashlib.sha256(b"encheck-billet-8f3a").digest()
    n = 21
    m = taille / n
    rr(d, (x, y, x + taille + 10, y + taille + 10), 6, fill=fond, outline=couleur, width=1)
    for i in range(n):
        for j in range(n):
            if (graine[(i * n + j) % 32] >> (j % 8)) & 1:
                d.rectangle([(x + 5 + i * m) * S, (y + 5 + j * m) * S,
                             (x + 5 + (i + 1) * m) * S, (y + 5 + (j + 1) * m) * S], fill=couleur)
    for cx, cy in [(0, 0), (n - 7, 0), (0, n - 7)]:
        d.rectangle([(x + 5 + cx * m) * S, (y + 5 + cy * m) * S,
                     (x + 5 + (cx + 7) * m) * S, (y + 5 + (cy + 7) * m) * S], fill=couleur)
        d.rectangle([(x + 5 + (cx + 1) * m) * S, (y + 5 + (cy + 1) * m) * S,
                     (x + 5 + (cx + 6) * m) * S, (y + 5 + (cy + 6) * m) * S], fill=fond)
        d.rectangle([(x + 5 + (cx + 2) * m) * S, (y + 5 + (cy + 2) * m) * S,
                     (x + 5 + (cx + 5) * m) * S, (y + 5 + (cy + 5) * m) * S], fill=couleur)


def billet(img, x, y, w, p, ref=None, tampon=True):
    ref = ref or p["accent_texte"]
    d = ImageDraw.Draw(img)
    h = 470
    rr(d, (x, y, x + w, y + h), 14, fill=p["fond"], outline=p["bordure"], width=1)
    bande_motif(img, (x, y, x + w, y + 24), 24)
    pad = 22
    yy = y + 40
    txt(d, (x + pad, yy), "En-Check", F(800, 16), p["encre"])
    txt(d, (x + pad, yy + 20), "Billet de pointage · registre du personnel", F(400, 9.5), p["douce"])
    txt(d, (x + w - pad, yy), "N° 2026-11-08-0042", F(600, 11), ref, anchor="rt")
    txt(d, (x + w - pad, yy + 18), "Émis à 17:04:39", F(400, 9.5), p["douce"], anchor="rt")

    yy += 52
    txt(d, (x + pad, yy), "Journée du 8 novembre 2026", F(700, 20), p["encre"])
    yy += 34
    d.line([(x + pad) * S, yy * S, (x + w - pad) * S, yy * S], fill=p["bordure"], width=1)

    yy += 14
    champs = [("SALARIÉ", "Mariam ADJOVI"), ("MATRICULE", "EC-0142"),
              ("ENTREPRISE", "Boutique A · Cotonou"), ("BORNE", "Entrée principale"),
              ("ENTRÉE (SERVEUR)", "07:58:12"), ("SORTIE (SERVEUR)", "17:04:39"),
              ("DURÉE RETENUE", "8 h 06"), ("STATUT", "Clôturée")]
    cw = (w - 2 * pad) / 2
    for k, (lib, val) in enumerate(champs):
        cx = x + pad + (k % 2) * cw
        cy = yy + (k // 2) * 42
        txt(d, (cx, cy), lib, F(600, 8), p["douce"])
        txt(d, (cx, cy + 13), val, F(600, 12.5), p["encre"])

    yv = y + h - 118
    d.line([(x + pad) * S, (yv - 12) * S, (x + w - pad) * S, (yv - 12) * S], fill=p["bordure"], width=1)
    qr(d, x + pad, yv, 62, p["encre"], p["surface"])
    txt(d, (x + pad + 78, yv + 4), "Empreinte 8f3a…c21e", F(600, 11), p["encre"])
    txt(d, (x + pad + 78, yv + 20), "Vérifier sur encheck.app/v/8f3a-c21e", F(400, 9.5), ref)
    txt(d, (x + pad + 78, yv + 36), "Toute modification invalide l'empreinte.", F(400, 9.5), p["douce"])
    txt(d, (x + w - pad, yv + 4), "SCEAU", F(600, 8), p["douce"], anchor="rt")
    txt(d, (x + w - pad, yv + 16), "Heure serveur", F(500, 10), p["encre"], anchor="rt")
    txt(d, (x + w - pad, yv + 30), "UTC+1", F(500, 10), p["encre"], anchor="rt")

    txt(d, (x + pad, y + h - 22), "Document non modifiable après clôture · conservé 5 ans",
        F(400, 8.5), p["douce"])

    if not tampon:
        return
    tampon = Image.new("RGBA", (int(160 * S), int(48 * S)), (0, 0, 0, 0))
    dt = ImageDraw.Draw(tampon)
    dt.rounded_rectangle([2, 2, 160 * S - 4, 48 * S - 4], radius=8 * S, outline=ref, width=2 * S)
    dt.text((14 * S, 8 * S), "CLÔTURÉE", font=F(700, 15), fill=ref)
    dt.text((14 * S, 28 * S), "8 NOV. 2026 · 17:04", font=F(500, 8.5), fill=ref)
    tampon = tampon.rotate(-7, expand=True, resample=Image.BICUBIC)
    img.paste(tampon, (int((x + w - 214) * S), int((y + 262) * S)), tampon)


def figure3():
    H = 735
    img = canevas(H)
    d = ImageDraw.Draw(img)
    M = 64
    encre, douce, mot = "#14100C", "#6B6259", "#8A6A3A"
    caps(d, (M, 44), "EN-CHECK  ·  PLANCHE DE DÉCISION  ·  CE QUE TU VENDS", F(600, 11), mot)
    txt(d, (M, 66), "La preuve, avec la même identité", F(700, 38), encre)
    txt(d, (M, 120), "Tu ne vends pas un tableau de bord : tu vends un billet qu'on peut montrer. Le même document, dans deux directions.",
        F(400, 15), douce)

    w = (W - 2 * M - 32) / 2
    billet(img, M, 172, w, A, ref="#D4AF37")
    billet(img, M + w + 32, 172, w, B)
    txt(d, (M, 172 + 486), "A · Sable & or — l'or en texte sur le sable tombe à 2,04:1 : numéro, lien de vérification et tampon s'effacent.",
        F(400, 12), douce)
    txt(d, (M + w + 32, 172 + 486), "B · Sable & argile — une argile profonde porte les références : 6,04:1, lisible à l'écran comme à l'impression.",
        F(400, 12), douce)
    txt(d, (M, H - 34), "Mêmes données, même mise en page. Seule la lisibilité change — et c'est elle qui fait la valeur d'une preuve.",
        F(400, 12), "#3B342C")
    sortie = img.resize((W, H), Image.LANCZOS)
    chemin = os.path.join(HERE, "03-preuve.png")
    sortie.save(chemin, optimize=True)
    print("écrit", chemin)


# ─────────────────────────────────────────────── figure 4 — la décision
def figure4():
    H = 800
    img = canevas(H)
    d = ImageDraw.Draw(img)
    M = 64
    encre, douce, mot, hair = "#14100C", "#6B6259", "#8A6A3A", "#E8E2D8"
    caps(d, (M, 44), "EN-CHECK  ·  PLANCHE DE DÉCISION  ·  CE QUE TU CHOISIS", F(600, 11), mot)
    txt(d, (M, 66), "Ce qu'il te reste à décider", F(700, 38), encre)
    txt(d, (M, 120), "Trois directions, comparées sur ce qui se mesure. Une seule recommandation — la tienne reste la bonne.",
        F(400, 15), douce)

    col0, colx = 210, 300
    cw = (W - M * 2 - col0 - 60) / 3
    y = 200
    # entêtes
    txt(d, (M, y), "ÉLÉMENT", F(600, 10), mot)
    for i, p in enumerate(DIRECTIONS):
        x = M + col0 + i * (cw + 30)
        txt(d, (x, y - 26), f"{'ABC'[i]}", F(800, 22), p["accent"])
        txt(d, (x + 26, y - 22), p["nom"], F(600, 13), encre)
        if i == 1:
            pastille(d, x + 26 + largeur(d, p["nom"], F(600, 13)) + 10, y - 22, "RECOMMANDÉ", "#1E5B36", "#DDF0E3", 9)

    lignes = [
        ("Le fond de page", "fond"),
        ("Les cartes et panneaux", "surface"),
        ("Le texte courant", "encre"),
        ("Le texte secondaire", "douce"),
        ("La marque : boutons, repères", "accent"),
        ("La marque en texte (liens, n°)", "accent_texte"),
    ]
    y += 22
    for lib, cle in lignes:
        txt(d, (M, y + 5), lib, F(500, 12), "#3B342C")
        for i, p in enumerate(DIRECTIONS):
            x = M + col0 + i * (cw + 30)
            rr(d, (x, y, x + 30, y + 24), 6, fill=p[cle], outline=hair, width=1)
            txt(d, (x + 40, y + 5), p[cle].upper(), F(600, 11.5), encre)
            if cle in ("douce", "accent", "accent_texte"):
                r = contraste(p[cle], p["fond"])
                verdict(d, x + 128, y + 3, r)
        d.line([M * S, (y + 34) * S, (W - M) * S, (y + 34) * S], fill="#F1ECE3", width=1)
        y += 42

    # ligne conformité
    txt(d, (M, y + 6), "Contrôles AA réussis sur 5", F(600, 12), "#3B342C")
    for i, p in enumerate(DIRECTIONS):
        x = M + col0 + i * (cw + 30)
        reussis = sum(1 for f, b in [(p["encre"], p["fond"]), (p["douce"], p["fond"]),
                                     (p["accent"], p["fond"]), (p["accent_texte"], p["fond"]),
                                     (p["sur_accent"], p["accent"])] if contraste(f, b) >= 4.5)
        fg, bg = ("#1E5B36", "#DDF0E3") if reussis >= 4 else ("#8C2020", "#F8E0DE")
        txt(d, (x, y + 2), f"{reussis} / 5", F(800, 20), fg)
    y += 46

    # recommandation
    rr(d, (M, y + 14, W - M, y + 176), 14, fill="#FBF7F0", outline="#EFE6D8", width=1)
    txt(d, (M + 24, y + 32), "Décision proposée", F(700, 15), encre)
    texte = [
        ("1", "Adopter B comme socle : les six couleurs viennent du motif que tu as déjà validé — rien n'est inventé."),
        ("2", "Ne jamais poser de texte sur l'argile claire : elle sert d'aplat (boutons, repères), pas d'encre. L'écriture prend l'argile profonde (6,04:1)."),
        ("3", "Figer le sable, l'argile et le brun dans le code (tokens), et interdire toute nouvelle couleur hors de cette liste — la règle devient vérifiable, pas une opinion."),
    ]
    yy = y + 56
    for n, t in texte:
        rr(d, (M + 24, yy + 1, M + 42, yy + 19), 9, fill="#A26537")
        txt(d, (M + 33, yy + 3), n, F(700, 11), "#FFFDF7", anchor="mt")
        txt(d, (M + 52, yy), t, F(400, 12), "#3B342C")
        yy += 34

    txt(d, (M, H - 38), "Les valeurs de C sont celles du référentiel v0.1 ; son accent « ambre / terre cuite » n'y est pas chiffré —",
        F(400, 11), douce)
    txt(d, (M, H - 22), "#B4703A est ici un exemple plausible, et il échoue en texte comme en fond de bouton.",
        F(400, 11), douce)
    sortie = img.resize((W, H), Image.LANCZOS)
    chemin = os.path.join(HERE, "04-decision.png")
    sortie.save(chemin, optimize=True)
    print("écrit", chemin)




# ─────────────────────────────────────────────── figure 5 — les motifs
def cover(chemin, w, h):
    from PIL import ImageOps
    im = Image.open(chemin).convert("RGB")
    return ImageOps.fit(im, (int(w * S), int(h * S)), method=Image.LANCZOS, centering=(0.5, 0.5))


def figure5():
    H = 830
    img = canevas(H)
    d = ImageDraw.Draw(img)
    M = 64
    encre, douce, mot = "#14100C", "#6B6259", "#8A6A3A"
    caps(d, (M, 44), "EN-CHECK  ·  PLANCHE DE DÉCISION  ·  LES MOTIFS DÉJÀ EN SERVICE", F(600, 11), mot)
    txt(d, (M, 66), "Six motifs, une seule grammaire", F(700, 38), encre)
    txt(d, (M, 120), "Tu en as déjà six, chacun attaché à une page. La règle n'est pas le choix du motif : c'est la façon de le poser.",
        F(400, 15), douce)

    motifs = [("motif-bogolan.webp", "Paie · Bogolan", "bandeau haut et bas, repeat-x"),
              ("absences-ndebele.webp", "Absences · Ndébélé", "bande pleine largeur"),
              ("planning-kuba.webp", "Planning · Kuba", "motif de fond de la page"),
              ("pointages-adinkra.webp", "Pointages · Adinkra", "liseré et en-tête"),
              ("employes-zoulou.webp", "Employés · Zoulou", "bandeau de section"),
              ("admin-bogolan-selected.webp", "Administrateurs · Bogolan", "repère de sélection")]
    cw = (W - 2 * M - 40) / 2
    y = 180
    for i, (fichier, titre, usage) in enumerate(motifs):
        cx = M + (i % 2) * (cw + 40)
        cy = y + (i // 2) * 158
        img.paste(cover(os.path.join(HERE, fichier), cw, 86), (int(cx * S), int(cy * S)))
        txt(d, (cx, cy + 96), titre, F(600, 12), encre)
        txt(d, (cx, cy + 112), usage, F(400, 11), douce)
    # encadré règle
    yr = y + 3 * 158 + 6
    rr(d, (M, yr, W - M, yr + 96), 12, fill="#FBF7F0", outline="#EFE6D8", width=1)
    txt(d, (M + 22, yr + 16), "La grammaire (elle, elle ne se discute plus)", F(700, 14), encre)
    regles = ["Une seule bande par page.", "Jamais derrière du texte.",
              "Jamais étirée : proportions d'origine.", "Jamais deux motifs forts dans la même zone."]
    for k, r in enumerate(regles):
        txt(d, (M + 22 + (k % 2) * 380, yr + 44 + (k // 2) * 20), "—  " + r, F(400, 11.5), "#3B342C")
    txt(d, (M, H - 24), "À noter : Ndébélé, Adinkra et Zoulou apportent un indigo et un vert qu'aucune des trois palettes ne prévoit. "
        "B doit les accueillir comme couleurs secondaires, sinon trois pages sur six resteront en conflit avec la charte.",
        F(400, 11.5), "#3B342C")
    sortie = img.resize((W, H), Image.LANCZOS)
    chemin = os.path.join(HERE, "05-motifs.png")
    sortie.save(chemin, optimize=True)
    print("écrit", chemin)


# ─────────────────────────────────────────────── figure 6 — la règle des motifs
def entete_page(img, x, y, w, h, motif, regime):
    """Trois façons de poser un motif en haut d'une page, palette B."""
    d = ImageDraw.Draw(img)
    p = B
    rr(d, (x, y, x + w, y + h), 12, fill=p["fond"], outline=p["bordure"], width=1)
    d.rectangle([x * S, y * S, (x + w) * S, (y + 26) * S], fill=p["surface"])
    txt(d, (x + 12, y + 7), "En-Check", F(700, 11), p["encre"])
    txt(d, (x + w - 12, y + 8), "Paie · novembre 2026", F(400, 9), p["douce"], anchor="rt")

    if regime == "nu":
        bande_motif(img, (x + 1, y + 27, x + w - 1, y + 57), 30, motif)
    elif regime == "passe-partout":
        rr(d, (x + 10, y + 34, x + w - 10, y + 64), 6, fill=p["surface"], outline=p["bordure"], width=1)
        bande_motif(img, (x + 14, y + 39, x + w - 14, y + 59), 20, motif)

    yy = y + (78 if regime != "illustration" else 40)
    txt(d, (x + 14, yy), "Masse salariale", F(600, 11), p["encre"])
    txt(d, (x + 14, yy + 18), "14 250 000 FCFA", F(700, 18), p["encre"])
    txt(d, (x + 14, yy + 44), "42 salariés · novembre", F(400, 9), p["douce"])
    rr(d, (x + w - 100, yy + 6, x + w - 14, yy + 30), 7, fill=p["accent"])
    txt(d, (x + w - 57, yy + 11), "Envoyer", F(600, 9.5), p["sur_accent"], anchor="mt")
    if regime == "illustration":
        rr(d, (x + 14, yy + 62, x + w - 14, y + h - 12), 8, fill=p["surface"], outline=p["bordure"], width=1)
        bande_motif(img, (x + 22, yy + 74, x + w - 22, yy + 120), 46, motif)
        txt(d, (x + 22, yy + 130), "Aucun bulletin généré ce mois", F(600, 10), p["encre"])
        txt(d, (x + 22, yy + 145), "Le motif est ici une illustration,", F(400, 8.5), p["douce"])
        txt(d, (x + 22, yy + 157), "pas la signature de la page.", F(400, 8.5), p["douce"])


def figure6():
    H = 1000
    img = canevas(H)
    d = ImageDraw.Draw(img)
    M = 64
    encre, douce, mot = "#14100C", "#6B6259", "#8A6A3A"
    caps(d, (M, 44), "EN-CHECK  ·  PLANCHES DE DÉCISION  ·  LES MOTIFS", F(600, 11), mot)
    txt(d, (M, 66), "Un motif par page, oui — à trois conditions", F(700, 36), encre)
    txt(d, (M, 116), "Un motif est une image, pas une palette : ses couleurs restent dans l'image. Aucune n'est prélevée pour colorer un bouton, un badge ou un lien.",
        F(400, 14), douce)
    txt(d, (M, 137), "Ci-dessous, le même en-tête de Paie avec le Ndébélé — le motif qui apporte le plus de bleu et le plus de vert.",
        F(400, 14), douce)

    cw = (W - 2 * M - 2 * 30) / 3
    y = 190
    regimes = [("nu", "1 · Bandeau nu", "Aujourd'hui : le motif est collé au fond.", "Son bleu affronte l'argile : deux marques."),
               ("passe-partout", "2 · Passe-partout — recommandé", "Un cadre de 10 px, une bordure de 1 px,", "20 px de haut. Le motif devient un objet."),
               ("illustration", "3 · Illustration", "Plus de bandeau : le motif vit dans une", "zone de contenu, avec du texte à côté.")]
    for i, (regime, titre, n1, n2) in enumerate(regimes):
        x = M + i * (cw + 30)
        txt(d, (x, y - 26), titre, F(600, 12.5), encre)
        entete_page(img, x, y, cw, 250, "absences-ndebele.webp", regime)
        txt(d, (x, y + 260), n1, F(400, 11.5), douce)
        txt(d, (x, y + 276), n2, F(400, 11.5), douce)

    y2 = y + 330
    txt(d, (M, y2 - 24), "LA MÊME RÈGLE POUR LES SIX MOTIFS", F(600, 10), mot)
    motifs = [("motif-bogolan.webp", "Paie · Bogolan"), ("absences-ndebele.webp", "Absences · Ndébélé"),
              ("planning-kuba.webp", "Planning · Kuba"), ("pointages-adinkra.webp", "Pointages · Adinkra"),
              ("employes-zoulou.webp", "Employés · Zoulou"), ("admin-bogolan-selected.webp", "Administrateurs · Bogolan")]
    gw = (W - 2 * M - 2 * 24) / 3
    for i, (f, lib) in enumerate(motifs):
        gx = M + (i % 3) * (gw + 24)
        gy = y2 + (i // 3) * 100
        rr(d, (gx, gy, gx + gw, gy + 78), 8, fill=B["fond"], outline=B["bordure"], width=1)
        rr(d, (gx + 8, gy + 10, gx + gw - 8, gy + 50), 5, fill=B["surface"], outline=B["bordure"], width=1)
        img.paste(cover(os.path.join(HERE, f), gw - 20, 32), (int((gx + 10) * S), int((gy + 14) * S)))
        txt(d, (gx + 10, gy + 57), lib, F(500, 10.5), B["encre"])
        rr(d, (gx + gw - 76, gy + 55, gx + gw - 10, gy + 73), 6, fill=B["accent"])
        txt(d, (gx + gw - 43, gy + 59), "Envoyer", F(600, 8.5), B["sur_accent"], anchor="mt")

    yr = y2 + 216
    rr(d, (M, yr, W - M, yr + 152), 12, fill="#FBF7F0", outline="#EFE6D8", width=1)
    txt(d, (M + 22, yr + 16), "Les trois conditions — elles rendent la règle vérifiable", F(700, 14), encre)
    regles = [
        ("Hauteur et place fixes", "20 px de haut, en haut de page, marge 10 px, bordure 1 px — identiques partout."),
        ("Jamais derrière du texte", "Le motif occupe sa bande. Aucun texte, aucun tableau par-dessus."),
        ("Aucune couleur prélevée", "Le bleu du Ndébélé n'est pas un bleu de bouton : l'action reste argile."),
        ("Une bande par page, jamais étirée", "Proportions d'origine, repeat-x, deux motifs forts jamais ensemble."),
    ]
    for k, (t, s) in enumerate(regles):
        cx = M + 22 + (k % 2) * 700
        cy = yr + 46 + (k // 2) * 50
        txt(d, (cx, cy), "—  " + t, F(600, 11.5), encre)
        txt(d, (cx + 18, cy + 18), s, F(400, 10.5), "#3B342C")

    txt(d, (M, H - 24), "Conséquence : la marque reste une seule. Ce qui change d'une page à l'autre, c'est l'illustration — pas la couleur, pas la typographie, pas les boutons.",
        F(400, 11.5), "#3B342C")
    sortie = img.resize((W, H), Image.LANCZOS)
    chemin = os.path.join(HERE, "06-motifs-regles.png")
    sortie.save(chemin, optimize=True)
    print("écrit", chemin)


# ─────────────────────────────────────────────── figure 7 — le thème
def kiosque(img, x, y, w, h, p):
    d = ImageDraw.Draw(img)
    rr(d, (x, y, x + w, y + h), 16, fill=p["fond"], outline=p["bordure"], width=1)
    d.rectangle([x * S, y * S, (x + w) * S, (y + 26) * S], fill=p["surface"])
    txt(d, (x + 12, y + 7), "En-Check", F(800, 10.5), p["encre"])
    d.ellipse([(x + w - 22) * S, (y + 8) * S, (x + w - 12) * S, (y + 18) * S], fill=p["accent"])
    bande_motif(img, (x + 1, y + 27, x + w - 1, y + 43), 16, "motifs" if False else "absences-ndebele.webp")
    yy = y + 56
    txt(d, (x + 12, yy), "BONJOUR", F(600, 8), p["douce"])
    txt(d, (x + 12, yy + 13), "Mariam ADJOVI", F(700, 14), p["encre"])
    txt(d, (x + 12, yy + 33), "07:58 · Borne 1", F(400, 9), p["douce"])
    cy = y + h / 2 + 4
    r = 46
    d.ellipse([(x + w / 2 - r) * S, (cy - r) * S, (x + w / 2 + r) * S, (cy + r) * S], fill=p["accent"])
    txt(d, (x + w / 2, cy - 8), "Pointer", F(700, 13), p["sur_accent"], anchor="mt")
    txt(d, (x + w / 2, cy + 10), "l'arrivée", F(500, 9.5), p["sur_accent"], anchor="mt")
    txt(d, (x + w / 2, y + h - 26), "08:04:12 · heure serveur", F(400, 8.5), p["douce"], anchor="mt")


def deux_tons(img, x, y, w, h, dessine):
    """Dessine deux fois (clair / sombre) puis n'en garde que la moitié gauche / droite."""
    A = canevas(img.height // S)
    Bo = canevas(img.height // S)
    dessine(A, x, y, w, h, B)
    dessine(Bo, x, y, w, h, B_D)
    mid = int((x + w / 2) * S)
    img.paste(A.crop((int(x * S), int(y * S), mid, int((y + h) * S))), (int(x * S), int(y * S)))
    img.paste(Bo.crop((mid, int(y * S), int((x + w) * S), int((y + h) * S))), (mid, int(y * S)))
    d = ImageDraw.Draw(img)
    for k in range(0, int(h), 12):
        d.line([mid, (y + k) * S, mid, (y + k + 6) * S], fill="#FFFFFF", width=2 * S)


def figure7():
    H = 1310
    img = canevas(H)
    d = ImageDraw.Draw(img)
    M = 64
    encre, douce, mot = "#14100C", "#6B6259", "#8A6A3A"
    caps(d, (M, 44), "EN-CHECK  ·  PLANCHES DE DÉCISION  ·  LE THÈME", F(600, 11), mot)
    txt(d, (M, 66), "Clair, sombre ou automatique ?", F(700, 36), encre)
    txt(d, (M, 116), "« Automatique » n'est pas un troisième design : c'est une règle de bascule. La vraie décision, c'est de savoir lequel est la référence — et lequel on adapte.",
        F(400, 14), douce)

    cw = (W - 2 * M - 2 * 30) / 3
    titres = ["Clair — référence", "Sombre — adaptation", "Automatique — bascule"]

    # ligne 1 : administration
    y = 190
    txt(d, (M, y - 24), "ADMINISTRATION WEB", F(700, 11), mot)
    for i, t in enumerate(titres):
        txt(d, (M + i * (cw + 30), y - 6), t, F(600, 11.5), encre)
    ecran(img, M, y + 8, cw, 300, B)
    ecran(img, M + cw + 30, y + 8, cw, 300, B_D)
    xa = M + 2 * (cw + 30)
    deux_tons(img, xa, y + 8, cw, 300, lambda c, a, b, cc, hh, pp: ecran(c, a, b, cc, hh, pp))
    txt(d, (xa + cw / 2, y + 322), "suit le réglage de l'appareil", F(400, 10), douce, anchor="mt")

    # ligne 2 : kiosque
    y2 = y + 376
    txt(d, (M, y2 - 24), "KIOSQUE DE POINTAGE (tablette fixe)", F(700, 11), mot)
    for i, t in enumerate(titres):
        txt(d, (M + i * (cw + 30), y2 - 6), t, F(600, 11.5), encre)
    kw, kh = 200, 330
    kiosque(img, M + (cw - kw) / 2, y2 + 8, kw, kh, B)
    kiosque(img, M + cw + 30 + (cw - kw) / 2, y2 + 8, kw, kh, B_D)
    xa2 = M + 2 * (cw + 30)
    deux_tons(img, xa2 + (cw - kw) / 2, y2 + 8, kw, kh,
              lambda c, a, b, cc, hh, pp: kiosque(c, a, b, cc, hh, pp))
    txt(d, (xa2 + cw / 2, y2 + kh + 24), "à éviter ici : la lumière du lieu ne change pas", F(400, 10), douce, anchor="mt")

    # tableau de critères
    yt = y2 + kh + 62
    col0 = 430
    txt(d, (M, yt), "CE QUI DÉCIDE", F(600, 10), mot)
    for i, t in enumerate(["Clair", "Sombre", "Automatique"]):
        txt(d, (M + col0 + i * ((W - M - col0 - M) / 3), yt), t.upper(), F(600, 10), mot)
    criteres = [
        ("Plein soleil, tablette dehors", "✓  lisible", "✗  reflets et délavage", "~  dépend du capteur"),
        ("Éblouissement, équipe de nuit", "✗  douloureux", "✓  confortable", "~  bascule parfois trop tard"),
        ("Impression et export papier", "✓  natif", "✗  il faut une seconde mise en page", "✗  résultat imprévisible"),
        ("Batterie (écran OLED)", "~  consommation", "✓  économise", "~  variable"),
        ("Charge de travail et de test", "1 mise en page", "2 à maintenir", "2 à maintenir + cas imprévus"),
    ]
    yy = yt + 22
    for lib, a, b, c in criteres:
        txt(d, (M, yy + 4), lib, F(500, 11.5), "#3B342C")
        for i, v in enumerate([a, b, c]):
            coul = "#1E5B36" if v.startswith("✓") else ("#8C2020" if v.startswith("✗") else "#7A5A14")
            txt(d, (M + col0 + i * ((W - M - col0 - M) / 3), yy + 4), v, F(400, 11), coul)
        d.line([M * S, (yy + 26) * S, (W - M) * S, (yy + 26) * S], fill="#F1ECE3", width=1)
        yy += 30

    # recommandation
    yr = yy + 14
    rr(d, (M, yr, W - M, yr + 92), 12, fill="#FBF7F0", outline="#EFE6D8", width=1)
    txt(d, (M + 22, yr + 14), "Recommandation", F(700, 13), encre)
    recs = [("Administration", "clair par défaut, sombre disponible, automatique en option — jamais imposé."),
            ("Kiosque", "le thème est un réglage du site, pas de l'appareil : l'exploitant choisit une fois."),
            ("Les deux", "le clair est la référence de conception ; le sombre est testé au même niveau, pas laissé pour la fin.")]
    for k, (t, s) in enumerate(recs):
        txt(d, (M + 22, yr + 38 + k * 17), t, F(600, 11), "#8A6A3A")
        txt(d, (M + 130, yr + 38 + k * 17), s, F(400, 11), "#3B342C")

    sortie = img.resize((W, H), Image.LANCZOS)
    chemin = os.path.join(HERE, "07-theme.png")
    sortie.save(chemin, optimize=True)
    print("écrit", chemin)


# ═══════════════════════════════ le kente, dessiné d'après le SVG du dépôt
def _tuile_kente(sx, sy, U=6):
    """Reproduit la tuile 240 × 28 de KenteWovenTapestrySvg, étirée par (sx, sy)."""
    im = Image.new("RGB", (max(1, int(240 * sx * U)), max(1, int(28 * sy * U))), "#1A120C")
    d = ImageDraw.Draw(im)

    def R(x, y, w, h, c):
        d.rectangle([x * sx * U, y * sy * U, (x + w) * sx * U - 1, (y + h) * sy * U - 1], fill=c)

    def P(pts, c):
        d.polygon([(x * sx * U, y * sy * U) for x, y in pts], fill=c)

    def L(x1, y1, x2, y2, c, e=2):
        d.line([x1 * sx * U, y1 * sy * U, x2 * sx * U, y2 * sy * U], fill=c,
               width=max(1, int(e * U * min(sx, sy))))

    # bloc 1 — rayures or / terracotta
    R(0, 0, 38, 28, "#C85A28")
    R(0, 4, 38, 4, "#E8AE3E")
    R(0, 12, 38, 4, "#1E140E")
    R(0, 20, 38, 4, "#E8AE3E")
    for vx in (5, 19, 33):
        L(vx, 0, vx, 28, "#F4D078", 1.5)
    # bloc 2 — damier or / émeraude / noir
    R(38, 0, 34, 28, "#1E5E3E")
    for i, (a, b, c) in enumerate([("#E8AE3E", "#1A120C", "#E8AE3E"),
                                   ("#C85A28", "#E8AE3E", "#C85A28"),
                                   ("#E8AE3E", "#1A120C", "#E8AE3E")]):
        yy = (2, 11, 19)[i]
        hh = (7, 6, 7)[i]
        R(40, yy, 9, hh, a)
        R(51, yy, 9, hh, b)
        R(62, yy, 8, hh, c)
    # bloc 3 — losange royal sur indigo-ardoise
    R(72, 0, 44, 28, "#24384A")
    P([(94, 2), (112, 14), (94, 26), (76, 14)], "#E8AE3E")
    P([(94, 6), (105, 14), (94, 22), (83, 14)], "#C85A28")
    d.ellipse([(94 - 2.8) * sx * U, (14 - 2.8) * sy * U, (94 + 2.8) * sx * U, (14 + 2.8) * sy * U], fill="#FFF3D1")
    # bloc 4 — chevrons
    R(116, 0, 46, 28, "#8C3418")
    for k, (c, e) in enumerate([("#E8AE3E", 2.6), ("#288256", 2.6), ("#E8AE3E", 2.6), ("#F5D78E", 2.2)]):
        x0 = 120 + 10 * k
        L(x0, 3, x0 + 10, 14, c, e)
        L(x0 + 10, 14, x0, 25, c, e)
    # bloc 5 — émeraude rayée
    R(162, 0, 38, 28, "#1F6A45")
    R(162, 5, 38, 4, "#E8AE3E")
    R(162, 13, 38, 3, "#C85A28")
    R(162, 20, 38, 4, "#E8AE3E")
    for vx in (170, 181, 192):
        L(vx, 0, vx, 28, "#1A120C", 2)
    # bloc 6 — sabliers adinkra
    R(200, 0, 40, 28, "#B54B22")
    P([(206, 3), (234, 3), (220, 14), (234, 25), (206, 25), (220, 14)], "#E8AE3E")
    L(200, 0, 200, 28, "#E8AE3E", 2)
    L(239, 0, 239, 28, "#E8AE3E", 2)
    return im


def bande_kente(img, box, hauteur=28, etire=False, svg_largeur=960):
    """Colle le kente dans box. etire=True reproduit le défaut actuel du produit."""
    x0, y0, x1, y1 = box
    largeur = int((x1 - x0) * S)
    h = int((y1 - y0) * S)
    sy = (y1 - y0) / 28.0
    sx = ((x1 - x0) / svg_largeur) if etire else sy
    tuile = _tuile_kente(sx, sy, U=S)
    bande = Image.new("RGB", (largeur, h), "#1A120C")
    x = 0
    while x < largeur:
        bande.paste(tuile, (x, 0))
        x += tuile.width
    img.paste(bande, (int(x0 * S), int(y0 * S)))


def accueil(img, x, y, w, h, p, bande_h=76, mode="actuel"):
    """Petit écran d'accueil, avec la bande de kente réglée selon le mode."""
    d = ImageDraw.Draw(img)
    rr(d, (x, y, x + w, y + h), 10, fill=p["fond"], outline=p["bordure"], width=1)
    d.rectangle([x * S, y * S, (x + w) * S, (y + 30) * S], fill=p["surface"])
    txt(d, (x + 14, y + 8), "En-Check", F(800, 11), p["encre"])
    txt(d, (x + w - 14, y + 9), "Accueil · novembre 2026", F(400, 9), p["douce"], anchor="rt")
    ecart = 10
    if mode == "actuel":
        bande_kente(img, (x, y + 30, x + w, y + 30 + bande_h), hauteur=bande_h, etire=True)
        yb = y + 30 + bande_h
    elif mode == "juste":
        bande_kente(img, (x, y + 30, x + w, y + 30 + bande_h), hauteur=bande_h, etire=False)
        yb = y + 30 + bande_h
    elif mode == "lettre":
        d.rectangle([x * S, (y + 30) * S, (x + w) * S, (y + 30 + bande_h) * S], fill="#1A120C")
        bande_kente(img, (x, y + 30 + (bande_h - 28) / 2, x + w, y + 30 + (bande_h + 28) / 2), hauteur=28)
        yb = y + 30 + bande_h
    else:  # passe-partout
        rb = y + 30 + 7
        rr(d, (x + ecart, rb, x + w - ecart, rb + bande_h + 14), 6, fill=p["surface"], outline=p["bordure"], width=1)
        bande_kente(img, (x + ecart + 1, rb + 7, x + w - ecart - 1, rb + 7 + bande_h), hauteur=bande_h, etire=False)
        yb = rb + bande_h + 14 + 7
    # trois chiffres
    cw3 = (w - 2 * ecart - 2 * 8) / 3
    for i, (t, v) in enumerate([("PRÉSENTS", "38 / 42"), ("RETARDS", "4"), ("ABSENTS", "4")]):
        cx = x + ecart + i * (cw3 + 8)
        rr(d, (cx, yb, cx + cw3, yb + 56), 8, fill=p["surface"], outline=p["bordure"], width=1)
        txt(d, (cx + 10, yb + 9), t, F(600, 7), p["douce"])
        txt(d, (cx + 10, yb + 22), v, F(700, 17), p["encre"])
    return yb + 56


def figure8():
    H = 780
    img = canevas(H)
    d = ImageDraw.Draw(img)
    M = 64
    encre, douce, mot = "#14100C", "#6B6259", "#8A6A3A"
    caps(d, (M, 44), "EN-CHECK  ·  PLANCHES DE DÉCISION  ·  L'ACCUEIL ET LE KENTE", F(600, 11), mot)
    txt(d, (M, 66), "Tu gardes le kente — voici comment le poser sans le déformer", F(700, 32), encre)
    txt(d, (M, 110), "Le kente est un dessin vectoriel de 28 px de haut, affiché aujourd'hui sur une bande de 76 px : il est donc agrandi et étiré de 2,7×.",
        F(400, 14), douce)
    txt(d, (M, 130), "Les neuf motifs photographiques, eux, sont toujours réduits en gardant leurs proportions. Un seul est malmené — celui que tu veux garder.",
        F(400, 14), douce)

    cw = (W - 2 * M - 2 * 30) / 3
    y = 186
    titres = [("Aujourd'hui", "SVG étiré à 76 px", "#8C2020"),
              ("Bandeau lettrage", "motif 28 px centré sur espresso", "#7A5A14"),
              ("Bande fine", "28 px, en passe-partout", "#1E5B36")]
    hauteurs = [76, 76, 28]
    modes = ["actuel", "lettre", "pp"]
    for i, (t, s, coul) in enumerate(titres):
        x = M + i * (cw + 30)
        txt(d, (x, y - 30), t, F(700, 12), encre)
        txt(d, (x, y - 14), s, F(400, 10), coul)
        accueil(img, x, y, cw, 196, B, bande_h=hauteurs[i], mode=modes[i])

    # mesure des hauteurs natives
    yt = y + 236
    txt(d, (M, yt), "CE QUE LA BANDE DE 76 PX FAIT À CHAQUE MOTIF", F(600, 10), mot)
    lignes = [
        ("Paie · Bogolan", "1536 × 76", "× 1,00", "hauteur native — aucune déformation", "#1E5B36"),
        ("Absences · Ndebélé", "2172 × 724", "× 0,10", "réduit en gardant ses proportions", "#1E5B36"),
        ("Planning · Kuba", "1086 × 362", "× 0,21", "réduit, proportions gardées", "#1E5B36"),
        ("Employés, Pointages", "1200 × 298", "× 0,26", "réduit, proportions gardées", "#1E5B36"),
        ("Accueil · Kente (SVG)", "960 × 28", "× 2,71", "AGRANDI et étiré — le seul cas", "#8C2020"),
    ]
    yy = yt + 22
    txt(d, (M + 300, yt), "SOURCE", F(600, 9), "#8A8078")
    txt(d, (M + 430, yt), "ÉCHELLE", F(600, 9), "#8A8078")
    for lib, src, ech, com, coul in lignes:
        txt(d, (M, yy), lib, F(500, 11.5), "#3B342C")
        txt(d, (M + 300, yy), src, F(400, 11), "#6B6259")
        txt(d, (M + 430, yy), ech, F(600, 11), coul)
        txt(d, (M + 520, yy), com, F(400, 11), coul)
        d.line([M * S, (yy + 22) * S, (W - M) * S, (yy + 22) * S], fill="#F1ECE3", width=1)
        yy += 26

    yr = yy + 16
    rr(d, (M, yr, W - M, yr + 118), 12, fill="#FBF7F0", outline="#EFE6D8", width=1)
    txt(d, (M + 22, yr + 14), "La règle que j'en tire — et qui corrige ma propre planche", F(700, 13), encre)
    lignes2 = [
        ("1", "La hauteur d'une bande n'est pas un réglage libre : 76 px viennent du Bogolan, le seul dessiné à cette taille."),
        ("2", "On ne change jamais la hauteur d'un motif ; on choisit un motif pour sa hauteur. D'où la vraie règle : proportions d'origine, toujours."),
        ("3", "Le kente est dessiné pour 28 px. Soit on le laisse à 28 px (bandeau lettrage ou bande fine), soit on le redessine pour 76 px."),
    ]
    for k, (n, t) in enumerate(lignes2):
        txt(d, (M + 22, yr + 40 + k * 24), n, F(700, 11), "#8A6A3A")
        txt(d, (M + 44, yr + 40 + k * 24), t, F(400, 11), "#3B342C")

    sortie = img.resize((W, H), Image.LANCZOS)
    chemin = os.path.join(HERE, "08-kente.png")
    sortie.save(chemin, optimize=True)
    print("écrit", chemin)


def _soleil(d, cx, cy, r, coul):
    d.ellipse([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S], fill=coul)
    for k in range(8):
        import math
        a = k * math.pi / 4
        d.line([(cx + math.cos(a) * (r + 2)) * S, (cy + math.sin(a) * (r + 2)) * S,
                (cx + math.cos(a) * (r + 4.5)) * S, (cy + math.sin(a) * (r + 4.5)) * S],
               fill=coul, width=max(1, int(1.2 * S)))


def _lune(d, cx, cy, r, coul, fond):
    d.ellipse([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S], fill=coul)
    d.ellipse([(cx - r + r * 0.75) * S, (cy - r - r * 0.25) * S,
               (cx + r + r * 0.75) * S, (cy + r - r * 0.25) * S], fill=fond)


def seg3(img, x, y, w, actif, p, petit=False):
    d = ImageDraw.Draw(img)
    h = 30 if petit else 38
    rr(d, (x, y, x + w, y + h), h / 2, fill=p["surface"], outline=p["bordure"], width=1)
    labels = ["Clair", "Sombre", "Automatique"]
    seg = (w - 6) / 3
    for i, lab in enumerate(labels):
        sx = x + 3 + i * seg
        if i == actif:
            rr(d, (sx, y + 3, sx + seg, y + h - 3), (h - 6) / 2, fill=p["accent"])
            coul = p["sur_accent"]
        else:
            coul = p["douce"]
        f = F(600 if i == actif else 500, 8.5 if petit else 10.5)
        txt(d, (sx + seg / 2, y + h / 2 - (6 if petit else 8)), lab, f, coul, anchor="mt")
    return h


def figure9():
    H = 780
    img = canevas(H)
    d = ImageDraw.Draw(img)
    M = 64
    encre, douce, mot = "#14100C", "#6B6259", "#8A6A3A"
    caps(d, (M, 44), "EN-CHECK  ·  PLANCHES DE DÉCISION  ·  LE THÈME, SA MÉMOIRE", F(600, 11), mot)
    txt(d, (M, 66), "L'interrupteur et sa mémoire", F(700, 34), encre)
    txt(d, (M, 112), "Clair par défaut. Si la personne passe en sombre, ce choix est enregistré : elle le retrouve à sa prochaine visite, sur cet appareil puis sur son compte.",
        F(400, 14), douce)
    txt(d, (M, 132), "« Automatique » reste accessible — mais ce n'est jamais lui qui décide à la place de la personne.", F(400, 14), douce)

    # ── panneau 1 : où
    x1, y = M, 196
    pw = (W - 2 * M - 2 * 28) / 3
    txt(d, (x1, y - 26), "1 · OÙ SE TROUVE LE BOUTON", F(700, 10), mot)
    cases = [
        ("Menu du compte", "un appui, là où la personne regarde déjà"),
        ("Page Réglages › Apparence", "le même composant, pour l'expliquer"),
        ("Barre haute (à éviter)", "encombre chaque écran, et sera masquée sur mobile"),
    ]
    for k, (t, s) in enumerate(cases):
        cy = y + k * 78
        rr(d, (x1, cy, x1 + pw, cy + 70), 10, fill="#FBF7F0" if k else "#FFFDF9",
           outline="#EFE6D8" if k else "#E3D5BE", width=1)
        txt(d, (x1 + 14, cy + 9), t, F(600, 11), encre)
        txt(d, (x1 + 14, cy + 25), s, F(400, 9.5), douce)
        seg3(img, x1 + 14, cy + 37, min(pw - 28, 220), 1, B, petit=True)

    # ── panneau 2 : trois états
    x2 = x1 + pw + 28
    txt(d, (x2, y - 26), "2 · TROIS ÉTATS, PAS DEUX", F(700, 10), mot)
    rr(d, (x2, y, x2 + pw, y + 212), 10, fill="#FFFDF9", outline="#E3D5BE", width=1)
    txt(d, (x2 + 16, y + 12), "Premier lancement", F(600, 10), douce)
    seg3(img, x2 + 16, y + 28, pw - 32, 0, B)
    txt(d, (x2 + 16, y + 76), "La personne clique « Sombre »", F(600, 10), douce)
    seg3(img, x2 + 16, y + 92, pw - 32, 1, B_D)
    txt(d, (x2 + 16, y + 140), "Ce qu'elle retrouve demain", F(600, 10), douce)
    seg3(img, x2 + 16, y + 156, pw - 32, 1, B_D)
    txt(d, (x2 + pw - 16, y + 196), "le choix est gardé", F(500, 9), "#1E5B36", anchor="rt")

    # ── panneau 3 : la mémoire
    x3 = x2 + pw + 28
    txt(d, (x3, y - 26), "3 · LA MÉMOIRE, EN TROIS COUCHES", F(700, 10), mot)
    couches = [
        ("1", "Choix de la personne", "appareil (immédiat) + compte (à la connexion)", "#1E5B36"),
        ("2", "Réglage du site", "kiosque uniquement : l'exploitant décide une fois", "#7A5A14"),
        ("3", "Défaut du produit", "clair — jamais le réglage de l'appareil", "#6B6259"),
    ]
    for k, (n, t, s, coul) in enumerate(couches):
        cy = y + k * 70
        rr(d, (x3, cy, x3 + pw, cy + 60), 10, fill="#FFFDF9", outline="#E3D5BE", width=1)
        d.ellipse([(x3 + 12) * S, (cy + 12) * S, (x3 + 32) * S, (cy + 32) * S], fill=coul)
        txt(d, (x3 + 22, cy + 15), n, F(700, 10), "#FFFFFF", anchor="mt")
        txt(d, (x3 + 42, cy + 11), t, F(600, 11), encre)
        txt(d, (x3 + 42, cy + 28), s, F(400, 9.5), douce)
    txt(d, (x3 + 22, y + 212), "la couche 1 gagne toujours", F(500, 9), "#1E5B36")

    # ── cas limites
    yt = 448
    txt(d, (M, yt), "CE QUE LA MÉMOIRE DOIT FAIRE DANS LES CAS PAS DRÔLES", F(700, 10), mot)
    lignes = [
        ("Nouvel appareil", "le compte apporte le choix ; avant la connexion, clair"),
        ("Navigation privée", "rien n'est conservé : clair à chaque visite — assumé"),
        ("Poste partagé", "le dernier choix s'applique : à trancher avec toi"),
        ("Kiosque de pointage", "pas d'interrupteur : le réglage du site s'impose"),
        ("Cache vidé, hors ligne", "retour au clair puis resynchronisation au compte"),
    ]
    yy = yt + 22
    for t, s in lignes:
        txt(d, (M, yy), t, F(600, 11), "#3B342C")
        txt(d, (M + 250, yy), s, F(400, 11), "#6B6259")
        d.line([M * S, (yy + 22) * S, (W - M) * S, (yy + 22) * S], fill="#F1ECE3", width=1)
        yy += 26

    yr = yy + 16
    rr(d, (M, yr, W - M, yr + 106), 12, fill="#FBF7F0", outline="#EFE6D8", width=1)
    txt(d, (M + 22, yr + 14), "Ce que j'inscris au registre (D-005)", F(700, 13), encre)
    l2 = [
        ("Défaut", "clair, sur tout appareil neuf — on ne lit pas « prefers-color-scheme » sans autorisation."),
        ("Choix", "enregistré sur l'appareil tout de suite, puis sur le compte à la connexion suivante."),
        ("Anti-clignotement", "le thème est appliqué avant le premier pixel, sinon l'écran blanchit une fraction de seconde."),
    ]
    for k, (t, s) in enumerate(l2):
        txt(d, (M + 22, yr + 40 + k * 21), t, F(600, 10.5), "#8A6A3A")
        txt(d, (M + 160, yr + 40 + k * 21), s, F(400, 10.5), "#3B342C")

    sortie = img.resize((W, H), Image.LANCZOS)
    chemin = os.path.join(HERE, "09-interrupteur.png")
    sortie.save(chemin, optimize=True)
    print("écrit", chemin)


def barre_theme(img, x, y, w, p, icone, titre="Tableau de bord"):
    d = ImageDraw.Draw(img)
    h = 44
    rr(d, (x, y, x + w, y + h), 10, fill=p["surface"], outline=p["bordure"], width=1)
    txt(d, (x + 14, y + 13), "En-Check", F(800, 11), p["encre"])
    txt(d, (x + 88, y + 14), "·", F(400, 11), p["bordure"])
    txt(d, (x + 100, y + 14), titre, F(500, 10.5), p["douce"])
    # bouton
    bx, by = x + w - 92, y + 7
    rr(d, (bx, by, bx + 32, by + 30), 8, fill=p["surface2"], outline=p["bordure"], width=1)
    if icone == "soleil":
        _soleil(d, bx + 16, by + 15, 5, p["encre"])
    else:
        _lune(d, bx + 16, by + 15, 6.5, p["encre"], p["surface2"])
    # avatar
    d.ellipse([(x + w - 48) * S, (y + 9) * S, (x + w - 20) * S, (y + 37) * S], fill=p["accent"])
    txt(d, (x + w - 34, y + 17), "MA", F(700, 9), p["sur_accent"], anchor="mt")


def figure10():
    H = 700
    img = canevas(H)
    d = ImageDraw.Draw(img)
    M = 64
    encre, douce, mot = "#14100C", "#6B6259", "#8A6A3A"
    caps(d, (M, 44), "EN-CHECK  ·  PLANCHES DE DÉCISION  ·  LE BOUTON DE THÈME", F(600, 11), mot)
    txt(d, (M, 66), "Un seul bouton — mais que raconte son icône ?", F(700, 34), encre)
    txt(d, (M, 112), "Tu as tranché : pas de menu, pas de réglage à part. Un bouton, deux états, et le choix est enregistré.",
        F(400, 14), douce)
    txt(d, (M, 132), "Reste une ambiguïté que tout le monde rencontre : l'icône montre-t-elle où l'on est, ou ce qui va se passer ?",
        F(400, 14), douce)

    cw = (W - 2 * M - 30) / 2
    y = 200

    # — option A
    txt(d, (M, y - 26), "A · LE BOUTON MONTRE L'ACTION", F(700, 10), "#1E5B36")
    txt(d, (M, y - 12), "la lune dit « passe en sombre »", F(400, 10), douce)
    barre_theme(img, M, y + 4, cw, B, "lune")
    txt(d, (M + 14, y + 54), "en thème clair", F(500, 9), "#8A8078")
    barre_theme(img, M, y + 74, cw, B_D, "soleil")
    txt(d, (M + 14, y + 124), "en thème sombre", F(500, 9), "#8A8078")

    # — option B
    x2 = M + cw + 30
    txt(d, (x2, y - 26), "B · LE BOUTON MONTRE L'ÉTAT", F(700, 10), "#7A5A14")
    txt(d, (x2, y - 12), "le soleil dit « tu es en clair »", F(400, 10), douce)
    barre_theme(img, x2, y + 4, cw, B, "soleil")
    txt(d, (x2 + 14, y + 54), "en thème clair", F(500, 9), "#8A8078")
    barre_theme(img, x2, y + 74, cw, B_D, "lune")
    txt(d, (x2 + 14, y + 124), "en thème sombre", F(500, 9), "#8A8078")

    # — argument
    ya = y + 160
    rr(d, (M, ya, W - M, ya + 96), 12, fill="#FBF7F0", outline="#EFE6D8", width=1)
    txt(d, (M + 22, ya + 14), "Pourquoi je recommande A", F(700, 12.5), encre)
    arg = [("L'état est déjà visible", "l'écran entier le dit : une icône qui le répète n'apprend rien."),
           ("Une icône est un verbe", "un bouton promet une action ; « lune » = ce qui va se passer si je clique."),
           ("Cohérent avec le reste", "tous les boutons d'En-Check disent ce qu'ils font (Envoyer, Traiter, Exporter).")]
    for k, (t, s2) in enumerate(arg):
        txt(d, (M + 22, ya + 38 + k * 19), t, F(600, 10.5), "#8A6A3A")
        txt(d, (M + 210, ya + 38 + k * 19), s2, F(400, 10.5), "#3B342C")

    # — fiche technique
    yt = ya + 120
    txt(d, (M, yt), "LA FICHE DU BOUTON — CE QUE LE DÉVELOPPEUR LIT", F(700, 10), mot)
    specs = [("Taille", "32 × 32 px, rayon 8"), ("Icône", "18 px, trait 1,5"),
             ("Emplacement", "barre haute, avant l'avatar"), ("Survol", "fond `--surface2`"),
             ("Clavier", "Tab, Entrée ou Espace"), ("Focus", "anneau 2 px `--accent`")]
    for k, (t, s2) in enumerate(specs):
        cx = M + (k % 3) * ((W - 2 * M) / 3)
        cy = yt + 24 + (k // 3) * 40
        txt(d, (cx, cy), t, F(600, 10), "#3B342C")
        txt(d, (cx, cy + 14), s2, F(400, 10), "#6B6259")
    # accessibilité
    yacc = yt + 108
    rr(d, (M, yacc, W - M, yacc + 62), 10, fill="#FFFDF9", outline="#E3D5BE", width=1)
    txt(d, (M + 20, yacc + 12), "Ce que l'icône ne peut pas dire, et qui doit donc être écrit", F(600, 11), encre)
    txt(d, (M + 20, yacc + 32), 'aria-label="Passer en thème sombre"   ·   aria-pressed="true" quand le sombre est actif   ·   contraste de l\'icône 6,5:1 (minimum exigé : 3:1)',
        F(400, 10), "#6B6259")

    # — ce qui est enregistré
    ye = yacc + 80
    txt(d, (M, ye), "CE QUI EST ENREGISTRÉ — DEUX VALEURS, PAS TROIS", F(700, 10), mot)
    txt(d, (M, ye + 20), "encheck.theme = « clair » | « sombre »     —     clé absente = clair     —     « automatique » disparaît de l'interface",
        F(500, 11), "#3B342C")
    txt(d, (M, ye + 40), "Si un jour tu veux l'automatique, il ne coûtera qu'un troisième bouton : la logique du bouton ne change pas.",
        F(400, 10), "#6B6259")

    sortie = img.resize((W, H), Image.LANCZOS)
    chemin = os.path.join(HERE, "10-bouton.png")
    sortie.save(chemin, optimize=True)
    print("écrit", chemin)


def figure11():
    global FAMILLE
    H = 980
    img = canevas(H)
    d = ImageDraw.Draw(img)
    M = 64
    encre, douce, mot = "#14100C", "#6B6259", "#8A6A3A"
    caps(d, (M, 44), "EN-CHECK  ·  PLANCHES DE DÉCISION  ·  LA POLICE", F(600, 11), mot)
    txt(d, (M, 66), "La police — et pourquoi ce n'est pas un détail", F(700, 34), encre)
    txt(d, (M, 112), "Aujourd'hui le produit n'a pas de police : il emprunte celle de l'ordinateur du visiteur. Segoe UI sur Windows, Geneva sur Mac, Roboto sur Android.",
        F(400, 14), douce)
    txt(d, (M, 132), "Trois machines, trois dessins différents — et une seule de ces polices est gratuite. Toutes mes planches, elles, sont composées en Inter.",
        F(400, 14), douce)

    cw = (W - 2 * M - 2 * 26) / 3
    y = 196
    cands = [
        ("inter", "Inter", "Neutre, dessinée pour les écrans.\nC'est la police de mes planches.",
         "Une interface qui s'efface derrière les chiffres. Aucun risque, aucune signature.",
         "OFL · 23,1 Ko"),
        ("plex", "IBM Plex Sans", "Humaniste-industrielle, du caractère\nsans crier. Jumelle à chasse fixe.",
         "Conçue pour les données et les documents. Elle donne un grain au produit.",
         "OFL · 22,1 Ko"),
        ("work", "Work Sans", "Plus ronde, plus chaleureuse.\nElle adoucit l'administration.",
         "Une voix humaine pour un outil qui parle de personnes. Moins rigoureuse en colonnes.",
         "OFL · 19,4 Ko"),
    ]
    for i, (cle, nom, accroche, texte, pied) in enumerate(cands):
        x = M + i * (cw + 26)
        d.line([x * S, (y - 18) * S, (x + cw) * S, (y - 18) * S], fill="#E3D5BE", width=2)
        FAMILLE = cle
        txt(d, (x, y - 6), nom, F(700, 20), encre)
        for k, ligne in enumerate(accroche.split("\n")):
            txt(d, (x, y + 24 + k * 15), ligne, F(400, 10.5), douce)
        # paragraphe
        txt(d, (x, y + 62), texte, F(400, 11), "#3B342C")
        # tableau de données
        yy = y + 118
        txt(d, (x, yy - 14), "NOM", F(600, 8), "#8A8078")
        txt(d, (x + cw - 132, yy - 14), "ARRIVÉE", F(600, 8), "#8A8078")
        txt(d, (x + cw - 62, yy - 14), "NET", F(600, 8), "#8A8078")
        for j, (n, h, m) in enumerate([("Mariam ADJOVI", "07:58", "42 500"),
                                       ("Koffi DANSOU", "08:12", "39 000"),
                                       ("Awa SÉNOU", "06:45", "38 200")]):
            txt(d, (x, yy), n, F(500, 11), encre)
            txt(d, (x + cw - 132, yy), h, F(400, 11), douce)
            txt(d, (x + cw - 62, yy), m, F(400, 11), douce)
            d.line([x * S, (yy + 18) * S, (x + cw) * S, (yy + 18) * S], fill="#F1ECE3", width=1)
            yy += 22
        # gros chiffre
        ft = F(700, 26)
        txt(d, (x, yy + 6), "14 250 000", ft, encre)
        larg = d.textlength("14 250 000", font=ft) / S
        txt(d, (x + larg + 8, yy + 20), "FCFA", F(500, 10), douce)
        txt(d, (x, yy + 46), pied, F(400, 9), "#8A8078")
    FAMILLE = "inter"

    # ── les chiffres : la largeur des chiffres
    yc = 476
    txt(d, (M, yc), "LE DÉTAIL QUI COMPTE ICI : LA LARGEUR DES CHIFFRES", F(700, 10), mot)
    txt(d, (M, yc + 20), "Un produit de pointage et de paie est une colonne de chiffres. Toutes les polices ne dessinent pas « 1 » et « 8 » de la même largeur — et ça se mesure.",
        F(400, 12), "#3B342C")
    demi = (W - 2 * M - 26) / 2
    blocs = [("inter", "Chiffres proportionnels — Inter, Work Sans", "#8C2020"),
             ("plex", "Chiffres tabulaires — Plex Sans, Plex Mono", "#1E5B36")]
    for i, (cle, titre, coul) in enumerate(blocs):
        x = M + i * (demi + 26)
        rr(d, (x, yc + 44, x + demi, yc + 196), 10, fill="#FFFDF9", outline="#E3D5BE", width=1)
        txt(d, (x + 16, yc + 56), titre, F(600, 10.5), encre)
        FAMILLE = cle
        f16 = F(400, 16)
        xr = x + demi - 42
        for k in range(0, 96, 6):
            d.line([xr * S, (yc + 78 + k) * S, xr * S, (yc + 78 + k + 3) * S], fill=coul, width=S)
        l1 = "111 111"
        l2 = "888 888"
        w1 = d.textlength(l1, font=f16) / S
        w2 = d.textlength(l2, font=f16) / S
        txt(d, (xr - 8, yc + 82), l1, f16, "#3B342C", anchor="ra")
        txt(d, (xr - 8, yc + 110), l2, f16, "#3B342C", anchor="ra")
        txt(d, (x + 20, yc + 150), f"même nombre de caractères : {w1:.0f} px et {w2:.0f} px", F(500, 10), coul)
        txt(d, (x + 20, yc + 170), "les deux nombres ne finissent pas au même endroit" if abs(w1 - w2) > 1
            else "les deux nombres occupent exactement la même largeur", F(400, 9.5), coul)
    FAMILLE = "inter"
    txt(d, (M, yc + 204), "Nuance honnête : Inter sait aussi le faire, avec une ligne de CSS (`font-variant-numeric: tabular-nums`). Ce n'est donc pas un argument décisif — c'est un piège à éviter, et un dev l'oublie une fois sur deux.",
        F(400, 10), "#6B6259")

    # ── recommandation
    yr = yc + 226
    rr(d, (M, yr, W - M, yr + 116), 12, fill="#FBF7F0", outline="#EFE6D8", width=1)
    txt(d, (M + 22, yr + 14), "Ce que je recommande : un couple, pas une police", F(700, 13), encre)
    FAMILLE = "plex"
    txt(d, (M + 22, yr + 40), "IBM Plex Sans", F(700, 15), "#7E4A26")
    FAMILLE = "inter"
    txt(d, (M + 150, yr + 44), "pour tout le texte de l'interface — titres, libellés, paragraphes.", F(400, 11), "#3B342C")
    FAMILLE = "mono"
    txt(d, (M + 22, yr + 64), "IBM Plex Mono", F(600, 15), "#7E4A26")
    FAMILLE = "inter"
    txt(d, (M + 150, yr + 68), "pour les matricules, les heures et les montants — ce qui doit s'aligner.", F(400, 11), "#3B342C")
    txt(d, (M + 22, yr + 92), "Pourquoi pas Inter : elle est irréprochable, mais invisible. Or ton identité doit tenir dans un outil qu'on regarde huit heures par jour.",
        F(400, 10.5), "#6B6259")

    sortie = img.resize((W, H), Image.LANCZOS)
    chemin = os.path.join(HERE, "11-police.png")
    sortie.save(chemin, optimize=True)
    print("écrit", chemin)


# ─────────────────────────────────────────── l'empreinte, reprise du SVG (viewBox 100)
_CHEMIN_EMPREINTE = [
    ("M", 30.5, 44.5, None, None, None, None),
    ("C", 27, 51.5, 28, 58.5, 32.5, 62.5),
    ("C", 39.5, 67.5, 40.5, 73.5, 39.5, 81),
    ("C", 38.5, 87.5, 41.5, 92.5, 49.5, 93),
    ("C", 56.5, 93.5, 60.5, 88.5, 63, 80.5),
    ("C", 66, 71, 69.5, 63.5, 72, 56.5),
    ("C", 74, 50.5, 72.5, 45.5, 68.5, 44),
    ("C", 62.5, 46.5, 56, 49.5, 49.5, 50.5),
    ("C", 42.5, 50.5, 35.5, 48, 30.5, 44.5),
]
_ORTEILS = [(35, 31.5, 7.8, 10.8, -6), (48, 27.5, 5.8, 8.8, -2), (59.8, 29.8, 5.2, 7.8, 5),
            (69.8, 34.2, 4.7, 6.8, 11), (77.8, 40.5, 4.2, 5.8, 17)]


def empreinte(img, x, y, taille, coul, opacite=1.0):
    """Dessine l'empreinte du logo dans un carré de `taille` px, coin supérieur gauche (x, y)."""
    k = taille * S / 100.0
    coul = tuple(int(coul.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4))
    pts = []
    cx_ = cy_ = 0
    for seg in _CHEMIN_EMPREINTE:
        if seg[0] == "M":
            pts.append((x * S + seg[1] * k, y * S + seg[2] * k))
            cx_, cy_ = seg[1], seg[2]
        else:
            x1, y1, x2, y2, x3, y3 = seg[1:]
            for i in range(1, 13):
                t = i / 12.0
                a = (1 - t) ** 3
                b = 3 * (1 - t) ** 2 * t
                c = 3 * (1 - t) * t * t
                e = t ** 3
                px = a * cx_ + b * x1 + c * x2 + e * x3
                py = a * cy_ + b * y1 + c * y2 + e * y3
                pts.append((x * S + px * k, y * S + py * k))
            cx_, cy_ = x3, y3
    couche = Image.new("RGBA", img.size, (0, 0, 0, 0))
    dc = ImageDraw.Draw(couche)
    dc.polygon(pts, fill=coul + (int(255 * opacite),))
    for (ex, ey, rx, ry, _rot) in _ORTEILS:
        dc.ellipse([(x * S + (ex - rx) * k), (y * S + (ey - ry) * k),
                    (x * S + (ex + rx) * k), (y * S + (ey + ry) * k)],
                   fill=coul + (int(255 * opacite),))
    img.paste(couche, (0, 0), couche)


def pastille_logo(img, x, y, taille, interieur="#A26537", exterieur="#E5D4C0", degrade=True, empreinte_coul="#3D2B1F"):
    """Le logo actuel : disque dégradé + empreinte."""
    d = ImageDraw.Draw(img)
    interieur = tuple(int(interieur.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4))
    exterieur = tuple(int(exterieur.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4))
    etapes = 46 if degrade else 1
    for i in range(etapes, 0, -1):
        r = taille / 2 * i / etapes
        if degrade:
            t = i / etapes
            c = tuple(int(interieur[j] + (exterieur[j] - interieur[j]) * t) for j in range(3))
            c = "#%02X%02X%02X" % c
        else:
            c = interieur
        d.ellipse([(x + taille / 2 - r) * S, (y + taille / 2 - r) * S,
                   (x + taille / 2 + r) * S, (y + taille / 2 + r) * S],
                  fill=c, outline="#C4A574" if i == etapes else None,
                  width=max(1, int(0.02 * taille * S)))
    empreinte(img, x + taille * 0.04, y + taille * 0.04, taille * 0.92, empreinte_coul, 0.86)


def tick_cousu(img, x, y, taille, coul, epaisseur=None, morceaux=3):
    """Un check dessiné en point de couture."""
    d = ImageDraw.Draw(img)
    e = epaisseur or taille * 0.13
    pts = [(x + taille * 0.14, y + taille * 0.54), (x + taille * 0.40, y + taille * 0.80),
           (x + taille * 0.88, y + taille * 0.20)]
    for a, b in [(pts[0], pts[1]), (pts[1], pts[2])]:
        lg = ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5
        pas = lg / (morceaux * 2 - 1)
        for i in range(morceaux):
            t0 = (i * 2) / (morceaux * 2 - 1)
            t1 = t0 + 1.0 / (morceaux * 2 - 1)
            p0 = (a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0)
            p1 = (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1)
            d.line([p0[0] * S, p0[1] * S, p1[0] * S, p1[1] * S], fill=coul,
                   width=int(e * S), joint="curve")
            for p in (p0, p1):
                d.ellipse([(p[0] - e / 2) * S, (p[1] - e / 2) * S,
                           (p[0] + e / 2) * S, (p[1] + e / 2) * S], fill=coul)


def mot_marque(img, x, y, taille, coul, couture=False, coul_couture="#A26537"):
    """« En-Check » en Plex Sans 700 ; le trait d'union peut devenir une couture."""
    global FAMILLE
    ancienne = FAMILLE
    FAMILLE = "plex"
    d = ImageDraw.Draw(img)
    f = F(700, taille)
    if not couture:
        txt(d, (x, y), "En-Check", f, coul)
    else:
        txt(d, (x, y), "En", f, coul)
        larg = d.textlength("En", font=f) / S
        cy = y + taille * 0.52
        L = taille * 0.42
        rr(d, (x + larg + taille * 0.10, cy - taille * 0.055,
               x + larg + taille * 0.10 + L, cy + taille * 0.055),
           taille * 0.055, fill=coul_couture)
        txt(d, (x + larg + L + taille * 0.20, y), "Check", f, coul)
    FAMILLE = ancienne


def figure12():
    H = 800
    img = canevas(H)
    d = ImageDraw.Draw(img)
    M = 64
    encre, douce, mot = "#14100C", "#6B6259", "#8A6A3A"
    caps(d, (M, 44), "EN-CHECK  ·  PLANCHES DE DÉCISION  ·  LE LOGOTYPE", F(600, 11), mot)
    txt(d, (M, 66), "Le logotype — garder l'empreinte, perdre le dégradé", F(700, 32), encre)
    txt(d, (M, 110), "Tu n'as pas de logo à créer : tu en as un, utilisé dans 23 fichiers. Il tient en deux parties — un disque dégradé et une empreinte de pied.",
        F(400, 14), douce)
    txt(d, (M, 130), "La seconde raconte exactement ce que vend le produit : quelqu'un est passé, à telle heure. C'est le dégradé qui pose problème.",
        F(400, 14), douce)

    # ── 1. aujourd'hui
    y = 190
    txt(d, (M, y - 24), "1 · AUJOURD'HUI", F(700, 10), mot)
    rr(d, (M, y, M + 520, y + 150), 10, fill="#FFFDF9", outline="#E3D5BE", width=1)
    for k, t in enumerate([84, 52, 30, 16]):
        x = M + 24 + sum([84 + 26, 52 + 26, 30 + 26][:k])
        pastille_logo(img, x, y + 22, t)
        txt(d, (x + t / 2, y + 110), f"{t} px", F(500, 8.5), "#8A8078", anchor="mt")
    txt(d, (M + 400, y + 30), "utilisé dans", F(400, 9), "#8A8078")
    txt(d, (M + 400, y + 46), "23 fichiers", F(700, 16), encre)
    txt(d, (M + 400, y + 74), "cercle + dégradé", F(400, 9), "#8A8078")
    txt(d, (M + 400, y + 88), "#C4A574 → #E5D4C0", F(500, 8.5), "#8A8078")
    txt(d, (M + 400, y + 108), "empreinte", F(400, 9), "#8A8078")
    txt(d, (M + 400, y + 122), "#3D2B1F à 86 %", F(500, 8.5), "#8A8078")
    # couleurs d'animation hors palette
    xa = M + 24
    txt(d, (xa, y + 130), "animation de chargement : #F59E0B  #D97706  #4A7C59 — trois couleurs qui n'existent dans aucune palette",
        F(400, 9), "#9B2C2C")

    # ── 2. ce qui ne survit pas
    x2 = M + 546
    txt(d, (x2, y - 24), "2 · CE QUI NE SURVIT PAS", F(700, 10), mot)
    rr(d, (x2, y, W - M, y + 150), 10, fill="#FFFDF9", outline="#E3D5BE", width=1)
    cas = [("à 16 px (favicon)", "le dégradé devient une tache", "#8C2020"),
           ("en noir et blanc", "l'empreinte se noie dans le disque", "#8C2020"),
           ("sur fond sombre", "le disque clair fait un halo", "#8C2020")]
    for k, (t, s2, coul) in enumerate(cas):
        cx = x2 + 26 + k * 288
        if k == 0:
            pastille_logo(img, cx, y + 26, 16)
            txt(d, (cx + 30, y + 28), "= le favicon de l'onglet", F(400, 9), "#8A8078")
        elif k == 1:
            pastille_logo(img, cx, y + 26, 56, interieur="#6E6E6E", exterieur="#D8D8D8", empreinte_coul="#3A3A3A")
        else:
            rr(d, (cx, y + 26, cx + 78, y + 82), 8, fill="#1C1109", outline="#463020", width=1)
            pastille_logo(img, cx + 11, y + 37, 56)
        txt(d, (cx, y + 100), t, F(600, 10), encre)
        txt(d, (cx, y + 116), s2, F(400, 9), coul)

    # ── 3. trois pistes
    y3 = 380
    txt(d, (M, y3), "3 · TROIS PISTES — MÊME TAILLE D'EN-TÊTE", F(700, 10), mot)
    cw = (W - 2 * M - 2 * 26) / 3
    pistes = ["innov"]
    # A : empreinte en aplats
    xa = M
    rr(d, (xa, y3 + 20, xa + cw, y3 + 210), 10, fill="#FFFDF9", outline="#E3D5BE", width=1)
    txt(d, (xa + 18, y3 + 32), "A · L'EMPREINTE, EN APLATS", F(700, 10), "#1E5B36")
    pastille_logo(img, xa + 18, y3 + 52, 44, degrade=False, empreinte_coul="#FFFDF7")
    mot_marque(img, xa + 74, y3 + 62, 17, "#2A1708")
    txt(d, (xa + 18, y3 + 108), "Un seul aplat d'argile, l'empreinte en crème.", F(400, 10), "#3B342C")
    txt(d, (xa + 18, y3 + 124), "Tient à 16 px, en noir et blanc, sur fond sombre.", F(400, 10), "#3B342C")
    txt(d, (xa + 18, y3 + 148), "Coût : une ligne de SVG. Rien à redessiner.", F(500, 9.5), "#1E5B36")
    # B : le tick cousu
    xb = M + cw + 26
    rr(d, (xb, y3 + 20, xb + cw, y3 + 210), 10, fill="#FFFDF9", outline="#E3D5BE", width=1)
    txt(d, (xb + 18, y3 + 32), "B · LE TICK COUSU", F(700, 10), "#7A5A14")
    rr(d, (xb + 18, y3 + 52, xb + 62, y3 + 96), 10, fill="#F3E9DA", outline="#D8C6AC", width=1)
    tick_cousu(img, xb + 18, y3 + 52, 44, "#A26537")
    mot_marque(img, xb + 74, y3 + 62, 17, "#2A1708", couture=True)
    txt(d, (xb + 18, y3 + 108), "Le check devient un point de couture ;", F(400, 10), "#3B342C")
    txt(d, (xb + 18, y3 + 124), "le trait d'union, une piqûre d'argile.", F(400, 10), "#3B342C")
    txt(d, (xb + 18, y3 + 148), "Coût : remplacer 23 usages, et perdre l'empreinte.", F(500, 9.5), "#7A5A14")
    # C : monogramme
    xc = M + 2 * (cw + 26)
    rr(d, (xc, y3 + 20, xc + cw, y3 + 210), 10, fill="#FFFDF9", outline="#E3D5BE", width=1)
    txt(d, (xc + 18, y3 + 32), "C · LE MONOGRAMME EC", F(700, 10), "#6B6259")
    d.ellipse([(xc + 18) * S, (y3 + 52) * S, (xc + 62) * S, (y3 + 96) * S], fill="#A26537")
    txt(d, (xc + 40, y3 + 62), "EC", F(700, 14), "#FFFDF7", anchor="mt")
    mot_marque(img, xc + 74, y3 + 62, 17, "#2A1708")
    txt(d, (xc + 18, y3 + 108), "Bon pour l'icône d'application et l'avatar.", F(400, 10), "#3B342C")
    txt(d, (xc + 18, y3 + 124), "Mais deux lettres ne racontent rien :", F(400, 10), "#3B342C")
    txt(d, (xc + 18, y3 + 140), "ni le passage, ni l'heure.", F(400, 10), "#3B342C")
    txt(d, (xc + 18, y3 + 158), "À garder comme complément, pas comme logo.", F(500, 9.5), "#6B6259")

    # ── 4. recommandation
    yr = y3 + 232
    rr(d, (M, yr, W - M, yr + 108), 12, fill="#FBF7F0", outline="#EFE6D8", width=1)
    txt(d, (M + 22, yr + 14), "Ma recommandation : A, plus un jeu de trois versions", F(700, 13), encre)
    l2 = [("Version couleur", "disque aplat argile + empreinte crème — pour l'écran"),
          ("Version mono", "tout en encre, sur fond clair comme sombre — pour l'impression et les fiches de paie"),
          ("Version réduite", "l'empreinte seule, sans disque — favicon 16 px, icône d'application, kiosque")]
    for k, (t, s2) in enumerate(l2):
        txt(d, (M + 22, yr + 40 + k * 22), t, F(600, 10.5), "#8A6A3A")
        txt(d, (M + 170, yr + 40 + k * 22), s2, F(400, 10.5), "#3B342C")

    sortie = img.resize((W, H), Image.LANCZOS)
    chemin = os.path.join(HERE, "12-logotype.png")
    sortie.save(chemin, optimize=True)
    print("écrit", chemin)


def vignette(img, chemin, x, y, w, h, rayon=8, bord="#D8C6AC"):
    d = ImageDraw.Draw(img)
    im = Image.open(os.path.join(HERE, "..", "public", "images", chemin)).convert("RGB")
    im = ImageOps.fit(im, (int(w * S), int(h * S)), Image.LANCZOS, centering=(0.5, 0.45))
    masque = Image.new("L", im.size, 0)
    ImageDraw.Draw(masque).rounded_rectangle([0, 0, im.size[0] - 1, im.size[1] - 1], rayon * S, fill=255)
    img.paste(im, (int(x * S), int(y * S)), masque)
    d.rounded_rectangle([x * S, y * S, (x + w) * S, (y + h) * S], rayon * S, outline=bord, width=max(1, int(S)))
    return im


def figure13():
    H = 800
    img = canevas(H)
    d = ImageDraw.Draw(img)
    M = 64
    encre, douce, mot = "#14100C", "#6B6259", "#8A6A3A"
    caps(d, (M, 44), "EN-CHECK  ·  PLANCHES DE DÉCISION  ·  LES IMAGES", F(600, 11), mot)
    txt(d, (M, 66), "La photographie — et ce qui n'en est pas", F(700, 32), encre)
    txt(d, (M, 110), "Dix-sept visuels dans le produit, trois natures mélangées, aucune règle écrite. Et 1,7 Mo de photos sur 3,9 Mo d'images — pour un outil qu'on ouvre en 3G.",
        F(400, 14), douce)

    # ── 1. inventaire
    y = 176
    txt(d, (M, y - 22), "1 · CE QU'IL Y A DÉJÀ (extraits réels)", F(700, 10), mot)
    items = [("employes-loading-team.jpg", "photo d'équipe", "— générée par IA", "#9B2C2C"),
             ("admins-loading-fa.jpg", "illustration · awalé", "le meilleur visuel du produit", "#1E5B36"),
             ("retards-arrival-background.webp", "rendu · la borne", "cuivre et lait", "#1E5B36"),
             ("employes-loading-badge.jpg", "photo · au comptoir", "chaude, accordée à B · avec le slogan", "#8A6A3A")]
    vw, vh = 300, 168
    for i, (f, t, s2, coul) in enumerate(items):
        x = M + i * (vw + 26)
        vignette(img, f, x, y, vw, vh)
        txt(d, (x, y + vh + 10), t, F(600, 10.5), encre)
        txt(d, (x, y + vh + 26), s2, F(400, 9.5), coul)

    # ── 2. trois natures
    y2 = 400
    txt(d, (M, y2), "2 · TROIS NATURES — UNE SEULE PEUT ÊTRE LA RÈGLE", F(700, 10), mot)
    cw = (W - 2 * M - 2 * 26) / 3
    nature = [
        ("La photo", "3 arguments contre, 1 pour",
         ["Un visage de salarié réel exige une autorisation écrite — et un droit de retrait.",
          "Les visages générés par IA se voient : mains, dents, écran illisible.",
          "Elle vieillit vite : la tablette de 2024 date déjà."], "#9B2C2C"),
        ("L'illustration", "à retenir",
         ["Aucun consentement à gérer : personne n'est photographié.",
          "Elle tient la palette : liseré, aplats, couleurs du socle.",
          "Elle compresse bien : 1376 px de large, moins de 120 Ko en WebP."], "#1E5B36"),
        ("Le motif", "déjà décidé",
         ["Le passe-partout (D-003) le tient en haut de page.",
          "Il ne descend pas dans le contenu : il signe, il n'illustre pas.",
          "Pour un état vide, il fait un fond, pas un message."], "#8A6A3A"),
    ]
    for i, (titre, sous, points, coul) in enumerate(nature):
        x = M + i * (cw + 26)
        rr(d, (x, y2 + 20, x + cw, y2 + 196), 10, fill="#FFFDF9", outline="#E3D5BE", width=1)
        txt(d, (x + 18, y2 + 32), titre, F(700, 15), encre)
        txt(d, (x + 18, y2 + 54), sous, F(500, 9.5), coul)
        for k, p in enumerate(points):
            txt(d, (x + 18, y2 + 76 + k * 38), "—", F(600, 10), coul)
            # texte replié à la main sur deux lignes
            mots = p.split()
            lignes, courant = [], ""
            for m2 in mots:
                essai = (courant + " " + m2).strip()
                if d.textlength(essai, font=F(400, 10)) / S > cw - 46:
                    lignes.append(courant); courant = m2
                else:
                    courant = essai
            lignes.append(courant)
            for j, l in enumerate(lignes):
                txt(d, (x + 32, y2 + 76 + k * 38 + j * 13), l, F(400, 10), "#3B342C")

    # ── 3. la règle
    y3 = y2 + 224
    rr(d, (M, y3, W - M, y3 + 152), 12, fill="#FBF7F0", outline="#EFE6D8", width=1)
    txt(d, (M + 22, y3 + 14), "3 · La règle que je propose", F(700, 13), encre)
    regles = [
        ("Où", "écran de chargement et état vide — jamais dans un tableau, jamais derrière du texte"),
        ("Combien", "une seule image par écran, jamais deux"),
        ("Quelle nature", "l'illustration par défaut ; la photo seulement sur autorisation écrite du lieu et des personnes"),
        ("Interdits", "visage de salarié réel · capture d'écran illisible · texte incrusté dans l'image (le « On gère ! » du visuel d'équipe)"),
        ("Technique", "WebP, 1 376 px de large au plus, 120 Ko au plus, sinon on l'allège"),
    ]
    for k, (t, s2) in enumerate(regles):
        txt(d, (M + 22, y3 + 40 + k * 21), t, F(600, 10.5), "#8A6A3A")
        txt(d, (M + 150, y3 + 40 + k * 21), s2, F(400, 10.5), "#3B342C")

    sortie = img.resize((W, H), Image.LANCZOS)
    chemin = os.path.join(HERE, "13-images.png")
    sortie.save(chemin, optimize=True)
    print("écrit", chemin)


def _scene(w, h, recadre=False):
    im = Image.open(os.path.join(HERE, "..", "public", "images", "retards-arrival-approved.webp")).convert("RGB")
    if recadre:
        W0, H0 = im.size
        im = im.crop((int(W0 * 0.06), 0, int(W0 * 1.0), int(H0 * 0.99)))
    return ImageOps.fit(im, (int(w * S), int(h * S)), Image.LANCZOS, centering=(0.5, 0.30))


def figure14():
    H = 780
    img = canevas(H)
    d = ImageDraw.Draw(img)
    M = 64
    encre, douce, mot = "#14100C", "#6B6259", "#8A6A3A"
    caps(d, (M, 44), "EN-CHECK  ·  PLANCHES DE DÉCISION  ·  L'ILLUSTRATION", F(600, 11), mot)
    txt(d, (M, 66), "L'illustration sur le sable — une mesure avant d'en commander vingt-sept", F(700, 29), encre)
    txt(d, (M, 108), "Tu retiens une illustration par page, et la borne comme référence. J'ai trouvé mieux que la borne vide : la scène complète, déjà dans le produit —",
        F(400, 13.5), douce)
    txt(d, (M, 127), "une femme qui badine le terminal, en terre cuite et indigo. Le problème n'est pas le dessin : c'est son fond blanc, qui occupe 57 % de l'image.",
        F(400, 13.5), douce)

    y = 182
    vw = (W - 2 * M - 3 * 22) / 4
    vh = vw * 0.78
    txt(d, (M, y - 16), "QUATRE POSES DU MÊME DESSIN", F(700, 9.5), mot)

    # 1 — telle quelle sur le fond
    x = M
    rr(d, (x, y, x + vw, y + vh), 6, fill=B["fond"])
    v = _scene(vw - 26, vh - 26)
    img.paste(v, (int((x + 13) * S), int((y + 13) * S)))
    txt(d, (x, y + vh + 10), "1 · Telle quelle, sur le fond", F(600, 10.5), encre)
    txt(d, (x, y + vh + 26), "1,17:1 — l'image fait un trou clair", F(400, 9.5), "#8C2020")
    txt(d, (x, y + vh + 40), "et 57 % de blanc pèse sur la page", F(400, 9.5), "#8C2020")

    # 2 — recadrée
    x = M + (vw + 22)
    rr(d, (x, y, x + vw, y + vh), 6, fill=B["fond"])
    v = _scene(vw - 26, vh - 26, recadre=True)
    img.paste(v, (int((x + 13) * S), int((y + 13) * S)))
    txt(d, (x, y + vh + 10), "2 · Recadrée sur le sujet", F(600, 10.5), encre)
    txt(d, (x, y + vh + 26), "le blanc ne domine plus : le geste et la borne", F(400, 9.5), "#7A5A14")
    txt(d, (x, y + vh + 40), "occupent toute la largeur", F(400, 9.5), "#7A5A14")

    # 3 — recadrée + carte bordée
    x = M + 2 * (vw + 22)
    rr(d, (x, y, x + vw, y + vh), 8, fill="#FFFDF9", outline="#D8C6AC", width=2)
    v = _scene(vw - 24, vh - 24, recadre=True)
    img.paste(v, (int((x + 12) * S), int((y + 12) * S)))
    txt(d, (x, y + vh + 10), "3 · Recadrée, dans une carte", F(600, 10.5), encre)
    txt(d, (x, y + vh + 26), "la bordure sépare : le regard lit un cadre", F(400, 9.5), "#1E5B36")
    txt(d, (x, y + vh + 40), "— et la carte peut porter une légende", F(400, 9.5), "#1E5B36")

    # 4 — dans un état vide
    x = M + 3 * (vw + 22)
    rr(d, (x, y, x + vw, y + vh), 8, fill=B["fond"], outline=B["bordure"], width=1)
    d.rectangle([x * S, y * S, (x + vw) * S, (y + 22) * S], fill=B["surface"])
    txt(d, (x + 10, y + 7), "Absences", F(600, 8.5), B["encre"])
    v = _scene(vw - 46, vh * 0.50, recadre=True)
    img.paste(v, (int((x + 20) * S), int((y + 30) * S)))
    txt(d, (x + vw / 2, y + vh - 54), "Rien à signaler", F(700, 10), B["encre"], anchor="mt")
    txt(d, (x + vw / 2, y + vh - 34), "aucune absence ce mois-ci", F(400, 8.5), B["douce"], anchor="mt")
    rr(d, (x + vw / 2 - 44, y + vh - 20, x + vw / 2 + 44, y + vh - 4), 7, fill=B["accent"])
    txt(d, (x + vw / 2, y + vh - 16), "Déclarer", F(600, 7.5), B["sur_accent"], anchor="mt")
    txt(d, (x, y + vh + 10), "4 · Dans un état vide", F(600, 10.5), encre)
    txt(d, (x, y + vh + 26), "elle explique l'écran au lieu de le décorer", F(400, 9.5), "#1E5B36")
    txt(d, (x, y + vh + 40), "— et le bouton reste argile", F(400, 9.5), "#1E5B36")

    # règle
    yr = y + vh + 74
    rr(d, (M, yr, W - M, yr + 96), 12, fill="#FBF7F0", outline="#EFE6D8", width=1)
    txt(d, (M + 22, yr + 14), "La règle qui découle de ta décision", F(700, 13), encre)
    regles = [("Nature", "une illustration par page. La scène du badgeage est la référence : une personne, un geste, le terminal."),
              ("Cadre", "recadrée sur le sujet, jamais posée à nu : carte à bordure 1 px, ou carte d'état vide."),
              ("Couleur", "terre cuite et indigo — les deux existent déjà dans nos palettes (D-001, D-002). Rien à inventer.")]
    for k, (t, s2) in enumerate(regles):
        txt(d, (M + 22, yr + 40 + k * 19), t, F(600, 10), "#8A6A3A")
        txt(d, (M + 110, yr + 40 + k * 19), s2, F(400, 10), "#3B342C")

    # charge
    yc = yr + 116
    txt(d, (M, yc), "CE QUE « UNE PAR PAGE » VEUT DIRE EN TRAVAIL", F(700, 9.5), mot)
    txt(d, (M, yc + 18), "27 pages, 17 visuels existants dont 10 servent au chargement : il en manque une vingtaine. Je propose de commencer par les cinq qui servent à quelque chose —",
        F(400, 11), "#3B342C")
    txt(d, (M, yc + 35), "Accueil, Pointages, Absences, Planning, Paie. On reparlera de « mettre en avant ce genre d'image » quand ces cinq-là existeront : c'est là qu'on verra si le style tient.",
        F(400, 11), "#3B342C")

    sortie = img.resize((W, H), Image.LANCZOS)
    chemin = os.path.join(HERE, "14-illustration.png")
    sortie.save(chemin, optimize=True)
    print("écrit", chemin)


def _gris(hexa):
    h = hexa.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return int(0.299 * r + 0.587 * g + 0.114 * b)


def fiche_paie(img, x, y, w, p):
    d = ImageDraw.Draw(img)
    h = 470
    rr(d, (x, y, x + w, y + h), 10, fill=p["fond"], outline=p["bordure"], width=1)
    # la bande d'abord, le texte ensuite : jamais l'un sur l'autre (D-003)
    bande_motif(img, (x, y + 1, x + w - 1, y + 19), 18)
    yy = y + 30
    txt(d, (x + 16, yy), "Boutique A · Cotonou", F(600, 8.5), p["douce"])
    txt(d, (x + w - 16, yy), "BULLETIN DE PAIE", F(700, 8.5), p["encre"], anchor="rt")
    yy += 18
    txt(d, (x + 16, yy), "Mariam ADJOVI", F(700, 14), p["encre"])
    FAM = FAMILLE
    globals()["FAMILLE"] = "mono"
    txt(d, (x + 16, yy + 20), "EC-0417 · novembre 2026", F(400, 8.5), p["douce"])
    txt(d, (x + w - 16, yy + 2), "142 500", F(700, 17), p["encre"], anchor="rt")
    txt(d, (x + w - 16, yy + 24), "FCFA net", F(400, 8), p["douce"], anchor="rt")
    globals()["FAMILLE"] = FAM
    yy += 46
    d.line([(x + 16) * S, yy * S, (x + w - 16) * S, yy * S], fill=p["bordure"], width=1)
    txt(d, (x + 16, yy + 6), "RUBRIQUE", F(600, 7.5), p["douce"])
    txt(d, (x + w - 190, yy + 6), "BASE", F(600, 7.5), p["douce"], anchor="rt")
    txt(d, (x + w - 120, yy + 6), "TAUX", F(600, 7.5), p["douce"], anchor="rt")
    txt(d, (x + w - 16, yy + 6), "MONTANT", F(600, 7.5), p["douce"], anchor="rt")
    yy += 22
    lignes = [("Salaire de base", "151 h", "—", "120 000"),
              ("Heures supplémentaires", "4 h", "× 1,15", "3 680"),
              ("Prime de panier", "22 j", "—", "11 000"),
              ("Retenue CNSS (5,5 %)", "—", "—", "−7 920"),
              ("Impôt ITS", "—", "—", "−3 300")]
    globals()["FAMILLE"] = "mono"
    for i, (lib, base, taux, mont) in enumerate(lignes):
        txt(d, (x + 16, yy), lib, F(400, 9), p["encre"])
        txt(d, (x + w - 190, yy), base, F(400, 9), p["douce"], anchor="rt")
        txt(d, (x + w - 120, yy), taux, F(400, 9), p["douce"], anchor="rt")
        txt(d, (x + w - 16, yy), mont, F(500, 9), p["encre"], anchor="rt")
        d.line([(x + 16) * S, (yy + 15) * S, (x + w - 16) * S, (yy + 15) * S], fill=p["surface2"], width=1)
        yy += 21
    globals()["FAMILLE"] = FAM
    yy += 8
    rr(d, (x + 16, yy, x + w - 16, yy + 40), 8, fill=p["surface2"])
    txt(d, (x + 28, yy + 8), "NET À PAYER", F(600, 8), p["douce"])
    globals()["FAMILLE"] = "mono"
    txt(d, (x + w - 28, yy + 6), "123 460 FCFA", F(700, 13), p["encre"], anchor="rt")
    globals()["FAMILLE"] = FAM
    yy += 54
    txt(d, (x + 16, yy), "Les montants sont en francs CFA. Le bulletin est conservé cinq ans.", F(400, 8), p["douce"])
    yp = y + h - 38
    d.line([(x + 16) * S, yp * S, (x + w - 16) * S, yp * S], fill=p["bordure"], width=1)
    globals()["FAMILLE"] = "mono"
    txt(d, (x + 16, yp + 9), "Réf. FP-2026-11-0417", F(400, 7.5), p["douce"])
    txt(d, (x + 16, yp + 21), "Vérifiable sur en-check.app/v/FP-2026-11-0417", F(400, 7), p["douce"])
    globals()["FAMILLE"] = FAM
    qr(d, x + w - 46, yp + 7, 26, p["encre"], p["fond"])


def rapport(img, x, y, w, p):
    d = ImageDraw.Draw(img)
    h = 470
    rr(d, (x, y, x + w, y + h), 10, fill=p["fond"], outline=p["bordure"], width=1)
    bande_motif(img, (x, y + 1, x + w - 1, y + 19), 18)
    yy = y + 30
    txt(d, (x + 16, yy), "Boutique A · Cotonou", F(600, 8.5), p["douce"])
    txt(d, (x + w - 16, yy), "RAPPORT DE POINTAGE", F(700, 8.5), p["encre"], anchor="rt")
    yy += 18
    txt(d, (x + 16, yy), "Novembre 2026", F(700, 14), p["encre"])
    txt(d, (x + w - 16, yy + 4), "42 salariés", F(400, 8.5), p["douce"], anchor="rt")
    yy += 40
    txt(d, (x + 16, yy), "SALARIÉ", F(600, 7.5), p["douce"])
    txt(d, (x + w - 150, yy), "JOURS", F(600, 7.5), p["douce"], anchor="rt")
    txt(d, (x + w - 80, yy), "HEURES", F(600, 7.5), p["douce"], anchor="rt")
    txt(d, (x + w - 16, yy), "RETARDS", F(600, 7.5), p["douce"], anchor="rt")
    yy += 18
    lignes = [("Mariam ADJOVI", "22", "151,0", "0"),
              ("Koffi DANSOU", "21", "146,5", "2"),
              ("Awa SÉNOU", "20", "139,0", "3"),
              ("Sylvain HOUNKPÈ", "22", "152,5", "0"),
              ("Blandine KPADONOU", "19", "128,0", "4"),
              ("Ibrahim SOULE", "22", "150,0", "1")]
    globals()["FAMILLE"] = "mono"
    for nom, j, hv, r in lignes:
        txt(d, (x + 16, yy), nom, F(400, 9), p["encre"])
        txt(d, (x + w - 150, yy), j, F(400, 9), p["encre"], anchor="rt")
        txt(d, (x + w - 80, yy), hv, F(400, 9), p["encre"], anchor="rt")
        txt(d, (x + w - 16, yy), r, F(500, 9), p["erreur"] if r != "0" else p["encre"], anchor="rt")
        d.line([(x + 16) * S, (yy + 15) * S, (x + w - 16) * S, (yy + 15) * S], fill=p["surface2"], width=1)
        yy += 21
    globals()["FAMILLE"] = "inter"
    yy += 12
    txt(d, (x + 16, yy), "6 322 heures déclarées · 10 retards sur la période", F(500, 9), p["encre"])
    txt(d, (x + 16, yy + 16), "Le détail par journée figure en annexe, page 2.", F(400, 8), p["douce"])
    yp = y + h - 38
    d.line([(x + 16) * S, yp * S, (x + w - 16) * S, yp * S], fill=p["bordure"], width=1)
    globals()["FAMILLE"] = "mono"
    txt(d, (x + 16, yp + 9), "Exporté le 18/11/2026 à 08:04", F(400, 7.5), p["douce"])
    txt(d, (x + 16, yp + 21), "Réf. RP-2026-11-A1 · page 1 / 2", F(400, 7), p["douce"])
    globals()["FAMILLE"] = "inter"
    qr(d, x + w - 46, yp + 7, 26, p["encre"], p["fond"])


def figure15():
    H = 1000
    img = canevas(H)
    d = ImageDraw.Draw(img)
    M = 64
    encre, douce, mot = "#14100C", "#6B6259", "#8A6A3A"
    caps(d, (M, 44), "EN-CHECK  ·  PLANCHES DE DÉCISION  ·  LA PREUVE", F(600, 11), mot)
    txt(d, (M, 66), "La preuve — trois documents, une seule grammaire", F(700, 31), encre)
    txt(d, (M, 110), "Le billet de pointage, la fiche de paie, le rapport exporté. Trois sorties, un seul métier : prouver. Voici ce qui les rend reconnaissables — et vérifiables.",
        F(400, 13.5), douce)

    y = 162
    cw = (W - 2 * M - 2 * 26) / 3
    txt(d, (M, y - 16), "1 · LES TROIS SORTIES, DANS LA MÊME LANGUE", F(700, 9.5), mot)

    billet(img, M, y, cw, B, ref=None, tampon=False)
    txt(d, (M, y + 486), "Billet de pointage", F(600, 11), encre)
    txt(d, (M, y + 502), "la preuve d'une journée — remise au salarié", F(400, 9.5), douce)

    x2 = M + cw + 26
    fiche_paie(img, x2, y, cw, B)
    txt(d, (x2, y + 486), "Bulletin de paie", F(600, 11), encre)
    txt(d, (x2, y + 502), "la preuve d'un mois — gardée 5 ans", F(400, 9.5), douce)

    x3 = M + 2 * (cw + 26)
    rapport(img, x3, y, cw, B)
    txt(d, (x3, y + 486), "Rapport exporté", F(600, 11), encre)
    txt(d, (x3, y + 502), "la preuve d'une période — pour l'inspection", F(400, 9.5), douce)

    # ── 2. le test du noir et blanc
    y2 = y + 540
    txt(d, (M, y2), "2 · LE TEST QUI DÉCIDE : L'IMPRESSION EN NOIR ET BLANC", F(700, 9.5), mot)
    txt(d, (M, y2 + 18), "Un statut ne doit jamais reposer sur la couleur seule. Trois pastilles, puis les mêmes passées en niveaux de gris — le vert et l'ambre deviennent le même gris.",
        F(400, 11.5), "#3B342C")
    etats = [("En poste", B["succes"]), ("En retard", B["alerte"]), ("Sortie manquante", B["erreur"])]
    for i, (t, coul) in enumerate(etats):
        cx = M + i * 236
        rr(d, (cx, y2 + 42, cx + 220, y2 + 74), 8, fill=B["surface"], outline=B["bordure"], width=1)
        d.ellipse([(cx + 12) * S, (y2 + 53) * S, (cx + 22) * S, (y2 + 63) * S], fill=coul)
        txt(d, (cx + 30, y2 + 50), t, F(500, 10), B["encre"])
        g = _gris(coul)
        gris = "#%02X%02X%02X" % (g, g, g)
        rr(d, (cx, y2 + 82, cx + 220, y2 + 114), 8, fill="#F2F2F2", outline="#D8D8D8", width=1)
        d.ellipse([(cx + 12) * S, (y2 + 93) * S, (cx + 22) * S, (y2 + 103) * S], fill=gris)
        txt(d, (cx + 30, y2 + 90), t, F(500, 10), "#2B2B2B")
        txt(d, (cx + 200, y2 + 122), f"gris {g}", F(400, 8), "#8A8078", anchor="rt")
    g1, g2, g3 = (_gris(B["succes"]), _gris(B["alerte"]), _gris(B["erreur"]))
    txt(d, (M, y2 + 140), f"Vert {g1} · ambre {g2} · rouge {g3} : les trois gris se suivent de trop près pour être distingués sur une photocopie. La couleur informe, le mot décide.",
        F(500, 10.5), "#7E4A26")

    # ── 3. la grammaire
    yr = y2 + 166
    rr(d, (M, yr, W - M, yr + 150), 12, fill="#FBF7F0", outline="#EFE6D8", width=1)
    txt(d, (M + 22, yr + 14), "3 · La grammaire du document", F(700, 13), encre)
    regles = [
        ("Toujours clair", "un document ne suit jamais le thème de l'application : il est clair, même si l'écran est sombre"),
        ("Le motif en tête", "20 px, en passe-partout, une seule fois — il signe, il ne décore pas le corps"),
        ("Chiffres en mono", "colonnes alignées, virgules alignées, toujours la même police pour les montants"),
        ("Une référence", "chaque sortie porte un numéro unique : FP-2026-11-0417, RP-2026-11-A1"),
        ("Vérifiable", "un QR vers une page publique qui dit si le document est authentique, et depuis quand"),
        ("Noir et blanc", "la couleur ne porte jamais l'information seule : toujours un mot à côté"),
    ]
    for k, (t, s2) in enumerate(regles):
        col = k % 2
        ligne = k // 2
        cx = M + 22 + col * 740
        cy = yr + 40 + ligne * 24
        txt(d, (cx, cy), t, F(600, 10), "#8A6A3A")
        txt(d, (cx + 118, cy), s2, F(400, 10), "#3B342C")

    sortie = img.resize((W, H), Image.LANCZOS)
    chemin = os.path.join(HERE, "15-preuve-document.png")
    sortie.save(chemin, optimize=True)
    print("écrit", chemin)


def page_verif(img, x, y, w, p):
    d = ImageDraw.Draw(img)
    h = 412
    rr(d, (x, y, x + w, y + h), 22, fill=p["fond"], outline=p["bordure"], width=2)
    # barre d'adresse
    rr(d, (x + 14, y + 14, x + w - 14, y + 40), 8, fill=p["surface2"])
    txt(d, (x + 24, y + 21), "en-check.app/v/7Kd2Qf9Lm", F(500, 8), p["douce"])
    # statut
    yy = y + 56
    rr(d, (x + 14, yy, x + w - 14, yy + 62), 10, fill="#E8F1E9")
    d.ellipse([(x + 26) * S, (yy + 22) * S, (x + 44) * S, (yy + 40) * S], fill=p["succes"])
    d.line([(x + 31) * S, (yy + 31) * S, (x + 34) * S, (yy + 35) * S, (x + 39) * S, (yy + 27) * S],
           fill="#FFFFFF", width=int(1.6 * S), joint="curve")
    txt(d, (x + 54, yy + 12), "Document authentique", F(700, 13), "#1E5B36")
    txt(d, (x + 54, yy + 32), "Bulletin de paie · novembre 2026", F(400, 8.5), "#2F5B3C")
    txt(d, (x + 54, yy + 45), "non modifié depuis l'émission", F(400, 8), "#2F5B3C")
    yy += 76
    for lib, val in [("EMPLOYEUR", "Boutique A · Cotonou"), ("SALARIÉ", "Mariam ADJOVI · EC-0417")]:
        txt(d, (x + 16, yy), lib, F(600, 7), p["douce"])
        txt(d, (x + 16, yy + 12), val, F(600, 10), p["encre"])
        yy += 32
    d.line([(x + 16) * S, yy * S, (x + w - 16) * S, yy * S], fill=p["bordure"], width=1)
    yy += 8
    globals()["FAMILLE"] = "mono"
    for lib, val in [("Salaire de base", "120 000"), ("Heures supplémentaires", "3 680"),
                     ("Prime de panier", "11 000"), ("Retenue CNSS", "−7 920"), ("Impôt ITS", "−3 300")]:
        txt(d, (x + 16, yy), lib, F(400, 8.5), p["encre"])
        txt(d, (x + w - 16, yy), val, F(400, 8.5), p["encre"], anchor="rt")
        d.line([(x + 16) * S, (yy + 13) * S, (x + w - 16) * S, (yy + 13) * S], fill=p["surface2"], width=1)
        yy += 18
    globals()["FAMILLE"] = "inter"
    yy += 4
    rr(d, (x + 14, yy, x + w - 14, yy + 30), 8, fill=p["surface2"])
    txt(d, (x + 24, yy + 8), "NET À PAYER", F(600, 7.5), p["douce"])
    globals()["FAMILLE"] = "mono"
    txt(d, (x + w - 24, yy + 6), "123 460 FCFA", F(700, 11), p["encre"], anchor="rt")
    globals()["FAMILLE"] = "inter"
    yy += 44
    globals()["FAMILLE"] = "mono"
    txt(d, (x + 16, yy), "Empreinte 8f3a…c21e · émise le 18/11/2026 à 08:04", F(400, 7), p["douce"])
    globals()["FAMILLE"] = "inter"
    yy += 16
    txt(d, (x + 16, yy), "Consultée 3 fois · dernière le 18/11/2026 à 09:12", F(400, 7), p["douce"])
    yy += 16
    rr(d, (x + 14, yy, x + w - 14, yy + 26), 6, fill=p["surface"])
    txt(d, (x + 22, yy + 7), "Page publique, non indexée · lien révocable par l'employeur", F(400, 7), p["douce"])


def figure16():
    H = 730
    img = canevas(H)
    d = ImageDraw.Draw(img)
    M = 64
    encre, douce, mot = "#14100C", "#6B6259", "#8A6A3A"
    caps(d, (M, 44), "EN-CHECK  ·  PLANCHES DE DÉCISION  ·  LA PAGE DE VÉRIFICATION", F(600, 11), mot)
    txt(d, (M, 66), "Niveau complet — voici ce que voit le vérificateur", F(700, 30), encre)
    txt(d, (M, 110), "Tu as choisi le niveau complet : la page montre les montants. C'est défendable — à une condition, et elle n'est pas négociable :",
        F(400, 13.5), douce)
    txt(d, (M, 129), "le lien doit être impossible à deviner, impossible à indexer, révocable et journalisé. Sans ces quatre garde-fous, un QR devient une fuite de salaires.",
        F(400, 13.5), douce)

    y = 172
    # la page, sur téléphone
    txt(d, (M, y - 14), "CE QUE VOIT LA PERSONNE QUI SCANNE", F(700, 9.5), mot)
    page_verif(img, M, y, 330, B)
    txt(d, (M, y + 426), "Une seule question posée au départ : ce papier est-il vrai ?", F(400, 9.5), douce)
    txt(d, (M, y + 442), "La page y répond en premier, les montants viennent ensuite.", F(400, 9.5), douce)

    # les garde-fous
    x2 = M + 366
    txt(d, (x2, y - 14), "LES QUATRE GARDE-FOUS — CHACUN EST UNE LIGNE DE CODE", F(700, 9.5), mot)
    garde = [
        ("1 · Jeton imprévisible", "32 caractères tirés au hasard, pas une référence lisible. On ne peut pas passer d'un bulletin au suivant en changeant un chiffre — c'est ce qui empêche l'aspiration en masse."),
        ("2 · Non indexable", "noindex, nofollow, absent du sitemap, aucun lien depuis le site. Un moteur de recherche ne doit jamais tomber sur un bulletin de paie."),
        ("3 · Révocable", "l'employeur peut invalider un lien. La page affiche alors « document révoqué le 18/11/2026 » — et plus aucun montant."),
        ("4 · Journalisé", "chaque consultation est horodatée et visible du salarié. Il peut savoir qui a regardé sa paie, et quand. C'est ce qui rend une fuite traçable."),
    ]
    yy = y + 6
    for t, s2 in garde:
        rr(d, (x2, yy, W - M, yy + 74), 10, fill="#FFFDF9", outline="#E3D5BE", width=1)
        txt(d, (x2 + 18, yy + 12), t, F(700, 11), encre)
        mots = s2.split()
        lignes, courant = [], ""
        for m2 in mots:
            essai = (courant + " " + m2).strip()
            if d.textlength(essai, font=F(400, 10)) / S > W - M - x2 - 40:
                lignes.append(courant); courant = m2
            else:
                courant = essai
        lignes.append(courant)
        for j, l in enumerate(lignes):
            txt(d, (x2 + 18, yy + 33 + j * 13), l, F(400, 10), "#3B342C")
        yy += 82

    # le risque résiduel
    yr = y + 336
    rr(d, (x2, yr, W - M, yr + 96), 12, fill="#FBF0EE", outline="#EBD3CF", width=1)
    txt(d, (x2 + 20, yr + 12), "Le risque qui reste, et qu'aucun garde-fou ne supprime", F(700, 12), "#8C2020")
    txt(d, (x2 + 20, yr + 34), "Une personne qui a le papier peut photographier l'écran. Les garde-fous rendent la fuite traçable et révocable ; ils ne la rendent pas impossible.",
        F(400, 10), "#5A2A22")
    txt(d, (x2 + 20, yr + 52), "C'est le prix du « complet ». Tu le paies en connaissance de cause — et il faut le dire au client, pas le lui cacher.",
        F(400, 10), "#5A2A22")
    txt(d, (x2 + 20, yr + 74), "Au Bénin, c'est l'APDP qui contrôle ces traitements ; le principe est le même qu'en Europe : une donnée exposée doit pouvoir être justifiée.",
        F(400, 9), "#7A4A42")

    # une réserve de bon sens
    yc = yr + 116
    txt(d, (x2, yc), "UNE SEULE EXCEPTION DE BON SENS", F(700, 9.5), mot)
    txt(d, (x2, yc + 18), "Le rapport exporté circule plus largement que le bulletin : il part chez un inspecteur, une banque, un cabinet comptable.",
        F(400, 10.5), "#3B342C")
    txt(d, (x2, yc + 34), "Je propose de lui laisser le niveau complet aussi, mais avec une durée de vie plus courte — 3 mois au lieu de 12.",
        F(400, 10.5), "#3B342C")
    txt(d, (x2, yc + 50), "Même grammaire, exposition plus brève. Dis-moi si tu préfères aligner les deux durées.", F(500, 10.5), "#7E4A26")

    sortie = img.resize((W, H), Image.LANCZOS)
    chemin = os.path.join(HERE, "16-verification.png")
    sortie.save(chemin, optimize=True)
    print("écrit", chemin)


def figura_font(d, xy, texte, chemin, taille, coul):
    f = ImageFont.truetype(chemin, int(taille * S))
    d.text((xy[0] * S, xy[1] * S), texte, font=f, fill=coul)


def figure17():
    H = 690
    img = canevas(H)
    d = ImageDraw.Draw(img)
    M = 64
    encre, douce, mot = "#14100C", "#6B6259", "#8A6A3A"
    caps(d, (M, 44), "EN-CHECK  ·  PLANCHES DE DÉCISION  ·  LES LANGUES", F(600, 11), mot)
    txt(d, (M, 66), "Les langues — ce que le produit peut écrire aujourd'hui", F(700, 30), encre)
    txt(d, (M, 108), "Le français est la langue de l'administration et des documents légaux. Mais le kiosque de pointage, lui, est utilisé par tout le monde —",
        F(400, 13.5), douce)
    txt(d, (M, 127), "y compris par des salariés qui lisent le fon ou le yoruba avant le français. Avant d'en parler, une mesure.",
        F(400, 13.5), douce)

    # ── 1. le test des caractères
    y = 186
    txt(d, (M, y - 16), "1 · LE TEST DES CARACTÈRES", F(700, 9.5), mot)
    rr(d, (M, y, M + 720, y + 214), 10, fill="#FFFDF9", outline="#E3D5BE", width=1)
    txt(d, (M + 20, y + 12), "La police retenue (IBM Plex Sans)", F(600, 10), "#8C2020")
    figura_font(d, (M + 20, y + 28), "Kúabɔ̀   Ẹ káàbọ̀   ɔ ɛ ɖ ŋ ṣ ẹ ọ", os.path.join(HERE, "fonts", "plex-sans-400.ttf"), 20, "#2A1708")
    txt(d, (M + 20, y + 62), "sept caractères manquent : ils s'affichent en carrés vides", F(400, 9), "#8C2020")
    d.line([(M + 20) * S, (y + 82) * S, (M + 700) * S, (y + 82) * S], fill="#EFE6D8", width=1)
    txt(d, (M + 20, y + 92), "Une police qui les a (DejaVu Sans, Noto Sans)", F(600, 10), "#1E5B36")
    figura_font(d, (M + 20, y + 108), "Kúabɔ̀   Ẹ káàbọ̀   ɔ ɛ ɖ ŋ ṣ ẹ ọ",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20, "#2A1708")
    txt(d, (M + 20, y + 142), "tout est lisible — les sept lettres et les accents de ton", F(400, 9), "#1E5B36")
    txt(d, (M + 20, y + 168), "Les deux phrases ci-dessus sont des salutations (fon, yoruba) : elles devront être relues par un locuteur avant publication.",
        F(400, 8.5), "#8A8078")
    txt(d, (M + 20, y + 182), "Je ne traduis pas — je mesure. Écrire en fon sans ses lettres propres, ce n'est pas du fon : c'est du français déguisé.", F(500, 8.5), "#7E4A26")

    # ── 2. trois portées
    x2 = M + 746
    txt(d, (x2, y - 16), "2 · TROIS PORTÉES POSSIBLES", F(700, 9.5), mot)
    portees = [
        ("A · Français seul", "0 traduction", "les documents restent en français de toute façon ; mais le kiosque exclut ceux qui ne lisent pas le français", "#8C2020"),
        ("B · Français + kiosque", "3 écrans, ~40 chaînes", "arrivée, sortie, récapitulatif. L'administration et les documents restent en français", "#1E5B36"),
        ("C · Tout traduit", "27 pages + documents", "cher, et juridiquement risqué : le Code du travail est en français", "#9B2C2C"),
    ]
    for k, (t, cout, s2, coul) in enumerate(portees):
        cy = y + k * 72
        rr(d, (x2, cy, W - M, cy + 64), 10, fill="#FFFDF9" if k != 1 else "#F4FAF5",
           outline="#D8C6AC" if k == 1 else "#E3D5BE", width=2 if k == 1 else 1)
        txt(d, (x2 + 18, cy + 10), t, F(700, 11), encre)
        txt(d, (x2 + 18, cy + 27), cout, F(600, 9), coul)
        mots = s2.split()
        lignes, courant = [], ""
        for m2 in mots:
            essai = (courant + " " + m2).strip()
            if d.textlength(essai, font=F(400, 9.5)) / S > W - M - x2 - 40:
                lignes.append(courant); courant = m2
            else:
                courant = essai
        lignes.append(courant)
        for j, l in enumerate(lignes):
            txt(d, (x2 + 18, cy + 41 + j * 12), l, F(400, 9.5), "#3B342C")

    # ── 3. la règle
    yr = y + 238
    rr(d, (M, yr, W - M, yr + 174), 12, fill="#FBF7F0", outline="#EFE6D8", width=1)
    txt(d, (M + 22, yr + 14), "3 · Ce que je propose", F(700, 13), encre)
    regles = [
        ("Documents légaux", "français uniquement. Un bulletin en fon serait contestable devant un tribunal — et le Code du travail est rédigé en français."),
        ("Kiosque", "choix de langue au premier écran — Fon · Yoruba · Français — mémorisé comme le thème (D-005), et sans bouton séparé."),
        ("Traductions", "écrites et relues par des locuteurs fon et yoruba, payées. Ce n'est pas une tâche de développement : c'est un travail de langue."),
        ("Police", "une police de secours déclarée en second dans la pile CSS, pour que jamais un carré vide n'apparaisse."),
        ("Contrôle", "un test automatique qui échoue si une chaîne contient un caractère absent de la police — avant la mise en ligne, pas après."),
    ]
    for k, (t, s2) in enumerate(regles):
        txt(d, (M + 22, yr + 42 + k * 25), t, F(600, 10), "#8A6A3A")
        txt(d, (M + 160, yr + 42 + k * 25), s2, F(400, 10), "#3B342C")

    sortie = img.resize((W, H), Image.LANCZOS)
    chemin = os.path.join(HERE, "17-langues.png")
    sortie.save(chemin, optimize=True)
    print("écrit", chemin)


def _salutation(img, x, y, w, pays, langue, salut, note, coul="#2A1708", fontfile=None):
    d = ImageDraw.Draw(img)
    h = 158
    rr(d, (x, y, x + w, y + h), 10, fill=B["fond"], outline=B["bordure"], width=1)
    d.rectangle([x * S, y * S, (x + w) * S, (y + 26) * S], fill=B["surface"])
    txt(d, (x + 14, y + 8), "En-Check", F(800, 9.5), B["encre"])
    txt(d, (x + w - 14, y + 8), "Accueil", F(400, 8.5), B["douce"], anchor="rt")
    if fontfile:
        figura_font(d, (x + 16, y + 42), salut, fontfile, 21, coul)
    else:
        txt(d, (x + 16, y + 42), salut, F(700, 22), coul)
    txt(d, (x + 16, y + 74), pays, F(600, 9.5), B["douce"])
    txt(d, (x + 16, y + 88), langue, F(400, 8.5), B["douce"])
    txt(d, (x + 16, y + 108), note, F(400, 8), "#8A8078")
    # trois chiffres, pour rappeler que la page reste la même
    for k, (t, v) in enumerate([("PRÉSENTS", "38/42"), ("RETARDS", "4"), ("ABSENTS", "4")]):
        cx = x + 16 + k * ((w - 32) / 3)
        txt(d, (cx, y + 122), t, F(600, 6.5), B["douce"])
        txt(d, (cx, y + 131), v, F(700, 10), B["encre"])


def figure18():
    H = 700
    img = canevas(H)
    d = ImageDraw.Draw(img)
    M = 64
    encre, douce, mot = "#14100C", "#6B6259", "#8A6A3A"
    caps(d, (M, 44), "EN-CHECK  ·  PLANCHES DE DÉCISION  ·  LE BONJOUR", F(600, 11), mot)
    txt(d, (M, 66), "Le français partout — et un bonjour par pays", F(700, 30), encre)
    txt(d, (M, 108), "L'interface reste en français. Ce qui change avec le pays de l'entreprise, c'est une seule ligne : la salutation de l'accueil.",
        F(400, 13.5), douce)
    txt(d, (M, 127), "Ce n'est pas de la traduction, c'est de l'accueil — et c'est assez pour que la personne se sente attendue.",
        F(400, 13.5), douce)

    y = 178
    cw = (W - 2 * M - 3 * 18) / 4
    txt(d, (M, y - 14), "1 · LE MÊME ACCUEIL, QUATRE ENTREPRISES", F(700, 9.5), mot)
    _salutation(img, M, y, cw, "Bénin", "fon", "Àfɔ̀n gandia", "police de secours — voir plus bas",
                fontfile="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
    _salutation(img, M + (cw + 18), y, cw, "Congo (RC et RDC)", "lingala", "Mboté", "aucun caractère particulier")
    _salutation(img, M + 2 * (cw + 18), y, cw, "Madagascar", "malgache", "Manao ahoana", "aucun caractère particulier")
    _salutation(img, M + 3 * (cw + 18), y, cw, "Sénégal", "wolof", "Na nga def", "salutation courante — à faire relire")

    # ── 2. l'orthographe
    y2 = y + 180
    txt(d, (M, y2), "2 · LA SEULE DIFFICULTÉ TECHNIQUE : L'ORTHOGRAPHE", F(700, 9.5), mot)
    rr(d, (M, y2 + 18, W - M, y2 + 150), 10, fill="#FFFDF9", outline="#E3D5BE", width=1)
    txt(d, (M + 20, y2 + 30), "Écrit sans ses lettres propres", F(600, 10), "#8C2020")
    txt(d, (M + 20, y2 + 48), "Afon Gandia", F(700, 20), "#2A1708")
    txt(d, (M + 20, y2 + 78), "lisible partout — mais ce n'est pas l'orthographe du fon, et la prononciation se perd", F(400, 9), "#8C2020")
    d.line([(M + 20) * S, (y2 + 100) * S, (W - M - 20) * S, (y2 + 100) * S], fill="#EFE6D8", width=1)
    txt(d, (M + 20, y2 + 110), "Écrit correctement", F(600, 10), "#1E5B36")
    figura_font(d, (M + 180, y2 + 106), "Àfɔ̀n gandia", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 19, "#2A1708")
    txt(d, (M + 400, y2 + 114), "nécessite une police de secours pour le o ouvert et l'accent grave — une seule ligne à charger", F(400, 9), "#1E5B36")

    # ── 3. le mécanisme
    y3 = y2 + 172
    rr(d, (M, y3, W - M, y3 + 142), 12, fill="#FBF7F0", outline="#EFE6D8", width=1)
    txt(d, (M + 22, y3 + 14), "3 · Le mécanisme — une table, pas du code", F(700, 13), encre)
    regles = [
        ("Où", "une table « pays vers salutation », en base. Ajouter un pays ne doit jamais demander de redéployer l'application."),
        ("Quand", "la salutation suit le pays choisi par l'entreprise à l'inscription — jamais la langue du navigateur."),
        ("Défaut", "« Bonjour » si le pays n'a pas encore d'entrée. Jamais de case vide, jamais de carré."),
        ("Qui valide", "un locuteur du pays, comme les traductions (D-010). Une salutation fausse est pire que « Bonjour »."),
        ("Portée", "l'accueil seulement — et le premier écran du kiosque si tu veux aller jusque-là. Rien d'autre."),
    ]
    for k, (t, s2) in enumerate(regles):
        txt(d, (M + 22, y3 + 42 + k * 20), t, F(600, 9.5), "#8A6A3A")
        txt(d, (M + 130, y3 + 42 + k * 20), s2, F(400, 9.5), "#3B342C")

    sortie = img.resize((W, H), Image.LANCZOS)
    chemin = os.path.join(HERE, "18-bonjour.png")
    sortie.save(chemin, optimize=True)
    print("écrit", chemin)


def bouton(img, x, y, w, h, texte, p, genre="primaire", etat="repos"):
    d = ImageDraw.Draw(img)
    if etat == "focus":
        etat = "repos"
        focus = True
    else:
        focus = False
    if genre == "primaire":
        fond = {"repos": p["accent"], "survol": "#8A5024", "actif": "#7A4520", "desactive": p["surface2"]}[etat]
        coul = p["sur_accent"] if etat != "desactive" else "#8A7561"
        bord = None
    elif genre == "secondaire":
        fond = p["surface"] if etat != "desactive" else p["surface2"]
        coul = p["encre"] if etat != "desactive" else "#8A7561"
        bord = p["bordure"]
    else:
        fond = {"repos": "#9C4A26", "survol": "#853B1D", "actif": "#6F3117", "desactive": p["surface2"]}[etat]
        coul = p["sur_accent"] if etat != "desactive" else "#8A7561"
        bord = None
    if focus:
        rr(d, (x - 4, y - 4, x + w + 4, y + h + 4), (h / 2 + 4), outline="#7E4A26", width=2)
    rr(d, (x, y, x + w, y + h), h / 2 if h <= 34 else 8, fill=fond, outline=bord, width=1 if bord else 0)
    txt(d, (x + w / 2, y + h / 2 - h * 0.22), texte, F(600, h * 0.34), coul, anchor="mt")


def figure19():
    H = 800
    img = canevas(H)
    d = ImageDraw.Draw(img)
    M = 64
    encre, douce, mot = "#14100C", "#6B6259", "#8A6A3A"
    caps(d, (M, 44), "EN-CHECK  ·  PLANCHES DE DÉCISION  ·  LE PÉRIMÈTRE", F(600, 11), mot)
    txt(d, (M, 66), "L'identité s'arrête-t-elle avant les boutons ?", F(700, 30), encre)
    txt(d, (M, 108), "Non — mais elle ne va pas jusqu'au bout non plus. Il y a trois couches, et les confondre est la façon la plus sûre de fabriquer un produit",
        F(400, 13.5), douce)
    txt(d, (M, 127), "qui change de visage tous les deux ans. Voici où s'arrête chaque couche.", F(400, 13.5), douce)

    y = 176
    cw = (W - 2 * M - 2 * 26) / 3
    couches = [
        ("1 · L'IDENTITÉ", "ce qu'on vient de décider", "dix-huit planches",
         [("Couleurs", "sable & argile + indigo et vert secondaires"),
          ("Motifs", "un par page, en passe-partout"),
          ("Typographie", "Plex Sans + Plex Mono"),
          ("Image", "une illustration par page"),
          ("Preuve", "trois documents, une grammaire"),
          ("Voix", "français + un bonjour par pays")], "#1E5B36"),
        ("2 · LE SYSTÈME D'INTERFACE", "ce qui en découle", "la prochaine étape",
         [("Boutons", "argile, 3 tailles, 4 états"),
          ("Champs", "bordure 1 px, focus anneau 2 px"),
          ("Tableaux", "chiffres en mono, colonnes alignées"),
          ("Badges", "couleur + mot, jamais la couleur seule"),
          ("Modales", "surface, rayon 12, ombre douce"),
          ("États vides", "une illustration + un bouton")], "#7A5A14"),
        ("3 · LES TENDANCES", "ce qui passe de mode", "à consommer peu",
         [("Bento UI", "une grille de cartes inégales"),
          ("Glassmorphism", "flou et transparence"),
          ("Néomorphisme", "ombres internes"),
          ("Dégradés animés", "le retour du décor"),
          ("Mode « brutaliste »", "bords nets, gros traits"),
          ("Icônes 3D", "rendus brillants")], "#6B6259"),
    ]
    for i, (titre, sous, past, items, coul) in enumerate(couches):
        x = M + i * (cw + 26)
        rr(d, (x, y, x + cw, y + 336), 10, fill="#FFFDF9", outline="#E3D5BE", width=1)
        txt(d, (x + 18, y + 14), titre, F(700, 11.5), encre)
        txt(d, (x + 18, y + 33), sous, F(400, 9.5), douce)
        pastille(d, x + cw - 18 - largeur(d, past, F(600, 8)) - 16, y + 12, past, coul, "#FFFFFF", 8, (8, 4), 20)
        for k, (t, s2) in enumerate(items):
            txt(d, (x + 18, y + 62 + k * 38), t, F(600, 10), encre)
            txt(d, (x + 18, y + 76 + k * 38), s2, F(400, 9.5), "#3B342C")

    # ── le bouton, dérivé
    y2 = y + 358
    txt(d, (M, y2), "LE BOUTON, PAR EXEMPLE — IL DÉCOULE DÉJÀ DE TOUT CE QUI EST DÉCIDÉ", F(700, 9.5), mot)
    rr(d, (M, y2 + 16, M + 740, y2 + 200), 10, fill="#FFFDF9", outline="#E3D5BE", width=1)
    etats = ["repos", "survol", "actif", "desactive", "focus"]
    for k, e in enumerate(etats):
        bx = M + 24 + k * 140
        bouton(img, bx, y2 + 44, 120, 40, "Envoyer", B, "primaire", e)
        txt(d, (bx, y2 + 94), e, F(500, 8.5), "#8A8078")
    for k, (g, t) in enumerate([("secondaire", "Secondaire"), ("danger", "Supprimer"), ("secondaire", "Désactivé")]):
        bx = M + 24 + k * 140
        bouton(img, bx, y2 + 118, 120, 40, t, B, g, "disabled" if t == "Désactivé" else "repos")
    txt(d, (M + 24, y2 + 172), "Contrastes mesurés : texte sur argile 4,64:1 · survol 6,35:1 · suppression 6,03:1 · désactivé 3,24:1 (assumé : un bouton inactif doit se voir inactif)",
        F(400, 9), "#6B6259")

    # ── bento : où ça marche
    x2 = M + 764
    txt(d, (x2, y2), "ET BENTO ?", F(700, 9.5), mot)
    rr(d, (x2, y2 + 16, W - M, y2 + 200), 10, fill="#FFFDF9", outline="#E3D5BE", width=1)
    # bento : accueil
    bx = x2 + 18
    txt(d, (bx, y2 + 28), "Sur l'accueil — oui", F(600, 10), "#1E5B36")
    blocs = [(0, 0, 96, 56), (102, 0, 60, 26), (168, 0, 60, 26), (102, 30, 126, 26)]
    for (dx, dy, w, hh) in blocs:
        rr(d, (bx + dx, y2 + 44 + dy, bx + dx + w, y2 + 44 + dy + hh), 6, fill=B["surface2"], outline=B["bordure"], width=1)
    txt(d, (bx, y2 + 112), "des cartes de tailles inégales : le regard", F(400, 8.5), "#3B342C")
    txt(d, (bx, y2 + 124), "hiérarchise tout seul", F(400, 8.5), "#3B342C")
    # table
    tx = x2 + 232
    txt(d, (tx, y2 + 28), "Sur la paie — non", F(600, 10), "#8C2020")
    for ligne in range(4):
        for col in range(4):
            rr(d, (tx + col * 26, y2 + 46 + ligne * 14, tx + col * 26 + 22, y2 + 46 + ligne * 14 + 11), 2,
               fill=B["surface2"] if ligne else B["bordure"])
    txt(d, (tx, y2 + 112), "42 lignes et 6 colonnes ne se découpent", F(400, 8.5), "#3B342C")
    txt(d, (tx, y2 + 124), "pas en cartes : le tableau reste un tableau", F(400, 8.5), "#3B342C")
    txt(d, (x2 + 18, y2 + 148), "Bento est une grille, pas une identité : il devient une signature le jour où il est le même sur toutes les pages d'accueil.",
        F(400, 9), "#7E4A26")
    txt(d, (x2 + 18, y2 + 164), "Et il ne descend jamais dans les tableaux — c'est là qu'il casse la lecture.", F(500, 9), "#7E4A26")

    sortie = img.resize((W, H), Image.LANCZOS)
    chemin = os.path.join(HERE, "19-perimetre.png")
    sortie.save(chemin, optimize=True)
    print("écrit", chemin)


def _cadre(d, x, y, w, h, rayon=10, fond="#FFFDF9", bord="#E3D5BE", largeur=1):
    rr(d, (x, y, x + w, y + h), rayon, fill=fond, outline=bord, width=largeur)


def ecran_bento(img, x, y, w, h):
    d = ImageDraw.Draw(img)
    _cadre(d, x, y, w, h, 8, B["fond"], B["bordure"])
    d.rectangle([x * S, y * S, (x + w) * S, (y + 22) * S], fill=B["surface"])
    txt(d, (x + 12, y + 7), "Mboté — Accueil", F(700, 9), B["encre"])
    p = 10
    gw = w - 2 * p
    blocs = [(0, 0, gw * 0.58, 58, "38/42", "présents"), (gw * 0.60, 0, gw * 0.40, 58, "4", "retards"),
             (0, 66, gw * 0.32, 44, "12", "absences"), (gw * 0.34, 66, gw * 0.32, 44, "3", "départs"),
             (gw * 0.68, 66, gw * 0.32, 44, "96 %", "assiduité"),
             (0, 118, gw * 0.66, 52, "Paie", "novembre · à valider"), (gw * 0.68, 118, gw * 0.32, 52, "Valider", "la paie")]
    for (dx, dy, bw, bh, v, lab) in blocs:
        mx, my = x + p + dx, y + 30 + dy
        _cadre(d, mx, my, bw, bh, 6, B["surface"], B["bordure"])
        txt(d, (mx + 8, my + 8), v, F(700, 13), B["encre"])
        txt(d, (mx + 8, my + bh - 14), lab, F(400, 7), B["douce"])


def ecran_apple(img, x, y, w, h):
    d = ImageDraw.Draw(img)
    _cadre(d, x, y, w, h, 12, "#FDFBF7", "#EDE6DA")
    txt(d, (x + 26, y + 20), "Mboté", F(400, 10), B["douce"])
    txt(d, (x + 26, y + 44), "38", F(700, 54), "#1A1410")
    txt(d, (x + 26, y + 106), "sur 42 présents", F(400, 11), B["douce"])
    txt(d, (x + 26, y + 136), "4 retards à traiter", F(500, 11), "#7E4A26")
    rr(d, (x + 26, y + h - 48, x + 146, y + h - 16), 8, fill=B["accent"])
    txt(d, (x + 86, y + h - 40), "Traiter", F(600, 10), B["sur_accent"], anchor="mt")


def ecran_awwwards(img, x, y, w, h):
    ww, hh = int(w * S), int(h * S)
    loc = Image.new("RGB", (ww, hh), "#12100E")
    d = ImageDraw.Draw(loc)
    cx, cy = ww / 2, hh * 0.42
    for k in range(34, 0, -1):
        r = k * 3.4 * S
        f = (34 - k) / 34
        coul = (int(18 + 46 * f), int(14 + 30 * f), int(11 + 16 * f))
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=coul)
    # un objet en perspective : la borne
    u = S
    d.polygon([(cx - 26 * u, cy - 52 * u), (cx + 6 * u, cy - 62 * u),
               (cx + 26 * u, cy - 44 * u), (cx - 6 * u, cy - 34 * u)], fill="#EBD3AD")
    d.polygon([(cx - 6 * u, cy - 34 * u), (cx + 26 * u, cy - 44 * u),
               (cx + 20 * u, cy + 50 * u), (cx - 12 * u, cy + 58 * u)], fill="#C08A49")
    d.polygon([(cx - 26 * u, cy - 52 * u), (cx - 6 * u, cy - 34 * u),
               (cx - 12 * u, cy + 58 * u), (cx - 34 * u, cy + 46 * u)], fill="#8C5A2A")
    # écran incrusté sur la face avant
    d.polygon([(cx + 2 * u, cy - 22 * u), (cx + 19 * u, cy - 28 * u),
               (cx + 15 * u, cy + 20 * u), (cx - 2 * u, cy + 26 * u)], fill="#F6E9D3")
    for k in range(8):
        d.line([(cx - 44 * u + k * 12 * u, (0.86 * hh)), (cx - 28 * u + k * 12 * u, 0.86 * hh)],
               fill="#3A2E22", width=u)
    d.text((16 * u, 14 * u), "Mboté", font=F(400, 10), fill="#C9B49A", anchor="lt")
    bb = 92 * u
    d.rounded_rectangle([cx - bb / 2, hh - 34 * u, cx + bb / 2, hh - 14 * u], radius=10 * u,
                        outline="#C08A49", width=u)
    d.text((cx, hh - 31 * u), "Entrer", font=F(500, 9), fill="#E8CFA8", anchor="mt")
    masque = Image.new("L", (ww, hh), 0)
    ImageDraw.Draw(masque).rounded_rectangle([0, 0, ww - 1, hh - 1], radius=12 * u, fill=255)
    img.paste(loc, (int(x * S), int(y * S)), masque)


def figure20():
    H = 900
    img = canevas(H)
    d = ImageDraw.Draw(img)
    M = 64
    encre, douce, mot = "#14100C", "#6B6259", "#8A6A3A"
    caps(d, (M, 44), "EN-CHECK  ·  PLANCHES DE DÉCISION  ·  LES TENDANCES", F(600, 11), mot)
    txt(d, (M, 66), "Bento, Apple, Awwwards 3D — trois choses différentes", F(700, 29), encre)
    txt(d, (M, 106), "Tu aimes ces trois façons de construire, et c'est légitime. Mais ce ne sont pas trois styles équivalents : c'est une grille, une discipline,",
        F(400, 13.5), douce)
    txt(d, (M, 125), "et un spectacle. Le même écran, les mêmes chiffres, trois traitements — puis ce que je prends de chacun.", F(400, 13.5), douce)

    y = 172
    cw = (W - 2 * M - 2 * 26) / 3
    txt(d, (M, y - 14), "LE MÊME ACCUEIL, TROIS FAÇONS", F(700, 9.5), mot)
    ecran_bento(img, M, y, cw, 210)
    ecran_apple(img, M + cw + 26, y, cw, 210)
    ecran_awwwards(img, M + 2 * (cw + 26), y, cw, 210)

    titres = [("BENTO — une grille", "7 blocs, tailles inégales", "#7A5A14"),
              ("APPLE — une discipline", "1 chiffre, 1 action, du vide", "#1E5B36"),
              ("AWWWARDS 3D — un spectacle", "1 objet, 1 halo, 0 donnée", "#8C2020")]
    for i, (t, s2, coul) in enumerate(titres):
        x = M + i * (cw + 26)
        txt(d, (x, y + 224), t, F(700, 11), encre)
        txt(d, (x, y + 240), s2, F(400, 9.5), coul)

    # ── verdicts
    y2 = y + 274
    txt(d, (M, y2), "CE QUE CHACUN APPORTE, ET CE QU'IL COÛTE", F(700, 9.5), mot)
    verdicts = [
        ("Apporte", "la hiérarchie sans effort : le regard classe les blocs tout seul", "une seule idée par écran : impossible de se tromper d'action", "l'envie d'entrer, la première fois"),
        ("Coûte", "7 blocs = 7 choses à regarder ; ça casse dans un tableau de 42 lignes", "du vide, donc du défilement — et beaucoup de discipline à tenir", "des mégaoctets, une batterie vidée, et rien de vérifiable"),
        ("Où ça vit", "les accueils et les tableaux de bord", "toute l'administration, tous les jours", "le site public, le premier lancement, jamais la paie"),
        ("Ce que j'en prends", "la grille — D-012", "la discipline de l'espace et de la hiérarchie", "un seul écran, celui qu'on montre au prospect"),
    ]
    for k, (etiquette, *cols) in enumerate(verdicts):
        cy = y2 + 22 + k * 46
        txt(d, (M, cy + 6), etiquette.upper(), F(600, 8), "#8A8078")
        for i, c in enumerate(cols):
            x = M + i * (cw + 26)
            mots = c.split()
            lignes, courant = [], ""
            for m2 in mots:
                essai = (courant + " " + m2).strip()
                if d.textlength(essai, font=F(400, 9.5)) / S > cw - 8:
                    lignes.append(courant); courant = m2
                else:
                    courant = essai
            lignes.append(courant)
            for j, l in enumerate(lignes):
                txt(d, (x, cy + j * 12), l, F(400, 9.5), "#3B342C")

    # ── le test qui arbitre
    yr = y2 + 214
    rr(d, (M, yr, W - M, yr + 118), 12, fill="#FBF7F0", outline="#EFE6D8", width=1)
    txt(d, (M + 22, yr + 14), "Le test qui arbitre, et il est impitoyable", F(700, 13), encre)
    txt(d, (M + 22, yr + 38), "Est-ce que ça aide quelqu'un de fatigué, à 18 h, à clôturer une paie sans se tromper ?",
        F(500, 12), "#7E4A26")
    l2 = [
        ("Apple gagne", "parce que son apport est invisible : de l'espace, une hiérarchie, une action. Rien à charger, rien à admirer."),
        ("Bento gagne aussi", "mais seulement sur l'accueil : ailleurs, la grille découpe ce qui doit rester en colonnes."),
        ("Awwwards perd", "dans l'administration — et gagne sur le site public, où le but est de donner envie, pas de faire travailler."),
    ]
    for k, (t, s2) in enumerate(l2):
        txt(d, (M + 22, yr + 60 + k * 17), t, F(600, 10), "#8A6A3A")
        txt(d, (M + 150, yr + 60 + k * 17), s2, F(400, 10), "#3B342C")

    sortie = img.resize((W, H), Image.LANCZOS)
    chemin = os.path.join(HERE, "20-tendances.png")
    sortie.save(chemin, optimize=True)
    print("écrit", chemin)


def figure20():
    H = 880
    img = canevas(H)
    d = ImageDraw.Draw(img)
    M = 64
    encre, douce, mot = "#14100C", "#6B6259", "#8A6A3A"
    caps(d, (M, 40), "EN-CHECK  ·  PLANCHES DE DÉCISION  ·  LES TENDANCES", F(600, 11), mot)
    txt(d, (M, 62), "Bento, Apple, Awwwards 3D — trois choses différentes", F(700, 29), encre)
    txt(d, (M, 102), "Tu aimes ces trois façons de construire, et c'est légitime. Mais ce ne sont pas trois styles équivalents : c'est une grille, une discipline,",
        F(400, 13.5), douce)
    txt(d, (M, 121), "et un spectacle. Le même écran, les mêmes chiffres, trois traitements — puis ce que je prends de chacun.", F(400, 13.5), douce)

    # ── les trois écrans
    y = 162
    cw = (W - 2 * M - 2 * 26) / 3
    txt(d, (M, y - 14), "LE MÊME ACCUEIL, TROIS FAÇONS", F(700, 9.5), mot)
    ecran_bento(img, M, y, cw, 200)
    ecran_apple(img, M + cw + 26, y, cw, 200)
    ecran_awwwards(img, M + 2 * (cw + 26), y, cw, 200)

    titres = [("BENTO — une grille", "7 blocs, tailles inégales", "#7A5A14"),
              ("APPLE — une discipline", "1 chiffre, 1 action, du vide", "#1E5B36"),
              ("AWWWARDS 3D — un spectacle", "1 objet, 1 halo, 0 donnée", "#8C2020")]
    for i, (t, s2, coul) in enumerate(titres):
        x = M + i * (cw + 26)
        txt(d, (x, y + 212), t, F(700, 11), encre)
        txt(d, (x, y + 228), s2, F(400, 10), coul)

    # ── le tableau des verdicts
    y2 = y + 266
    txt(d, (M, y2 - 18), "CE QUE CHACUN APPORTE, ET CE QU'IL COÛTE", F(700, 9.5), mot)
    x0 = M + 128
    c3 = (W - 12 - x0 - 2 * 18) / 3
    verdicts = [
        ("Apporte", "la hiérarchie sans effort : le regard classe les blocs tout seul",
         "une seule idée par écran : impossible de se tromper d'action",
         "l'envie d'entrer, la première fois"),
        ("Coûte", "7 blocs = 7 choses à regarder ; ça casse dans un tableau de 42 lignes",
         "du vide, donc du défilement — et beaucoup de discipline à tenir",
         "des mégaoctets, une batterie vidée, et rien de vérifiable"),
        ("Où ça vit", "les accueils et les tableaux de bord",
         "toute l'administration, tous les jours",
         "le site public, le premier lancement, jamais la paie"),
        ("Ce que j'en prends", "la grille — la décision D-012",
         "l'espace et la hiérarchie, posés par défaut",
         "un seul écran : celui qu'on montre au prospect"),
    ]
    for k, (etiquette, *cols) in enumerate(verdicts):
        cy = y2 + k * 48
        if k:
            d.line([M * S, (cy - 8) * S, (W - M) * S, (cy - 8) * S], fill="#E7DECF", width=1)
        txt(d, (M, cy + 10), etiquette.upper(), F(600, 8), "#8A8078")
        for i, c in enumerate(cols):
            x = x0 + i * (c3 + 18)
            lignes, courant = [], ""
            for m2 in c.split():
                essai = (courant + " " + m2).strip()
                if d.textlength(essai, font=F(400, 9.5)) / S > c3 - 6:
                    lignes.append(courant); courant = m2
                else:
                    courant = essai
            lignes.append(courant)
            for j, l in enumerate(lignes):
                txt(d, (x, cy + j * 12), l, F(400, 9.5), "#3B342C")

    # ── le test qui arbitre
    yr = y2 + 196
    rr(d, (M, yr, W - M, yr + 104), 12, fill="#FBF7F0", outline="#EFE6D8", width=1)
    txt(d, (M + 22, yr + 13), "Le test qui arbitre, et il est impitoyable", F(700, 13), encre)
    txt(d, (M + 22, yr + 34), "Est-ce que ça aide quelqu'un de fatigué, à 18 h, à clôturer une paie sans se tromper ?",
        F(500, 12), "#7E4A26")
    l2 = [("Apple gagne", "parce que son apport est invisible : de l'espace, une hiérarchie, une action. Rien à charger, rien à admirer."),
          ("Bento gagne aussi", "mais seulement sur l'accueil : ailleurs, la grille découpe ce qui doit rester en colonnes."),
          ("Awwwards perd", "dans l'administration — et gagne sur le site public, où le but est de donner envie, pas de faire travailler.")]
    for k, (t, s2) in enumerate(l2):
        txt(d, (M + 22, yr + 56 + k * 15), t, F(600, 10), "#8A6A3A")
        txt(d, (M + 148, yr + 56 + k * 15), s2, F(400, 10), "#3B342C")

    # ── les trois propositions
    yp = yr + 118
    txt(d, (M, yp), "TROIS PROPOSITIONS — ELLES ATTENDENT TA DÉCISION", F(700, 9.5), mot)
    props = [("D-013", "Apple par défaut", "l'espace et la hiérarchie s'appliquent à toute l'administration"),
             ("D-014", "Bento sur l'accueil", "la grille reste à l'accueil, jamais dans un tableau"),
             ("D-015", "3D sur le site public", "un seul écran spectacle, celui du prospect")]
    bw = (W - 2 * M - 2 * 16) / 3
    for i, (num, t, s2) in enumerate(props):
        x = M + i * (bw + 16)
        rr(d, (x, yp + 14, x + bw, yp + 74), 8, fill="#FFFFFF", outline="#E3D5BE", width=1)
        d.rectangle([x * S, (yp + 14) * S, (x + 4) * S, (yp + 74) * S], fill="#8A6A3A")
        txt(d, (x + 16, yp + 22), num, F(700, 9), "#A08554")
        txt(d, (x + 16, yp + 37), t, F(600, 12), encre)
        txt(d, (x + 16, yp + 55), s2, F(400, 9), douce)

    sortie = img.resize((W, H), Image.LANCZOS)
    chemin = os.path.join(HERE, "20-tendances.png")
    sortie.save(chemin, optimize=True)
    print("écrit", chemin)


def figure21():
    H = 800
    img = canevas(H)
    d = ImageDraw.Draw(img)
    M = 64
    encre, douce, mot = "#14100C", "#6B6259", "#8A6A3A"
    caps(d, (M, 40), "EN-CHECK  ·  PLANCHES DE DÉCISION  ·  APPLE PAR DÉFAUT", F(600, 11), mot)
    txt(d, (M, 62), "D-013 validée — ce que ça change, chiffres en main", F(700, 29), encre)
    txt(d, (M, 102), "Avant de changer une ligne de code : voilà ce que contient le dépôt aujourd'hui. Relevé sur les 49 fichiers CSS de `src/`, commande reproductible,",
        F(400, 13.5), douce)
    txt(d, (M, 121), "et les mêmes chiffres pourront t'être remontrés après. C'est la seule façon de prouver qu'une règle d'interface a servi à quelque chose.",
        F(400, 13.5), douce)

    y = 162
    compteurs = [("53", "tailles de texte", "de 6,5 px à 36 px", "1 795 déclarations"),
                 ("41", "marges intérieures", "de 1 px à 84 px", "1 299 déclarations"),
                 ("27", "rayons d'angle", "de 1 px à 999 px", "1 039 déclarations")]
    bw = (W - 2 * M - 2 * 16) / 3
    for i, (gros, lab, sous, note) in enumerate(compteurs):
        x = M + i * (bw + 16)
        rr(d, (x, y, x + bw, y + 96), 10, fill="#FFFFFF", outline="#E3D5BE", width=1)
        txt(d, (x + 18, y + 14), gros, F(700, 34), "#7E4A26")
        txt(d, (x + 92, y + 24), lab, F(600, 12), encre)
        txt(d, (x + 92, y + 42), sous, F(400, 10), douce)
        txt(d, (x + 92, y + 58), note, F(400, 9), "#9A9088")

    y2 = y + 112
    txt(d, (M, y2), "CE QUE CES CHIFFRES VEULENT DIRE", F(700, 9.5), mot)
    txt(d, (M, y2 + 20), "121 valeurs distinctes au total. 106 sortent de l'échelle 4 · 8 · 12 · 16 · 24 · 32 · 48 — soit 88 %.",
        F(500, 12.5), encre)
    bx, by, bw2, bh = M, y2 + 42, W - 2 * M - 60, 13
    rr(d, (bx, by, bx + bw2, by + bh), 6, fill="#EFE6D8")
    rr(d, (bx, by, bx + bw2 * 0.88, by + bh), 6, fill="#A26537")
    txt(d, (bx + bw2 + 10, by - 3), "88 %", F(700, 11), "#7E4A26")
    txt(d, (bx, by + 18), "C'est ça, l'impression de « presque bien » : rien n'est faux, mais rien ne s'aligne. L'assistante ne le formule pas, elle dit que « ça fait chargé ».",
        F(400, 10.5), douce)

    y3 = y2 + 96
    txt(d, (M, y3), "CE QUE D-013 INSTALLE À LA PLACE", F(700, 9.5), mot)
    x = M
    for v in [4, 8, 12, 16, 24, 32, 48]:
        cote = 10 + v * 0.85
        rr(d, (x, y3 + 22 + (80 - cote), x + cote, y3 + 22 + 80), 4, fill="#EADCC7", outline="#D8C6AC", width=1)
        txt(d, (x + cote / 2, y3 + 28 + 80), str(v), F(600, 9), "#7E4A26", anchor="mt")
        x += cote + 20
    txt(d, (M, y3 + 122), "Espace : sept pas, jamais un autre. 4 pour serrer, 16 entre deux blocs, 48 entre deux sections.", F(400, 9.5), douce)

    x2 = M + 560
    txt(d, (x2, y3 + 20), "Titre 20 px · 700", F(700, 20), encre)
    txt(d, (x2, y3 + 50), "Corps 14 px · 400", F(400, 14), encre)
    txt(d, (x2, y3 + 72), "Légende 11 px · 400", F(400, 11), "#6B4A32")
    txt(d, (x2, y3 + 90), "Trois niveaux : toute information rentre dans l'un des trois.", F(400, 9.5), "#9A9088")
    txt(d, (x2, y3 + 106), "Et une action principale par écran — c'est la règle qui coûte le plus cher à tenir.", F(400, 9.5), "#9A9088")

    y4 = y3 + 146
    txt(d, (M, y4), "L'ÉCRAN DE PAIE, APRÈS", F(700, 9.5), mot)
    ex, ey, ew, eh = M, y4 + 16, W - 2 * M, 176
    rr(d, (ex, ey, ex + ew, ey + eh), 10, fill="#FFFDF9", outline="#E3D5BE", width=1)
    txt(d, (ex + 32, ey + 22), "Paie de novembre 2026", F(700, 20), encre)
    txt(d, (ex + 32, ey + 50), "42 employés · 38 bulletins générés · 1 anomalie", F(400, 14), "#3B342C")
    for k, (lab, val) in enumerate([("Brut", "4 218 000 F"), ("Cotisations", "− 736 400 F"), ("Net à payer", "3 481 600 F")]):
        ly = ey + 82 + k * 20
        txt(d, (ex + 32, ly), lab, F(400, 11), "#6B4A32")
        txt(d, (ex + 150, ly), val, F(600, 11), encre)
    # colonne des contrôles
    cx2 = ex + 400
    txt(d, (cx2, ey + 50), "CONTRÔLES", F(700, 8), "#9A9088")
    for k, (coul, t) in enumerate([("#9B2C2C", "1 anomalie bloquante"), ("#3F6B4C", "38 bulletins prêts"), ("#8A5A14", "2 justificatifs manquants")]):
        ly = ey + 68 + k * 18
        d.ellipse([cx2 * S, (ly + 4) * S, (cx2 + 6) * S, (ly + 10) * S], fill=coul)
        txt(d, (cx2 + 14, ly), t, F(400, 10.5), "#3B342C")
    rr(d, (ex + ew - 288, ey + 60, ex + ew - 32, ey + 92), 8, fill="#A26537")
    txt(d, (ex + ew - 160, ey + 69), "Valider la paie", F(600, 12), "#FFFDF7", anchor="mt")
    txt(d, (ex + ew - 288, ey + 104), "Télécharger le journal", F(400, 11), "#7E4A26")
    txt(d, (ex + 32, ey + 152), "Une action principale, une secondaire, et rien d'autre de même poids.", F(400, 9.5), "#9A9088")

    yp = ey + eh + 14
    rr(d, (M, yp, W - M, yp + 44), 8, fill="#FBF7F0", outline="#EFE6D8", width=1)
    txt(d, (M + 18, yp + 8), "Prochaine étape : D-011, le kit d'interface. Six composants, deux variantes (carte, tuile bento). Il se dessine avant de se coder.",
        F(500, 11), "#3B342C")
    txt(d, (M + 18, yp + 25), "Après l'avoir vu, tu valides — et seulement là, on touche au code.", F(400, 10), douce)

    sortie = img.resize((W, H), Image.LANCZOS)
    chemin = os.path.join(HERE, "21-apple-defaut.png")
    sortie.save(chemin, optimize=True)
    print("écrit", chemin)


def _panneau(d, x, y, w, h, numero, titre, spec):
    rr(d, (x, y, x + w, y + h), 12, fill="#FFFFFF", outline="#E3D5BE", width=1)
    txt(d, (x + 22, y + 16), numero, F(700, 8.5), "#A08554")
    txt(d, (x + 66, y + 15), titre, F(700, 12.5), "#14100C")
    ly = y + h - 20 - 12 * (len(spec) - 1)
    for l in spec:
        txt(d, (x + 22, ly), l, F(400, 9.5), "#7A6A58")
        ly += 12


def _bouton_kit(d, x, y, w, h, label, fond, coul, bord=None, largeur=1, decal=0):
    rr(d, (x, y + decal, x + w, y + h + decal), 8, fill=fond, outline=bord or fond, width=largeur)
    txt(d, (x + w / 2, y + h / 2 - 5 + decal), label, F(600, 11), coul, anchor="mt")


def figure22():
    H = 1040
    img = canevas(H)
    d = ImageDraw.Draw(img)
    M = 64
    encre, douce, mot = "#14100C", "#6B6259", "#8A6A3A"
    caps(d, (M, 40), "EN-CHECK  ·  PLANCHES DE DÉCISION  ·  LE KIT D'INTERFACE", F(600, 11), mot)
    txt(d, (M, 62), "D-011 — le kit : six composants, et rien d'autre", F(700, 29), encre)
    txt(d, (M, 102), "Tout ce qui se dessine dans le produit sort de ces six objets. Chacun est montré dans tous ses états, avec sa mesure et son contraste : c'est la même",
        F(400, 13.5), douce)
    txt(d, (M, 121), "chose pour le développeur et pour l'IA qui codera — plus d'invention possible. Ce qui n'est pas ici n'existe pas dans l'interface.",
        F(400, 13.5), douce)

    cw = (W - 2 * M - 24) / 2
    ys = [150, 150 + 268, 150 + 2 * 268]
    ph = 250

    # ── 1. bouton
    x, y = M, ys[0]
    _panneau(d, x, y, cw, ph, "01", "Bouton", [
        "hauteur 36 · rayon 8 · texte 600 / 12 px · écart intérieur 16",
        "plein 4,64 · survol 5,72 · actif 7,13 · danger 7,40 · désactivé 5,87",
        "désactivé = fond neutre + texte lisible, jamais une opacité réduite"])
    _bouton_kit(d, x + 22, y + 44, 150, 36, "Valider la paie", "#A26537", "#FFFDF7")
    _bouton_kit(d, x + 190, y + 44, 130, 36, "Survol", "#8C5A2A", "#FFFDF7")
    _bouton_kit(d, x + 338, y + 44, 120, 36, "Actif", "#7E4A26", "#FFFDF7", decal=1)
    _bouton_kit(d, x + 476, y + 44, 130, 36, "Désactivé", "#EADCC7", "#6B4A32")
    rr(d, (x + 22, y + 40, x + 172, y + 80), 10, fill=None, outline="#A26537", width=2)
    for dx, lab in [(22, "1 · repos"), (190, "2 · survol"), (338, "3 · actif"), (476, "4 · désactivé")]:
        txt(d, (x + dx, y + 86), lab, F(400, 9), "#6B4A32")
    _bouton_kit(d, x + 22, y + 104, 130, 36, "Secondaire", None, "#7E4A26", bord="#A26537")
    _bouton_kit(d, x + 166, y + 104, 110, 36, "Annuler", "#9B2C2C", "#FFFDF7")
    txt(d, (x + 292, y + 112), "Supprimer la ligne", F(500, 11), "#7E4A26")
    d.line([(x + 292) * S, (y + 128) * S, (x + 412) * S, (y + 128) * S], fill="#7E4A26", width=1)
    for dx, lab in [(22, "5 · secondaire"), (166, "6 · danger"), (292, "7 · lien")]:
        txt(d, (x + dx, y + 148), lab, F(400, 9), "#6B4A32")
    txt(d, (x + 22, y + 168), "5 = bordure seule, jamais de fond. 6 = le rouge pour l'irréversible seulement, après confirmation. 7 = une action tertiaire n'a pas de cadre.",
        F(400, 9.5), "#3B342C")
    txt(d, (x + 22, y + 184), "Le cadre autour du 1 est le focus clavier : 2 px #A26537, décalé de 2 px. Et une seule variante pleine par écran (D-013).",
        F(400, 9.5), "#3B342C")

    # ── 2. champ
    x = M + cw + 24
    _panneau(d, x, y, cw, ph, "02", "Champ de formulaire", [
        "hauteur 40 · rayon 6 · bordure 1 px #D8C6AC · texte 12 px",
        "étiquette au-dessus, 11 px #6B4A32 · aide en dessous, 10 px",
        "l'erreur ne se signale jamais par la couleur seule : bordure + mot",
        "le focus : la bordure passe de 1 à 2 px — visible même sans couleur"])

    def champ(cx, cy, w, label, valeur, etat="repos", aide=None):
        txt(d, (cx, cy), label, F(500, 10.5), "#6B4A32")
        bord = "#D8C6AC" if etat in ("repos", "focus") else "#9B2C2C"
        lw = 2 if etat in ("focus", "erreur") else 1
        fond = "#F3E9DA" if etat == "desactive" else "#FFFDF9"
        rr(d, (cx, cy + 15, cx + w, cy + 55), 6, fill=fond, outline=bord, width=lw)
        txt(d, (cx + 12, cy + 30), valeur, F(400, 11), "#6B4A32" if etat == "desactive" else "#2A1708")
        if aide:
            txt(d, (cx, cy + 60), aide, F(400, 9.5), "#9B2C2C" if etat == "erreur" else "#6B4A32")

    champ(x + 22, y + 42, 200, "Nom de l'employé", "Akossiwa Dossou")
    champ(x + 244, y + 42, 200, "Matricule", "EC-0417", "focus", "2 px = focus, sans couleur")
    champ(x + 466, y + 42, 200, "Montant brut", "0 F", "erreur", "Doit être supérieur à 0")
    champ(x + 22, y + 126, 200, "Site", "Cotonou — Siège", "desactive")
    champ(x + 244, y + 126, 200, "Période", "Novembre 2026")

    # ── 3. badge
    x, y = M, ys[1]
    _panneau(d, x, y, cw, ph, "03", "Badge de statut", [
        "hauteur 20 · rayon 999 · texte 600 / 10 px · pastille 6 px",
        "4 statuts, 4 couleurs, et toujours le mot écrit à côté",
        "contrastes : 5,62 · 5,41 · 6,89 · 5,87 — tous au-dessus du seuil"])

    def badge(bx, by, nom, coul):
        bw = 26 + d.textlength(nom, font=F(600, 10)) / S
        rr(d, (bx, by, bx + bw, by + 20), 10, fill="#FBF4E9", outline="#EADCC7", width=1)
        d.ellipse([(bx + 10) * S, (by + 7) * S, (bx + 16) * S, (by + 13) * S], fill=coul)
        txt(d, (bx + 22, by + 4), nom, F(600, 10), coul)
        return bw

    bx = x + 22
    for nom, coul in [("Présent", "#3F6B4C"), ("Retard", "#8A5A14"), ("Absent", "#9B2C2C"), ("En attente", "#6B4A32")]:
        bx += badge(bx, y + 46, nom, coul) + 14
    bx = x + 22
    for nom, coul in [("Validée", "#3F6B4C"), ("En attente de validation", "#8A5A14"), ("À justifier", "#9B2C2C")]:
        bx += badge(bx, y + 82, nom, coul) + 14
    txt(d, (x + 22, y + 118), "Le badge s'élargit avec le texte : il n'est jamais tronqué, jamais abrégé. Si le mot ne rentre pas, la colonne est trop étroite.",
        F(400, 9.5), "#3B342C")
    txt(d, (x + 22, y + 134), "Un point de couleur seul ne dit rien à un daltonien, ni à une impression en noir et blanc. Le mot est la donnée, la couleur n'est que le rappel.",
        F(400, 9.5), "#3B342C")
    txt(d, (x + 22, y + 158), "Interdit : une pastille verte sans texte, une ligne de tableau colorée pour dire « en retard ».",
        F(400, 9.5), "#3B342C")

    # ── 4. message
    x = M + cw + 24
    _panneau(d, x, y, cw, ph, "04", "Message d'alerte", [
        "fond teinté · barre de 3 px à gauche · texte 12 px · rayon 8",
        "hauteur libre, jamais plus de deux messages à l'écran",
        "le message dit quoi faire, pas seulement ce qui ne va pas"]),
    messages = [("La paie de novembre est validée. 38 bulletins sont prêts.", "#3F6B4C", "#EAF0EA"),
                ("2 justificatifs manquent pour Boubacar. Il reste 3 jours.", "#8A5A14", "#F6EFE2"),
                ("Impossible de valider : un montant est négatif (ligne 12).", "#9B2C2C", "#F7E9E7")]
    my = y + 42
    for texte, coul, fond in messages:
        rr(d, (x + 22, my, x + cw - 22, my + 34), 8, fill=fond, outline=fond, width=1)
        d.rectangle([(x + 22) * S, (my + 6) * S, (x + 25) * S, (my + 28) * S], fill=coul)
        txt(d, (x + 38, my + 11), texte, F(400, 10.5), "#2A1708")
        my += 42
    txt(d, (x + 22, y + 180), "Chaque message nomme la personne, la ligne ou la pièce. « Une erreur est survenue » est interdit : ça ne se répare pas.",
        F(400, 9.5), "#3B342C")

    # ── 5. carte et tuile
    x, y = M, ys[2]
    _panneau(d, x, y, cw, ph, "05", "Carte et tuile bento (D-014)", [
        "carte : rayon 8, écart 16, pour du contenu (un document, une fiche)",
        "tuile : rayon 12, écart 24, pour un chiffre de synthèse — 6 maximum par accueil",
        "une tuile contient un chiffre et un libellé. Une phrase, et ce n'est plus une tuile"]),
    rr(d, (x + 22, y + 44, x + 342, y + 168), 8, fill="#FFFDF9", outline="#D8C6AC", width=1)
    txt(d, (x + 40, y + 60), "Bulletin de paie — novembre", F(600, 11), "#14100C")
    txt(d, (x + 40, y + 80), "Akossiwa Dossou · EC-0417", F(400, 10), "#6B4A32")
    txt(d, (x + 40, y + 98), "Net à payer : 84 500 F", F(600, 11), "#2A1708")
    txt(d, (x + 40, y + 126), "carte · rayon 8", F(400, 9), "#A08554")
    rr(d, (x + 366, y + 44, x + 586, y + 168), 12, fill="#FBF4E9", outline="#EADCC7", width=1)
    txt(d, (x + 388, y + 60), "38/42", F(700, 26), "#2A1708")
    txt(d, (x + 388, y + 100), "présents", F(400, 10.5), "#6B4A32")
    txt(d, (x + 388, y + 126), "tuile · rayon 12", F(400, 9), "#A08554")

    # ── 6. tableau
    x = M + cw + 24
    _panneau(d, x, y, cw, ph, "06", "Tableau", [
        "en-tête 10 px 600 en capitales #6B4A32 · ligne de 34 px · filet 1 px #EADCC7",
        "chiffres alignés à droite, chiffres de largeur fixe (D-006)",
        "une seule action par ligne, et jamais en rouge"]),
    cols = [("EMPLOYÉ", 22, "l"), ("POINTAGES", 250, "r"), ("RETARDS", 350, "r"), ("", 430, "l")]
    ty = y + 42
    for lab, dx, al in cols:
        if lab:
            txt(d, (x + dx + (60 if al == "r" else 0), ty), lab, F(600, 8), "#6B4A32",
                anchor="rt" if al == "r" else "lt")
    d.line([(x + 22) * S, (ty + 16) * S, (x + cw - 22) * S, (ty + 16) * S], fill="#D8C6AC", width=1)
    lignes = [("Akossiwa Dossou", "22", "0"), ("Boubacar Sow", "20", "2"), ("Chantal Kponou", "22", "1")]
    for k, (nom, pt, ret) in enumerate(lignes):
        ly = ty + 26 + k * 34
        txt(d, (x + 22, ly), nom, F(400, 10.5), "#2A1708")
        txt(d, (x + 310, ly), pt, F(400, 10.5), "#2A1708", anchor="rt")
        txt(d, (x + 410, ly), ret, F(600, 10.5), "#8A5A14" if ret != "0" else "#3B342C", anchor="rt")
        txt(d, (x + 430, ly), "Voir", F(500, 10), "#7E4A26")
        d.line([(x + 22) * S, (ly + 22) * S, (x + cw - 22) * S, (ly + 22) * S], fill="#EADCC7", width=1)
    txt(d, (x + 22, y + 190), "Pas de zébrures, pas de colonne « actions » à quatre boutons. Une ligne = un fait, un lien.",
        F(400, 9.5), "#3B342C")

    # ── pied
    yp = ys[2] + ph + 20
    rr(d, (M, yp, W - M, yp + 54), 10, fill="#FBF7F0", outline="#EFE6D8", width=1)
    txt(d, (M + 22, yp + 12), "Ce que ça remplace : 49 fichiers CSS, 53 tailles de texte, 41 marges, 27 rayons (planche 21). Ce que ça donne : ces six objets, réutilisés partout.",
        F(500, 11), "#3B342C")
    txt(d, (M + 22, yp + 32), "Après ta validation, on écrit le kit une fois — puis on remplace, écran par écran, sans jamais réinventer un bouton.",
        F(400, 10), "#6B4A32")

    sortie = img.resize((W, H), Image.LANCZOS)
    chemin = os.path.join(HERE, "22-kit.png")
    sortie.save(chemin, optimize=True)
    print("écrit", chemin)


# ─────────────────────────────────────────────────────────── planche 23 : quatre peaux
def k_bouton(d, x, y, w, h, p):
    lab = "VALIDER LA PAIE" if p in ("B", "C", "D") else "Valider la paie"
    if p == "A":
        rr(d, (x, y, x + w, y + h), 8, fill="#A26537")
        txt(d, (x + w / 2, y + h / 2 - 5), lab, F(600, 11), "#FFFDF7", anchor="mt")
    elif p == "B":
        rr(d, (x, y + 3, x + w, y + h + 3), 10, fill="#7E4A26")
        rr(d, (x, y, x + w, y + h), 10, fill="#A26537")
        d.line([(x + 6) * S, (y + 1) * S, (x + w - 6) * S, (y + 1) * S], fill="#D9A96B", width=1)
        caps(d, (x + 16, y + h / 2 - 5), lab, F(700, 9.5), "#FFFDF7", tracking=1.3)
    elif p == "C":
        d.rectangle([x * S, y * S, (x + w) * S, (y + h) * S], fill="#2A1708")
        d.rectangle([x * S, y * S, (x + 6) * S, (y + h) * S], fill="#A26537")
        caps(d, (x + 20, y + h / 2 - 5), lab, F(600, 9.5), "#E8CFA8", tracking=1.6)
    else:
        d.rectangle([(x + 3) * S, (y + 3) * S, (x + w + 3) * S, (y + h + 3) * S], fill="#2A1708")
        rr(d, (x, y, x + w, y + h), 6, fill="#A26537", outline="#2A1708", width=2)
        caps(d, (x + 16, y + h / 2 - 5), lab, F(700, 9.5), "#FFFDF7", tracking=1.3)


def k_champ(d, x, y, w, p, label="Nom de l'employé", valeur="Akossiwa Dossou"):
    txt(d, (x, y), label, F(500, 10), "#6B4A32")
    top, bot = y + 14, y + 54
    if p == "A":
        rr(d, (x, top, x + w, bot), 6, fill="#FFFDF9", outline="#D8C6AC", width=1)
    elif p == "B":
        rr(d, (x, top, x + w, bot), 6, fill="#F7EDDF")
        d.line([x * S, (bot - 1) * S, (x + w) * S, (bot - 1) * S], fill="#CBB69A", width=2 * S)
    elif p == "C":
        rr(d, (x, top, x + w, bot), 2, fill="#F3E9DA", outline="#2A1708", width=2)
    else:
        d.rectangle([(x + 2) * S, (top + 2) * S, (x + w + 2) * S, (bot + 2) * S], fill="#2A1708")
        rr(d, (x, top, x + w, bot), 6, fill="#FFFDF7", outline="#2A1708", width=2)
    txt(d, (x + 12, top + 14), valeur, F(400, 11), "#2A1708")


def k_badge(d, x, y, p, texte="Retard", coul="#8A5A14"):
    if p == "A":
        bw = 26 + d.textlength(texte, font=F(600, 10)) / S
        rr(d, (x, y, x + bw, y + 20), 10, fill="#FBF4E9", outline="#EADCC7", width=1)
        d.ellipse([(x + 10) * S, (y + 7) * S, (x + 16) * S, (y + 13) * S], fill=coul)
        txt(d, (x + 22, y + 4), texte, F(600, 10), coul)
        return bw
    if p == "B":
        lab = texte.upper()
        bw = 20 + d.textlength(lab, font=F(700, 9)) / S
        rr(d, (x, y, x + bw, y + 20), 4, fill="#EADCC7")
        txt(d, (x + 10, y + 5), lab, F(700, 9), "#7E4A26")
        return bw
    if p == "C":
        lab = texte.upper()
        bw = 22 + d.textlength(lab, font=F(600, 9)) / S
        d.rectangle([x * S, y * S, (x + bw) * S, (y + 20) * S], fill="#2A1708")
        txt(d, (x + 11, y + 5), lab, F(600, 9), "#E8CFA8")
        return bw
    lab = texte.upper()
    bw = 22 + d.textlength(lab, font=F(700, 9)) / S
    d.rectangle([(x + 2) * S, (y + 2) * S, (x + bw + 2) * S, (y + 22) * S], fill="#2A1708")
    rr(d, (x, y, x + bw, y + 20), 10, fill="#F3E9DA", outline="#2A1708", width=2)
    txt(d, (x + 11, y + 5), lab, F(700, 9), "#7E4A26")
    return bw


def k_table(d, x, y, w, p):
    lignes = [("Akossiwa Dossou", "22"), ("Boubacar Sow", "20")]
    if p in ("A", "B"):
        txt(d, (x, y), "EMPLOYÉ", F(600, 7.5), "#6B4A32")
        txt(d, (x + w - 40, y), "POINT.", F(600, 7.5), "#6B4A32", anchor="rt")
        d.line([x * S, (y + 14) * S, (x + w) * S, (y + 14) * S], fill="#D8C6AC" if p == "A" else "#CBB69A", width=1)
        for k, (nom, val) in enumerate(lignes):
            ly = y + 22 + k * 24
            if p == "B" and k % 2 == 0:
                d.rectangle([x * S, (ly - 4) * S, (x + w) * S, (ly + 18) * S], fill="#FBF4E9")
            txt(d, (x, ly), nom, F(400, 10), "#2A1708")
            txt(d, (x + w - 40, ly), val, F(400, 10), "#2A1708", anchor="rt")
            d.line([x * S, (ly + 18) * S, (x + w) * S, (ly + 18) * S], fill="#EADCC7", width=1)
    elif p == "C":
        d.rectangle([x * S, y * S, (x + w) * S, (y + 18) * S], fill="#2A1708")
        caps(d, (x + 8, y + 5), "EMPLOYÉ", F(600, 7.5), "#E8CFA8", tracking=1.2)
        caps(d, (x + w - 46, y + 5), "POINT.", F(600, 7.5), "#E8CFA8", tracking=1.2)
        for k, (nom, val) in enumerate(lignes):
            ly = y + 24 + k * 24
            d.rectangle([x * S, ly * S, (x + 3) * S, (ly + 16) * S], fill="#A26537" if k == 0 else "#D8C6AC")
            txt(d, (x + 10, ly + 3), nom, F(400, 10), "#2A1708")
            txt(d, (x + w - 8, ly + 3), val, F(600, 10), "#2A1708", anchor="rt")
            d.line([x * S, (ly + 22) * S, (x + w) * S, (ly + 22) * S], fill="#D8C6AC", width=1)
    else:
        d.rectangle([x * S, y * S, (x + w) * S, (y + 74) * S], fill="#FFFDF7")
        rr(d, (x, y, x + w, y + 68), 4, fill=None, outline="#2A1708", width=2)
        d.rectangle([(x + 1) * S, (y + 1) * S, (x + w - 1) * S, (y + 18) * S], fill="#EADCC7")
        txt(d, (x + 8, y + 5), "EMPLOYÉ", F(700, 7.5), "#2A1708")
        txt(d, (x + w - 42, y + 5), "POINT.", F(700, 7.5), "#2A1708", anchor="rt")
        d.line([(x + 1) * S, (y + 19) * S, (x + w - 1) * S, (y + 19) * S], fill="#2A1708", width=2)
        for k, (nom, val) in enumerate(lignes):
            ly = y + 26 + k * 22
            txt(d, (x + 8, ly), nom, F(400, 10), "#2A1708")
            txt(d, (x + w - 8, ly), val, F(600, 10), "#2A1708", anchor="rt")
            d.line([(x + 1) * S, (ly + 16) * S, (x + w - 1) * S, (ly + 16) * S], fill="#2A1708", width=2)


def k_tuile(d, x, y, w, h, p):
    if p == "A":
        rr(d, (x, y, x + w, y + h), 12, fill="#FBF4E9", outline="#EADCC7", width=1)
        txt(d, (x + 16, y + 12), "38/42", F(700, 24), "#2A1708")
        txt(d, (x + 16, y + 48), "présents", F(400, 10), "#6B4A32")
    elif p == "B":
        rr(d, (x, y, x + w, y + h), 10, fill="#FBF4E9")
        d.rectangle([(x + 10) * S, (y + h - 7) * S, (x + w - 10) * S, (y + h - 3) * S], fill="#A26537")
        txt(d, (x + 16, y + 12), "38/42", F(700, 24), "#7E4A26")
        txt(d, (x + 16, y + 48), "présents", F(400, 10), "#6B4A32")
    elif p == "C":
        d.rectangle([x * S, y * S, (x + w) * S, (y + h) * S], fill="#2A1708")
        for k in range(9):
            d.rectangle([(x + 14 + k * 14) * S, (y + h - 12) * S, (x + 22 + k * 14) * S, (y + h - 6) * S], fill="#A26537")
        txt(d, (x + 16, y + 10), "38/42", F(700, 24), "#E8CFA8")
        txt(d, (x + 16, y + 44), "présents", F(400, 10), "#CBB69A")
    else:
        d.rectangle([(x + 3) * S, (y + 3) * S, (x + w + 3) * S, (y + h + 3) * S], fill="#2A1708")
        rr(d, (x, y, x + w, y + h), 8, fill="#FFFDF7", outline="#2A1708", width=2)
        txt(d, (x + 16, y + 10), "38/42", F(700, 24), "#2A1708")
        txt(d, (x + 16, y + 46), "présents", F(400, 10), "#2A1708")


def figure23():
    H = 712
    img = canevas(H)
    d = ImageDraw.Draw(img)
    M = 64
    encre, douce, mot = "#14100C", "#6B6259", "#8A6A3A"
    caps(d, (M, 38), "EN-CHECK  ·  PLANCHES DE DÉCISION  ·  QUATRE PEAUX POUR LE KIT", F(600, 11), mot)
    txt(d, (M, 60), "Le kit, quatre directions — même structure, quatre caractères", F(700, 27), encre)
    txt(d, (M, 98), "Tu as raison : la planche 22 était l'option la plus neutre qui existe. Voilà quatre peaux possibles pour les mêmes six objets. Mêmes couleurs,",
        F(400, 13), douce)
    txt(d, (M, 116), "même police, mêmes contrastes mesurés — seule la forme change. Le remplissage terracotta et la tuile bento restent dans les quatre ; c'est leur forme qui change.",
        F(400, 13), douce)

    col = (W - 2 * M - 3 * 16) / 4
    Y = 154
    noms = [("A", "MESURÉ", "celui de la planche 22"),
            ("B", "ARGILE MATE", "la matière, le relief"),
            ("C", "TISSÉ ÉDITORIAL", "le motif devient structure"),
            ("D", "BRUT ADOUCI", "le contour assume")]
    for i, (p, nom, sous) in enumerate(noms):
        x = M + i * (col + 16)
        txt(d, (x, Y), nom, F(700, 11), encre)
        txt(d, (x, Y + 16), sous, F(400, 9.5), mot)
        k_bouton(d, x, Y + 38, col - 40, 38, p)
        k_champ(d, x, Y + 92, col - 40, p)
        k_badge(d, x, Y + 168, p)
        k_table(d, x, Y + 202, col - 40, p)
        k_tuile(d, x, Y + 292, col - 46, 74, p)
        mesures = {"A": ["rayon 8 · bordure 1 px · sans ombre"],
                   "B": ["rayon 10 · ombre dure 3 px · filet bas 2,5 px"],
                   "C": ["rayon 0-3 · bande 6 px · capitales espacées"],
                   "D": ["rayon 6 · contour 2 px · ombre décalée 3 px"]}[p]
        txt(d, (x, Y + 386), mesures[0], F(400, 9), "#7A6A58")
        car = {"A": "Sobre. Ne vieillit pas, mais ne se retient pas :",
               "B": "Tactile. L'ombre dure sous le bouton, le champ qui s'enfonce :",
               "C": "Affirmé. Bandes espresso, capitales espacées, bords francs :",
               "D": "Franc. Contour épais, ombre pleine, tout se voit :"}[p]
        suite = {"A": "c'est exactement ce que tu as ressenti, et tu as raison.",
                 "B": "artisanal, chaleureux, proche de l'atelier.",
                 "C": "on reconnaît En-Check avant de lire le titre.",
                 "D": "lisible, mémorable, un peu provoquant."}[p]
        risque = {"A": "Risque : rien à retenir.", "B": "Risque : sur 40 lignes, la matière fatigue.",
                  "C": "Risque : si tout crie, plus rien n'est fort.", "D": "Risque : peut faire « jeu » dans la paie."}[p]
        txt(d, (x, Y + 408), car, F(400, 9), "#3B342C")
        txt(d, (x, Y + 421), suite, F(400, 9), "#3B342C")
        txt(d, (x, Y + 438), risque, F(500, 9), "#8A6A3A")

    yp = Y + 468
    rr(d, (M, yp, W - M, yp + 62), 10, fill="#FBF7F0", outline="#EFE6D8", width=1)
    txt(d, (M + 22, yp + 11), "Ce qui ne change pas : palette B, IBM Plex, 4,64 de contraste sur le bouton plein, une seule action principale, six composants, trois tailles de texte.",
        F(500, 10.5), "#3B342C")
    txt(d, (M + 22, yp + 28), "Ce qui change : les rayons, les bordures, les ombres, les capitales, la densité. C'est de la forme, pas de l'identité — donc réversible sans rien casser.",
        F(400, 10), "#6B4A32")
    txt(d, (M + 22, yp + 44), "Peut-on mélanger ? Une seule peau pour le kit entier. Mélanger A et D donne une interface qui doute d'elle-même.", F(400, 10), "#6B4A32")

    sortie = img.resize((W, H), Image.LANCZOS)
    chemin = os.path.join(HERE, "23-quatre-peaux.png")
    sortie.save(chemin, optimize=True)
    print("écrit", chemin)


# ─────────────────────────────────────────── planche 24 : peau D, trois formes par composant
ESP, TER, SAB, SUR, CAR, S2 = "#2A1708", "#A26537", "#F3E9DA", "#FBF4E9", "#FFFDF7", "#EADCC7"


def _ombre(d, x, y, w, h, r, dx=3, dy=3, coul=ESP):
    rr(d, (x + dx, y + dy, x + w + dx, y + h + dy), r, fill=coul)


def v_bouton(d, x, y, w, p):
    h = 36
    lab = "VALIDER LA PAIE"
    if p == 1:
        _ombre(d, x, y, w, h, 6)
        rr(d, (x, y, x + w, y + h), 6, fill=TER, outline=ESP, width=2)
        caps(d, (x + 16, y + 13), lab, F(700, 9.5), CAR, tracking=1.3)
    elif p == 2:
        _ombre(d, x, y, w, h, 6)
        rr(d, (x, y, x + w, y + h), 6, fill=CAR, outline=ESP, width=2)
        caps(d, (x + 16, y + 13), lab, F(700, 9.5), ESP, tracking=1.3)
    else:
        _ombre(d, x, y, w, h, 6, coul=TER)
        rr(d, (x, y, x + w, y + h), 6, fill=ESP, outline=ESP, width=2)
        caps(d, (x + 16, y + 13), "CLÔTURER LA PAIE", F(700, 9.5), "#E8CFA8", tracking=1.3)


def v_champ(d, x, y, w, p):
    if p == 1:
        txt(d, (x, y - 2), "Nom de l'employé", F(500, 9.5), ESP)
        _ombre(d, x, y + 12, w, 38, 6, 2, 2)
        rr(d, (x, y + 12, x + w, y + 50), 6, fill=CAR, outline=ESP, width=2)
        txt(d, (x + 12, y + 24), "Akossiwa Dossou", F(500, 10.5), ESP)
    elif p == 2:
        caps(d, (x, y), "NOM DE L'EMPLOYÉ", F(600, 7.5), "#6B4A32", tracking=1.2)
        rr(d, (x, y + 12, x + w, y + 50), 4, fill="#F7EDDF")
        d.rectangle([x * S, (y + 47) * S, (x + w) * S, (y + 50) * S], fill=ESP)
        txt(d, (x + 10, y + 24), "Akossiwa Dossou", F(500, 10.5), ESP)
    else:
        _ombre(d, x, y + 12, w, 38, 6, 2, 2)
        rr(d, (x, y + 12, x + w, y + 50), 6, fill=CAR, outline=ESP, width=2)
        d.rectangle([(x + 2) * S, (y + 14) * S, (x + 96) * S, (y + 48) * S], fill=S2)
        d.line([(x + 96) * S, (y + 12) * S, (x + 96) * S, (y + 50) * S], fill=ESP, width=2)
        caps(d, (x + 10, y + 24), "NOM", F(600, 8), ESP, tracking=1.2)
        txt(d, (x + 108, y + 24), "Akossiwa Dossou", F(500, 10.5), ESP)


def v_badge(d, x, y, w, p):
    lab = "RETARD"
    tw = d.textlength(lab, font=F(700, 9)) / S
    if p == 1:
        rr(d, (x, y, x + tw + 24, y + 22), 11, fill=SAB, outline=ESP, width=2)
        txt(d, (x + 12, y + 5), lab, F(700, 9), "#7E4A26")
    elif p == 2:
        d.rectangle([x * S, y * S, (x + tw + 24) * S, (y + 22) * S], fill=ESP)
        txt(d, (x + 12, y + 5), lab, F(700, 9), "#E8CFA8")
    else:
        pts = [(x, y), (x + tw + 24, y), (x + tw + 24, y + 22), (x + 8, y + 22), (x, y + 14)]
        d.polygon([(px * S, py * S) for px, py in pts], fill=SAB, outline=ESP)
        d.line([(px * S, py * S) for px, py in pts + [pts[0]]], fill=ESP, width=2)
        txt(d, (x + 12, y + 5), lab, F(700, 9), "#7E4A26")


def v_message(d, x, y, w, p):
    if p == 1:
        _ombre(d, x, y, w, 54, 8, 3, 3)
        rr(d, (x, y, x + w, y + 54), 8, fill=CAR, outline=ESP, width=2)
        d.rectangle([(x + 2) * S, (y + 2) * S, (x + 8) * S, (y + 52) * S], fill="#9B2C2C")
        txt(d, (x + 20, y + 10), "Impossible de valider.", F(700, 10.5), ESP)
        txt(d, (x + 20, y + 27), "Un montant est négatif, ligne 12.", F(400, 9.5), ESP)
    elif p == 2:
        rr(d, (x, y, x + w, y + 44), 4, fill="#3F6B4C")
        txt(d, (x + 14, y + 8), "38 bulletins générés.", F(700, 10.5), CAR)
        txt(d, (x + 14, y + 24), "La paie de novembre est prête.", F(400, 9.5), CAR)
    else:
        _ombre(d, x, y, w, 54, 8, 3, 3)
        rr(d, (x, y, x + w, y + 54), 8, fill="#F7EDDF", outline=ESP, width=2)
        caps(d, (x + 14, y + 9), "À FAIRE AVANT VENDREDI", F(700, 8), "#8A5A14", tracking=1.2)
        txt(d, (x + 14, y + 24), "2 justificatifs manquent pour", F(400, 9.5), ESP)
        txt(d, (x + 14, y + 37), "Boubacar Sow — il reste 3 jours.", F(400, 9.5), ESP)


def v_table(d, x, y, w, p):
    if p == 1:
        d.rectangle([x * S, y * S, (x + w) * S, (y + 56) * S], fill=CAR)
        rr(d, (x, y, x + w, y + 56), 4, fill=None, outline=ESP, width=2)
        d.rectangle([(x + 1) * S, (y + 1) * S, (x + w - 1) * S, (y + 17) * S], fill=S2)
        d.line([(x + 1) * S, (y + 18) * S, (x + w - 1) * S, (y + 18) * S], fill=ESP, width=2)
        txt(d, (x + 8, y + 5), "EMPLOYÉ", F(700, 7.5), ESP)
        txt(d, (x + w - 44, y + 5), "POINT.", F(700, 7.5), ESP, anchor="rt")
        for k, (nom, val) in enumerate([("Akossiwa Dossou", "22"), ("Boubacar Sow", "20")]):
            ly = y + 24 + k * 18
            txt(d, (x + 8, ly), nom, F(400, 9.5), ESP)
            txt(d, (x + w - 8, ly), val, F(700, 9.5), ESP, anchor="rt")
            if k == 0:
                d.line([(x + 1) * S, (ly + 14) * S, (x + w - 1) * S, (ly + 14) * S], fill=ESP, width=2)
    elif p == 2:
        txt(d, (x, y), "EMPLOYÉ", F(700, 7.5), ESP)
        txt(d, (x + w - 44, y), "POINT.", F(700, 7.5), ESP, anchor="rt")
        d.line([x * S, (y + 14) * S, (x + w) * S, (y + 14) * S], fill=ESP, width=2)
        for k, (nom, val) in enumerate([("Akossiwa Dossou", "22"), ("Boubacar Sow", "20")]):
            ly = y + 22 + k * 18
            txt(d, (x, ly), nom, F(400, 9.5), ESP)
            txt(d, (x + w - 8, ly), val, F(700, 9.5), ESP, anchor="rt")
            d.line([x * S, (ly + 14) * S, (x + w) * S, (ly + 14) * S], fill="#D8C6AC", width=1)
    else:
        for k, (nom, val, coul, lab) in enumerate([("Akossiwa Dossou", "22", "#3F6B4C", "PRÉSENT"),
                                                  ("Boubacar Sow", "20", "#8A5A14", "RETARD")]):
            ly = y + k * 28
            d.rectangle([x * S, ly * S, (x + 3) * S, (ly + 24) * S], fill=ESP)
            txt(d, (x + 12, ly + 3), nom, F(400, 9.5), ESP)
            tw = d.textlength(lab, font=F(700, 7)) / S
            d.rectangle([(x + w - 74) * S, (ly + 5) * S, (x + w - 74 + tw + 12) * S, (ly + 19) * S], fill=coul)
            txt(d, (x + w - 68, ly + 8), lab, F(700, 7), CAR)
            txt(d, (x + w - 8, ly + 6), val, F(700, 9.5), ESP, anchor="rt")
            d.line([x * S, (ly + 24) * S, (x + w) * S, (ly + 24) * S], fill="#D8C6AC", width=1)


def v_tuile(d, x, y, w, p):
    h = 60
    if p == 1:
        _ombre(d, x, y, w, h, 8)
        rr(d, (x, y, x + w, y + h), 8, fill=CAR, outline=ESP, width=2)
        txt(d, (x + 14, y + 8), "38/42", F(700, 22), ESP)
        txt(d, (x + 14, y + 40), "présents", F(400, 9.5), ESP)
    elif p == 2:
        _ombre(d, x, y, w, h, 8)
        rr(d, (x, y, x + w, y + h), 8, fill=CAR, outline=ESP, width=2)
        txt(d, (x + 14, y + 6), "38/42", F(700, 20), ESP)
        txt(d, (x + 14, y + 34), "présents · nov. 2026", F(400, 9), "#6B4A32")
        rr(d, (x + 14, y + 44, x + w - 14, y + 50), 3, fill=S2)
        rr(d, (x + 14, y + 44, x + 14 + (w - 28) * 0.905, y + 50), 3, fill=TER)
    else:
        _ombre(d, x, y, w, h, 8)
        rr(d, (x, y, x + w, y + h), 8, fill=CAR, outline=ESP, width=2)
        d.rectangle([(x + 2) * S, (y + 2) * S, (x + w - 2) * S, (y + 18) * S], fill=ESP)
        caps(d, (x + 12, y + 6), "PRÉSENCE DU JOUR", F(700, 7.5), "#E8CFA8", tracking=1.2)
        txt(d, (x + 14, y + 24), "38/42", F(700, 20), ESP)
        txt(d, (x + 100, y + 32), "sur 42", F(400, 8.5), "#6B4A32")


def figure24():
    H = 900
    img = canevas(H)
    d = ImageDraw.Draw(img)
    M = 64
    encre, douce, mot = "#14100C", "#6B6259", "#8A6A3A"
    caps(d, (M, 38), "EN-CHECK  ·  PLANCHES DE DÉCISION  ·  BRUT ADOUCI  ·  TROIS FORMES PAR OBJET", F(600, 10.5), mot)
    txt(d, (M, 60), "Peau D — brut adouci : trois formes pour chaque objet", F(700, 27), encre)
    txt(d, (M, 98), "Même peau, mêmes couleurs, mêmes contrastes. Ce qui change : la fonction. Un bouton pleine et un bouton contour ne disent pas la même chose —",
        F(400, 13), douce)
    txt(d, (M, 116), "et c'est cette différence qui sort du générique. Ici, chaque objet a trois formes, et chaque forme a un emploi écrit.", F(400, 13), douce)

    gut = 126
    colw = (W - 2 * M - gut - 32) / 3
    y0, rowh = 152, 112
    lignes = [
        ("01", "Bouton", [(v_bouton, (1,), "Pleine", "action principale, une par écran"),
                          (v_bouton, (2,), "Contour", "action secondaire, sans poids"),
                          (v_bouton, (3,), "Inverse", "ce qui engage : clôturer, valider, envoyer")]),
        ("02", "Champ", [(v_champ, (1,), "Cadre", "formulaire classique, un champ = une question"),
                         (v_champ, (2,), "Souligné", "saisie rapide dans une liste, en ligne"),
                         (v_champ, (3,), "Étiquette fixe", "grille de réglages : le nom ne bouge pas")]),
        ("03", "Badge", [(v_badge, (1,), "Pilule", "statut courant, qui peut changer"),
                         (v_badge, (2,), "Tampon", "statut figé : clôturé, payé, archivé"),
                         (v_badge, (3,), "Onglet", "statut provisoire, en attente de décision")]),
        ("04", "Message", [(v_message, (1,), "Carte", "erreur bloquante : il faut agir maintenant"),
                           (v_message, (2,), "Bandeau", "succès fugace, 5 secondes puis disparaît"),
                           (v_message, (3,), "Fiche", "alerte datée, avec un titre et une échéance")]),
        ("05", "Tableau", [(v_table, (1,), "Grille", "contrôle et paie : tout est bordé, rien à côté"),
                           (v_table, (2,), "Filets", "listes longues : seuls les rangs comptent"),
                           (v_table, (3,), "Tampon", "suivi de statuts : la couleur porte le mot")]),
        ("06", "Tuile", [(v_tuile, (1,), "Chiffre", "accueil : un nombre, un mot, et c'est tout"),
                         (v_tuile, (2,), "Chiffre + repère", "quand la période et l'unité changent le sens"),
                         (v_tuile, (3,), "Bandeau", "tuile de section, avec son titre intégré")]),
    ]
    for i, (num, nom, formes) in enumerate(lignes):
        top = y0 + i * rowh
        txt(d, (M, top + 6), num, F(700, 8.5), "#A08554")
        txt(d, (M, top + 20), nom, F(700, 12), encre)
        for j, (fn, args, titre, desc) in enumerate(formes):
            cx = M + gut + j * (colw + 16)
            fn(d, cx, top + 8, colw - 30, *args)
            txt(d, (cx, top + 74), titre, F(600, 10), ESP)
            txt(d, (cx, top + 87), desc, F(400, 9), "#7A6A58")
        if i:
            d.line([M * S, (top - 6) * S, (W - M) * S, (top - 6) * S], fill="#E7DECF", width=1)

    yp = y0 + 6 * rowh + 8
    rr(d, (M, yp, W - M, yp + 62), 10, fill="#FBF7F0", outline="#EFE6D8", width=1)
    txt(d, (M + 22, yp + 10), "La règle qui empêche le retour au générique : chaque forme a un emploi, et un seul. Un badge tampon pour un statut qui peut encore changer est une faute.",
        F(500, 10.5), "#3B342C")
    txt(d, (M + 22, yp + 28), "Dans le code, cela fait 18 formes au lieu de 6 — mais aucun n'est inventé au moment de coder la page. C'est là que le kit gagne son temps.",
        F(400, 10), "#6B4A32")
    txt(d, (M + 22, yp + 44), "Si tu veux en retirer une, dis-moi laquelle : trois formes par objet, c'est le maximum que je peux justifier. Au-delà, c'est du choix pour le choix.",
        F(400, 10), "#6B4A32")

    sortie = img.resize((W, H), Image.LANCZOS)
    chemin = os.path.join(HERE, "24-brut-adouci.png")
    sortie.save(chemin, optimize=True)
    print("écrit", chemin)


# ───────────────────────────────────────────── planche 25 : la page de paie, peau D
def _tick(d, x, y, coul="#3F6B4C"):
    d.line([(x) * S, (y + 4) * S, (x + 3) * S, (y + 7) * S], fill=coul, width=2)
    d.line([(x + 3) * S, (y + 7) * S, (x + 9) * S, (y - 1) * S], fill=coul, width=2)


def _btn25(d, x, y, w, h, lab, genre="pleine"):
    if genre == "pleine":
        _ombre(d, x, y, w, h, 6)
        rr(d, (x, y, x + w, y + h), 6, fill=TER, outline=ESP, width=2)
        caps(d, (x + 16, y + h / 2 - 5), lab, F(700, 9.5), CAR, tracking=1.3)
    else:
        _ombre(d, x, y, w, h, 6)
        rr(d, (x, y, x + w, y + h), 6, fill=CAR, outline=ESP, width=2)
        caps(d, (x + 16, y + h / 2 - 5), lab, F(700, 9.5), ESP, tracking=1.3)


def _tuile25(d, x, y, w, h, val, lab, mode="chiffre"):
    _ombre(d, x, y, w, h, 8)
    rr(d, (x, y, x + w, y + h), 8, fill=CAR, outline=ESP, width=2)
    if mode == "bandeau":
        d.rectangle([(x + 2) * S, (y + 2) * S, (x + w - 2) * S, (y + 24) * S], fill=ESP)
        caps(d, (x + 14, y + 9), lab.upper(), F(700, 7.5), "#E8CFA8", tracking=1.2)
        txt(d, (x + 14, y + 34), val, F(700, 26), ESP)
    else:
        txt(d, (x + 16, y + 12), val, F(700, 26 if mode == "grande" else 22), ESP)
        txt(d, (x + 16, y + (52 if mode == "grande" else 48)), lab, F(400, 9.5), "#3A342C" if False else ESP)
        if mode == "repere":
            rr(d, (x + 16, y + h - 18, x + w - 16, y + h - 12), 3, fill=S2)
            rr(d, (x + 16, y + h - 18, x + 16 + (w - 32) * 0.905, y + h - 12), 3, fill=TER)


def _badge25(d, x, y, lab, genre="pilule"):
    tw = d.textlength(lab, font=F(700, 8)) / S
    if genre == "pilule":
        rr(d, (x, y, x + tw + 22, y + 20), 10, fill=SAB, outline=ESP, width=2)
        txt(d, (x + 11, y + 5), lab, F(700, 8), "#7E4A26")
    else:
        d.rectangle([x * S, y * S, (x + tw + 22) * S, (y + 20) * S], fill=ESP)
        txt(d, (x + 11, y + 5), lab, F(700, 8), "#E8CFA8")


def figure25():
    H = 1020
    img = canevas(H)
    d = ImageDraw.Draw(img)
    M = 64
    encre, douce, mot = "#14100C", "#6B6259", "#8A6A3A"
    caps(d, (M, 38), "EN-CHECK  ·  PLANCHES DE DÉCISION  ·  LA PAGE DE PAIE EN BRUT ADOUCI", F(600, 10.5), mot)
    txt(d, (M, 60), "La paie, entière — et ce que la peau D tient vraiment", F(700, 27), encre)
    txt(d, (M, 98), "La même page que dans le produit, avec ses tuiles, son message et quarante employés. Dix lignes sont dessinées ; les règles, elles, valent pour les quarante.",
        F(400, 13), douce)

    # ── la page
    px, py, pw, ph = M, 132, 1120, 810
    d.rectangle([px * S, py * S, (px + pw) * S, (py + ph) * S], fill=SAB)
    bande_motif(img, (px, py, px + pw, py + 76), hauteur=76, fichier="motif-bogolan.webp")
    d = ImageDraw.Draw(img)

    cx, cw = px + 28, pw - 56
    txt(d, (cx, py + 96), "Paie de novembre 2026", F(700, 20), ESP)
    txt(d, (cx, py + 124), "42 employés · 38 bulletins générés · 1 anomalie bloquante", F(400, 11), ESP)
    _btn25(d, cx + cw - 320, py + 96, 150, 38, "TÉLÉCHARGER", "contour")
    _btn25(d, cx + cw - 158, py + 96, 158, 38, "VALIDER LA PAIE", "pleine")

    ty = py + 158
    _tuile25(d, cx, ty, 472, 96, "3 481 600 F", "net à payer · nov. 2026", "repere")
    _tuile25(d, cx + 490, ty, 272, 96, "38/42", "présents")
    _tuile25(d, cx + 780, ty, cw - 780, 96, "38", "BULLETINS PRÊTS", "bandeau")

    my = py + 272
    _ombre(d, cx, my, cw, 54, 8)
    rr(d, (cx, my, cx + cw, my + 54), 8, fill="#F7EDDF", outline=ESP, width=2)
    caps(d, (cx + 16, my + 9), "À FAIRE AVANT VENDREDI", F(700, 8), "#8A5A14", tracking=1.2)
    txt(d, (cx + 16, my + 24), "2 justificatifs manquent pour Boubacar Sow — il reste 3 jours.", F(400, 10), ESP)
    txt(d, (cx + cw - 96, my + 24), "Voir", F(500, 10), "#7E4A26")

    # recherche (champ souligné)
    sy = py + 340
    caps(d, (cx, sy), "RECHERCHER UN EMPLOYÉ", F(600, 7.5), ESP, tracking=1.2)
    rr(d, (cx, sy + 12, cx + 300, sy + 44), 4, fill="#F7EDDF")
    d.rectangle([cx * S, (sy + 41) * S, (cx + 300) * S, (sy + 45) * S], fill=ESP)
    txt(d, (cx + 10, sy + 21), "Sow", F(500, 10), ESP)
    txt(d, (cx + 320, sy + 22), "25 par page · tri par nom", F(400, 9), "#5C5248")

    # tableau
    tx, tw = cx, cw
    th = py + 392
    cols = [("EMPLOYÉ", 0, "l"), ("POSTE", 250, "l"), ("BRUT", 500, "r"),
            ("COTISATIONS", 630, "r"), ("NET", 790, "r"), ("STATUT", 950, "l")]
    d.rectangle([tx * S, th * S, (tx + tw) * S, (th + 30) * S], fill=S2)
    rr(d, (tx, th, tx + tw, th + 30), 4, fill=None, outline=ESP, width=2)
    for lab, dx, al in cols:
        txt(d, (tx + dx + 10, th + 9), lab, F(700, 7.5), ESP)
    d.line([(tx + 1) * S, (th + 31) * S, (tx + tw - 1) * S, (th + 31) * S], fill=ESP, width=2)

    lignes = [("Akossiwa Dossou", "Assistante RH", "320 000", "57 600", "262 400", "PAYÉ", "tampon"),
              ("Boubacar Sow", "Chauffeur", "185 000", "31 400", "153 600", "EN COURS", "pilule"),
              ("Chantal Kponou", "Comptable", "410 000", "73 800", "336 200", "PAYÉ", "tampon"),
              ("Dossou Hounkpatin", "Agent de sécurité", "175 000", "29 750", "145 250", "EN COURS", "pilule"),
              ("Estelle Adjovi", "Chargée de paie", "395 000", "71 100", "323 900", "PAYÉ", "tampon"),
              ("Fatou Bakary", "Femme de chambre", "165 000", "26 400", "138 600", "EN COURS", "pilule"),
              ("Gildas Zinsou", "Magasinier", "210 000", "35 700", "174 300", "PAYÉ", "tampon"),
              ("Hortense Dangbénon", "Infirmière", "285 000", "51 300", "233 700", "PAYÉ", "tampon"),
              ("Ismaël Traoré", "Mécanicien", "230 000", "39 100", "190 900", "EN COURS", "pilule"),
              ("Joséphine Ahouandjinou", "Secrétaire", "195 000", "33 150", "161 850", "PAYÉ", "tampon")]
    for k, (nom, poste, brut, cot, net, stat, genre) in enumerate(lignes):
        ry = th + 34 + k * 34
        txt(d, (tx + 10, ry + 11), nom, F(400, 9.5), ESP)
        txt(d, (tx + 260, ry + 11), poste, F(400, 9), "#4A4038")
        txt(d, (tx + 630, ry + 11), brut, F(400, 9.5), ESP, anchor="rt")
        txt(d, (tx + 790, ry + 11), "− " + cot, F(400, 9.5), "#5C5248", anchor="rt")
        txt(d, (tx + 930, ry + 11), net, F(700, 9.5), ESP, anchor="rt")
        _badge25(d, tx + 950, ry + 6, stat, genre)
        txt(d, (tx + tw - 34, ry + 11), "Voir", F(500, 9), "#7E4A26")
        d.line([(tx + 1) * S, (ry + 32) * S, (tx + tw - 1) * S, (ry + 32) * S], fill="#CBB69A", width=1)
    d.rectangle([tx * S, (th + 34) * S, (tx + tw) * S, (th + 34 + 340) * S], fill=None, outline=ESP, width=2)

    fy = th + 34 + 340
    txt(d, (tx, fy + 12), "40 employés · 25 par page · page 1 sur 2", F(400, 9), "#4A4038")
    _btn25(d, tx + tw - 268, fy + 4, 148, 30, "PAGE SUIVANTE", "contour")
    txt(d, (tx + tw - 292, fy + 12), "1 / 2", F(500, 9), ESP, anchor="rt")

    # ── colonne de droite
    ax, aw = 1216, 320
    txt(d, (ax, 132), "LES FORMES EN SERVICE", F(700, 9), mot)
    txt(d, (ax, 148), "9 des 18 formes — les 9 autres dorment.", F(400, 9.5), "#5C5248")
    formes = [("Bouton pleine", "valider la paie"), ("Bouton contour", "télécharger, paginer"),
              ("Champ souligné", "rechercher"), ("Message fiche", "l'alerte datée"),
              ("Tableau grille", "la paie, le contrôle"), ("Tuile chiffre", "présents"),
              ("Tuile + repère", "le net, avec sa période"), ("Tampon", "payé, figé"),
              ("Pilule", "en cours, mouvant")]
    for k, (f, u) in enumerate(formes):
        ly = 168 + k * 15
        txt(d, (ax, ly), f, F(600, 8.5), ESP)
        txt(d, (ax + 132, ly), u, F(400, 8.5), "#5C5248")

    txt(d, (ax, 322), "LES DOUZE CONTRÔLES", F(700, 9), mot)
    ctrl = ["hex hors de index.css", "paires 4,5:1 minimum", "une bande par page",
            "aucun motif étiré", "aucun texte sur bande", "aucune police tierce",
            "statut jamais par couleur", "composant = une des 18", "aucune ombre floue",
            "rayons 6/8/11/12/999", "contour 2 px espresso", "boutons en capitales"]
    for k, c in enumerate(ctrl):
        ly = 340 + k * 14
        _tick(d, ax, ly)
        txt(d, (ax + 16, ly - 1), c, F(400, 8.5), "#3A342C")

    txt(d, (ax, 522), "LE TEST DE DENSITÉ", F(700, 9), mot)
    d.rectangle([ax * S, 538 * S, (ax + 128) * S, 610 * S], fill=None, outline="#B9AE9F", width=1)
    txt(d, (ax + 8, 542), "un écran", F(400, 7.5), "#8A8078")
    for k in range(18):
        d.line([(ax + 8) * S, (552 + k * 3) * S, (ax + 120) * S, (552 + k * 3) * S], fill="#D8C6AC", width=1)
    d.rectangle([ax * S, 616 * S, (ax + 128) * S, 630 * S], fill=ESP)
    txt(d, (ax + 8, 619), "40 − 24 lignes", F(600, 7.5), "#E8CFA8")
    txt(d, (ax + 144, 538), "40 lignes × 34 px", F(600, 8.5), ESP)
    txt(d, (ax + 144, 550), "= 1 360 px", F(400, 8.5), ESP)
    txt(d, (ax + 144, 562), "= 1,7 écran", F(400, 8.5), ESP)
    txt(d, (ax + 144, 580), "d'où 25 par page,", F(600, 8.5), "#8A5A14")
    txt(d, (ax + 144, 592), "et non « tout à plat ».", F(600, 8.5), "#8A5A14")
    txt(d, (ax + 144, 606), "Les garde-fous de D-013", F(400, 8), "#5C5248")
    txt(d, (ax + 144, 618), "ne survivent pas au volume :", F(400, 8), "#5C5248")
    txt(d, (ax + 144, 630), "c'est la pagination qui les sauve.", F(400, 8), "#5C5248")

    txt(d, (ax, 654), "CE QUE LA PLANCHE NE PROUVE PAS", F(700, 9), "#8C2020")
    for k, l in enumerate(["Un dessin n'est pas un test :",
                           "ni la vitesse réelle, ni le comportement",
                           "à 40 lignes sur un téléphone.",
                           "Il faudra coder la page, puis mesurer.",
                           "La maquette ne montre que 10 lignes."]):
        txt(d, (ax, 672 + k * 14), l, F(400, 8.5), "#3A342C")

    txt(d, (ax, 762), "CE QUI RESTE OUVERT", F(700, 9), mot)
    txt(d, (ax, 778), "D-002 — les secondaires indigo", F(600, 8.5), ESP)
    txt(d, (ax, 791), "et vert forêt. Rien d'autre.", F(400, 8.5), "#3A342C")

    # pied de planche
    rr(d, (M, 952, W - M, 998), 8, fill="#FBF7F0", outline="#EFE6D8", width=1)
    txt(d, (M + 18, 962), "Tout ce qui est dessiné ici sort des dix-huit formes entérinées (D-017). Aucun composant n'a été inventé pour la page : c'est le test que la peau devait passer.",
        F(500, 10), "#3B342C")
    txt(d, (M + 18, 980), "Ce qui reste à faire : écrire le kit une fois, appliquer la page, remesurer les 53 tailles de texte. Tant que le chiffre ne bouge pas, rien n'est gagné.",
        F(400, 9.5), "#6B4A32")

    sortie = img.resize((W, H), Image.LANCZOS)
    chemin = os.path.join(HERE, "25-paie-brut-adouci.png")
    sortie.save(chemin, optimize=True)
    print("écrit", chemin)


# ─────────────────────────────────────── planche 26 : le dashboard et sa sidebar
def _item(d, x, y, w, lab, actif=False, teinte=TER):
    if actif:
        rr(d, (x + 3, y + 3, x + w + 3, y + 33), 6, fill=teinte)
        rr(d, (x, y, x + w, y + 30), 6, fill=SAB, outline=ESP, width=2)
        d.rounded_rectangle([(x + 8) * S, (y + 10) * S, (x + 22) * S, (y + 20) * S], radius=2 * S,
                            outline=ESP, width=2)
        txt(d, (x + 30, y + 8), lab, F(600, 10.5), ESP)
    else:
        d.rounded_rectangle([(x + 8) * S, (y + 10) * S, (x + 22) * S, (y + 20) * S], radius=2 * S,
                            outline="#B9A88E", width=1)
        txt(d, (x + 30, y + 8), lab, F(400, 10.5), "#E8D9BE")


def figure26():
    H = 1230
    img = canevas(H)
    d = ImageDraw.Draw(img)
    M = 64
    encre, douce, mot = "#14100C", "#6B6259", "#8A6A3A"
    caps(d, (M, 38), "EN-CHECK  ·  PLANCHES DE DÉCISION  ·  LE DASHBOARD ET SA BARRE", F(600, 10.5), mot)
    txt(d, (M, 60), "Le dashboard en peau D — et la réponse sur la barre latérale", F(700, 27), encre)
    txt(d, (M, 98), "La barre latérale était déjà, sans le savoir, la partie la plus « brut adouci » du produit : espresso, texture tissée, cuivre. Elle n'a pas à",
        F(400, 13), douce)
    txt(d, (M, 116), "changer de nature — elle a à changer de palette, d'ombres et d'état actif. Voilà les trois, appliqués, et mesurés.", F(400, 13), douce)

    # ── la fenêtre
    fx, fy, fw, fh = M, 148, 1472, 860
    d.rectangle([fx * S, fy * S, (fx + fw) * S, (fy + fh) * S], fill=SAB)

    # sidebar
    sx, sw = fx, 252
    d.rectangle([sx * S, fy * S, (sx + sw) * S, (fy + fh) * S], fill=ESP)
    for k in range(0, fh, 7):
        d.line([(sx + 4) * S, (fy + k) * S, (sx + sw - 4) * S, (fy + k) * S], fill="#33200F", width=1)
    txt(d, (sx + 20, fy + 20), "En-Check", F(700, 15), SAB)
    txt(d, (sx + 20, fy + 42), "Cotonou — Siège", F(400, 8.5), "#B9A88E")
    bande_kente(img, (sx, fy + 62, sx + sw, fy + 90), hauteur=28)
    d = ImageDraw.Draw(img)
    txt(d, (sx + 20, fy + 104), "PILOTAGE", F(700, 7.5), "#B9A88E")
    _item(d, sx + 12, fy + 118, sw - 24, "Tableau de bord", True)
    _item(d, sx + 12, fy + 152, sw - 24, "Rapports")
    txt(d, (sx + 20, fy + 194), "QUOTIDIEN", F(700, 7.5), "#B9A88E")
    _item(d, sx + 12, fy + 208, sw - 24, "Pointages")
    _item(d, sx + 12, fy + 242, sw - 24, "Absences")
    _item(d, sx + 12, fy + 276, sw - 24, "Planning")
    txt(d, (sx + 20, fy + 318), "PERSONNES", F(700, 7.5), "#B9A88E")
    _item(d, sx + 12, fy + 332, sw - 24, "Employés")
    _item(d, sx + 12, fy + 366, sw - 24, "Paie")
    _item(d, sx + 12, fy + 400, sw - 24, "Réglages")
    # pastilles de groupe (les 5 teintes de la palette)
    for k, c in enumerate([TER, "#C08A49", "#8A5A14", "#3F6B4C", "#9B2C2C"]):
        px = sx + 14 + k * 22
        d.ellipse([px * S, (fy + 452) * S, (px + 9) * S, (fy + 461) * S], fill=c, outline=SAB, width=1)
    txt(d, (sx + 14, fy + 470), "5 teintes, jamais un hex libre", F(400, 8), "#B9A88E")
    # pied de barre
    d.line([(sx + 12) * S, (fy + fh - 84) * S, (sx + sw - 12) * S, (fy + fh - 84) * S], fill="#4A3120", width=1)
    d.ellipse([(sx + 14) * S, (fy + fh - 68) * S, (sx + 44) * S, (fy + fh - 38) * S], fill=SAB)
    txt(d, (sx + 29, fy + fh - 60), "AD", F(700, 9), ESP, anchor="mt")
    txt(d, (sx + 54, fy + fh - 64), "Akossiwa Dossou", F(600, 9.5), SAB)
    txt(d, (sx + 54, fy + fh - 50), "Administratrice", F(400, 8), "#B9A88E")
    _btn25(d, sx + sw - 52, fy + fh - 68, 32, 30, "", "contour")
    cxs, cys = sx + sw - 36, fy + fh - 53
    d.ellipse([(cxs - 4) * S, (cys - 4) * S, (cxs + 4) * S, (cys + 4) * S], outline=ESP, width=2)
    for k in range(8):
        import math
        a = k * math.pi / 4
        d.line([(cxs + 6.5 * math.cos(a)) * S, (cys + 6.5 * math.sin(a)) * S,
                (cxs + 9.5 * math.cos(a)) * S, (cys + 9.5 * math.sin(a)) * S], fill=ESP, width=2)

    # zone principale
    mx = sx + sw
    mw = fw - sw
    bande_motif(img, (mx, fy, mx + mw, fy + 76), hauteur=76, fichier="motif-bogolan.webp")
    d = ImageDraw.Draw(img)
    cx = mx + 28
    txt(d, (cx, fy + 96), "Bonjour Akossiwa", F(700, 20), ESP)
    txt(d, (cx, fy + 126), "Vendredi 18 novembre 2026 · 42 employés · 3 choses à traiter", F(400, 11), ESP)
    tw = mw - 56
    ty = fy + 152
    _tuile25(d, cx, ty, 520, 100, "38/42", "présents aujourd'hui", "repere")
    _tuile25(d, cx + 536, ty, (tw - 552) / 2, 100, "4", "retards du jour")
    _tuile25(d, cx + 536 + (tw - 552) / 2 + 16, ty, (tw - 552) / 2, 100, "2", "absences à valider")

    # mini tableau des retards
    ly2 = fy + 276
    txt(d, (cx, ly2), "LES RETARDS DU JOUR", F(700, 9), mot)
    th = ly2 + 16
    cols = [("EMPLOYÉ", 0), ("ARRIVÉE", 250), ("RETARD", 330)]
    d.rectangle([cx * S, th * S, (cx + 640) * S, (th + 28) * S], fill=S2)
    rr(d, (cx, th, cx + 640, th + 28), 4, fill=None, outline=ESP, width=2)
    for lab, dx in cols:
        txt(d, (cx + dx + 10, th + 8), lab, F(700, 7.5), ESP)
    lignes = [("Boubacar Sow", "08:42", "42 min"), ("Ismaël Traoré", "08:17", "17 min"),
              ("Fatou Bakary", "08:11", "11 min"), ("Dossou Hounkpatin", "08:04", "4 min")]
    for k, (nom, arr, ret) in enumerate(lignes):
        ry = th + 32 + k * 32
        txt(d, (cx + 10, ry + 10), nom, F(400, 9.5), ESP)
        txt(d, (cx + 250, ry + 10), arr, F(400, 9.5), ESP)
        _badge25(d, cx + 336, ry + 5, ret.upper(), "pilule")
        txt(d, (cx + 630, ry + 10), "Voir", F(500, 9), "#7E4A26", anchor="rt")
        d.line([(cx + 1) * S, (ry + 30) * S, (cx + 639) * S, (ry + 30) * S], fill="#CBB69A", width=1)
    d.rectangle([cx * S, th * S, (cx + 640) * S, (th + 160) * S], fill=None, outline=ESP, width=2)

    # échéances
    ex = cx + 664
    txt(d, (ex, ly2), "À TRAITER CETTE SEMAINE", F(700, 9), mot)
    _ombre(d, ex, ly2 + 16, mw - 56 - 664, 132, 8)
    rr(d, (ex, ly2 + 16, ex + mw - 56 - 664, ly2 + 148), 8, fill=CAR, outline=ESP, width=2)
    for k, (t, s2) in enumerate([("Paie de novembre", "à valider avant vendredi"),
                                 ("2 justificatifs manquants", "Boubacar Sow"),
                                 ("Contrat à renouveler", "Estelle Adjovi · 30 nov.")]):
        ty2 = ly2 + 30 + k * 40
        txt(d, (ex + 14, ty2), t, F(600, 9.5), ESP)
        txt(d, (ex + 14, ty2 + 14), s2, F(400, 8.5), "#4A4038")
        if k < 2:
            d.line([(ex + 14) * S, (ty2 + 34) * S, (ex + mw - 70) * S, (ty2 + 34) * S], fill="#D8C6AC", width=1)

    # présence des 7 derniers jours
    gy = fy + 492
    _ombre(d, cx, gy, 640, 300, 8)
    rr(d, (cx, gy, cx + 640, gy + 300), 8, fill=CAR, outline=ESP, width=2)
    caps(d, (cx + 16, gy + 14), "PRÉSENCE DES 7 DERNIERS JOURS", F(700, 8), ESP, tracking=1.2)
    txt(d, (cx + 16, gy + 32), "38 sur 42 en moyenne", F(400, 9.5), "#4A4038")
    vals = [36, 40, 41, 31, 39, 42, 33]
    jours = ["L", "M", "M", "J", "V", "S", "D"]
    base = gy + 230
    bw2 = 56
    for k, v in enumerate(vals):
        bx = cx + 40 + k * 84
        hh = v / 42 * 150
        rr(d, (bx + 3, base - hh + 3, bx + bw2 + 3, base + 3), 4, fill=TER)
        rr(d, (bx, base - hh, bx + bw2, base), 4, fill=SAB, outline=ESP, width=2)
        txt(d, (bx + bw2 / 2, base - hh + 8), str(v), F(700, 9), ESP, anchor="mt")
        txt(d, (bx + bw2 / 2, base + 10), jours[k], F(500, 8.5), "#4A4038", anchor="mt")
    d.line([(cx + 20) * S, base * S, (cx + 620) * S, base * S], fill=ESP, width=2)

    # absences à valider
    ax2 = cx + 664
    aw2 = mw - 56 - 664
    _ombre(d, ax2, gy, aw2, 300, 8)
    rr(d, (ax2, gy, ax2 + aw2, gy + 300), 8, fill=CAR, outline=ESP, width=2)
    caps(d, (ax2 + 16, gy + 14), "ABSENCES À VALIDER", F(700, 8), ESP, tracking=1.2)
    abs_ = [("Chantal Kponou", "congé payé · 3 jours", "EN ATTENTE"),
            ("Gildas Zinsou", "maladie · 1 jour", "EN ATTENTE"),
            ("Hortense Dangbénon", "congé payé · 5 jours", "VALIDÉE")]
    for k, (nom, motif, st) in enumerate(abs_):
        ry = gy + 44 + k * 62
        txt(d, (ax2 + 16, ry), nom, F(600, 9.5), ESP)
        txt(d, (ax2 + 16, ry + 15), motif, F(400, 8.5), "#4A4038")
        _badge25(d, ax2 + 16, ry + 32, st, "pilule" if st == "EN ATTENTE" else "tampon")
        if k < 2:
            d.line([(ax2 + 16) * S, (ry + 56) * S, (ax2 + aw2 - 16) * S, (ry + 56) * S], fill="#D8C6AC", width=1)
    txt(d, (ax2 + 16, gy + 262), "5 autres demandes en attente", F(400, 8.5), "#7E4A26")
    txt(d, (ax2 + aw2 - 16, gy + 262), "Tout voir", F(600, 8.5), "#7E4A26", anchor="rt")

    # ── annotations
    ay = 1030
    colw = (W - 2 * M - 3 * 18) / 4
    blocs = [
        ("CE QUI ÉTAIT DÉJÀ JUSTE", "#1E5B36", [
            "La barre est espresso depuis le début, avec un motif de fils tissés.",
            "252 px, fixe, jamais recouverte : la bonne décision, gardée telle quelle.",
            "Un mode « Personnaliser » existe déjà : on réordonne, on renomme, on colorie les groupes.",
            "Rien de tout cela n'est à jeter."]),
        ("CE QUI CHANGE", "#8A6A3A", [
            "Les 5 teintes passent de #C1743C / #D8A13C / #7C8A46… aux couleurs de la palette B : terracotta, ocre, alerte, succès, erreur.",
            "L'item actif n'est plus un dégradé : c'est un bloc ivoire, texte espresso, ombre terracotta décalée de 3 px.",
            "Le kente apparaît en bandeau de 28 px sous le logo — le seul endroit du produit où le fond est espresso (D-004 bis)."]),
        ("LE DÉFAUT MESURÉ", "#8C2020", [
            "Aujourd'hui, le texte ivoire sur les teintes de groupe donne :",
            "ambre 1,92 · cuivre 3,00 · olive 3,13 · ardoise 3,42 · terre 5,15.",
            "Quatre sur cinq sont sous 4,5:1. Choisir « ambre » dans Personnaliser rend le libellé de la page à peu près illisible.",
            "Après : le texte ne se pose jamais sur une teinte de groupe. Les pastilles font 6 px, avec un liseré ivoire."]),
        ("CE QUE ÇA COÛTE", "#7A5A14", [
            "25 occurrences de l'ancien cuivre à remplacer dans le dépôt.",
            "Aucune ligne de structure à réécrire : la barre garde ses groupes, son ordre, son mode Personnaliser.",
            "Le kente est déjà dessiné (planche 08) : on le pose, on ne le recrée pas."]),
    ]
    for i, (titre, coul, lignes) in enumerate(blocs):
        x = M + i * (colw + 18)
        d.rectangle([x * S, ay * S, (x + 3) * S, (ay + 14) * S], fill=coul)
        txt(d, (x + 10, ay + 1), titre, F(700, 9), encre)
        y2 = ay + 22
        for l in lignes:
            mots, courant = [], ""
            for m2 in l.split():
                essai = (courant + " " + m2).strip()
                if d.textlength(essai, font=F(400, 8.8)) / S > colw - 6:
                    mots.append(courant); courant = m2
                else:
                    courant = essai
            mots.append(courant)
            for mm in mots:
                txt(d, (x, y2), mm, F(400, 8.8), "#3A342C")
                y2 += 12
            y2 += 4

    # pied
    yp = 1160
    rr(d, (M, yp, W - M, yp + 56), 8, fill="#FBF7F0", outline="#EFE6D8", width=1)
    txt(d, (M + 18, yp + 10), "D-018 (proposée) — La barre reste espresso, reçoit le kente sous le logo, et son item actif devient un bloc ivoire. Le mode Personnaliser garde le réordonnancement, perd le choix libre de couleur.",
        F(500, 10), "#3B342C")
    txt(d, (M + 18, yp + 28), "Ce n'est pas une nouvelle identité : c'est la même, remise dans sa palette. La barre était en avance sur le reste du produit — elle n'avait pas les bonnes couleurs.",
        F(400, 9.5), "#6B4A32")

    sortie = img.resize((W, H), Image.LANCZOS)
    chemin = os.path.join(HERE, "26-dashboard-sidebar.png")
    sortie.save(chemin, optimize=True)
    print("écrit", chemin)


# ───────────────────────────────────────── planche 27 : la modale
def _voile(img, box, alpha=112):
    x0, y0, x1, y1 = [int(v * S) for v in box]
    masque = Image.new("L", (x1 - x0, y1 - y0), alpha)
    img.paste(Image.new("RGB", (x1 - x0, y1 - y0), ESP), (x0, y0), masque)


def _fond_page(d, x, y, w, h):
    d.rectangle([x * S, y * S, (x + w) * S, (y + h) * S], fill=SAB)
    txt(d, (x + 16, y + 5), "Paie de novembre 2026", F(700, 11), ESP)
    for k in range(3):
        rr(d, (x + 16, y + 40 + k * 26, x + w - 16, y + 60 + k * 26), 6, fill=CAR, outline="#CBB69A", width=1)
    for k in range(6):
        d.line([(x + 16) * S, (y + 40 + k * 26 + 20) * S, (x + w - 16) * S, (y + 40 + k * 26 + 20) * S],
               fill="#CBB69A", width=1)


def _modale(d, x, y, w, titre, corps, boutons, h=None):
    h = h or 196
    _ombre(d, x, y, w, h, 8, 6, 6)
    rr(d, (x, y, x + w, y + h), 8, fill=CAR, outline=ESP, width=2)
    txt(d, (x + 18, y + 16), titre, F(700, 12), ESP)
    if corps:
        txt(d, (x + 18, y + 34), corps, F(400, 9), "#4A4038")
    for k in range(len(boutons)):
        bw3 = 120
        bx = x + w - 18 - bw3 - k * 128
        genre = boutons[len(boutons) - 1 - k]
        if genre == "pleine":
            _ombre(d, bx, y + h - 46, bw3, 30, 6, 2, 2)
            rr(d, (bx, y + h - 46, bx + bw3, y + h - 16), 6, fill=TER, outline=ESP, width=2)
            caps(d, (bx + 12, y + h - 36), boutons[-1 - k].split("|")[0] if "|" in boutons[-1 - k] else "", F(700, 8.5), CAR, tracking=1.2)
        elif genre == "inverse":
            _ombre(d, bx, y + h - 46, bw3, 30, 6, 2, 2, coul=TER)
            rr(d, (bx, y + h - 46, bx + bw3, y + h - 16), 6, fill=ESP, outline=ESP, width=2)
        else:
            _ombre(d, bx, y + h - 46, bw3, 30, 6, 2, 2)
            rr(d, (bx, y + h - 46, bx + bw3, y + h - 16), 6, fill=CAR, outline=ESP, width=2)
    d.line([(x + 2) * S, (y + h - 56) * S, (x + w - 2) * S, (y + h - 56) * S], fill=ESP, width=2)


def figure27():
    H = 980
    img = canevas(H)
    d = ImageDraw.Draw(img)
    M = 64
    encre, douce, mot = "#14100C", "#6B6259", "#8A6A3A"
    caps(d, (M, 38), "EN-CHECK  ·  PLANCHES DE DÉCISION  ·  LA MODALE", F(600, 10.5), mot)
    txt(d, (M, 60), "La modale — le dernier objet, et celui qu'on voit le plus", F(700, 27), encre)
    txt(d, (M, 98), "Une modale n'est pas un écran : c'est une carte posée sur une page qu'on met de côté. Trois cas réels, la même règle — deux boutons au plus,",
        F(400, 13), douce)
    txt(d, (M, 116), "une action principale, un seul moyen de sortir. Elle n'invente aucune forme : elle assemble la carte, les champs, le message et les boutons.", F(400, 13), douce)

    colw = (W - 2 * M - 2 * 20) / 3
    y0 = 146
    cas = [("CAS 1 · CRÉER", "un formulaire — 560 px"),
           ("CAS 2 · VALIDER", "une décision — 420 px"),
           ("CAS 3 · ENGAGER", "l'irréversible — 420 px")]
    for i, (titre, sous) in enumerate(cas):
        x = M + i * (colw + 20)
        txt(d, (x, y0), titre, F(700, 9), mot)
        txt(d, (x, y0 + 14), sous, F(400, 9), "#5C5248")
        px, py, pw2, ph2 = x, y0 + 30, colw, 232
        _fond_page(d, px, py, pw2, ph2)
        _voile(img, (px, py, px + pw2, py + ph2))
        d = ImageDraw.Draw(img)
        mw = colw - 52
        mx = px + 26

        if i == 0:
            my, mh = py + 20, 200
            _ombre(d, mx, my, mw, mh, 8, 6, 6)
            rr(d, (mx, my, mx + mw, my + mh), 8, fill=CAR, outline=ESP, width=2)
            txt(d, (mx + 18, my + 14), "Nouvel employé", F(700, 12), ESP)
            txt(d, (mx + 18, my + 32), "Il recevra une invitation à créer son mot de passe.", F(400, 8.5), "#4A4038")
            for k, (lab, val) in enumerate([("NOM ET PRÉNOM", "Chantal Kponou"), ("POSTE", "Comptable")]):
                caps(d, (mx + 18, my + 52 + k * 48), lab, F(600, 7), "#5C5248", tracking=1.2)
                rr(d, (mx + 18, my + 64 + k * 48, mx + mw - 18, my + 94 + k * 48), 6, fill=CAR, outline=ESP, width=2)
                txt(d, (mx + 28, my + 74 + k * 48), val, F(500, 9), ESP)
            d.line([(mx + 2) * S, (my + mh - 48) * S, (mx + mw - 2) * S, (my + mh - 48) * S], fill=ESP, width=2)
            _btn25(d, mx + 18, my + mh - 39, 108, 28, "ANNULER", "contour")
            _btn25(d, mx + mw - 126, my + mh - 39, 108, 28, "CRÉER", "pleine")
        elif i == 1:
            my, mh = py + 40, 176
            _ombre(d, mx, my, mw, mh, 8, 6, 6)
            rr(d, (mx, my, mx + mw, my + mh), 8, fill=CAR, outline=ESP, width=2)
            txt(d, (mx + 18, my + 14), "Valider cette absence ?", F(700, 12), ESP)
            txt(d, (mx + 18, my + 32), "Chantal Kponou · congé payé · 3 jours", F(400, 8.5), "#4A4038")
            rr(d, (mx + 18, my + 50, mx + mw - 18, my + 96), 8, fill="#F7EDDF", outline=ESP, width=2)
            caps(d, (mx + 28, my + 58), "DU 18 AU 20 NOVEMBRE", F(700, 7), "#8A5A14", tracking=1.2)
            txt(d, (mx + 28, my + 72), "Solde de congés après validation : 12 jours.", F(400, 8.5), ESP)
            d.line([(mx + 2) * S, (my + mh - 48) * S, (mx + mw - 2) * S, (my + mh - 48) * S], fill=ESP, width=2)
            _btn25(d, mx + 18, my + mh - 39, 108, 28, "REFUSER", "contour")
            _btn25(d, mx + mw - 126, my + mh - 39, 108, 28, "VALIDER", "pleine")
        else:
            my, mh = py + 34, 190
            _ombre(d, mx, my, mw, mh, 8, 6, 6)
            rr(d, (mx, my, mx + mw, my + mh), 8, fill=CAR, outline=ESP, width=2)
            txt(d, (mx + 18, my + 14), "Clôturer la paie ?", F(700, 12), ESP)
            for k, l in enumerate(["38 bulletins seront figés et envoyés.",
                                   "Les montants ne pourront plus changer.",
                                   "Une correction exigera un nouveau bulletin."]):
                txt(d, (mx + 18, my + 38 + k * 17), "· " + l, F(400, 8.5), ESP)
            txt(d, (mx + 18, my + 96), "Cette action est irréversible.", F(700, 8.5), "#8C2020")
            d.line([(mx + 2) * S, (my + mh - 48) * S, (mx + mw - 2) * S, (my + mh - 48) * S], fill=ESP, width=2)
            _btn25(d, mx + 18, my + mh - 39, 108, 28, "REVENIR", "contour")
            _ombre(d, mx + mw - 126, my + mh - 39, 108, 28, 6, 2, 2, coul=TER)
            rr(d, (mx + mw - 126, my + mh - 39, mx + mw - 18, my + mh - 11), 6, fill=ESP, outline=ESP, width=2)
            caps(d, (mx + mw - 112, my + mh - 30), "CLÔTURER", F(700, 8.5), "#E8CFA8", tracking=1.2)

    # ── les règles
    yy = 424
    txt(d, (M, yy), "LA RÈGLE, EN TROIS PHRASES", F(700, 9.5), mot)
    blocs = [
        ("CE QU'ELLE EST", "#1E5B36", [
            "Une carte : rayon 8, contour 2 px espresso, ombre dure de 6 px.",
            "Trois largeurs seulement — 420 (décider), 560 (saisir), 760 (consulter).",
            "Le titre est l'action : « Valider cette absence ? », jamais « Absence ».",
            "Deux boutons au plus, une seule action pleine. Un seul moyen de sortir : la croix, Échap ou Annuler — les trois mènent au même endroit.",
        ]),
        ("CE QU'ELLE N'EST PAS", "#8C2020", [
            "Une page déguisée : au-delà de 8 champs, c'est une page, pas une modale.",
            "Trois boutons pleins — donc aucune action principale, donc un utilisateur qui choisit au hasard.",
            "Une modale ouverte depuis une modale. Si ça arrive, la première était une page.",
            "Un « OK ». Le bouton dit ce qu'il fait : « Créer », « Valider », « Clôturer ».",
        ]),
        ("LES MESURES", "#7A5A14", [
            "Voile : espresso à 44 % — la page reste lisible, mais on comprend qu'elle attend.",
            "En-tête et pied séparés par un filet de 2 px, jamais par une ombre.",
            "Boutons de 28 px dans la modale, 36 px dans la page : la hiérarchie continue.",
            "Fermeture au clavier obligatoire : Échap ferme, la tabulation ne sort pas de la carte.",
        ]),
    ]
    for i, (titre, coul, lignes) in enumerate(blocs):
        x = M + i * (colw + 20)
        d.rectangle([x * S, (yy + 26) * S, (x + 3) * S, (yy + 40) * S], fill=coul)
        txt(d, (x + 10, yy + 26), titre, F(700, 9), encre)
        y2 = yy + 48
        for l in lignes:
            courant = ""
            for m2 in l.split():
                essai = (courant + " " + m2).strip()
                if d.textlength(essai, font=F(400, 8.8)) / S > colw - 10:
                    txt(d, (x, y2), courant, F(400, 8.8), "#3A342C"); y2 += 12; courant = m2
                else:
                    courant = essai
            txt(d, (x, y2), courant, F(400, 8.8), "#3A342C"); y2 += 15
        y2 += 3

    # ── téléphone + largeurs
    yb = 612
    txt(d, (M, yb - 22), "SUR TÉLÉPHONE", F(700, 9.5), mot)
    phx, phy, phw, phh = M, yb, 150, 250
    rr(d, (phx, phy, phx + phw, phy + phh), 16, fill=ESP, outline=ESP, width=2)
    rr(d, (phx + 5, phy + 10, phx + phw - 5, phy + phh - 10), 12, fill="#5C4630")
    _fond_page(d, phx + 8, phy + 14, phw - 16, phh - 28)
    d.rectangle([(phx + 8) * S, (phy + 14) * S, (phx + phw - 8) * S, (phy + 40) * S], fill=SAB)
    txt(d, (phx + 16, phy + 18), "Paie", F(700, 9), ESP)
    _voile(img, (phx + 8, phy + 14, phx + phw - 8, phy + phh - 14), 150)
    d = ImageDraw.Draw(img)
    # feuille plein écran
    rr(d, (phx + 12, phy + 60, phx + phw - 12, phy + phh - 18), 8, fill=CAR, outline=ESP, width=2)
    txt(d, (phx + 22, phy + 70), "Valider ?", F(700, 10), ESP)
    txt(d, (phx + 22, phy + 86), "Chantal Kponou", F(400, 8), "#4A4038")
    txt(d, (phx + 22, phy + 98), "congé payé · 3 jours", F(400, 8), "#4A4038")
    _btn25(d, phx + 22, phy + 140, phw - 44, 26, "VALIDER", "pleine")
    _btn25(d, phx + 22, phy + 174, phw - 44, 26, "REFUSER", "contour")
    txt(d, (phx + 22, phy + 214), "Feuille plein écran", F(400, 7.5), "#5C5248")

    nx = M + 178
    for k, l in enumerate(["Sous 640 px de fenêtre, la carte devient",
                           "une feuille : elle prend toute la largeur,",
                           "les boutons s'empilent, l'action principale",
                           "reste en haut. Aucune règle ne change.",
                           "",
                           "Le pouce atteint le bas de l'écran : c'est",
                           "pourquoi l'action principale n'y est pas."]):
        txt(d, (nx, yb + 4 + k * 14), l, F(400, 8.8), "#3A342C" if l else "#3A342C")

    wx = M + 560
    txt(d, (wx, yb - 22), "TROIS LARGEURS, PAS UNE", F(700, 9.5), mot)
    for k, (lab, v, usage) in enumerate([("420", 147, "décider, confirmer"),
                                         ("560", 196, "saisir un formulaire"),
                                         ("760", 266, "consulter un tableau")]):
        by = yb + 6 + k * 44
        _ombre(d, wx, by, v, 26, 6, 3, 3)
        rr(d, (wx, by, wx + v, by + 26), 6, fill=CAR, outline=ESP, width=2)
        txt(d, (wx + 10, by + 7), lab + " px", F(700, 9), ESP)
        txt(d, (wx + v + 12, by + 7), usage, F(400, 8.5), "#5C5248")
    txt(d, (wx, yb + 146), "Une quatrième largeur serait une décision,", F(400, 8.8), "#8A6A3A")
    txt(d, (wx, yb + 160), "pas un ajustement au cas par cas.", F(400, 8.8), "#8A6A3A")

    # pied
    yp = 890
    rr(d, (M, yp, W - M, yp + 62), 8, fill="#FBF7F0", outline="#EFE6D8", width=1)
    txt(d, (M + 18, yp + 10), "D-020 (proposée) — La modale est une carte de 420, 560 ou 760 px, voile espresso 44 %, deux boutons au plus, fermeture clavier obligatoire.",
        F(500, 10), "#3B342C")
    txt(d, (M + 18, yp + 28), "Elle n'ajoute aucune forme au kit : elle assemble la carte, le champ, le message et le bouton. Le contrôle n° 8 est donc satisfait par construction.",
        F(400, 9.5), "#6B4A32")
    txt(d, (M + 18, yp + 44), "Reste à trancher : le cas 3 utilise un bouton inverse (espresso), pas un bouton danger (rouge). Le rouge est réservé à ce qui détruit — clôturer engage, ça ne détruit pas.",
        F(400, 9.5), "#8A6A3A")

    sortie = img.resize((W, H), Image.LANCZOS)
    chemin = os.path.join(HERE, "27-modale.png")
    sortie.save(chemin, optimize=True)
    print("écrit", chemin)


def figure28():
    H = 944
    img = canevas(H)
    d = ImageDraw.Draw(img)
    M = 64
    CW = W - 2 * M
    encre, douce, mot, hair = "#14100C", "#6B6259", "#8A6A3A", "#EFE6D8"
    vert, ambre, rouge = "#1E5B36", "#7A5A14", "#8C2020"

    def wrap(x, y, s, font, fill, largeur_max, interligne=12):
        courant = ""
        for m2 in s.split():
            essai = (courant + " " + m2).strip()
            if d.textlength(essai, font=font) / S > largeur_max:
                txt(d, (x, y), courant, font, fill)
                y += interligne
                courant = m2
            else:
                courant = essai
        if courant:
            txt(d, (x, y), courant, font, fill)
            y += interligne
        return y

    caps(d, (M, 38), "EN-CHECK  ·  PLANCHES DE DÉCISION  ·  LE MÉCANISME", F(600, 10.5), mot)
    txt(d, (M, 60), "Comment une page entre dans la charte", F(700, 27), encre)
    txt(d, (M, 98), "Plusieurs agents, chacun sur une page, sans se parler. Une charte ne se transmet pas par la lecture : elle se transmet par une porte qui refuse.",
        F(400, 13), douce)
    txt(d, (M, 116), "Trois pièces : un contrat de page (ce qu'il a le droit de faire), un vérificateur (ce qui mesure), une note (ce qui bloque une fusion).", F(400, 13), douce)

    # ── 1. le cycle
    y = 156
    caps(d, (M, y), "1  ·  LE CYCLE EN SIX TEMPS — UNE PAGE, UN AGENT, UNE BRANCHE", F(700, 9.5), mot)
    etapes = [
        ("1", "LIRE", "la fiche de page, les trois planches qui la concernent, les jetons. Rien d'autre.", None),
        ("2", "STRUCTURER", "bande, en-tête, corps, une seule action principale. Rien ne se code avant.", None),
        ("3", "HABILLER", "uniquement les dix-huit formes du kit et les jetons. Aucune couleur écrite.", None),
        ("4", "MESURER", "npm run charte : six contrôles rendent un verdict, sans discuter.", "PORTE 1"),
        ("5", "CAPTURER", "deux captures — clair et sombre, 1440 px — jointes à la demande.", "PORTE 2"),
        ("6", "DÉCLARER", "la fiche remplie : score, captures, écarts, ce qui a résisté.", "PORTE 3"),
    ]
    cw = (CW - 5 * 12) / 6
    for i, (num, titre, detail, porte) in enumerate(etapes):
        x = M + i * (cw + 12)
        rr(d, (x, y + 18, x + cw, y + 118), 8, fill="#FBF7F0", outline=hair, width=1)
        txt(d, (x + 12, y + 28), num, F(700, 22), TER)
        txt(d, (x + 40, y + 36), titre, F(700, 10), encre)
        wrap(x + 12, y + 60, detail, F(400, 8.6), "#3A342C", cw - 24, 11)
        if porte:
            rr(d, (x + 12, y + 96, x + cw - 12, y + 112), 4, fill="#F3E9DA")
            caps(d, (x + 20, y + 101), porte, F(700, 7.5), "#7E4A26", tracking=1.1)

    # ── 2. les trois portes
    y = 302
    caps(d, (M, y), "2  ·  LES TROIS PORTES — CE QUI BLOQUE UNE FUSION", F(700, 9.5), mot)
    portes = [
        ("PORTE 1  ·  LE SCRIPT", vert, "C1  C2  C6  C8  C9  C10", [
            ("Qui", "personne. La CI, à chaque envoi."),
            ("Refuse", "une couleur en dur, un contraste sous 4,5:1, une police tierce, une ombre floue, un rayon hors liste, une forme hors kit."),
            ("Coût", "trente secondes. C'est la moins chère des trois."),
            ("Ne voit pas", "la page rendue. Une bande de motif étirée lui échappe complètement."),
        ]),
        ("PORTE 2  ·  LA CAPTURE", ambre, "V1  V2  V3  V4  V5  +  C3  C4  C5  C7", [
            ("Qui", "l'agent lead, ou toi. Sur la demande de fusion."),
            ("Refuse", "une page sans les deux captures ; une page qui ne se reconnaît pas ; deux actions de même poids ; un statut dit par la couleur seule."),
            ("Coût", "deux minutes par page."),
            ("Ne voit pas", "la justesse du chiffre. Elle juge la forme, pas le métier."),
        ]),
        ("PORTE 3  ·  L'HUMAIN", "#2A1708", "le jugement", [
            ("Qui", "toi — mais par lots de cinq pages, jamais page par page."),
            ("Refuse", "les inventions, et tout écart à une décision entérinée."),
            ("Tranche", "un écart récurrent devient une décision numérotée, une fois pour toutes."),
            ("Ne voit pas", "tout. C'est précisément pourquoi les deux premières existent."),
        ]),
    ]
    pw = (CW - 2 * 20) / 3
    for i, (titre, coul, contrôles, lignes) in enumerate(portes):
        x = M + i * (pw + 20)
        d.rectangle([x * S, (y + 22) * S, (x + 3) * S, (y + 36) * S], fill=coul)
        txt(d, (x + 10, y + 22), titre, F(700, 9.5), encre)
        txt(d, (x + 10, y + 40), contrôles, F(600, 8.4), coul)
        yy = y + 58
        for lab, val in lignes:
            txt(d, (x + 10, yy), lab.upper(), F(700, 7.2), "#8A8078")
            yy = wrap(x + 10, yy + 11, val, F(400, 8.6), "#3A342C", pw - 24, 11) + 4

    # ── 3. la note
    y = 512
    caps(d, (M, y), "3  ·  LA NOTE — CENT POINTS, MAIS SIX VETOS", F(700, 9.5), mot)
    txt(d, (M, y + 24), "Un veto n'est pas compensable par un bon score. Une page peut valoir 90 et ne pas fusionner.", F(400, 9.4), douce)

    bx, by = M, y + 52
    txt(d, (bx, by), "CONTRÔLES AUTOMATIQUES — 60 POINTS", F(700, 8), "#7E4A26")
    cell, gap = 44, 6
    for k, lab in enumerate(["C1", "C2", "C6", "C8", "C9", "C10"]):
        cx = bx + k * (cell + gap)
        rr(d, (cx, by + 16, cx + cell, by + 46), 6, fill=TER, outline=ESP, width=2)
        caps(d, (cx + cell / 2, by + 26), lab, F(700, 10), CAR, tracking=0.2)
    yy = wrap(bx, by + 54, "10 points chacun — et un veto : si l'un tombe, la page ne fusionne pas, quel que soit le reste.",
              F(400, 8.8), "#3A342C", 640, 12)
    txt(d, (bx, yy), "C8 le jour où le kit sera écrit ; les autres, dès aujourd'hui.", F(400, 8.8), mot)

    by2 = by + 100
    txt(d, (bx, by2), "CRITÈRES VISUELS — 40 POINTS", F(700, 8), "#5C4630")
    for k, lab in enumerate(["V1", "V2", "V3", "V4", "V5"]):
        cx = bx + k * (cell + gap)
        rr(d, (cx, by2 + 16, cx + cell, by2 + 46), 6, fill=ESP, outline=ESP, width=2)
        caps(d, (cx + cell / 2, by2 + 26), lab, F(700, 10), "#E8CFA8", tracking=0.2)
    wrap(bx, by2 + 54, "8 points chacun — notés 0 ou 8, jamais un demi. Le doute vaut 0. Ils se lisent sur la capture, pas dans le code.",
         F(400, 8.8), "#3A342C", 640, 12)

    # seuil
    sy = by2 + 100
    txt(d, (bx, sy + 2), "SEUIL DE FUSION", F(700, 8), mot)
    tw = 320
    rr(d, (bx + 118, sy, bx + 118 + tw, sy + 14), 7, fill=S2)
    rr(d, (bx + 118, sy, bx + 118 + tw * 0.85, sy + 14), 7, fill=TER)
    d.rectangle([(bx + 118 + tw * 0.85) * S, (sy - 4) * S, (bx + 120 + tw * 0.85) * S, (sy + 18) * S], fill=ESP)
    txt(d, (bx + 118 + tw * 0.85 + 8, sy - 2), "85", F(700, 10), ESP)
    txt(d, (bx, sy + 20), "au-dessous, la page retourne à l'agent avec les critères nommés — jamais « à revoir ».", F(400, 8.6), douce)

    # table des décisions
    tx = M + 700
    txt(d, (tx, y + 24), "CE QUE LA NOTE DÉCLENCHE", F(700, 8), mot)
    lignes = [("100", "fusion immédiate — la page devient la référence", vert),
              ("≥ 85", "fusion, écarts consignés dans la fiche", vert),
              ("60 – 84", "retour à l'agent, critères nommés", ambre),
              ("< 60", "le temps 2 est repris ; le code est jeté", rouge)]
    for k, (note, action, coul) in enumerate(lignes):
        ry = y + 44 + k * 30
        rr(d, (tx, ry, tx + 78, ry + 22), 6, fill=coul)
        txt(d, (tx + 39, ry + 11), note, F(700, 9), CAR, anchor="mm")
        txt(d, (tx + 90, ry + 7), action, F(400, 9), "#3A342C")
    txt(d, (tx, y + 176), "La note sert à suivre une progression, jamais à négocier.", F(400, 8.6), mot)

    # ── le contrat de page
    cy = 722
    caps(d, (tx, cy - 22), "LE CONTRAT DE PAGE — CE QUE REÇOIT CHAQUE AGENT", F(700, 8), mot)
    rr(d, (tx, cy, W - M, cy + 124), 8, fill="#FBF7F0", outline=hair, width=1)
    d.rectangle([(tx + 1) * S, (cy + 1) * S, (tx + 4) * S, (cy + 123) * S], fill=TER)
    txt(d, (tx + 18, cy + 12), "Pointages  ·  motif Adinkra  ·  tableau en grille  ·  25 lignes", F(700, 10), encre)
    wrap(tx + 18, cy + 32, "Autorisé : bouton pleine et contour · champ cadre · badge pilule et tampon · message bandeau · tuile chiffre + repère.",
         F(400, 8.8), "#3A342C", 700, 12)
    wrap(tx + 18, cy + 56, "Interdit : tuile bento · badge onglet · une couleur seule pour dire « en retard » · une modale de plus de 8 champs.",
         F(400, 8.8), "#3A342C", 700, 12)
    wrap(tx + 18, cy + 80, "Recette : la page tient 40 relevés et se lit sans couleur.", F(600, 8.8), "#7E4A26", 700, 12)
    txt(d, (tx + 18, cy + 100), "Une fiche = une page = une branche = un agent. Jamais deux agents sur la même page.", F(400, 8.8), mot)

    # ── pied
    yp = 860
    rr(d, (M, yp, W - M, yp + 64), 8, fill="#FBF7F0", outline=hair, width=1)
    txt(d, (M + 18, yp + 10), "Trois pièges, et une seule parade : l'agent styliste (rayon 12 devenu 14), l'agent prudent (l'ancien composant gardé), l'agent pressé (pas de capture).",
        F(500, 10), "#3B342C")
    txt(d, (M + 18, yp + 28), "Aucun des trois ne se corrige par la pédagogie. Un dessin n'est pas un test : le script voit le code, pas l'écran — d'où deux portes humaines.",
        F(400, 9.5), "#6B4A32")
    txt(d, (M + 18, yp + 44), "Ce mécanisme applique D-016, D-017 et D-019. Il ne décide rien : il empêche un agent qui ne connaît ni le produit ni le fondateur de s'écarter en silence.",
        F(400, 9.5), mot)

    sortie = img.resize((W, H), Image.LANCZOS)
    chemin = os.path.join(HERE, "28-mecanisme.png")
    sortie.save(chemin, optimize=True)
    print("écrit", chemin)


if __name__ == "__main__":
    quoi = sys.argv[1] if len(sys.argv) > 1 else "all"
    for nom, cle in [("figure%d" % i, str(i)) for i in range(1, 29)]:
        if quoi in (cle, "all"):
            globals()[nom]()
