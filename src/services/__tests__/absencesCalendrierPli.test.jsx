// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { styleBarreAbsence } from '../../constants/motifsAbsence'
import AbsencesCalendrier from '../../components/AbsencesCalendrier'

// ═══════════════════════════════════════════════════════════
// 📐 LE PLI PAR EMPLOYÉ — le contrat du corps du calendrier
//
// Maquette : `maquettes/absences-grille-2-pli.png`, désignée le 10/12 —
// « tu ne réussis pas à exactement faire comme la maquette. retravaille ça et
// utilise la 2e maquette comme modèle ». La corde (première maquette) est
// déposée avec son fichier de serrures : ce fichier-là verrouille le pli.
//
// Ce qu'il tient, dans l'ordre :
//
//   1. LE CHAMP EST UN PLATEAU : un cadre de trois, posé sur le sable de la
//      page, ombre dure. Les lignes se séparent par la règle, pas par le ton.
//   2. LA PLANCHE EST POSÉE SUR LE JOUR, elle ne pend pas : `left` à la
//      naissance de sa première cellule, `right` à la fin de sa dernière. Une
//      seule géométrie pour l'entête et la piste, un seul jeton de largeur.
//   3. LE JOUR COURANT EST LAVÉ ET PLONBÉ, les jours nu sont marqués d'un trait
//      de crayon au TIERS de cellule, le week-end est hachuré dans l'entête.
//   4. LE SOLDE EST PEINT À LA RIVE DROITE DU CHAMP, par-dessus la dernière
//      cellule — ce n'est plus une colonne, et l'entête ne réserve rien.
//   5. LE SECOND ÉTAGE : ce qui n'a rien à signaler se REPLIE en pastilles à
//      coin plié, avec le compte écrit en clair, et la case « Déplier tout ».
//   6. LE MÉTIER EST INTACT : `segmentSurJours` positionne en pourcentage,
//      `styleBarreAbsence` garde sa loi (le trait dit le statut), le dépôt vise
//      le jour sous le pointeur, le clic ouvre le tiroir.
//
// Les nombres ci-dessous sont ceux du dessin, relevés à la règle sur le fichier
// de 1376 × 768 (voir `docs/ABSENCES-ETAGERE.md`). Ils ne se recopient pas d'une
// mémoire : le dessin a déjà été réexporté deux fois, et chaque cote reprise de
// tête s'est trouvée fausse.
// ═══════════════════════════════════════════════════════════

const RACINE = path.resolve(import.meta.dirname, '../../..')
const lire = (...chemins) => fs.readFileSync(path.join(RACINE, ...chemins), 'utf8')

const COMPOSANT = lire('src', 'components', 'AbsencesCalendrier.jsx')
const FEUILLE = lire('src', 'pages', 'AbsencesAfroTech.css')
const CSS = FEUILLE.replace(/\/\*[\s\S]*?\*\//g, '')
// La rubrique du pli commence à ses jetons et court jusqu'à la fin de la
// feuille : elle en est la DERNIÈRE rubrique, et c'est la tringle qui est bornée
// (`absencesCalendrierTringle.test.jsx` s'arrête à `--abs-pli-pas`, avec son
// propre `throw`). Le 6/12, une section ajoutée en fin de fichier avait
// silencieusement élargi trois verrous de la tringle ; si le pli cesse d'être
// dernier, c'est ici qu'on pose la borne — pas en relâchant un verrou voisin.
const DÉBUT_PLI = CSS.search(/\.abs-cal\s*\{\s*--abs-pli-pas/)
if (DÉBUT_PLI === -1) throw new Error('rubrique du pli introuvable en fin de feuille')
const PLI = CSS.slice(DÉBUT_PLI)

const DESSIN = 'maquettes/absences-grille-2-pli.png'
const DOCUMENT = 'docs/ABSENCES-ETAGERE.md'

const nud = (c) => c.replace(/\s+/g, '')
const corps = (sélecteur) => {
  const i = PLI.indexOf(`${sélecteur} {`)
  if (i === -1) throw new Error(`règle absente de la rubrique du pli : ${sélecteur}`)
  const début = PLI.indexOf('{', i)
  return PLI.slice(début + 1, PLI.indexOf('}', début))
}

/** Un jeton de la rubrique, en nombre — la cote du dessin, pas une intention. */
function cote(nom) {
  const trou = PLI.split(`${nom}:`)[1]
  if (!trou) throw new Error(`jeton du pli absent : ${nom}`)
  return Number(trou.trim().split(';')[0].replace('px', ''))
}

/** La valeur brute d'un jeton (pour les valeurs qui ne sont pas des nombres). */
function valeur(nom) {
  const trou = PLI.split(`${nom}:`)[1]
  if (!trou) throw new Error(`jeton du pli absent : ${nom}`)
  return trou.trim().split(';')[0].trim()
}

const employes = [
  { id: 'e1', first_name: 'Aïssatou', last_name: 'Diallo', enterprise_id: 'ent-1' },
  { id: 'e2', first_name: 'Mamadou', last_name: 'Sarr', enterprise_id: 'ent-1' },
  { id: 'e3', first_name: 'Salimata', last_name: 'Cissé', enterprise_id: 'ent-2' },
  // la quatrième n'a RIEN à signaler sur la période : c'est elle qui fait le pli
  { id: 'e4', first_name: 'Nadia', last_name: 'Bamba', enterprise_id: 'ent-1' },
]

const absence = (id, employee_id, start_date, end_date, reason, extra = {}) => ({
  id,
  employee_id,
  enterprise_id: extra.enterprise_id || 'ent-1',
  start_date,
  end_date,
  reason,
  status: 'approuve',
  count_holidays_as_leave: false,
  created_at: '2026-10-01T08:00:00Z',
  ...extra,
})

const absences = [
  // trois jours pleins dans la fenêtre : la planche type du dessin
  absence('a1', 'e1', '2026-10-19', '2026-10-21', 'conge'),
  // une journée, en attente : le cerne pointillé et le mot écrit sous le trait
  absence('a2', 'e2', '2026-10-20', '2026-10-20', 'maladie', { status: 'en_attente' }),
  // refusée, deux jours
  absence('a3', 'e3', '2026-10-22', '2026-10-23', 'injustifie', { status: 'refuse' }),
  // chevauche a1 sur la même ligne : le rang se compte, la ligne grandit
  absence('a4', 'e1', '2026-10-20', '2026-10-22', 'formation'),
  // née avant la fenêtre : rive collée à deux pixels, pointe retirée
  absence('a5', 'e2', '2026-10-18', '2026-10-19', 'maladie'),
]

const fériés = new Set(['2026-10-20'])

const PROPS = {
  absences,
  employes,
  annee: 2026,
  mois: 9,
  mode: 'semaine',
  jourInitial: '2026-10-21',
  darkMode: true,
  getHolidaySet: (id) => (id === 'ent-2' ? fériés : new Set()),
  joursPrisParEmploye: { e1: 4 },
  plafondConges: 30,
}

function rendre(props = {}) {
  return renderToStaticMarkup(<AbsencesCalendrier {...PROPS} {...props} />)
}

// ── les trois rendus, cadrés sur la semaine du 19 au 25 octobre 2026 ──
//
// Le repère « aujourd'hui » du composant se lit sur l'horloge du navigateur :
// sans cadrage, ni le lavage de l'entête ni le plomb de la piste ne se rendent,
// et les deux verrous (10, 11) vérifieraient le vide. L'horloge est donc FIGÉE
// au mercredi 21 octobre 2026 avant tout rendu — c'est le jour que le dessin
// lave. Elle se relève tout de suite : un faux `Date` survivant à ce fichier
// fausserait les autres, qui ne s'attendent pas à être consultés.
vi.useFakeTimers()
vi.setSystemTime(new Date('2026-10-21T09:00:00'))
const grille = rendre()
const grilleMois = rendre({ mode: 'mois' })
const grilleJour = rendre({ mode: 'jour' })
vi.useRealTimers()

/**
 * Le bloc d'UNE ligne de la grille, de son ouverture à la suivante.
 *
 * L'ancre est `data-testid="abs-pli-ligne"`, pas `data-employe` seul : la pastille
 * du registre porte le MÊME `data-employe` (c'est elle qui dit qui se replie), et
 * une recherche au plus près partait de la puce pour atterrir en fin de feuille —
 * le verrou lisait alors le pied de page à la place de la piste.
 */
function ligneDe(html, employe) {
  const marqueur = `data-testid="abs-pli-ligne" data-employe="${employe}"`
  const début = html.indexOf(marqueur)
  if (début === -1) throw new Error(`aucune ligne rendue pour ${employe}`)
  const suite = html.indexOf('data-testid="abs-pli-ligne"', début + marqueur.length)
  return html.slice(début, suite === -1 ? html.length : suite)
}

/**
 * La piste d'UNE ligne : de son ouverture au solde. Ce tronçon-là, et pas la
 * ligne entière, parce que la jauge du solde est un `<i>` et que le verrou des
 * traits de jour n'a rien à y voir.
 */
function pisteDe(html, employe) {
  const ligne = ligneDe(html, employe)
  const début = ligne.indexOf('data-drop-lane=')
  const fin = ligne.indexOf('abs-pli-solde')
  return ligne.slice(début, fin)
}

/**
 * Le `style` de la planche d'une absence, retrouvé par son TITRE.
 *
 * Jamais par son rang dans le DOM : les planches suivent l'ordre des lignes puis
 * des segments, et quatre absences pour trois employés ne se rendent pas dans
 * l'ordre de leurs identifiants. Le titre, lui, est la phrase du dessin — il
 * nomme le jour de début et de fin.
 */
function styleDePlanche(html, titre) {
  const re = /title="([^"]*)"[^>]*data-testid="abs-cal-barre"[^>]*?style="([^"]*)"/g
  for (const m of html.matchAll(re)) {
    if (m[1].includes(titre)) return m[2].replace(/&quot;/g, '"')
  }
  throw new Error(`aucune planche dont le titre contienne « ${titre} »`)
}

describe('📐 le pli par employé', () => {
  it('0. la maquette du pli est dans le dépôt et nommée dans le composant', () => {
    expect(fs.existsSync(path.join(RACINE, DESSIN))).toBe(true)
    expect(COMPOSANT).toContain(DESSIN)
    // la corde est déposée, pas seulement doublée : la feuille ne la nomme plus
    expect(FEUILLE).not.toContain('absences-grille-1-corde.png')
  })

  it('1. la rubrique du pli est la dernière de la feuille', () => {
    // la tringle borne son terrain là-dessus : si une section est ajoutée après,
    // c'est ici qu'on déplace la borne, pas en relâchant un verrou voisin
    expect(PLI.length).toBeGreaterThan(2000)
    expect(CSS.slice(0, DÉBUT_PLI)).not.toContain('--abs-pli-pas')
    expect(CSS.slice(DÉBUT_PLI + 40).indexOf('.abs-cal {')).toBe(-1)
  })

  it('2. la corde est déposée : ni fil, ni anneau, ni carte suspendue', () => {
    for (const trace of ['abs-corde-planche', 'abs-corde-anneaux', 'abs-corde-fil', 'abs-corde-cordons', 'data-anneau']) {
      expect(COMPOSANT).not.toContain(trace)
      expect(PLI).not.toContain(trace)
    }
    // les trois jetons qui disaient « ça pend » ont disparu de la feuille
    for (const jeton of ['--abs-corde-descente', '--abs-corde-aile', '--abs-corde-fil-top']) {
      expect(FEUILLE).not.toContain(jeton)
    }
    // et le solde n'est plus une colonne réservée dans l'entête
    expect(COMPOSANT).not.toContain('abs-cal-entete-solde')
    expect(PLI).not.toContain('.abs-cal-entete-solde')
  })

  it('3. le champ est un plateau : cadre de trois, fond de sable, ombre dure', () => {
    const plateau = nud(corps('.abs-pli-plateau'))
    expect(plateau).toContain('border:var(--abs-pli-rule)solidvar(--charte-encre)')
    expect(plateau).toContain('background:var(--charte-sable)')
    expect(plateau).toContain('border-radius:var(--charte-rayon-champ)')
    expect(plateau).toContain('box-shadow:var(--abs-pli-ombre)var(--abs-pli-ombre)00var(--charte-bordure)')
    // le dessin grise le sable à (222, 200, 176) : c'est `--charte-bordure`, pas
    // un noir à l'aveugle, et le flou est à zéro (contrôle C9 de la charte)
    expect(plateau).not.toMatch(/blur|rgba\(/)
    // l'ombre doit avoir sa place : le conteneur coupe, sinon elle est rognée. Et
    // depuis le 11/12, la même loi protège L'ÉVENTAIL DES FEUILLES PLIÉES : le
    // souffle de gauche et le souffle du bas valent l'évasement des deux feuilles
    // (2 × 8 de décalage + 3 de règle = 22), relevés à x 42..45 et x 34..37 pour
    // un montant à 50..52.
    const champ = nud(corps('.abs-cal-champ'))
    expect(champ).toContain('padding-left:var(--abs-pli-évasement)')
    expect(champ).toContain('padding-bottom:var(--abs-pli-évasement)')
    expect(champ).toContain('padding-right:calc(var(--abs-pli-pli)+var(--abs-pli-ombre))')
    expect(cote('--abs-pli-pli')).toBe(8)
    // LE PLATEAU PREND LA LARGEUR DE SES JOURS, pas celle de l'écran : un plancher
    // écrit en JavaScript était une seconde naissance du nombre de jour.
    expect(champ).toContain('width:max-content')
    expect(champ).toContain('min-width:100%')
  })

  it('4. la ligne fait 78 et se sépare par la règle, pas par le ton', () => {
    expect(cote('--abs-pli-pas')).toBe(78) // règles à y 200, 278, 356, 434, 512
    expect(cote('--abs-pli-rule')).toBe(3)
    const ligne = nud(corps('.abs-pli-ligne'))
    expect(ligne).toContain('border-bottom:var(--abs-pli-rule)solidvar(--charte-encre)')
    expect(ligne).toContain('min-height:calc(var(--abs-pli-pas)+(var(--abs-pli-rangs,1)-1)*var(--abs-pli-empilement))')
    // le dessin lit le même sable sur ses cinq lignes (233-234 mesurés) : il n'y
    // a plus d'alternance à écrire, et donc plus de `data-alterné` à entretenir
    expect(COMPOSANT).not.toContain('data-alterné')
    expect(PLI).not.toContain('data-alterné')
    // et rien ne déborde de la ligne : ni descente, ni débord réservé
    expect(PLI).not.toContain('--abs-pli-débord')
  })

  it('5. la planche est posée sur les BORDS de ses cellules', () => {
    // a1 : lundi 19 → mercredi 21 = index 0..2 d'une semaine de sept jours.
    // Le dessin pose l'encre à x 302 pour une cellule née à 305 (la pointe rend
    // au jour ce que le cerne lui prend) et finit sa planche à x 735 pour une
    // dernière cellule morte à 740. La corde accrochait ses cordons aux CENTRES
    // des jours de rive ; le pli pose sa planche sur les BORDS.
    const a1 = styleDePlanche(grille, 'du 19/10/2026 au 21/10/2026')
    expect(a1).toContain('--abs-pli-entree:calc(0% + var(--abs-pli-pointe));left:var(--abs-pli-entree)')
    expect(a1).toContain('right:calc(57.142857142857146% + var(--abs-pli-rive))')
    // a2 : une journée (index 1) — rive à x 752 pour une cellule finissant à 740
    const a2 = styleDePlanche(grille, 'du 20/10/2026 au 20/10/2026')
    expect(a2).toContain('--abs-pli-entree:calc(14.285714285714285% + var(--abs-pli-pointe))')
    expect(a2).toContain('right:calc(71.42857142857143% + var(--abs-pli-rive))')
    // a3 : 22 → 23 (index 3..4)
    expect(styleDePlanche(grille, 'du 22/10/2026 au 23/10/2026'))
      .toContain('--abs-pli-entree:calc(42.857142857142854% + var(--abs-pli-pointe))')
    // LE PLANCHER EST LE JOUR, PAS LE MOT (12/12). Le dessin donne 162 de corps à
    // une planche d'une journée posée sur une cellule de 145 — seize de pointe, huit
    // de rive — et son mot ne fait que 125 : il TIENT. Laissé en
    // `min-width: max-content`, c'était l'inverse exact : « la flèche déborde en
    // fonction de la longueur du texte », une journée d'« Absence injustifiée »
    // remplissait deux jours. Une planche est une MESURE DE PÉRIODE.
    const planche = nud(corps('.abs-pli-planche'))
    expect(planche).not.toContain('min-width:max-content')
    expect(planche).toContain('min-width:0')
    // et c'est le MOT qui s'écourte, jamais la durée : l'ellipsis est dans
    // `.abs-pli-motif`, le « · N j » et l'emoji se retiennent de se serrer
    expect(nud(corps('.abs-pli-motif'))).toContain('text-overflow:ellipsis')
    expect(nud(PLI)).toContain('.abs-pli-durée,.abs-pli-séparateur{flex-shrink:0}')
    // pas d'`overflow: hidden` sur la planche : sa pointe de ruban est un enfant
    // posé à `left: -16px`, hors de l'encre — le cadre la mangerait
    // la borne lit le MÊME nombre que le `left` : une `max-width` écrite d'après un
    // second calcul de la naissance serait la dérive du 25/11 rejouée. Elle rend
    // aussi à la plaquette du solde la largeur que le dessin lui donne à la rive du
    // champ : une planche qui glisse SOUS la plaquette perd sa rive droite dans le
    // sable, et « on ne voit plus où s'arrête la planche » (fondateur, 11/12).
    expect(planche).toContain(
      'max-width:min(fit-content,calc(100%-var(--abs-pli-entree)-var(--abs-pli-solde)-2px))'
    )
    expect(PLI).not.toContain('--abs-pli-aile')
    // en mode jour, la colonne unique EST le champ : les deux rives se collent,
    // et la naissance collée reste LE même nombre pour le `left` et la borne
    expect(grilleJour).toContain('--abs-pli-entree:2px;left:var(--abs-pli-entree);right:2px')
  })

  it('6. la pointe de ruban se pose à la naissance du jour, et s\'efface si la journée commence avant', () => {
    expect(cote('--abs-pli-pointe')).toBe(16) // x 302 → 318 pour une cellule à 305
    expect(cote('--abs-pli-rive')).toBe(8)
    const pointe = nud(corps('.abs-pli-planche::before'))
    expect(pointe).toContain('transform:translateY(-50%)rotate(45deg)')
    expect(pointe).toContain('z-index:-1')
    expect(pointe).toContain('left:calc(-1*var(--abs-pli-pointe)-var(--abs-pli-encre))')
    expect(pointe).toContain('border-left:var(--abs-pli-encre)solidvar(--charte-encre)')
    expect(pointe).toContain('border-bottom:var(--abs-pli-encre)solidvar(--charte-encre)')
    // le caret ‹ du dessin, crème dans la pointe, et rien d\'autre dedans
    expect(ligneDe(grille, 'e1')).toContain('class="abs-pli-glyphe"')
    // la planche née avant la fenêtre n\'a pas de naissance : ni pointe, ni caret
    expect(styleDePlanche(grille, 'du 18/10/2026 au 19/10/2026')).toContain('--abs-pli-entree:2px')
    expect(grille).toContain('data-coupée="vrai"')
    expect(grille).toContain('data-coupée="faux"')
    // `nud` des deux côtés : la feuille est nudée, ma comparaison doit l'être
    // aussi, sinon c'est l'espace d'un sélecteur descendant qui fait tomber le
    // verrou et non la règle qui a bougé.
    const coupe = ".abs-pli-planche[data-coupée='vrai']::before,.abs-pli-planche[data-coupée='vrai'] .abs-pli-glyphe{display:none}"
    expect(nud(PLI)).toContain(nud(coupe))
  })

  it('7. le cerclage, le rayon et le remplissage viennent du dessin', () => {
    expect(cote('--abs-pli-encre')).toBe(3) // les deux rives mesurées de 3
    expect(cote('--abs-pli-planche')).toBe(40) // y 220..259
    const planche = nud(corps('.abs-pli-planche'))
    expect(planche).toContain('height:var(--abs-pli-planche)')
    expect(planche).toContain('border-width:var(--abs-pli-encre)')
    expect(planche).toContain('border-radius:var(--charte-rayon-carte)')
    // le dessin remplit d\'argile (154, 95, 49 au cœur) : `--charte-aplat`, la
    // teinte unique de la maison — la couleur du motif ne se pose pas ici
    expect(planche).toContain('background:var(--charte-aplat)')
    expect(planche).toContain('color:var(--charte-blanc)')
    expect(planche).toContain('font-size:var(--charte-taille-titre)')
    // et l'étiquette se pose à douze après le cerne, seize avant la rive : le
    // dessin mesure 611 → 621 à gauche et 736 → 752 à droite, soit `espace-3` et
    // `espace-4` — ni le quatre de la corde, ni le seize des deux côtés
    expect(planche).toContain('padding:0var(--charte-espace-4)0var(--charte-espace-3)')
  })

  it('8. le trait dit le statut, et la loi reste dans le service', () => {
    // trois planches, trois traits : plein, pointillé, barré
    expect(grille).toContain('data-trait="plein"')
    expect(grille).toContain('data-trait="pointillé"')
    expect(grille).toContain('data-trait="barré"')
    expect(styleDePlanche(grille, 'du 20/10/2026 au 20/10/2026')).toContain('border-style:dashed')
    expect(styleDePlanche(grille, 'du 22/10/2026 au 23/10/2026')).toContain('text-decoration:line-through')
    // une planche non acquise se DÉREMPLIT (le dessin ne remplit pas sa refusée :
    // le lavage du jour passe au travers de son cerne)
    // la valeur relue est ÉCRITE, pas joker : `pointill.e` a failli passer pour
    // « pointillée » (le mot est « pointillé », sans e final) et le verrou se
    // taisait sur une feuille pourtant bonne. Un attribut d'état se recopie.
    const nu = nud(PLI).match(
      /\.abs-pli-planche\[data-trait='pointillé'\],\.abs-pli-planche\[data-trait='barré'\]\{([^}]*)\}/
    )
    if (!nu) throw new Error('la règle de déremplissage du trait est introuvable — les deux traits ne partent plus de la même règle')
    expect(nud(nu[1])).toContain('background:transparent')
    expect(nud(nu[1])).toContain('color:var(--charte-encre)')
    // la feuille ne connaît PAS les noms de statut : elle lit `data-trait`, posé
    // d\'après `styleBarreAbsence`. Écrire « en_attente » ici, ce serait
    // redémarrer la loi à partir de sa liste de mots.
    expect(PLI).not.toContain('en_attente')
    expect(PLI).not.toContain("='refuse'")
  })

  it('9. le mot du statut s\'écrit SOUS son trait, à sa rive droite', () => {
    const mot = nud(corps('.abs-pli-statut'))
    expect(mot).toContain('position:absolute')
    expect(mot).toContain('right:calc(var(--charte-espace-4)+var(--abs-pli-encre))')
    expect(mot).toContain('top:calc(100%+var(--charte-espace-1))')
    expect(mot).toContain('text-transform:uppercase')
    // le mot est MICRO et à `line-height: 1` : la ligne fait 78, la planche 40,
    // il reste dix-sept pixels sous le trait. Un corps de 14 avec son interligne
    // les franchissait et le mot touchait la règle du dessous — la cote du dessin
    // est une capitales de 13 (y 415..427), et 11 est la marche la plus proche.
    expect(mot).toContain('font-size:var(--charte-taille-micro)')
    expect(mot).toContain('line-height:1')
    // et il ne se pose JAMAIS à droite de la planche : hors du cerne, il sortait
    // du plateau pour les planches de fin de semaine
    expect(mot).not.toContain('left:')
    // le dessin écrit « REFUSÉE » à x 772..860 pour une planche finissant à 764,
    // sous son trait (y 415..427 pour un trait à 410) — un mot, pas une pastille
    expect(grille).toContain('>En attente</span>')
    // le mot refusé, on ne l'invente pas ici : on relit l'étiquette du service et
    // on exige qu'elle soit ÉCRITE dans la planche barrée. Une feuille muette ou
    // un test qui épellerait « Refusée » à la place de « Refusé » tombent pareil.
    const motRefus = styleBarreAbsence({ status: 'refuse', reason: 'injustifie' }).statut.label
    expect(motRefus).toMatch(/Refus/i)
    const plancheRefusée = ligneDe(grille, 'e3')
    expect(plancheRefusée).toContain(`<span class="abs-pli-statut">${motRefus}</span>`)
    expect(plancheRefusée).toContain('data-trait="barré"')
    // la rive qui touche le bord du champ retourne le mot SOUS la planche, sinon
    // `overflow-x` le couperait net
    // la règle de rive n'est pas relue, elle est ABSENTÉE : le mot est dans
    // l'empreinte de la planche, donc il n'a plus de raison de changer de côté
    expect(PLI).not.toContain("data-rive")
    // et le marqueur de rive est MORT avec la règle qui s'en servait : le mot
    // étant dans l'empreinte de la planche, il ne peut plus sortir du plateau.
    // Un attribut que plus personne ne lit est une promesse de plus.
    expect(grille).not.toContain('data-rive')
    expect(PLI).not.toContain('data-rive')
    // une planche qui finit au bord droit du champ garde SON retrait de huit : le
    // dessin fait exactement ça pour sa planche du 22 (dernière cellule morte à
    // x 740, encre à x 735). Le coller au montant à deux pixels, ce serait une
    // autre loi — elle n'existe plus, et rien ne la remplace.
    const grilleFin = rendre({ absences: [...absences, absence('a6', 'e3', '2026-10-24', '2026-10-25', 'conge')] })
    expect(styleDePlanche(grilleFin, 'du 24/10/2026 au 25/10/2026')).toContain('right:calc(0% + var(--abs-pli-rive))')
  })

  it('10. le jour courant est lavé d\'une cellule et plombe de trois', () => {
    expect(cote('--abs-pli-lavage')).toBe(1) // x 591..734 pour une cellule de 145
    expect(cote('--abs-pli-plomb')).toBe(3) // x 656..658
    expect(valeur('--abs-pli-opacité')).toBe('0.26') // (217,195,177) sur (243,232,212)
    const lavage = nud(corps('.abs-pli-lavage'))
    const plomb = nud(corps('.abs-pli-plomb'))
    expect(lavage).toContain('width:calc(var(--abs-pli-lavage)*100%/var(--abs-pli-nb-jours))')
    expect(lavage).toContain('max-width:100%') // le mode jour ne déborde pas du champ
    expect(plomb).toContain('width:var(--abs-pli-plomb)')
    expect(plomb).toContain('transform:translateX(-50%)')
    // un seul repère pour les deux, et le même que l\'entête : le plomb ne passe
    // plus à côté de sa colonne comme sous la corde
    const lefts = [...grille.matchAll(/class="abs-pli-(?:lavage|plomb)"[^>]*?style="left:([^"]+)"/g)].map((m) => m[1])
    // une piste par ligne montree (Nadia est repliée), deux spans par piste
    expect(lefts).toHaveLength(6)
    expect(new Set(lefts).size).toBe(1)
    // et le jour de ce left est bien le mercredi 21, jour que le dessin lave
    expect(lefts[0]).toBe(`${(2 + 0.5) * (100 / 7)}%`)
    // l'entête lit la MÊME loi : le rectangle de lavage descend jusqu'à la règle
    const ciel = nud(corps(".abs-cal-jour[data-aujourdhui='vrai']::before"))
    expect(ciel).toContain('top:var(--abs-pli-ciel)')
    expect(ciel).toContain('left:0;right:0;bottom:0')
    expect(ciel).toContain('opacity:var(--abs-pli-opacité)')
    expect(cote('--abs-pli-ciel')).toBe(27) // 76 − 49 mesurés
    // et sous les planches : le dessin ne laisse pas le plomb manger le label
    expect(plomb).not.toContain('z-index')
    expect(nud(corps('.abs-pli-planche'))).toContain('z-index:2')
  })

  it('11. les jours nus se marquent d\'un trait de crayon, au TIERS de cellule', () => {
    expect(cote('--abs-pli-trait')).toBe(2)
    expect(cote('--abs-pli-trait-hauteur')).toBe(22)
    expect(cote('--abs-pli-tiers')).toBe(3) // pas un : relevés à x 306, 354, 402, 450…
    const piste = nud(corps('.abs-pli-piste'))
    expect(piste).toContain('background-size:calc(100%/(var(--abs-pli-nb-jours)*var(--abs-pli-tiers)))var(--abs-pli-trait-hauteur)')
    expect(piste).toContain('background-position:0center')
    expect(piste).toContain('background-repeat:repeat-x')
    // le fond fait le travail : la piste ne rend PAS un élément par jour — c'est
    // la leçon du mois de trente et un jours, trente et un nœuds par ligne
    for (const e of ['e1', 'e2', 'e3']) {
      expect(pisteDe(grille, e), `la piste de ${e} rend des éléments par jour`).not.toContain('<i')
      expect(pisteDe(grille, e)).not.toMatch(/data-jour=/)
    }
    // les jours vivent dans l'entête, et rien d'autre
    expect((grille.match(/data-jour="/g) || [])).toHaveLength(7)
    expect((grilleMois.match(/data-jour="/g) || [])).toHaveLength(31)
  })

  it('12. un seul champ, deux usages : la coupure se partage au jeton près', () => {
    // l'entête et la tête de ligne lisent le même jeton — la dérive du 25/11
    // (−8 px au lundi, −97 px au dimanche) vient d'un terme manquant d'un côté
    expect(nud(corps('.abs-cal-entete-employes'))).toContain('width:var(--abs-pli-employe)')
    expect(nud(corps('.abs-pli-tete'))).toContain('width:var(--abs-pli-employe)')
    expect(nud(corps('.abs-cal-entete-jours'))).toContain('flex:11')
    expect(nud(corps('.abs-pli-piste'))).toContain('flex:11')
    // 252 = x 53 (l'intérieur du plateau) → x 305 (la naissance de la première
    // cellule). Le prénom du dessin court jusqu'à 311 : il borde la coupure, il
    // ne la pousse pas.
    expect(COMPOSANT).toContain('const LARGEUR_EMPLOYE = 252')
    expect(cote('--abs-pli-entête')).toBe(76) // l'entête se lit hors du plateau
    // LA LARGEUR DU CHAMP S'ÉCRIT UNE FOIS. Le dessin donne 1015 pixels à sept
    // cellules de 145 : l'entête et la piste lisent le MÊME produit, et la
    // plaquette du solde ne réserve plus rien dans le JavaScript — réservant cent
    // quarante-sept pixels de trop, le jour tombait à 108, puis à 127 selon
    // l'écran, et une planche d'une journée cherchait cinquante pixels de plus que
    // sa cellule (le fondateur, 11/12 : « on ne voit pas où s'arrête la planche
    // "Formation · 1 j" »).
    expect(nud(corps('.abs-cal-entete-jours'))).toContain('min-width:var(--abs-pli-champ)')
    // et l'entête porte la règle du cadre qu'il surplombe : 1 015 de champ, pas
    // 1 021 — un jour de 145,86 et six pixels de dérive à la dernière cellule
    expect(nud(corps('.abs-cal-entete'))).toContain('padding:0var(--abs-pli-rule)')
    expect(nud(corps('.abs-pli-piste'))).toContain('min-width:var(--abs-pli-champ)')
    expect(valeur('--abs-pli-champ')).toBe(
      'calc(var(--abs-pli-nb-jours, 7) * var(--abs-pli-jour, 145px))'
    )
    expect(COMPOSANT).toContain('const LARGEUR_JOUR_SEMAINE = 145')
    expect(COMPOSANT).toContain("'--abs-pli-jour': `${largeurJour}px`")
    expect(COMPOSANT).not.toContain('LARGEUR_SOLDE')
    expect(cote('--abs-pli-solde')).toBe(130) // x 1178..1307, la plaquette peinte
    expect(nud(corps('.abs-pli-solde'))).toContain('width:var(--abs-pli-solde)')
    // le plateau ne coupe pas les colonnes par un filet : le dessin n'en a pas
    expect(PLI).not.toMatch(/\.abs-pli-tete\s*\{[^}]*border-right/)
  })

  it('13. le week-end se hache dans l\'entête, pas dans les lignes', () => {
    const hachures = nud(corps(".abs-cal-jour[data-weekend='vrai']::after"))
    expect(cote('--abs-pli-hachure-largeur')).toBe(40) // x 1133..1173
    expect(cote('--abs-pli-hachure-hauteur')).toBe(37) // y 165..202
    expect(hachures).toContain('background:repeating-linear-gradient(135deg,transparent03px,var(--charte-bordure)3px6px)')
    // trois pixels de mords sur la règle du plateau, comme au dessin
    expect(hachures).toContain('bottom:calc(-1*var(--abs-pli-rule))')
    expect(hachures).toContain('right:0')
    // la semaine du 19 au 25 octobre : samedi 24 et dimanche 25, deux cellules
    expect((grille.match(/data-weekend="vrai"/g) || [])).toHaveLength(2)
    // octobre 2026 commence un jeudi : 3, 4, 10, 11, 17, 18, 24, 25 et le 31 —
    // neuf samedis et dimanches, et le 31 est bien un samedi
    expect((grilleMois.match(/data-weekend="vrai"/g) || [])).toHaveLength(9)
    // dans les lignes, le chômé ne se peint pas : le trait de jour suffit au dessin
    expect(PLI).not.toContain('.abs-pli-piste[data-weekend')
  })

  it('14. le solde est peint à la rive droite du champ, le nombre à côté', () => {
    expect(cote('--abs-pli-jauge')).toBe(50) // la pilule : x 1178..1228
    expect(cote('--abs-pli-jauge-hauteur')).toBe(18) // y 231..248
    const solde = nud(corps('.abs-pli-solde'))
    expect(solde).toContain('position:absolute')
    expect(solde).toContain('right:0;top:0;bottom:0')
    // AUCUN FOND (12/12). La plaquette était peinte du sable de la page : cent
    // trente pixels opaques sur la rive droite de chaque ligne, qui effaçaient les
    // traits de jour et mangeaient la pointe de la dernière planche — alors que le
    // dessin pose sa jauge et son nombre DIRECTEMENT sur les cellules. `min-width`
    // et `max-width` de la planche ont réglé la rencontre ; il ne reste pas à
    // poser un cache par-dessus.
    expect(solde).toContain('background:transparent')
    expect(solde).toContain('pointer-events:none') // elle se lit, elle ne se clique pas
    expect(cote('--abs-pli-solde-repli')).toBe(13) // 1320 − 1307 : le nombre s'arrête là
    // la pilule est remplie à gauche et nue à droite, et le nombre est ÉCRIT — une
    // jauge lue seule serait un statut sans mot
    const jauge = nud(corps('.abs-pli-jauge'))
    expect(jauge).toContain('background:var(--charte-bordure)')
    // le plein se lit dans la CHAPE de la pilule (le pourcentage d'un absolu se
    // mesure au Border-Box du conteneur positionné : écrit en `width: 100%`,
    // l'argile passait sous le cerclage droit)
    expect(nud(corps('.abs-pli-jauge i'))).toContain(
      'width:calc((100%-2*var(--charte-trait))*var(--abs-pli-plein,0%)/100%)'
    )
    expect(nud(corps('.abs-pli-jauge i'))).toContain('background:var(--charte-aplat)')
    // la jauge se remplit de CE QUI EST PRIS (le dessin : argile jusqu'à 82 %, un
    // solde de 26/30 rendu plein) — remplie du RESTANT, un solde épuisé se serait
    // dit vierge, et un solde intact un bloc de pierre
    // e1 a 4 jours pris sur un plafond de 30 : la jauge se remplit du TIERS pris
    // (13 %), et le nombre écrit à côté reste le solde — 26/30. Remplie du restant,
    // elle se dirait vierge quand il est épuisé.
    expect(ligneDe(grille, 'e1')).toContain('style="--abs-pli-plein:13%"')
    expect(ligneDe(grille, 'e1')).toContain('26/30')
    // la plaquette vit DANS la piste (elle ne suit plus une colonne à part) :
    // l'ordre du DOM le prouve, l'absence de `abs-cal-entete-solde` aussi
    const ligne = ligneDe(grille, 'e1')
    expect(ligne.indexOf('abs-pli-piste')).toBeLessThan(ligne.indexOf('abs-pli-solde'))
    // le « + » du dessin devant « 26/30 » n'est pas une donnée : le nombre est nu
    expect(ligne).not.toContain('+26/30')
    expect(ligne).not.toContain('>+ ')
  })

  it('15. le registre du pli : les pastilles à coin replié et le compte', () => {
    expect(cote('--abs-pli-registre')).toBe(76) // 604..680
    expect(cote('--abs-pli-carré')).toBe(51) // hors-tout de la pastille (x 71..122)
    expect(cote('--abs-pli-coin')).toBe(18) // le coin replié, x 126..144
    expect(cote('--abs-pli-ciel-repli')).toBe(4) // l'air entre les deux règles
    const registre = nud(corps('.abs-pli-registre'))
    expect(registre).toContain('margin-top:var(--abs-pli-ciel-repli)')
    expect(registre).toContain('border-top:var(--abs-pli-rule)solidvar(--charte-encre)')
    expect(registre).toContain('min-height:var(--abs-pli-registre)')
    // le coin replié : l'angle droit en haut à gauche, et il pend au pied de la
    // pastille — c'est LE signe du dessin, il n'est pas décoratif
    const coin = nud(corps('.abs-pli-chip::after'))
    expect(coin).toContain('clip-path:polygon(00,100%0,0100%)')
    expect(coin).toContain('background:var(--charte-encre)')
    expect(coin).toContain('bottom:calc(-1*var(--abs-pli-encre))')
    // une seule pastille rendue : la ligne sans absence de ce jeu de données
    expect((grille.match(/data-testid="abs-pli-chip"/g) || [])).toHaveLength(1)
    expect(grille).toContain('data-testid="abs-pli-registre"')
    const compte = nud(corps('.abs-pli-compte'))
    expect(compte).toContain('margin-left:auto')
    expect(compte).toContain('font-size:var(--charte-taille-titre)')
    // et le compte est ÉCRIT dans le registre, à sa rive droite — un `|| true`
    // ne verrouillait rien ici et le disait vrai quoi qu'il arrive.
    // l'ordre se lit dans le RENDU de l'étage, pas dans la feuille : c'est là que
    // le compte doit tomber après la dernière pastille
    const étage = grille.slice(grille.indexOf('abs-pli-registre'))
    expect(étage.lastIndexOf('abs-pli-compte') > étage.lastIndexOf('abs-pli-chip')).toBe(true)
    expect(grille).toContain('· rien à signaler')
  })

  it('16. la pastille du registre est LE contrôle du pli, ligne par ligne', () => {
    // Le 10/12, elle était écrite muette — « le dessin ne lui prête aucun geste » —
    // et le dessin ne montre pas non plus de liste de lignes repliées. Le fondateur,
    // lui, en veut une : « c\'est impossible de cliquer sur un employé plié, et le
    // déplier ou le plier juste lui ». La pastille est donc devenue le geste : un
    // bouton, pas une span, avec son état (`aria-pressed`) et son mot (`aria-label`).
    const trou = grille.indexOf('data-testid="abs-pli-chip"')
    const autour = grille.slice(trou - 300, trou + 400)
    expect(autour).toContain('<button')
    expect(autour).toContain('aria-pressed="false"')
    expect(autour).toContain('aria-label="Nadia Bamba · plier sa ligne"')
    expect(autour).toContain('rien à signaler sur la période')
    expect(nud(PLI)).toContain('.abs-pli-chip{cursor:pointer}')
    expect(PLI).toContain('.abs-pli-chip:hover')
    // l'employé sans absence reste LISTÉ : son nom se lit, il n'est pas effacé
    expect(grille).toContain('Nadia')
    // et sa ligne a SA pince, dans la colonne d'identité — jamais sur la piste
    const pince = corps('.abs-pli-plier')
    expect(nud(pince)).toContain('margin-left:auto')
    expect(nud(pince)).toContain('width:var(--abs-pli-case)')
    const tete = nud(corps('.abs-pli-tete'))
    expect(tete).toContain('width:var(--abs-pli-employe)')
    expect(tete).toContain('position:sticky')
    // le bouton n'est pas posé sur la piste : la pince vit dans `.abs-pli-tete`
    expect(grille.indexOf('abs-pli-plier')).toBeLessThan(grille.indexOf('abs-pli-piste', grille.indexOf('abs-pli-plier')))
    expect(nud(corps('.abs-pli-plier[aria-pressed=\'true\']'))).toContain('background:var(--charte-aplat)')
  })

  it('17. la ligne de compte lit le même tableau que les deux étages', () => {
    // cinq absences rendues, un employé replié : deux fois le même tableau, pas
    // deux fois la même phrase inventée
    const comptes = grille.slice(grille.indexOf('abs-pli-comptes'))
    expect(comptes.slice(0, 700)).toContain('>5</span> à signaler')
    expect(comptes.slice(0, 700)).toContain('>1</span> rien')
    expect(comptes.slice(0, 700)).toContain('cette semaine')
    // le compte NE SE LIT PAS de l'état du pli : ouvrir une ligne à la main ne
    // change pas le bilan de la période (`àSignaler` compte en absences, sur le
    // registre entier, et non sur les seules lignes dépliées)
    // et surtout : le compte ne se lit QU'UNE fois. L'entête de la colonne des
    // prénoms est vide au dessin (x 53..305, y 165..192 : aucun pixel d'encre) ;
    // y remettre « Employé · 3 », c'est écrire le même nombre deux fois — la loi
    // de l'étage, à l'envers.
    expect(grille).not.toContain('Employé')
    expect(nud(corps('.abs-cal-entete-employes'))).toContain('width:var(--abs-pli-employe)')
    // et en mois, le compte suit la période : a5 (18 oct.) n'y est plus seule,
    // Nadia n'a toujours rien — la loi, c'est que les deux étages se répondent
    // LE MOIS NE PLIE PAS (12/12 : « bcp d\'anomalie quand la grille passe en mode
    // mois ») : trente et une vignettes de 36 n\'ont pas de place pour une ligne
    // « rien à signaler » vide. Tous les employés y sont en ligne, aucune pastille,
    // aucune case de pli, et la plaquette du solde est écourtée à zéro.
    const lignesMois = (grilleMois.match(/data-testid="abs-pli-ligne"/g) || []).length
    expect(lignesMois).toBe(employes.length)
    expect((grilleMois.match(/data-testid="abs-pli-chip"/g) || [])).toHaveLength(0)
    expect(grilleMois).not.toContain('abs-pli-registre')
    expect(grilleMois).not.toContain('abs-cal-deplier-tout')
    expect(grilleMois).not.toContain('abs-pli-plier')
    expect(grilleMois).toContain('data-mode="mois"')
    // la plaquette du solde n'a plus de largeur : le jeton se relit à zéro, et la
    // pilule ne se rend même plus — un élément `display:none` dans une vignette de
    // trente-six pixels est du DOM pour rien
    expect(nud(PLI)).toContain('--abs-pli-solde:var(--abs-pli-solde-mois)')
    expect(nud(PLI)).toContain('.abs-cal[data-mode=\'mois\']').toContain('.abs-pli-jauge{display:none}')
    expect(grilleMois).not.toContain('abs-pli-jauge')
    // la semaine, elle, garde sa partition entière
    const lignesSemaine = (grille.match(/data-testid="abs-pli-ligne"/g) || []).length
    const pucesSemaine = (grille.match(/data-testid="abs-pli-chip"/g) || []).length
    expect(lignesSemaine + pucesSemaine).toBe(employes.length)
  })

  it('18. « Déplier tout » est la case qui rouvre le pli — et rien d\'autre', () => {
    expect(grille).toContain('data-testid="abs-cal-deplier-tout"')
    expect(grille).toContain('<input type="checkbox"')
    // la case ne s'écrit que là où le pli a un sens : le mode jour ne plie pas
    expect(grilleJour).not.toContain('abs-cal-deplier-tout')
    // et la semaine la rend TOUJOURS : le mot, pas la case, dit ce qui se passe
    expect(COMPOSANT).toContain("déplierTout ? 'Replier tout' : 'Déplier tout'")
    // l'ancien billet de la tringle est descendu dans la grille : un seul mot, et
    // ce mot n'est plus jamais PRONONCÉ en haut (la feuille, elle, a le droit
    // d'expliquer qu'il a disparu — c'est un commentaire, pas une étiquette)
    expect(grille).not.toContain('Masquer sans absence')
    expect(COMPOSANT).not.toContain('masquerSansAbsence')
    // et l'état par défaut est bien FERMÉ, comme au dessin (cinq lignes sur neuf)
    // L'interrupteur d'entête n'est PAS un état : il se relit des deux ensembles
    // de déviations. Trois états pour un seul réglage, c'est le pli qui se contredit.
    expect(COMPOSANT).toContain('const déplierTout = sansPlanche.length > 0 && sansPlanche.every((l) => estOuvert(l))')
    expect(COMPOSANT).not.toContain('const [déplierTout')
    const case_ = nud(corps('.abs-pli-deplier input'))
    expect(case_).toContain('width:var(--abs-pli-case)')
    expect(case_).toContain('border:var(--abs-pli-encre)solidvar(--charte-encre)')
    expect(case_).toContain('appearance:none')
    // trente carrés, cerclés de trois, coins de six, et VIDE (le centre du
    // dessin lit le sable : (244, 234, 216))
    expect(cote('--abs-pli-case')).toBe(30)
    expect(case_).toContain('border-radius:var(--charte-rayon-champ)')
    expect(case_).toContain('background:transparent')
    // le mot est une CAPITALE écrite par le CSS (la leçon de la tringle), en
    // titre (cap de 19 : y 106..124), à douze de la case, collé à la rive
    // intérieure du plateau (1186..1323 pour un montant à 1326)
    const libellé = nud(corps('.abs-pli-deplier'))
    expect(libellé).toContain('gap:var(--charte-espace-3)')
    expect(libellé).toContain('font-size:var(--charte-taille-titre)')
    expect(libellé).toContain('right:0')
    expect(libellé).not.toContain('text-transform')
    const comptes = nud(corps('.abs-pli-comptes'))
    expect(comptes).toContain('text-transform:uppercase')
  })

  it('19. le mode jour ne plie pas : la feuille du jour a déjà son second étage', () => {
    // quatre lignes rendues, pas de registre — « Présents (n) » dit déjà qui est
    // là, et un nombre écrit deux fois se contredit à la première retouche
    expect((grilleJour.match(/data-testid="abs-pli-ligne"/g) || [])).toHaveLength(4)
    expect(grilleJour).not.toContain('abs-pli-registre')
    // le 21 octobre, seule Aïssatou est absente : les trois autres sont là, et
    // l'étage « Présents » les nomme — c'est lui, pas un pli, qui les montre ici
    expect(grilleJour).toContain('Présents (3)')
    expect(grilleJour).toContain('Aïssatou Diallo')
    // deux, pas une : a4 (20 → 22) recouvre aussi le 21. C'est le rang qui les
    // sépare, et le jour ne se contente donc pas d'EMPILER les planches : il les
    // compte, comme la semaine.
    expect((grilleJour.match(/data-testid="abs-cal-barre"/g) || [])).toHaveLength(2)
    expect(ligneDe(grilleJour, 'e1')).toContain('--abs-pli-rang:1')
    expect(ligneDe(grilleJour, 'e1')).toContain('--abs-pli-rangs:2')
    // la ligne de compte, elle, reste lisible dans les trois modes
    expect(grilleJour).toContain('abs-cal-comptes')
    expect(grilleJour).toContain('aujourd’hui')
  })

  it('20. le dépôt d\'une pince vise toujours le jour sous le pointeur', () => {
    // la piste reste la zone de dépôt : `data-drop-lane` par ligne, et le calcul
    // de `jourDepuisX` n'a pas bougé d'un pouce depuis la corde
    expect((grille.match(/data-drop-lane="e/g) || [])).toHaveLength(3)
    expect((grilleJour.match(/data-drop-lane="e/g) || [])).toHaveLength(4)
    expect(COMPOSANT).toContain('const index = jourDepuisX(e.clientX, rect, nbJours)')
    expect(COMPOSANT).toContain('onDeposerMotif({ employeeId: ligne.employe.id, dateIso: jours[index].iso, motifId })')
    // le jour visé se pose en pourcentage de la piste, pas en nombre de pixels
    expect(COMPOSANT).toContain("left: `calc(${(survol.index / nbJours) * 100}% + 1px)`")
    expect(COMPOSANT).toContain("width: `calc(${(1 / nbJours) * 100}% - 2px)`")
  })

  it('21. le clic ouvre le tiroir, et le titre porte la phrase entière', () => {
    expect(COMPOSANT).toContain('onClick={() => setAbsenceActive(a)}')
    expect(grille).toContain(
      'title="Congé payé · Aïssatou Diallo · du 19/10/2026 au 21/10/2026 · Approuvé"'
    )
    // la durée comptée vient du service (fériés déduits), pas d'un soustraction
    // faite à la main dans le rendu
    expect(COMPOSANT).toContain('const joursComptés = compterJoursOuvres(')
    expect(grille).toContain('>3 j</span>')
  })

  it('22. les cotes viennent du dessin, pas d\'une échelle qu\'on s\'invente', () => {
    // chaque nombre ci-dessous est une mesure du fichier de 1376 × 768
    expect(cote('--abs-pli-pas')).toBe(78)
    expect(cote('--abs-pli-rule')).toBe(3)
    expect(cote('--abs-pli-carré')).toBe(51)
    expect(cote('--abs-pli-planche')).toBe(40)
    expect(cote('--abs-pli-encre')).toBe(3)
    expect(cote('--abs-pli-pointe')).toBe(16)
    expect(cote('--abs-pli-rive')).toBe(8)
    expect(cote('--abs-pli-trait')).toBe(2)
    expect(cote('--abs-pli-trait-hauteur')).toBe(22)
    expect(cote('--abs-pli-plomb')).toBe(3)
    expect(cote('--abs-pli-entête')).toBe(76)
    expect(cote('--abs-pli-jauge')).toBe(50)
    expect(cote('--abs-pli-jauge-hauteur')).toBe(18)
    expect(cote('--abs-pli-registre')).toBe(76)
    expect(cote('--abs-pli-noeud')).toBe(13)
    expect(cote('--abs-pli-ombre')).toBe(6)
    // et ce ne sont PAS les cotes de la corde, recopiées pour faire plaisir :
    // la corde avait un pas de 50 et une carte de 46
    expect(valeur('--abs-pli-pas')).not.toBe('50px')
    expect(valeur('--abs-pli-planche')).not.toBe('46px')
    // le pas du registre : 125 mesurés entre deux pastilles, moins la pastille
    expect(cote('--abs-pli-écart')).toBe(74)
    // relevées après coup, le 11/12, sur les trois images que le fondateur a
    // posées à côté du dessin : le jour (145, non pas le 108 qu'on s'était
    // fabriqué), la plaquette du solde (130 = x 1178..1307), son repli (13), la
    // pile de feuilles repliées (8 de décalage, 22 de souffle)
    expect(COMPOSANT).toContain('const LARGEUR_JOUR_SEMAINE = 145')
    expect(cote('--abs-pli-solde')).toBe(130)
    expect(cote('--abs-pli-solde-repli')).toBe(13)
    expect(cote('--abs-pli-pli')).toBe(8)
    // l'évasement n'est pas un nombre recopié, c'est le décalage doublé d'une
    // règle : `calc(2 * (8 + 3))` = 22
    expect(valeur('--abs-pli-évasement')).toBe(
      'calc(2 * (var(--abs-pli-pli) + var(--abs-pli-rule)))'
    )
  })

  it('23. tout ce que le pli appelle est déclaré quelque part', () => {
    const appels = new Set([...PLI.matchAll(/var\((--abs-pli-[\wéèê-]+)?/g)].map((m) => m[1]).filter(Boolean))
    // deux origines : les jetons de la rubrique (`.abs-cal` et les règles
    // locales, comme `--abs-pli-décalage` né dans `.abs-pli-planche`) et ceux que
    // pose le composant. Les uns et les autres se relisent, rien n'est déclaré
    // deux fois.
    const déclarés = new Set([...PLI.matchAll(/(--abs-pli-[\wéèê-]+)\s*:/g)].map((m) => m[1]))
    // sept jetons sont posés par le composant, parce qu'ils dépendent de la
    // période ou du rang : ils doivent se lire dans sa source
    for (const nom of appels) {
      if (déclarés.has(nom)) continue
      expect(COMPOSANT, `${nom} n'est ni déclaré dans la feuille, ni posé par le composant`).toContain(nom)
    }
    expect(appels.size).toBeGreaterThan(15)
    // et l'inverse : un jeton déclaré que rien n'appelle est une cote morte.
    // « Appelé » comprend le composant : `--abs-pli-rive` ne vit que dans un
    // `calc` du `style`, et c'est un usage, pas un ornement.
    for (const nom of déclarés) {
      expect(PLI.split(nom).length > 2 || COMPOSANT.includes(nom), `${nom} n'est appelé nulle part`).toBe(true)
    }
  })

  it('24. la rubrique n\'apporte ni couleur en dur, ni flou, ni rayon hors liste', () => {
    expect(PLI).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/)
    expect(PLI).not.toMatch(/rgba?\(/)
    expect(PLI).not.toMatch(/blur|backdrop-filter/)
    for (const m of PLI.matchAll(/border-radius:\s*([^;]+);/g)) {
      for (const v of m[1].matchAll(/(\d+(?:\.\d+)?)px/g)) {
        expect(['6', '8', '11', '12', '999', '0', '1', '2', '3', '4']).toContain(v[1])
      }
    }
    // aucune taille de lettre en dur : le corps vient des jetons de la charte
    expect(PLI).not.toMatch(/font-size:\s*\d/)
    // aucun `!important`, aucun z-index sauvage hors des deux colonnes collantes
    expect(PLI).not.toContain('!important')
    const z = [...PLI.matchAll(/z-index:\s*(-?\d+)/g)].map((m) => m[1])
    expect([...new Set(z)].sort()).toEqual(['-1', '1', '2', '3'])
  })

  it('25. aucune media ne repositionne le pli', () => {
    const media = PLI.slice(PLI.lastIndexOf('@media'))
    expect(media).toContain('.abs-pli-nom { max-width: 110px }')
    expect(media).toContain('width: calc(var(--abs-pli-jauge) / 2)')
    // la case d'entête se pose en flux, pas en:absolute, quand la ligne se replie
    expect(media).toContain('.abs-pli-deplier { position: static }')
    // et surtout : aucune règle de largeur pour les planches, le plomb ou le
    // lavage — c'est ce qui garde les colonnes d'aplomb à toute taille
    expect(media).not.toContain('abs-pli-planche')
    expect(media).not.toContain('abs-pli-piste')
    expect(media).not.toContain('abs-pli-lavage')
  })

  it('26. la légende apprend le pli, et ne parle plus d\'anneaux', () => {
    expect(COMPOSANT).toContain('jour nu')
    expect(COMPOSANT).toContain("colonne lavée = aujourd’hui")
    expect(COMPOSANT).toContain("planche posée = l’absence, de son premier jour au dernier")
    expect(COMPOSANT).toContain('rien à signaler (bas du plateau)')
    expect(COMPOSANT).not.toContain('anneau = jour travaillé')
    expect(COMPOSANT).not.toContain('pastille = chômé')
  })

  it('27. les cotes sont écrites dans le document, pas seulement dans la feuille', () => {
    const doc = lire(...DOCUMENT.split('/'))
    expect(doc).toContain('absences-grille-2-pli.png')
    // 78 (le pas), 40 (la planche), 16 (la pointe), 0.26 (l'opacité du lavage),
    // 51 (la pastille) : le relevé et le code doivent se resommer
    for (const coteDuDessin of ['78', '40', '16', '0.26', '51', '18', '145', '130']) {
      expect(doc, `la cote ${coteDuDessin} a disparu du document`).toContain(coteDuDessin)
    }
  })

  it('28. les feuilles pliées se voient : le plateau est une pile, pas un cadre', () => {
    // LE MANQUEMENT, 11/12 : « les feuilles pliées ne se voient pas ». Le dessin
    // n'entoure pas le champ d'un trait unique : derrière le plateau, deux feuilles
    // repliées dépassent sur sa gauche, à huit puis à seize du montant (arêtes
    // relevées à x 42..45 et x 34..37 pour une règle à 50..52), chacune descendue
    // d'un deuil de plus que son décalage, et leurs coins courbent au rayon du cadre.
    const feuille = nud(PLI)
    expect(feuille).toContain('.abs-pli-plateau::before,.abs-pli-plateau::after{')
    // la feuille est un cadre complet posé DERRIÈRE le fond de sable : seul ce qui
    // dépasse s'encre, et le plateau n'a rien à soustraire quand il défile
    expect(feuille).toContain(
      'content:"";position:absolute;inset:0;z-index:-1;box-sizing:border-box'
    )
    expect(feuille).toContain('border:var(--abs-pli-rule)solidvar(--charte-encre)')
    expect(feuille).toContain('background:var(--charte-sable)')
    expect(feuille).toContain('pointer-events:none')
    // les deux décalages se déduisent du MÊME jeton, l'un simple, l'autre doublé —
    // écrire « -16px » à la main serait une cote orpheline
    expect(feuille).toContain(
      '.abs-pli-plateau::before{transform:translate(calc(-1*var(--abs-pli-pli)),calc(var(--abs-pli-pli)+var(--abs-pli-rule)));}'
    )
    expect(feuille).toContain(
      '.abs-pli-plateau::after{transform:translate(calc(-2*var(--abs-pli-pli)),calc(2*(var(--abs-pli-pli)+var(--abs-pli-rule))));}'
    )
    // le cadre doit connaître sa pile : `position: relative`, sinon `z-index: -1`
    // enverrait les feuilles derrière le fond de la PAGE et non du plateau
    expect(nud(corps('.abs-pli-plateau'))).toContain('position:relative')
    // et le souffle est payé d'avance : `overflow-x: auto` coupe, une feuille
    // rognée ne se lit plus pliée
    const champ = nud(corps('.abs-cal-champ'))
    expect(champ).toContain('padding-left:var(--abs-pli-évasement)')
    expect(champ).toContain('padding-bottom:var(--abs-pli-évasement)')
  })

  it('29. le pli est réversible : la case survit au geste qui la rendait inutile', () => {
    // LE MANQUEMENT, 11/12 : « le bouton déplier disparait une fois déplier donc on
    // ne peut plus plier après ». Un réglage qui s'efface après service n'est pas un
    // réglage. Ce verrou ne lit donc pas la feuille, il CLIQUE : il provoque l'état
    // dans lequel le pli se perdait.
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    const hote = document.createElement('div')
    document.body.append(hote)
    const racine = createRoot(hote)
    try {
      act(() => racine.render(<AbsencesCalendrier {...PROPS} />))
      const case_ = hote.querySelector('[data-testid="abs-cal-deplier-tout"]')
      expect(case_, 'la case de pli manque dès le départ').toBeTruthy()
      expect(hote.textContent).toContain('Déplier tout')
      // le pli est fermé : la ligne sans absence est dans le registre
      expect(hote.querySelector('[data-testid="abs-pli-registre"]')).toBeTruthy()
      expect(hote.querySelector('[data-testid="abs-pli-ligne"][data-employe="e4"]')).toBe(null)

      act(() => { case_.click() })
      // TOUT est déplié, et la case est ENCORE LÀ — c'est le mot qui a basculé
      expect(hote.textContent).toContain('Replier tout')
      expect(hote.textContent).not.toContain('Déplier tout')
      expect(case_.checked).toBe(true)
      expect(hote.querySelector('[data-testid="abs-pli-registre"]')).toBe(null)
      expect(hote.querySelector('[data-testid="abs-pli-ligne"][data-employe="e4"]')).toBeTruthy()

      // et le geste se referme : la ligne e4 reprend sa pastille
      act(() => { hote.querySelector('[data-testid="abs-cal-deplier-tout"]').click() })
      expect(hote.textContent).toContain('Déplier tout')
      expect(hote.querySelector('[data-testid="abs-pli-registre"]')).toBeTruthy()
      expect(hote.querySelector('[data-testid="abs-pli-ligne"][data-employe="e4"]')).toBe(null)
    } finally {
      act(() => racine.unmount())
      hote.remove()
      globalThis.IS_REACT_ACT_ENVIRONMENT = false
    }
    // rien à ouvrir : la case reste posée, mais elle ne fait pas semblant
    const toutVu = rendre({
      absences: [...absences, absence('a6', 'e4', '2026-10-24', '2026-10-24', 'conge')],
    })
    expect(toutVu).toContain('data-testid="abs-cal-deplier-tout"')
    expect(toutVu).toMatch(/type="checkbox"[^>]*disabled/)
    expect(toutVu).not.toContain('data-testid="abs-pli-registre"')
    // et la case éteinte garde sa place dans la ligne de compte : c'est le dessin
    expect(nud(PLI)).toContain('.abs-pli-deplierinput:disabled')
  })

  it('30. la pile se peint DERRIÈRE le fond du plateau, pas derrière la page', () => {
    // Le 11/12, les feuilles étaient écrites et ne se voyaient pas ; le 12/12, le
    // fondateur a re-signalé le même manque : « il était convenu la forme feuilles
    // pliées pour la grille mais jusque là tu n\'as rien fait ». La cause n\'était
    // pas la géométrie, c\'était l\'empilement : deux pseudo-éléments en
    // `z-index: -1` se peignent dans le CONTEXTE d\'empilement du plus proche ancêtre
    // qui en crée un — ici la racine de la page, donc sous le fond sable de
    // `.abs-cal`. Le plateau doit isoler le sien.
    const plateau = nud(corps('.abs-pli-plateau'))
    expect(plateau).toContain('isolation:isolate')
    expect(plateau).toContain('position:relative')
    // et le fond du plateau doit rester OPAQUE : c\'est lui qui cache la pile sous
    // les lignes (une feuille qui traverse les rangs ne serait plus une pile)
    expect(plateau).toContain('background:var(--charte-sable)')
    // les deux feuilles, toujours derrière, toujours à -1 (la règle est écrite en
    // deux sélecteurs accolés, donc cherchée telle quelle, pas via `corps`)
    const feuilles = nud(PLI.slice(PLI.indexOf('.abs-pli-plateau::before,'), PLI.indexOf('.abs-pli-plateau::before {')))
    expect(feuilles).toContain('.abs-pli-plateau::before,.abs-pli-plateau::after{')
    expect(feuilles).toContain('z-index:-1')
    expect(feuilles).toContain('border:var(--abs-pli-rule)solidvar(--charte-encre)')
    // le souffle reste payé d\'avance : `overflow-x: auto` coupe la pile à ras
    const champ = nud(corps('.abs-cal-champ'))
    expect(champ).toContain('padding-left:var(--abs-pli-évasement)')
    expect(champ).toContain('padding-bottom:var(--abs-pli-évasement)')
  })

  it('31. le pli se referme sur la ligne seule, et la pince est dans la tête', () => {
    // Le verrou 29 prouvait le geste GLOBAL ; celui-ci prouve le geste PARTICULIER,
    // celui qui manquait (« le déplier ou le plier juste lui »).
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    const hote = document.createElement('div')
    document.body.append(hote)
    const racine = createRoot(hote)
    try {
      act(() => racine.render(<AbsencesCalendrier {...PROPS} />))
      // la ligne SANS absence est pliée : ni en ligne, ni de planche — mais sa
      // pastille est là, et c\'est un bouton
      expect(hote.querySelector('[data-testid="abs-pli-ligne"][data-employe="e4"]')).toBe(null)
      const pastille = hote.querySelector('[data-testid="abs-pli-chip"][data-employe="e4"]')
      expect(pastille?.tagName, 'la pastille du pli doit être un bouton').toBe('BUTTON')
      expect(pastille.getAttribute('aria-pressed')).toBe('false')
      // un clic : SA ligne se soulève, les autres ne bougent pas, la pastille sort du
      // registre (elle n\'est plus pliée), et le compte du haut ne change pas
      act(() => { pastille.click() })
      expect(hote.querySelector('[data-testid="abs-pli-ligne"][data-employe="e4"]')).toBeTruthy()
      expect(hote.querySelectorAll('[data-testid="abs-pli-ligne"]')).toHaveLength(4)
      expect(hote.querySelector('[data-testid="abs-pli-registre"]')).toBe(null)
      expect(hote.textContent).toContain('5 à signaler')
      // un clic sur SA PINCE la referme — le geste inverse, ligne par ligne
      const pince = hote.querySelector('[data-testid="abs-pli-plier"][data-employe="e4"]')
      expect(pince?.getAttribute('aria-pressed')).toBe('true')
      act(() => { pince.click() })
      expect(hote.querySelector('[data-testid="abs-pli-ligne"][data-employe="e4"]')).toBe(null)
      expect(hote.querySelector('[data-testid="abs-pli-chip"][data-employe="e4"]')).toBeTruthy()
      // et une ligne PLEINE peut se plier sans toucher aux autres : e1 a deux
      // absences, sa pince l\'éteint, e2 et e3 restent en ligne
      const pince1 = hote.querySelector('[data-testid="abs-pli-plier"][data-employe="e1"]')
      expect(pince1?.getAttribute('aria-pressed')).toBe('true')
      act(() => { pince1.click() })
      expect(hote.querySelector('[data-testid="abs-pli-ligne"][data-employe="e1"]')).toBe(null)
      expect(hote.querySelector('[data-testid="abs-pli-ligne"][data-employe="e2"]')).toBeTruthy()
      expect(hote.querySelector('[data-testid="abs-pli-ligne"][data-employe="e3"]')).toBeTruthy()
      // la case d\'entête a basculé : il reste une ligne à rouvrir
      expect(hote.querySelector('[data-testid="abs-cal-comptes"]').textContent).toContain('Déplier tout')
    } finally {
      act(() => racine.unmount())
      hote.remove()
      globalThis.IS_REACT_ACT_ENVIRONMENT = false
    }
  })

  it('32. la planche ne déborde plus au gré du mot', () => {
    // LA MESURE DU FONDATEUR (12/12, image de la semaine) : « la flèche absence
    // injustifiée remplit deux jours alors que le congé n\'est que 1 jour. la flèche
    // déborde EN FONCTION DE LA LONGUEUR DU TEXTE ». Le verrou 5 cote la feuille ;
    // celui-ci cote le geste : une planche d\'un jour, mot long, rendu réel.
    const large = rendre({
      absences: [absence('a9', 'e1', '2026-10-20', '2026-10-20', 'injustifie')],
    })
    const style = styleDePlanche(large, 'du 20/10/2026 au 20/10/2026')
    // une seule cellule de cadre : née au jour 1, finissant avant le jour 2
    expect(style).toContain('--abs-pli-entree:calc(14.285714285714285% + var(--abs-pli-pointe))')
    expect(style).toContain('right:calc(71.42857142857143% + var(--abs-pli-rive))')
    // et le mot est LÀ, entier, dans l\'accessibilité — coupé à l\'œil, pas au lecteur
    expect(large).toContain('aria-label="Absence injustifiée · Aïssatou Diallo · du 20/10/2026 au 20/10/2026 · Approuvé"')
    // la durée se retient de se couper avec le mot : le « · 1 j » reste entier,
    // et c'est bien `.abs-pli-motif` qui porte le libellé (donc l'ellipsis)
    const trou = large.indexOf('class="abs-pli-motif"')
    expect(large.slice(trou, trou + 160)).toContain('class="abs-pli-motif">Absence injustifiée</span>')
    expect(large.slice(trou, trou + 240)).toContain('class="abs-pli-durée">1 j<')
  })
})
