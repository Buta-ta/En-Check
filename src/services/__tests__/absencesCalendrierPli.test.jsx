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
const PAGE = lire('src', 'pages', 'Absences.jsx')
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

/** Le corps d'une règle n'importe où dans la feuille. Le bandeau d'outils n'est PAS
 * de la rubrique du pli — il la précède, et verrouiller sa lecture sur `PLI`
 * ferait échouer le verrou pour une raison d'ordre, pas de fond. */
const corpsFeuille = (sélecteur) => {
  const i = CSS.indexOf(`${sélecteur} {`)
  if (i === -1) throw new Error(`règle absente de la feuille : ${sélecteur}`)
  const début = CSS.indexOf('{', i)
  return CSS.slice(début + 1, CSS.indexOf('}', début))
}

/** La règle complète (sélecteurs compris) d'un bloc à deux sélecteurs accolés. */
const règleFeuille = (début) => {
  const i = CSS.indexOf(début)
  if (i === -1) throw new Error(`règle absente de la feuille : ${début}`)
  return CSS.slice(i, CSS.indexOf('}', CSS.indexOf('{', i)) + 1)
}

/** Un jeton de la rubrique, en nombre — la cote du dessin, pas une intention.
 * ⚠️ Il SUIT un `var()` simple : `--abs-pli-pas` est devenu la lecture du pas de la
 * semaine (un nombre écrit une fois, deux modes), et une aiguille qui ferait
 * `Number('var(…')` comparerait `NaN` à `NaN` en croyant mesurer quelque chose. */
function cote(nom, profondeur = 0) {
  const trou = PLI.split(`${nom}:`)[1]
  if (!trou) throw new Error(`jeton du pli absent : ${nom}`)
  if (profondeur > 2) throw new Error(`chaîne de var() trop longue sur ${nom}`)
  const brut = trou.trim().split(';')[0].trim()
  const renvoi = brut.match(/^var\((--abs-pli-[\wéèê-]+)\)$/)
  if (renvoi) return cote(renvoi[1], profondeur + 1)
  return Number(brut.replace('px', ''))
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
    expect(plateau).toContain('box-shadow:var(--abs-pli-pli)var(--abs-pli-pli)00var(--charte-bordure)')
    // L'OMBRE SE RELIT SUR LE PAS DE LA PILE, plus sur un `--abs-pli-ombre` à part.
    // Le dessin grise sa chute à x 1328..1337 pour une rive à 1325 : la chute fait
    // un pas, et ce pas est celui des feuilles. Deux lois d'ombre (6 d'un côté, 11
    // de l'autre) sur le même plateau, c'est un dessin qu'on Commente au lieu de le
    // continuer — le jeton orphelin est supprimé, pas conservé « au cas où ».
    expect(plateau).not.toContain('--abs-pli-ombre')
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
    // l'éventail se REFERME dans le cadre au lieu de pendre dessous : en bas et à
    // droite, seule la chute de l'ombre compte — un pas, pas une queue. Onze pixels
    // de hauteur rendus à la page (« moins scroller »), et la `overflow-x` ne rogne
    // plus que ce qui déborde vraiment.
    expect(champ).toContain('padding-bottom:var(--abs-pli-pli)')
    expect(champ).toContain('padding-right:var(--abs-pli-pli)')
    expect(cote('--abs-pli-pli')).toBe(8)
    // LE CHAMP BORNE SES JOURS, IL NE S'ÉTALE PAS SUR L'ÉCRAN. `width: max-content`
    // + `min-width: 100%` était une DOUBLE naissance : la largeur du contenu et
    // celle du conteneur, la plus grande gagnant — soit, sur un écran de 1 173, un
    // plateau de 1 207 ALONGÉ de ses 36 de padding, et un défilement horizontal
    // permanent pour aller chercher la seule jauge du solde. `min-width: max-content`
    // seul garde la borne basse (un écran étroit défile, c'est voulu) sans jamais
    // imposer au plateau une largeur qu'il n'a pas demandée
    // (« optimise l'espace pour moins scroller », fondateur, 13/12).
    expect(champ).toContain('min-width:max-content')
    // aucune largeur `max-content` en DUR : la négation se fait sur la déclaration,
    // pas sur un sous-chaîne que `min-width: max-content` contient aussi
    expect(champ).not.toMatch(/(^|;)width:max-content/)
    expect(champ).not.toContain('min-width:100%')
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
    // la pince de ligne est un CARRE, mais pas au gabarit du bandeau : la case
    // d'entête de trente est la cote du dessin (x 1143..1173), et le dessin ne
    // dessine aucune pince de ligne. La payer 30 rendait le prénom en ellipses sur
    // un écran d'ordinateur — la colonne d'identité est à 252 pour toute la
    // famille, huit pixels de pince en moins sont huit pixels de nom en plus
    // (« optimise l'espace », fondateur, 13/12).
    expect(nud(pince)).toContain('width:var(--abs-pli-pince)')
    expect(nud(pince)).toContain('height:var(--abs-pli-pince)')
    expect(valeur('--abs-pli-pince')).toBe('calc(var(--abs-pli-case) - var(--abs-pli-pli))')
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
    // `--abs-pli-ombre` est MORT : la chute du plateau se relit sur le pas de la
    // pile. Un jeton déclaré que plus personne ne lit est une promesse de plus —
    // la loi du dépôt, c'est qu'on le supprime au lieu de le laisser s'ossifier.
    expect(PLI).not.toContain('--abs-pli-ombre')
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
    // la pile, à la règle : une feuille descend de son pas PLUS la règle (11), les
    // deux de le double (22). Et l'évasement n'est pas un nombre recopié : c'est la
    // pile moins la règle (19) — seize de recul pour la dernière feuille, trois
    // d'air. Relevé sur `maquettes/absences-grille-2-pli.png`, arêtes x 42..45 et
    // x 34..37 pour un montant à 50..52, queues à y 692 et 703 pour un trait bas à
    // 680 (le 12/12, j'avais écrit 22 pour les deux ; le souffle et la pile ne sont
    // pas la même mesure).
    // et l'éventail, en calculs : seize est le double de huit, la pile est le recul
    // plus la règle, l'évasement EST la pile (un seul nombre, deux usages), la
    // rentrée se relit sur le pas de ligne — jamais sur un 390 posé à la main.
    expect(valeur('--abs-pli-recul')).toBe('calc(2 * var(--abs-pli-pli))')
    expect(valeur('--abs-pli-pile')).toBe(
      'calc(var(--abs-pli-recul) + var(--abs-pli-rule))'
    )
    expect(valeur('--abs-pli-évasement')).toBe('var(--abs-pli-pile)')
    expect(valeur('--abs-pli-rentrée')).toBe('var(--abs-pli-pas)')
    // `--abs-pli-deuil` (la queue de 11) est MORT avec les raiures droites
    expect(PLI).not.toContain('--abs-pli-deuil')
    // et la pince se déduit de la case, jamais d'un 22 posé à la main
    expect(valeur('--abs-pli-pince')).toBe(
      'calc(var(--abs-pli-case) - var(--abs-pli-pli))'
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

  /* Les blocs `@media` RÉELS de la rubrique (les prose qui nomment `@media` dans
     les commentaires sont écartés en exigeant la parenthèse). Le 26/12, le verrou
     lisait `PLI.lastIndexOf('@media')` : dès qu'une rubrique sous le pli gagnait
     son propre repli, c'est ELLE qu'il inspectait, et le pli n'y était pas — une
     aiguille qui dépend de l'ORDRE du fichier se retourne contre la loi qu'elle
     garde. La loi, ici, est double : le bloc du pli tient ses trois replis, et
     AUCUN autre bloc ne choisit un sélecteur du pli. */
  const blocsMedia = () => {
    const out = []
    const re = /@media\s*\(/g
    let m
    while ((m = re.exec(PLI))) {
      const ouverture = PLI.indexOf('{', m.index)
      let curseur = ouverture
      let profondeur = 0
      do {
        if (PLI[curseur] === '{') profondeur++
        else if (PLI[curseur] === '}') profondeur--
        curseur++
      } while (curseur < PLI.length && profondeur > 0)
      out.push(PLI.slice(m.index, curseur))
    }
    return out
  }

  it('25. aucune media ne repositionne le pli', () => {
    const media = blocsMedia().find((b) => b.includes('.abs-pli-nom { max-width: 110px }'))
    expect(media, 'le bloc du pli a perdu son repli d’étiquette').toBeTruthy()
    expect(media).toContain('width: calc(var(--abs-pli-jauge) / 2)')
    // la case d'entête se pose en flux, pas en:absolute, quand la ligne se replie
    expect(media).toContain('.abs-pli-deplier { position: static }')
    // et surtout : aucune règle de largeur pour les planches, le plomb ou le
    // lavage — c'est ce qui garde les colonnes d'aplomb à toute taille
    expect(media).not.toContain('abs-pli-planche')
    expect(media).not.toContain('abs-pli-piste')
    expect(media).not.toContain('abs-pli-lavage')
    // et sous le pli, les replis des rubriques voisines ne touchent JAMAIS un
    // sélecteur du pli : une media qui re-cadre une planche par en bas
    // recréerait le décalage colonne/rail que le verrou 22 interdit
    for (const b of blocsMedia().filter((x) => x !== media)) {
      expect(nud(b)).not.toMatch(/\.abs-pli-[a-z-]+\s*[,{]/)
    }
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
    // LE MANQUEMENT, 11/12 : « les feuilles pliées ne se voient pas ». Le 12/12, je
    // les avais faites et le fondateur a re-signale autre chose : « c'est ca que tu
    // appelles feuilles pliees, desole mais la tu ne respectes absolument pas la
    // maquette choisie ». La cause n'etait pas la visibilite, c'etait LA FORME :
    // j'avais pose DEUX CADRES COMPLETS decales (un cerclage sur les quatre cotes,
    // translates de -8 et -16), ce qui dessine un double montant a droite et un
    // double trait en haut — pas une pile. Le dessin, lui, ne decale AUCUN CADRE :
    // il RAYE le flanc gauche de trois paralleles qui naissent au niveau du trait du
    // haut et finissent au niveau du trait du bas.
    const feuille = nud(PLI)
    expect(feuille).toContain('.abs-pli-plateau::before,.abs-pli-plateau::after{')
    // une BANDE remplie, large de son recul plus la règle, taillée en parallélogramme
    // par `clip-path`. Ni `inset: 0` (le cadre décalé), ni `border-left` sur toute la
    // hauteur (la raiure droite), ni `rotate` (un trait de trois pixels tourné de
    // 1,9° s'antialiasse et le dessin, lui, est net).
    expect(feuille).toContain(
      'content:"";position:absolute;top:0;height:100%;z-index:-1;background:var(--charte-encre);pointer-events:none'
    )
    expect(feuille).not.toContain('inset:0')
    expect(feuille).not.toContain('border-left:var(--abs-pli-rule)')
    expect(feuille).not.toContain('transform:rotate')
    // les deux decalages se deduisent du MEME jeton, l'un simple, l'autre double —
    // ecrire « -16px » a la main serait une cote orpheline ; la queue est le MEME
    // deuil, ecrit de bas en haut (`bottom:` neg), jamais un hauteur absolue
    const éventail = feuille
    expect(éventail).toContain(
      '.abs-pli-plateau::before{left:calc(-1*var(--abs-pli-pile));width:calc(var(--abs-pli-pile)+var(--abs-pli-rule));'
    )
    expect(éventail).toContain(
      '.abs-pli-plateau::after{left:calc(-1*(var(--abs-pli-pli)+var(--abs-pli-rule)));'
    )
    // les deux rentrées : cinq rangées pour la feuille du dessous, quatre pour celle
    // du dedans — un pas d'éventail, deux écritures du même jeton
    expect(éventail).toContain('calc(5*var(--abs-pli-rentrée))')
    expect(éventail).toContain('calc(4*var(--abs-pli-rentrée))')
    // la pile est a GAUCHE seule : le dessin ne rend aucune feuille a droite (x
    // 1328..1337 y est l'ombre grise, pas un montant). Un `right:` ici serait le
    // double cadre que le fondateur refuse.
    expect(feuille).not.toMatch(/\.abs-pli-plateau::(before|after)\{[^}]*right:/)
    // le cadre doit connaître sa pile : `position: relative`, sinon `z-index: -1`
    // enverrait les feuilles derrière le fond de la PAGE et non du plateau
    expect(nud(corps('.abs-pli-plateau'))).toContain('position:relative')
    // et le souffle est payé d'avance : `overflow-x: auto` coupe, une feuille
    // rognée ne se lit plus pliée
    const champ = nud(corps('.abs-cal-champ'))
    expect(champ).toContain('padding-left:var(--abs-pli-évasement)')
    expect(champ).toContain('padding-bottom:var(--abs-pli-pli)')
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
    expect(feuilles).toContain('background:var(--charte-encre)')
    // et le plateau ne DOIT pas se garder d'air pour sa pile en padding interne : la
    // gouttière est payée par le conteneur. Poser un `padding-left` sur le plateau
    // (ma premiere reponse au reproche) poussait chaque ligne de vingt-cinq pixels
    // hors de son montant — l'entête, lui, ne porte que sa règle de trois.
    expect(nud(corps('.abs-pli-plateau'))).not.toContain('padding-left')
    expect(nud(corps('.abs-cal-entete'))).not.toContain('--abs-pli-pile')
    // le souffle reste payé d\'avance : `overflow-x: auto` coupe la pile à ras
    const champ = nud(corps('.abs-cal-champ'))
    expect(champ).toContain('padding-left:var(--abs-pli-évasement)')
    expect(champ).toContain('padding-bottom:var(--abs-pli-pli)')
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
  it('35. les rives des feuilles tombent aux cotes du dessin, au pixel', () => {
    // CE VERROU NE LIT PAS UNE OPINION, il fait l'addition. Profil d'encre du flanc
    // gauche de `maquettes/absences-grille-2-pli.png`, montant à x 50..53 :
    //   y 225 → x 34..37 et x 42..45 ;  y 300 → 37..39 et 43..46 ;  y 400 → 41..43
    //   et 45..48 ;  y 434 → une seule encre (le dedans est rentré) ;  y 600 → 50..53
    //   (le dessous est rentré). Ramené au bord EXTÉRIEUR du cadre : des reculs de
    //   16..13 et 8..5 AU SOMMET, et rien du tout en bas.
    const pli = cote('--abs-pli-pli')        // 8
    const règle = cote('--abs-pli-rule')     // 3
    // `--abs-pli-recul` et `--abs-pli-rentrée` sont des CALCULS, pas des px : ils se
    // relisent d'abord comme tels (une aiguille qui ferait `Number('calc(…')`
    // comparerait `NaN` à `NaN` et croirait mesurer quelque chose)
    expect(valeur('--abs-pli-recul')).toBe('calc(2 * var(--abs-pli-pli))')
    expect(valeur('--abs-pli-rentrée')).toBe('var(--abs-pli-pas)')
    const recul = 2 * pli                    // 16
    const pas = cote('--abs-pli-pas')       // 78
    expect([recul, recul - règle]).toEqual([16, 13])
    expect([pli, pli - règle]).toEqual([8, 5])
    // les rentrées, en pas de ligne : quatre rangées pour le dedans (312 → l'encre
    // est déjà rentrée à y 434 pour un plateau ouvert à 200), cinq pour le dessous
    // (390 → y 590, et le montant est seul à y 600)
    expect(4 * pas).toBe(312)
    expect(5 * pas).toBe(390)
    // la bande part de l'ARÊTE EXTÉRIEURE du montant moins son recul : `left: -pile`
    // pour le dessous (−19 dans la boîte de padding, soit −16 au bord du cadre), et
    // `-(pli + règle)` pour le dedans (−8). Écrire les deux en `translateX`, comme au
    // premier cycle, payait la règle deux fois.
    const nœuds = nud(PLI).slice(
      nud(PLI).indexOf('.abs-pli-plateau::before{'),
      nud(PLI).indexOf('.abs-pli-comptes{')
    )
    expect(nœuds).not.toContain('right:')
    // pas de `clip-path` sans points : le parallélogramme a bien quatre sommets
    expect((nœuds.match(/polygon\(/g) || []).length).toBe(2)
    expect((nœuds.match(/,/g) || []).length).toBeGreaterThanOrEqual(6)
  })

  it('36. le bandeau d\'outils est un rang, écrit une seule fois', () => {
    // LA SECTION DE L'IMAGE (13/12 : « retravaille cette section », « optimise
    // l'espace pour moins scroller »). La capture montrait le champ de recherche SEUL
    // sur son rang, la tringle Planning/Mois/Liste sur le second, « 4 absences » nud
    // sur le troisième. La cause n'était pas un excès de zèle : la barre d'outils
    // était sortie des `style` inline SANS que la loi du rang (`display:flex`,
    // `justify-content:space-between`) soit écrite à la feuille — deux `div` block
    // l'un sous l'autre, et voilà trois bandeaux avant la grille.
    const outils = nud(corpsFeuille('.abs-outils'))
    expect(outils).toContain('display:flex')
    expect(outils).toContain('justify-content:space-between')
    expect(outils).toContain('align-items:center')
    // la tringle ne se replie plus sur un écran d'ordinateur : le `wrap` est la loi
    // du petit écran, pas celle du rang. Les deux moitiés partagent la règle, et la
    // media ne fait que la LEVER — une seule écriture de la largeur du souffle.
    const moitiés = nud(règleFeuille('.abs-outils-gauche,'))
    expect(moitiés).toContain('flex-wrap:nowrap')
    expect(moitiés).toContain('min-width:0')
    // le champ ne s'étale plus à tout l'écran : un plafond, pas un élastique
    expect(nud(corpsFeuille('.abs-outils-champ'))).toContain('max-width:320px')
    // la règle est écrite À LA FEUILLE : ni `!important`, ni attribut `style` sur le
    // bandeau. Une règle qui gagne en criant n'est pas une règle — et le rang d'hier
    // vivait dans un `style` que plus personne ne relisait.
    expect(outils).not.toContain('!important')
    expect(nud(corpsFeuille('.abs-outils-compte'))).not.toContain('!important')
    expect(PAGE).toMatch(/<div className="toolbar-top abs-outils">/)
    // LA PORTÉE, pas seulement la valeur. Le bandeau lit `--abs-pli-rule` (3) et
    // `--abs-pli-case` (30), deux jetons de la rubrique du pli — et la rubrique ne
    // vivait que sur `.abs-cal`. Or le bandeau est le FRÈRE du calendrier, pas son
    // enfant : une propriété personnalisée non résolue n'annule pas la valeur, elle
    // annule la PROPRIÉTÉ toute entière (`border` retombe à `initial`,
    // `border-style: none`) — c'est la barre d'outils NUE de l'image du fondateur.
    // La rubrique est donc déclarée sur les deux hôte, et les nombres restent écrits
    // une fois (c'est la portée qui est dupliquée, pas la cote).
    const hôte = CSS.search(/\.abs-cal \{\s*--abs-pli-pas/)
    expect(CSS.slice(hôte - '.abs-page,\n'.length, hôte)).toBe('.abs-page,\n')
    // le compte ne prend plus de rangée pour lui : il est dans la rive droite du
    // bandeau, et son style objet a disparu de la page avec sa ligne.
    expect(PAGE).toContain('className="abs-outils-compte"')
    expect(PAGE).not.toContain('S.resultCount')
    expect(FEUILLE).toContain('.abs-outils-compte {')
    // en Planning, c'est le plateau qui écrit le bilan : le compte de la page n'y a
    // pas sa place (deux écritures du même nombre, et c'est la retouche qui les
    // sépare — la loi du verrou 17, appliquée à la page).
    expect(PAGE).toMatch(/viewMode !== 'planning' && \(\s*<div className="abs-outils-compte"/)
    // et le repli reste permis, mais écrit une seule fois : la media lève le nowrap
    const media = FEUILLE.slice(FEUILLE.indexOf('@media (max-width: 650px) {\n  .abs-outils-vue span'))
    const relevé = nud(media.slice(0, media.indexOf('\n}') + 2))
    expect(relevé).toContain('.abs-outils-gauche,')
    expect(relevé).toContain('flex-wrap:wrap')
    // la media ne fait QUE lever le nowrap : elle n'écrit aucune largeur nouvelle,
    // sinon le nombre vivrait deux fois (une par écran) — la loi de la page.
    expect(relevé).toContain('.abs-outils-champ{flex-basis:100%;max-width:none}')
  })

  it('34. la colonne d\'identité rend l\'air que la pince lui prenait', () => {
    // LA MESURE, 13/12 : « optimise l'espace pour moins scroller ». La capture du
    // plateau rendait le prénom réduit à trois points de suspension : la colonne
    // d'identité est une cote du dessin (252, x 54..305, partagée entre le nom ET la
    // pince), et chaque ligne payait en plus une pince au gabarit de la case
    // d'entête — 30 relevés à x 1143..1173 sur le bandeau. La planche, elle, ne se
    // réduit pas : c'est une mesure de période, ses bords sont la vérité du
    // calendrier (verrou 32). C'est donc la pince qui rend l'air, et rien d'autre.
    expect(COMPOSANT).toContain('const LARGEUR_EMPLOYE = 252')
    const tete = nud(corps('.abs-pli-tete'))
    expect(tete).toContain('width:var(--abs-pli-employe)')
    // la pince de ligne est un carré DÉDUIT (la case moins un pas de pile = 22),
    // pas une recopie du gabarit du bandeau : deux largeurs écrites à la main, et
    // c'est la retouche qui les sépare.
    const pince = nud(corps('.abs-pli-plier'))
    expect(pince).toContain('width:var(--abs-pli-pince)')
    expect(pince).toContain('height:var(--abs-pli-pince)')
    expect(cote('--abs-pli-case')).toBe(30)
    expect(cote('--abs-pli-pli')).toBe(8)
    // et la case d'entête, elle, garde sa cote : le bandeau est dans le dessin, la
    // ligne ne l'est pas. Un `--abs-pli-pince` qui remplacerait les deux serait une
    // égalité fausse, écrite pour éviter une discussion.
    const caseTete = nud(corps('.abs-pli-deplier input'))
    expect(caseTete).toContain('width:var(--abs-pli-case)')
    expect(caseTete).not.toContain('--abs-pli-pince')
    // le mot du prénom garde sa priorité : c'est la troncature qui paie l'espace
    expect(nud(corps('.abs-pli-nom'))).toContain('min-width:0')
  })

  it('37. le mois relit les cotes de la semaine, il ne les re-écrit pas', () => {
    // SA PROPRE CAPTURE (08/12, « le mois n'est pas bien fait, il y a bcp d'anomalies »)
    // nommait six défauts, tous nés de la même cause : des cotes de SEMAINE lues sur
    // trente et une colonnes de trente-six. Le mois n'a donc pas de rules nouvelles,
    // il relit les jetons : chaque valeur ci-dessous est un calcul dont le seul nombre
    // est celui du dessin.
    const hôte = ".abs-cal[data-mode='mois'] {"
    const i = PLI.indexOf(hôte)
    if (i === -1) throw new Error("le mode mois n'a plus de bloc dans la rubrique du pli")
    const mois = nud(PLI.slice(i, PLI.indexOf('}', i)))
    expect(mois).toContain('--abs-pli-pas:calc(var(--abs-pli-pas-semaine)/2)')
    expect(mois).toContain('--abs-pli-entête:var(--abs-pli-pas)')
    expect(mois).toContain('--abs-pli-ciel:0px')
    expect(mois).toContain('--abs-pli-rentrée:calc(2*var(--abs-pli-pas))')
    expect(mois).toContain('--abs-pli-planche:var(--abs-pli-pas)')
    expect(mois).toContain('--abs-pli-empilement:0px')
    expect(mois).toContain('--abs-pli-carré:calc(var(--abs-pli-pas)-2*var(--charte-espace-1))')
    expect(mois).toContain('--abs-pli-tiers:1')
    expect(mois).toContain('--abs-pli-trait-hauteur:100%')
    // la largeur de hachure N'EST PAS relue à 100 % : à trente-six pixels de
    // cellule, le cerne remplissait la case de six diagonales (le zèbre du peigne,
    // rejoué en entête). Elle garde les 40 du dessin, une seule diagonale déborde.
    expect(mois).not.toContain('--abs-pli-hachure-largeur')
    expect(mois).toContain('--abs-pli-hachure-hauteur:calc(var(--abs-pli-pas)-var(--abs-pli-rule))')
    // le peigne du mois est UNE RÈGLE PAR JOUR posée tous les sept jours — pas le
    // peigne de la semaine (trois poils par cellule), qui rayait la page en zèbre.
    // la borne est l'accolade, pas la fin de la rubrique : une tranche sans fin
    // avalerait les neuf règles suivantes et compterait leurs encres (23 au lieu
    // de 1 — une aiguille qui échoue pour une raison d'ordre n'est pas une mesure)
    const débutPiste = PLI.indexOf(".abs-cal[data-mode='mois'] .abs-pli-piste {")
    expect(débutPiste, "le peigne du mois n'a plus de règle").toBeGreaterThan(-1)
    const pisteMois = nud(PLI.slice(débutPiste, PLI.indexOf('}', débutPiste)))
    expect(pisteMois).toContain('background-size:calc(7*var(--abs-pli-jour))')
    // UNE SEULE RIVE : la septième journée suivante commence exactement où finit la
    // septième — un trait à droite ET à gauche peindrait un double aux coutures.
    expect((pisteMois.match(/var\(--charte-encre\)/g) || []).length).toBe(1)
    // la lettre du jour se tait, le quantième se centre, le mot du statut se tait :
    // trois `display`, pas trois tailles réécrites
    expect(nud(corps(".abs-cal[data-mode='mois'] .abs-cal-jour-nom"))).toContain('display:none')
    expect(nud(corps(".abs-cal[data-mode='mois'] .abs-pli-statut"))).toContain('display:none')
    const étiquette = nud(corps(".abs-cal[data-mode='mois'] .abs-cal-jour"))
    expect(étiquette).toContain('padding:0')
    expect(étiquette).toContain('align-items:center')
    // et la semaine NE BOUGE PAS : le mois est une relecture, pas une retouche
    expect(cote('--abs-pli-pas')).toBe(78)
    expect(cote('--abs-pli-planche')).toBe(40)
    expect(cote('--abs-pli-carré')).toBe(51)
    expect(valeur('--abs-pli-tiers')).toBe('3')
    // le nombre du mois se déduit, il n'est pas posé : 39 = la moitié de 78, et la
    // rentrée (78) retrouve la distance absolue de la semaine (1 × 78)
    const pas = cote('--abs-pli-pas-semaine')
    expect(pas / 2).toBe(39)
    expect(2 * (pas / 2)).toBe(pas)
    expect(cote('--abs-pli-rule')).toBe(3)
    expect(pas - cote('--abs-pli-rule')).toBe(75) // la hachure, à la semaine
    expect(pas / 2 - cote('--abs-pli-rule')).toBe(36) // la hachure, au mois
    // et le souffle du CONTENEUR se relit avec la pile : le mois la referme à
    // 2 × 39 = 78 (la distance absolue de la semaine), donc il ne paie ni la
    // chute de droite ni celle du bas — huit pixels de défilement pour une ombre
    // qui n'existe pas est un défilement volé (08/12, « optimise l'espace »)
    const souffle = nud(corps(".abs-cal[data-mode='mois'] .abs-cal-champ"))
    expect(souffle).toContain('padding-right:0')
    expect(souffle).toContain('padding-bottom:0')
  })

  it('38. la page Absences est dans la coque, et son rail porte les images', () => {
    // « RAMENE THE SIDEBAR ET LE RAIL DANS LA PAGE ABSENCE (n\'oublie pas
    // d\'afficher les images respectives des entreprises dans la sidebar comme dans
    // la page employées) », 08/12. Trois lois, trois aiguilles :
    // 1️⃣ une barre, une seule : la page ne se DESSINE pas de rail, elle rend
    //    `<CoqueAdmin sidebar={<SidebarUnique …/>}>` comme Planning, Pauses, Retards ;
    expect(PAGE).toContain("import CoqueAdmin from '../components/coque/CoqueAdmin'")
    expect(PAGE).toContain('<SidebarUnique')
    // 2️⃣ le rail est le FILS DIRECT de `.coque-admin` (Sinon : un wrapper de plus,
    //    et la barre redevient un flex-item qui ôte sa largeur à la page — la faute
    //    du 08/11, reproduite). Deux `<CoqueAdmin` (ouverture + fermeture), rien de plus.
    // `<CoqueAdmin` EN BALISE OUVERTE, une fois : ni l'import, ni le commentaire qui
    // nomme la coque (une aiguille qui compte les SOUS-CHAÎNES d'un fichier compterait
    // aussi la prose — et la prose, ici, cite exactly what we forbid twice).
    expect((PAGE.match(/^\s*<CoqueAdmin$/gm) || []).length).toBe(1)
    expect((PAGE.match(/<\/CoqueAdmin>/g) || []).length).toBe(1)
    // 3️⃣ le rail est lu par TOUTES les pages de la coque via la MÊME fabrique de
    //    sections et le MÊME gabarit de panneau : écrit en dur ici, il dériverait
    //    au premier bouton oublié (c'est déjà la loi des sections, see
    //    `sectionsNavAdmin`).
    expect(PAGE).toContain("import { sectionsNavAdmin } from '../components/coque/sectionsNavAdmin'")
    expect(PAGE).toContain('sectionsNavAdmin({')
    const barre = lire('src', 'components', 'SidebarUnique.jsx')
    const gabarit = Number(barre.match(/const LARGEUR_PANNEAU = (\d+)/)[1])
    expect(gabarit).toBe(254)
    // « COMME DANS LA PAGE EMPLOYÉES » : l'image de l'entreprise, pas sa lettre. Le
    // rond lit `logo_url` sur les objets qu'on lui passe — une requête qui ne la
    // demande pas laisse la lettre du nom, et on croit le logo perdu alors qu'il
    // n'a jamais été demandé (`SelecteurEntreprise`, 26/11).
    const selecteur = lire('src/components/SelecteurEntreprise.jsx')
    expect(selecteur).toContain('entreprise?.logo_url')
    expect(PAGE).toContain('entreprises={entreprises}')
    expect(PAGE).toContain('entrepriseActive={entrepriseActivePourRail}')
    expect(PAGE).toContain(".from('enterprises').select('*')")
    // et le rail n'a pas de sections récrites à la main
    expect(PAGE).not.toContain("label: 'Absences', path: '/absences'")
  })

  it('39. la table des soldes lit sa fabrication dans la base, sur des rails', () => {
    // L'ANOMALIE, 26/12 (capture du fondateur : « on ne comprend pas, il y a des
    // anomalies »). Quatre chiffres serrés sous un entête unique, une note qui
    // n'existait que sous « Acquis », et cette note REJOUÉE à la main depuis la
    // date d'embauche — elle affichait « 2 × 11 mois » sous un « 24 j » que le
    // service avait calculé sur douze mois. Une fabrication qui se rejoue est une
    // fabrication qui ment le lendemain du recalcul : elle se LIT.
    expect(PAGE).not.toContain('explicationAcquis')
    expect(PAGE).toContain('calculation_details')
    expect(PAGE).toContain('last_calculated_at')
    // le nom de la table reste un mot de service, jamais un mot d'écran
    expect(PAGE).not.toContain('employee_leave_balances')

    // LES RAILS. La largeur d'une colonne de nombre se nomme une fois et sert
    // deux fois : au gabarit de la grille et à la jauge, qui doit se comparer
    // d'une ligne à l'autre. 104 = « 2 j/mois × 12 mois » en 11 px.
    expect(cote('--abs-soldes-nombre')).toBe(104)
    const jetonLargeur = CSS.match(/--abs-soldes-largeur:[^;]+;/)[0]
    expect(jetonLargeur).toContain('4 * var(--abs-soldes-nombre)')
    expect(jetonLargeur).toContain('4 * var(--charte-espace-3)')
    const grille = CSS.match(/--abs-soldes-grille:[^;]+;/)[0]
    expect(grille).toContain('minmax(var(--abs-soldes-nombre), 1fr)')
    // le rail s'applique aux lignes, et une seule fois : posé sur chaque nombre,
    // il laissait la table se tasser sous son propre défilement. La règle du
    // défilement se lit dans la FEUILLE, pas dans `PLI` : c'est la tringle qui la
    // porte, et le rail des soldes n'est pas le terrain du pli.
    expect(nud(CSS)).toContain("[data-testid='abs-soldes-liste']>div{min-width:var(--abs-soldes-largeur)")
    expect(nud(CSS)).toContain("[data-testid='abs-soldes-liste']{overflow-x:auto")

    // chaque colonne de nombre porte le nombre PUIS sa fabrication, alignés à
    // droite et sur la même ligne de base — c'est la colonne qui décide, jamais
    // la ligne (`justify-self`, c'est n rails, n décisions)
    const nombre = nud(corps('.abs-soldes-nombre'))
    expect(nombre).toContain('justify-items:end')
    expect(nombre).toContain('align-items:baseline')
    expect(nombre).not.toContain('justify-self')
    // le nom et le matricule ne se touchent plus : deux lignes, une grille
    const identité = nud(corps('.abs-soldes-identité-nom'))
    expect(identité).toContain('display:grid')
    expect(identité).toContain('min-width:0')
    // les quatre nombres sont quatre, pas trois + un solde cerclé à part
    expect((PAGE.match(/className="abs-soldes-nombre"/g) || []).length).toBe(4)
    expect((PAGE.match(/abs-soldes-chiffre/g) || []).length).toBeGreaterThanOrEqual(3)
  })

  it('40. les motifs reprennent l’échelle du pli, sans encre hors charte', () => {
    // LA CAPTURE, 26/12 : huit tuiles cerclées CHACUNE DE SA COULEUR, fond teinté,
    // six rayons différents (16, 13, 11, 10, 9, 3), un dégradé `#C25E28 → #8C3418`
    // pour un seul bouton — le tout en styles inline, donc hors portée du thème
    // sombre et hors de portée de la feuille. La tuile n'a plus qu'un cerclage,
    // celui de la carte ; la couleur du motif ne reste que là où c'est UNE DONNÉE.
    const motifs = lire('src', 'components', 'AbsencesMotifsManager.jsx')
    expect(motifs).not.toMatch(/#[0-9A-Fa-f]{6}/)
    expect(motifs).not.toMatch(/rgba\(/)
    expect(motifs).not.toMatch(/borderRadius/)
    expect(motifs).not.toMatch(/linear-gradient/)
    expect(motifs).not.toMatch(/!important/)
    // les classes de la pile, plus les boutons de la maison
    for (const c of ['abs-motifs-pile', 'abs-motifs-carte', 'abs-motifs-pince', 'ch-btn-pleine', 'ch-champ-cadre']) {
      expect(motifs).toContain(c)
    }
    // le nombre d'usages se lit avec son mot, sinon un « 2 » nu se lit comme un code
    expect(motifs).toContain('absence{nb === 1 ?')

    // LE RAIL, à la mesure du pli : une planche = 224, la pince = la case de
    // l'entête (30), le glyphe = son carré. Sous la planche, `min(100%, …)`
    // évite la gouttière — c'est pour ça que cette rubrique n'a pas de media.
    expect(cote('--abs-motifs-planche')).toBe(224)
    expect(cote('--abs-motifs-glyphe')).toBe(34)
    const pile = nud(corps('.abs-motifs-pile'))
    expect(pile).toContain('repeat(auto-fill,minmax(min(100%,var(--abs-motifs-planche)),1fr))')
    const tuile = nud(corps('.abs-motifs-carte'))
    expect(tuile).toContain('grid-template-columns:autominmax(0,1fr)auto')
    expect(tuile.match(/border:/g) || []).toHaveLength(1)
    const pince = nud(corps('.abs-motifs-pince'))
    expect(pince).toContain('width:var(--abs-pli-case)')
    expect(pince).toContain('border:var(--abs-pli-rule)solidvar(--charte-encre)')
    expect(pince).not.toContain('box-shadow')
  })


  it('41. la page ne rustine plus l’application : le repli vit dans sa feuille', () => {
    // LE RELEVÉ, 26/12 (« rends la page absences responsive tout écran, mobile,
    // tablette, desktop »). La balise `<style>` de la page pesait 9 Ko et choisissait
    // 48 sélecteurs, dont 28 que plus aucun composant du dépôt ne monte. Sans portée,
    // ces règles peignaient les AUTRES écrans pendant que la page était ouverte
    // (`.stats-grid` de Pointages en deux colonnes, `body { overflow-x: hidden }` qui
    // coupait le défilement du tableau, `button { min-height: 44px !important }` qui
    // enflait chaque pince du pli — et l'aplomb du pli se règle à la case de 30).
    const styleBrut = PAGE.slice(PAGE.indexOf('<style>{`'), PAGE.indexOf('`}</style>'))
    expect(styleBrut.length).toBeLessThan(3200) // 9 Ko d'héritage, plus jamais
    // le commentaire de la balise NOMME les sélecteurs qu'il enterre — une aiguille
    // qui compte des sous-chaînes lit donc la prose, pas le contrat : on coupe les
    // commentaires avant de mesurer (la leçon du 08/12 sur `<CoqueAdmin`)
    const style = styleBrut.replace(/\/\*[\s\S]*?\*\//g, '')
    // aucune couleur en dur, aucun sélecteur d'un autre écran, pas de `body`
    expect(style).not.toMatch(/#[0-9A-Fa-f]{3,8}/)
    expect(style).not.toMatch(/rgba?\(/)
    // LE RECENSEMENT, pas la liste de ce qui est interdit : énumérer les sélecteurs
    // Enterres se retourne contre l'aiguille dès qu'un survivant en est le préfixe
    // (`.cal-day` relisait `.cal-day-click`, conservé lui). Ce que la balise sait
    // nommer tient en cinq classes — les cinq que la page monte.
    const connues = [...new Set([...style.matchAll(/\.([a-z][a-z0-9-]+)/g)].map((m) => m[1]))].sort()
    expect(connues).toEqual(['abs-page', 'absence-card-hover', 'afro-card', 'cal-day-click', 'doc-view-btn'])
    // une seule règle porte un `!important`, et c'est le repli de mouvement borné
    // à `.abs-page` — un inline ne se commande qu'ainsi
    expect((style.match(/!important/g) || []).length).toBe(2)
    expect(style).toContain(".abs-page [style*='animation']")
    // quatre images de mouvement (deux accolades chacune), sept règles d'effets,
    // un bloc de repli : le recensement des classes ci-dessus est la vraie borne,
    // compter les accolades n'aurait gardé que l'écriture du jour
    expect((style.match(/@keyframes/g) || []).length).toBe(4)

    // et le responsive de CETTE page se lit dans sa feuille, au seuil du composant
    // qui le porte : table qui défile avec son identité collante, tuiles en rail
    // fluide, aucun repli qui re-dessine le pli (verrou 25)
    expect(nud(CSS)).toContain('.abs-soldes-identité{display:flex')
    expect(nud(corps('.abs-soldes-identité'))).toContain('position:sticky')
    expect(nud(corps('.abs-soldes-identité'))).toContain('z-index:1')
    // le rail fluide à sa place, et UN seul repli pour lui, dans le bloc du pli :
    // `corps()` lit la PREMIÈRE règle du sélecteur et c'est le repli qui est écrit
    // avant la définition — d'où la feuille entière, deux aiguilles distinctes
    expect(nud(CSS)).toContain('.abs-config-grille{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))')
    expect(nud(CSS)).toContain('.abs-config-grille{grid-template-columns:1fr')
  })

})
