import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import AbsencesCalendrier from '../../components/AbsencesCalendrier'

// ═══════════════════════════════════════════════════════════
// 🪢 LA CORDE PAR EMPLOYÉ — le contrat du corps du calendrier
//
// Maquette : `maquettes/absences-grille-1-corde.png`, retenue le 10/12 avec
// « je choisis le 1… je veux absolument avoir ce rendu ». Ce fichier ne rejoue
// pas la capture (les prénoms et les « 30/30 » du dessin sont des taches) : il
// garde les promesses qui ne se voient pas dessus.
//
//   1. LA PREUVE DE PRÉSENCE EST DESSINÉE : un anneau par jour de la période,
//      réparti sur les mêmes colonnes que l'entête, et pas un `left` calculé à
//      la main. Une case vide ne prouvait rien ; un trait tendu prouve.
//   2. LES COLONNES NE SONT PLUS DES CELLULES : `data-jour` n'existe que dans
//      l'entête. Si le corps se remet à rendre sept `<div>` par ligne, le
//      compteur double et ce fichier le refuse.
//   3. LA PLANCHE PEND, ELLE N'EST PAS POSÉE : une ficelle de `descente` qui
//      ENTRE dans le trait, et le rang qui se déduit d'un seul nombre
//      d'empilement, partagé entre la planche et la ligne.
//   4. LE MÉTIER EST INTACT : `segmentSurJours` positionne en pourcentage,
//      `styleBarreAbsence` garde sa loi (couleur = motif, trait = statut), le
//      dépôt vise toujours le jour sous le pointeur.
//   5. LE SOLDE DEVIENT UNE LONGUEUR, avec le nombre à côté.
// ═══════════════════════════════════════════════════════════

const RACINE = path.resolve(import.meta.dirname, '../../..')
const lire = (...chemins) => fs.readFileSync(path.join(RACINE, ...chemins), 'utf8')

const COMPOSANT = lire('src', 'components', 'AbsencesCalendrier.jsx')
const FEUILLE = lire('src', 'pages', 'AbsencesAfroTech.css')
const CSS = FEUILLE.replace(/\/\*[\s\S]*?\*\//g, '')
// La rubrique de la corde commence à ses jetons et court jusqu'à la fin de la
// feuille : elle en est la DERNIÈRE rubrique, et c'est la tringle qui est bornée
// (`absencesCalendrierTringle.test.jsx` s'arrête à `--abs-corde-fil`, avec son
// propre `throw`). Le 6/12, une section ajoutée en fin de fichier avait
// silencieusement élargi trois verrous de la tringle ; si la corde cesse d'être
// dernière, c'est ici qu'on pose la borne — pas en relâchant un verrou voisin.
const CORDE = CSS.slice(CSS.search(/\.abs-cal\s*\{\s*--abs-corde-fil/))
if (!CORDE.startsWith('.abs-cal')) throw new Error('rubrique de la corde introuvable en fin de feuille')
if (CSS.slice(0, CSS.search(/\.abs-cal\s*\{\s*--abs-corde-fil/)).includes('--abs-corde-repos')) {
  throw new Error('un jeton de la corde se retrouve AVANT la rubrique : tringle et corde ne sont plus séparées')
}

const DESSIN = 'maquettes/absences-grille-1-corde.png'

const nud = (c) => c.replace(/\s+/g, '')

function declarations(sélecteur, plage = CSS) {
  const i = plage.indexOf(`${sélecteur} {`)
  if (i === -1) throw new Error(`règle absente de la feuille : ${sélecteur}`)
  const début = plage.indexOf('{', i)
  const fin = plage.indexOf('}', début)
  return plage.slice(début + 1, fin)
}

function jeton(plage, nom) {
  const trou = plage.split(`${nom}:`)[1]
  if (!trou) throw new Error(`jeton absent : ${nom}`)
  return Number(trou.trim().split(';')[0].replace('px', ''))
}

// ── le jeu de données : la semaine du lundi 19 au dimanche 25 octobre 2026 ──
const employes = [
  { id: 'e1', first_name: 'Aïssatou', last_name: 'Diallo', enterprise_id: 'ent-1' },
  { id: 'e2', first_name: 'Mamadou', last_name: 'Sarr', enterprise_id: 'ent-1' },
  { id: 'e3', first_name: 'Salimata', last_name: 'Cissé', enterprise_id: 'ent-2' },
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
  absence('a1', 'e1', '2026-10-19', '2026-10-21', 'conge'),
  absence('a2', 'e2', '2026-10-20', '2026-10-20', 'maladie', { status: 'en_attente' }),
  absence('a3', 'e3', '2026-10-22', '2026-10-23', 'injustifie', { status: 'refuse' }),
  // deux chevauchements sur la même corde : la deuxième planche descend d'un rang
  absence('a4', 'e1', '2026-10-20', '2026-10-22', 'formation'),
]

const fériés = new Set(['2026-10-20']) // un seul employé de ent-2 est férié ailleurs

function rendre(props = {}) {
  return renderToStaticMarkup(
    <AbsencesCalendrier
      absences={absences}
      employes={employes}
      annee={2026}
      mois={9}
      mode="semaine"
      jourInitial="2026-10-21"
      darkMode
      getHolidaySet={(id) => (id === 'ent-2' ? fériés : new Set())}
      joursPrisParEmploye={{ e1: 4 }}
      plafondConges={30}
      {...props}
    />
  )
}

const grille = rendre()
const grilleMois = rendre({ mode: 'mois' })
const grilleJour = rendre({ mode: 'jour' })

/** la planche d'un statut donné, 900 caractères à partir de son ouverture */
function plancheDe(html, statut) {
  const i = html.indexOf(`data-statut="${statut}"`)
  if (i === -1) throw new Error(`aucune planche ${statut} rendue`)
  return html.slice(i, i + 900)
}

/** les anneaux d'UNE ligne */
function anneauxDe(html, employe) {
  const début = html.indexOf(`data-employe="${employe}"`)
  const fin = html.indexOf('data-employe="', début + 10)
  const ligne = html.slice(début, fin === -1 ? html.length : fin)
  return {
    ligne,
    tous: [...ligne.matchAll(/data-anneau="([^"]+)"/g)].map((m) => m[1]),
  }
}

describe('🪢 la corde par employé', () => {
  it('0. la maquette retenue est dans le dépôt et nommée dans le composant', () => {
    expect(fs.existsSync(path.join(RACINE, DESSIN))).toBe(true)
    expect(COMPOSANT).toContain(DESSIN)
  })

  it('1. une ligne par employé, et lʼanneau est la preuve du jour', () => {
    expect((grille.match(/data-testid="abs-corde-ligne"/g) || [])).toHaveLength(3)
    // sept jours d'affilée sur chaque corde
    expect(anneauxDe(grille, 'e1').tous).toHaveLength(7)
    // les week-ends sont chômés dʼoffice (samedi 24 ? non : lundi→dimanche,
    // le samedi 24 octobre et le dimanche 25 tombent en bout de semaine)
    const e1 = anneauxDe(grille, 'e1')
    expect(e1.tous[5]).toBe('chômé') // samedi
    expect(e1.tous[6]).toBe('chômé') // dimanche
    expect(e1.tous[0]).toBe('travaillé') // lundi
  })

  it('2. le férié vient de lʼentreprise de la ligne, pas dʼune liste globale', () => {
    // le mardi 20 est férié pour ent-2 seulement : Salimata le voit plein,
    // les deux autres le voient creux
    expect(anneauxDe(grille, 'e3').tous[1]).toBe('chômé')
    expect(anneauxDe(grille, 'e1').tous[1]).toBe('travaillé')
    expect(COMPOSANT).toContain('feriers.has(j.iso) || j.weekend')
  })

  it('3. les colonnes ne sont plus des cases : data-jour reste dans lʼentête', () => {
    // sept `data-jour` pour sept jours — pas quatorze (entête + corps) ni
    // trente et un : le jour ne se dessine plus en cellule, il se lit à l'anneau
    expect((grille.match(/data-jour="/g) || [])).toHaveLength(7)
    expect((grilleMois.match(/data-jour="/g) || [])).toHaveLength(31)
    expect(anneauxDe(grille, 'e1').ligne).not.toContain('data-jour=')
    // et le corps n'a plus une `<div>` de fond par jour
    expect(anneauxDe(grille, 'e1').ligne).not.toContain('borderLeft')
  })

  it('4. les anneaux se répartissent comme lʼentête, sans un seul left calculé', () => {
    const i = declarations('.abs-corde-anneaux i', CORDE)
    // nud() ôte les espaces : `flex: 1 1 0` s'écraserait en `flex:110`, un
    // truqueur qui lirait l'inspecteur calculé s'y laisserait prendre
    expect(i).toMatch(/flex:\s*1\s+1\s+0/)
    expect(nud(i)).not.toContain('left:')
    // et l'anneau ne se centre PAS sur sa colonne : relevé 08/12, les six trous
    // du dessin sont à x 474, 596, 716, 832, 947, 1062 — les BORNES des
    // cellules — quand les étiquettes restent centrées dans les leurs (411,
    // 534, 656…). Un `left: 50%` posait donc chaque anneau sous le chiffre du
    // jour, un demi-jour à droite de son tracé : c'est le décalage que le
    // fondateur voyait de travers. L'anneau naît à `left: 0`, à cheval sur la
    // borne, et `translateX(-50%)` le partage entre les deux journées.
    const anneau = nud(declarations('.abs-corde-anneaux i::before', CORDE))
    expect(anneau).toContain('left:0')
    expect(anneau).toContain('translateX(-50%)')
  })

  it('5. lʼanneau creux et la pastille pleine : le trou est peint, pas posé', () => {
    const creux = nud(declarations('.abs-corde-anneaux i::before', CORDE))
    // le trou relit la teinte de la BANDE, pas un blanc recopié : un trou
    // transparent n'est pas un trou, c'est un cercle posé sur un trait
    expect(creux).toContain('background:var(--abs-corde-fond)')
    const plein = nud(declarations(".abs-corde-anneaux i[data-anneau='chômé']::before", CORDE))
    expect(plein).toContain('background:var(--charte-encre)')
    // et le mot est dans l'attribut : un lecteur d'écran n'a pas à deviner
    expect(anneauxDe(grille, 'e1').ligne).toContain('data-anneau="chômé"')
    // un férié d'entreprise et un dimanche ont la même pastille — la maquette
    // choisie ne les distinguait pas — mais pas la même raison, et la raison
    // se lit au survol de l'anneau
    expect(anneauxDe(grille, 'e1').ligne).toContain('chômé (week-end)')
    expect(anneauxDe(grille, 'e3').ligne).toContain("chômé (férié de l’entreprise)")
    expect(anneauxDe(grille, 'e1').ligne).toContain('travaillé')
  })
  it('6. la planche est accrochée : deux cordons qui traversent le fil', () => {
    // le dessin n'a pas une ficelle au milieu de la carte : il en a DEUX, à six
    // pixels des coins, et chacune dépasse le trait. Un cordon de 2 px qui
    // touche sans traverser ne retient rien — mesuré sur mon rendu, on ne le
    // voyait pas : une carte posée, pas une carte accrochée.
    const cordons = nud(declarations('.abs-corde-cordons', CORDE))
    expect(cordons).toContain('border-left:var(--abs-corde-cordons)')
    expect(cordons).toContain('border-right:var(--abs-corde-cordons)')
    expect(cordons).toContain('left:var(--abs-corde-coin)')
    expect(cordons).toContain('right:var(--abs-corde-coin)')
    // hauteur = la montée + le trait + un cordon par-dessus : le cordon ENTRE
    // dans le fil, il ne s'arrête pas devant
    expect(cordons).toContain(
      'top:calc(-1*(var(--abs-corde-montée)+var(--abs-corde-fil)+var(--abs-corde-cordons)))',
    )
    expect(cordons).toContain(
      'height:calc(var(--abs-corde-montée)+var(--abs-corde-fil)+var(--abs-corde-cordons))',
    )
    // la montée est UN seul calcul, posé sur la carte : cordons et nœud le
    // relisent, personne ne redessine l'arithmétique du rang
    const planche = nud(declarations('.abs-corde-planche', CORDE))
    expect(planche).toContain(
      '--abs-corde-montée:calc(var(--abs-corde-descente)+var(--abs-corde-rang,0)*var(--abs-corde-empilement))',
    )
  })
  it('6bis. au deuxième rang, cordons et nœud suivent le fil', () => {
    // une montée de `descente` seulement laisse la deuxième carte accrochée à
    // vingt-six pixels sous le trait, et le nœud avec elle. Les deux relisent
    // `--abs-corde-montée` : un seul endroit où écrire le rang.
    for (const sel of ['.abs-corde-cordons', '.abs-corde-noeud']) {
      expect(nud(declarations(sel, CORDE))).toContain('var(--abs-corde-montée)')
    }
    // le nœud est CENTER sur le fil, à la même arithmétique que l'anneau
    const anneau = nud(declarations('.abs-corde-anneaux i::before', CORDE))
    const nœud = nud(declarations('.abs-corde-noeud', CORDE))
    expect(anneau).toContain('+var(--abs-corde-fil)/2-(var(--abs-corde-anneau)+2*var(--abs-corde-cercle))/2)')
    expect(nœud).toContain('-var(--abs-corde-fil)/2-var(--abs-corde-noeud)/2)')
    // et il est sur le cordon de gauche, pas à côté
    expect(nœud).toContain('left:var(--abs-corde-coin)')
    // au premier rang la montée est nulle : la carte ne descend que de sa
    // `descente`, c'est `rang` qui la descend — pas un décalage constant
    expect(declarations('.abs-corde-planche', CORDE)).toContain('--abs-corde-rang, 0')
  })
  it('7. la planche accroche ses cordons aux centres de ses jours de rive', () => {
    // a1 : lundi 19 → mercredi 21, index 0 à 2 sur 7 jours. Le dessin ne pose
    // pas la carte sur les cellules : il la pend aux CENTRES du premier et du
    // dernier jour, et l'aile (12 px) déborde de chaque cordon — mesuré carte de
    // x 524 a 790 pour des cordons a 536 et 776. Les deux rives se lisent donc
    // en `left` ET `right` : une largeur recopiee ferait deborder la carte d'un
    // demi-jour des deux cotes, et la coupe de fenetre n'aurait plus ou s'accrocher.
    expect(grille).toContain('left:calc(7.142857142857142% - var(--abs-corde-aile))')
    // rive gauche au centre du lundi (0,5 / 7 = 7,14 %), rive droite au centre
    // du mercredi (3,5 / 7 = 50 %, donc 64,29 % depuis le bord droit)
    expect(grille).toContain('right:calc(64.28571428571428% - var(--abs-corde-aile))')
    expect(declarations('.abs-corde-planche', CORDE)).toContain('--abs-corde-aile')
    // en vue mensuelle, les quatre planches sont entieres : les huit rives se
    // hangent aux centres de jour, pas une seule ne se colle au bord
    expect((grilleMois.match(/left:calc\([^)]*--abs-corde-aile\)/g) || [])).toHaveLength(4)
    expect((grilleMois.match(/right:calc\([^)]*--abs-corde-aile\)/g) || [])).toHaveLength(4)
    expect(grilleMois).not.toContain('left:2px')
    // une periode coupee par la fenetre, elle, touche le bord : c'est la branche
    // `seg.coupeeAvant` du composant, et pas une cote de plus a recopier
    expect(COMPOSANT).toContain('left: nbJours === 1 || seg.coupeeAvant')
    expect(COMPOSANT).toContain('right: nbJours === 1 || seg.coupeeAprès')
    // en mode jour, la colonne unique EST le champ : les deux rives au bord
    expect(grilleJour).toContain('left:2px')
    expect(grilleJour).toContain('right:2px')
    expect(grilleJour).toContain('data-anneau="travaillé"')
    expect((grilleJour.match(/data-anneau=/g) || [])).toHaveLength(3) // un anneau par ligne
  })

  it('8. deux planches qui se chevauchent descendent dʼun rang, la ligne grandit', () => {
    // e1 porte a1 (19→21) et a4 (20→22) : elles se recouvrent, donc a4 prend
    // le rang 1 et la ligne annonce deux rangs
    const { ligne } = anneauxDe(grille, 'e1')
    expect(ligne).toContain('--abs-corde-rangs:2')
    expect(ligne).toContain('--abs-corde-rang:1')
    // le cran d'empilement et la hauteur que la ligne doit laisser libre se
    // déduisent du MÊME nombre : écrits deux fois, ils se contredisent à la
    // première retouche, et le deuxième rang mangeait la bande du dessous
    const planche = nud(declarations('.abs-corde-planche', CORDE))
    const règle = nud(declarations('.abs-corde-ligne', CORDE))
    expect(planche).toContain('var(--abs-corde-empilement)')
    expect(règle).toContain(
      'min-height:calc(var(--abs-corde-repos)+(var(--abs-corde-rangs,1)-1)*var(--abs-corde-empilement))',
    )
    // `min-height`, jamais `height` : une ligne d'un seul rang reste à la cote
    // du dessin, une ligne à trois rangs la dépasse sans se faire couper
    expect(règle).not.toMatch(/;height:calc/)
    // et le champ respire sous la dernière ligne d'exactement ce que la carte
    // déborde de la sienne : `overflow-x: auto` coupe, il faut rendre la place
    const jetons = declarations('.abs-cal', CORDE)
    expect(nud(jetons)).toContain(
      '--abs-corde-débord:calc(var(--abs-corde-fil-top)+var(--abs-corde-fil)+var(--abs-corde-descente)+var(--abs-corde-carte)-var(--abs-corde-repos))',
    )
    expect(nud(declarations('.abs-cal-champ', CORDE))).toContain(
      'padding-bottom:var(--abs-corde-débord)',
    )
  })
  it('9. la cote vient du dessin, pas dʼune échelle quʼon sʼinvente', () => {
    // relevées à la règle sur `maquettes/absences-grille-1-corde.png` (son
    // canevas fait 1 422 px de large : l'échelle est celle d'un écran, les
    // cotes se recopient). Le 25/11, je les avais rétrécies à la taille des
    // micro-étiquettes de l'application « par pureté de jetons » : ce n'était
    // pas une contrainte, c'était mon arbitrage — et le rendu ne ressemblait
    // plus au dessin. Ces nombres sont LA cote, pas une intention.
    const jetons = declarations('.abs-cal', CORDE)
    const cote = (nom) => jeton(jetons, nom)
    expect(cote('--abs-corde-repos')).toBe(50) // le pas d'une ligne (dessin : 48,5)
    expect(cote('--abs-corde-carte')).toBe(46) // la hauteur de la carte (214..258)
    expect(cote('--abs-corde-descente')).toBe(14) // le fil (198) au bord haut (214)
    // LE FIL NE COLLE PAS AU HAUT DE LA BANDE : il court a y 196 dans une ligne
    // qui commence a 175. Pose a 2 px, il montait toute la pile de dix-neuf
    // pixels — les anneaux sous la regle, la jauge flotter sous la carte.
    expect(cote('--abs-corde-fil-top')).toBe(21)
    expect(cote('--abs-corde-fil')).toBe(3) // le trait tendu (y 196, 197, 198)
    expect(cote('--abs-corde-encre')).toBe(3) // le contour de la carte
    expect(cote('--abs-corde-cordons')).toBe(3) // x 535..537
    expect(cote('--abs-corde-coin')).toBe(12) // 536 − 524
    expect(cote('--abs-corde-aile')).toBe(12) // la carte deborde son cordon
    expect(cote('--abs-corde-anneau')).toBe(10) // le trou : le fil s'interrompt
    expect(cote('--abs-corde-cercle')).toBe(3) // 16 × 15 hors-tout
    expect(cote('--abs-corde-jauge')).toBe(74) // dessin : x 1190..1261, soit 72
    expect(cote('--abs-corde-jauge-hauteur')).toBe(15) // y 190..204
    expect(cote('--abs-corde-entete')).toBe(76) // y 96..172
    expect(cote('--abs-corde-lavage')).toBe(1) // x 595..715 : une colonne, pas 1,5
    // la carte DÉBORDE exprès de sa ligne : 46 dans 50, descendue de 26, elle
    // passe devant le fil du voisin. La réduire pour la faire tenir, c'était
    // exactement la trahison reprochée.
    expect(cote('--abs-corde-descente') + cote('--abs-corde-carte')).toBeGreaterThan(cote('--abs-corde-repos'))
    const planche = nud(declarations('.abs-corde-planche', CORDE))
    expect(planche).toContain('height:var(--abs-corde-carte)')
    expect(planche).toContain('border-width:var(--abs-corde-encre)')
    expect(planche).toContain('box-shadow:var(--charte-ombre-dure)')
    // et le z-index qui la pose devant les bandes suivantes — sans lui, sa
    // queue est mangée par la ligne du dessous
    expect(planche).toContain('z-index:2')
  })
  it('10. le solde est une longueur, avec le nombre à côté', () => {
    const { ligne } = anneauxDe(grille, 'e1')
    // 4 jours pris sur un plafond de 30 → 26 restants, et la jauge pleine à
    // 87 % (26/30 arrondi) : la jauge dit ce qui RESTE, comme le nombre
    expect(ligne).toContain('--abs-corde-plein:87%')
    expect(ligne).toContain('26/30')
    // un employé qui n'a rien pris a la jauge pleine ET le nombre
    expect(grille).toContain('30/30')
    expect(grille).toContain('class="abs-corde-jauge"')
  })

  it('11. le statut se lit : la couleur dit le motif, le trait dit le statut', () => {
    // a2 est en attente : contour pointillé ET le mot. On ancre sur l'état de
    // la planche, pas sur le libellé du motif — « Absence injustifiée » se lit
    // aussi sur une pince de la tringle et l'indexOf retombe sur la tringle
    const a2 = plancheDe(grille, 'en_attente')
    expect(a2).toContain('border-style:dashed')
    expect(a2).toContain('En attente')
    // a3 est refusée : barrée et le mot
    const a3 = plancheDe(grille, 'refuse')
    expect(a3).toContain('line-through')
    expect(a3).toContain('Refusé')
    // une approuvée ne porte pas de mot de statut : la plaine couleur le dit
    expect(grille).not.toMatch(/abs-corde-statut">Approuvé/)
  })

  it('12. la légende apprend les deux anneaux', () => {
    expect(COMPOSANT).toContain('anneau = jour travaillé')
    expect(COMPOSANT).toContain('pastille = chômé')
    // et la légende existante n'a pas été amputée au passage
    for (const mot of ['En attente (contour pointillé)', 'Refusé (barré)', 'à cheval sur la période', '📎 justificatif joint', '⚡ conflit de pointage']) {
      expect(COMPOSANT).toContain(mot)
    }
  })

  it('13. le dépôt dʼune pince vise toujours le jour sous le pointeur', () => {
    expect(grille).toContain('data-drop-lane="e1"')
    expect(COMPOSANT).toContain('jourDepuisX(e.clientX, rect, nbJours)')
    expect(COMPOSANT).toContain('onDeposerMotif({ employeeId: ligne.employe.id, dateIso: jours[index].iso, motifId })')
    expect(CORDE).not.toContain('.abs-drop-cell') // la marque du jour visé n'a pas bougé de rubrique
    expect(FEUILLE).toContain('.abs-drop-cell')
  })

  it('14. la corde nʼapporte ni couleur en dur, ni flou, ni rayon hors liste', () => {
    expect(CORDE).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/)
    expect(CORDE).not.toMatch(/rgba?\(/)
    expect(CORDE).not.toContain('blur(')
    // un rayon multiple se lit coin par coin : le lavage de l'entête est arrondi
    // du haut et droit du bas (il se recoud a la bande), et `0` n'est pas un
    // rayon hors liste — c'est l'absence de rayon
    const autorisés = ['var(--charte-rayon-champ)', 'var(--charte-rayon-carte)', 'var(--charte-rayon-pilule)']
    for (const r of [...CORDE.matchAll(/border-radius:\s*([^;]+);/g)].map((m) => m[1].trim())) {
      for (const coin of r.split(/\s+/)) {
        expect(coin === '0' || autorisés.includes(coin)).toBe(true)
      }
    }
  })

  it('15. tout ce que la corde appelle est déclaré quelque part', () => {
    // un `var(--x)` non déclaré retombe à 0 — c'est exactement comme ça que
    // l'anneau de la poutre s'était téléporté le 2/12
    // un var(--x, repli) est voulu : c'est un jeton que le JSX pose en ligne
    // (`--abs-corde-rang`, `--abs-corde-rangs`, `--abs-corde-plein`). Ce que la
    // feuille appelle SANS repli doit être déclaré, ici ou sur la règle qui le
    // consomme — et le test vérifie aussi que les cinq exclus le sont vraiment.
    const appelés = [...CORDE.matchAll(/var\((--abs-corde-[a-zé-]+)\)/g)].map((m) => m[1])
    expect(appelés.length).toBeGreaterThan(15)
    const posésParLeJSX = ['--abs-corde-employe', '--abs-corde-solde', '--abs-corde-nb-jours']
    const posésLocalement = ['--abs-corde-fond', '--abs-corde-montée']
    const Déclarés = declarations('.abs-cal', CORDE)
    for (const nom of new Set(appelés)) {
      if (posésParLeJSX.includes(nom) || posésLocalement.includes(nom)) continue
      expect(Déclarés).toContain(`${nom}:`)
    }
    // mais il faut qu'ils soient posés : sinon le jeton appelant retombe à zéro
    // et la colonne s'effondre sans un mot
    for (const nom of posésParLeJSX) expect(COMPOSANT).toContain(`'${nom}'`)
    for (const nom of posésLocalement) expect(CORDE).toContain(`${nom}:`)
  })
  it('16. aucune media ne repositionne la corde', () => {
    const medias = CORDE.slice(CORDE.indexOf('@media'))
    for (const m of medias.matchAll(/^\s*([.:#][^,{]*)[,{]/gm)) {
      expect(['.abs-corde-nom', '.abs-corde-jauge']).toContain(m[1].trim())
    }
    expect(medias).not.toContain('.abs-corde-anneaux')
    expect(medias).not.toContain('.abs-corde-planche')
  })

  it('17. lʼentête et la piste partagent un seul modèle de largeur', () => {
    // LA panne du 25/11, mesurée sur l'écran : −8 px au premier jour, −97 px au
    // septième, et le repère du jour hors de sa colonne. Les formules étaient
    // lisibles et justes chacune — c'est le champ de l'entête qui oubliait la
    // colonne du solde. Lire les formules n'est pas vérifier : ce test compare
    // les DEUX côtés, c'est le seul moyen de voir revenir la dérive.
    const entête = nud(declarations('.abs-cal-entete-jours', CORDE))
    const piste = nud(declarations('.abs-corde-piste', CORDE))
    expect(entête).toContain('flex:110')
    expect(piste).toContain('flex:110')
    for (const sel of ['.abs-cal-entete-employes', '.abs-corde-tete']) {
      expect(nud(declarations(sel, CORDE))).toContain('width:var(--abs-corde-employe)')
    }
    for (const sel of ['.abs-cal-entete-solde', '.abs-corde-solde']) {
      expect(nud(declarations(sel, CORDE))).toContain('width:var(--abs-corde-solde)')
    }
    // la réserve du composant porte les trois termes : sans le solde, le
    // `minWidth` ment et la piste se tasse dès que l'écran raccourcit
    expect(COMPOSANT).toMatch(
      /minWidth: LARGEUR_EMPLOYE \+ nbJours \* largeurJour \+ LARGEUR_SOLDE/,
    )
    // la colonne du solde a UNE valeur : la barre du dessin fait 72 px (x 1190
    // → 1261), le nombre s'écrit à côté jusqu'à x 1319, et la colonne mesurée en
    // fait cent quatre-vingt-quatorze sur un canevas de 1 376 — seize pour cent
    // du champ, soit 136 ici. Élargir la colonne pour loger un corps de lettre
    // qu'on n'a pas mesuré, c'est dériver le partage des jours.
    expect(COMPOSANT).toContain('const LARGEUR_SOLDE = 136')
    // le dessin ne sépare pas les jours par un filet
    expect(nud(declarations('.abs-cal-jour', CORDE))).not.toContain('border-left')
  })

  it('18. le champ est nu : des bandes, pas une carte blanche', () => {
    // le dessin n'a ni cadre autour du calendrier, ni fond blanc derrière les
    // lignes : le sable de la maison EST le fond, les lignes s'y posent en
    // bandes alternées. Le jour où un fond de carte se glisse dans une ligne de
    // corde, la maquette est trahie — et ce fichier le refuse.
    const ligne = nud(declarations('.abs-corde-ligne', CORDE))
    expect(ligne).toContain('background:var(--abs-corde-fond)')
    expect(ligne).not.toContain('border-top')
    expect(ligne).not.toContain('border-bottom')
    expect(CORDE).not.toMatch(/\.abs-corde-(ligne|tete|piste)[^{]*\{[^}]*var\(--charte-blanc\)/)
    // la bande alterne par le TON, pas par un filet, et elle vient d'un
    // attribut posé par le composant : un `:nth-child` compterait l'entête,
    // premier enfant du champ, et inverserait toutes les lignes
    expect(CORDE).toContain(".abs-corde-ligne[data-alterné='vrai']")
    expect(CORDE).not.toContain('.abs-corde-ligne:nth-child')
    expect(COMPOSANT).toContain('data-alterné={ligneIdx % 2 === 1 ?')
    // les deux colonnes collantes relisent la teinte de la bande : un fond qui
    // traînerait son propre blanc laisserait une bande claire traverser le
    // défilement horizontal
    for (const sel of ['.abs-corde-tete', '.abs-corde-solde']) {
      expect(nud(declarations(sel, CORDE))).toContain('background:var(--abs-corde-fond)')
    }
  })

  it('18bis. la vignette de tête suit la cote du dessin : large et teintée', () => {
    // relevée : x 42..119, y 180..214 — un rectangle de 78 × 35, TINTÉ (le ton
    // mesuré (230, 218, 193) est celui de `--charte-surface2`), sans un seul
    // trait d'encre sur son bord. J'avais posé un carré cerclé de 34 : c'était
    // mon habitude, pas la cote. Et l'entête prend le pas d'une ligne, 50 px,
    // avec un filet de 2 px — pas un trait de corde.
    const jetons = declarations('.abs-cal', CORDE)
    expect(jeton(jetons, '--abs-corde-figure-largeur')).toBe(78)
    expect(jeton(jetons, '--abs-corde-figure-hauteur')).toBe(35)
    const vignette = nud(declarations('.abs-corde-figure', CORDE))
    expect(vignette).toContain('background:var(--charte-surface2)')
    expect(vignette).not.toContain('border:')
    expect(vignette).toContain('object-fit:cover')
    // le prénom se borne : la vignette large ne pousse pas la ligne à deux étages
    expect(nud(declarations('.abs-corde-nom', CORDE))).toContain('text-overflow:ellipsis')
    const entête = nud(declarations('.abs-cal-entete', CORDE))
    // 76 px, pas le pas d'une ligne : le dessin joue son entête sur un registre
    // large parce que ses étiquettes sont à la taille de titre (capitales de
    // 16 px mesurées dans « L 23 »). Le filet du bas EST la règle du dessin.
    expect(entête).toContain('min-height:var(--abs-corde-entête)')
    expect(entête).toContain('border-bottom:var(--charte-trait)solidvar(--charte-bordure)')
    // et l'échelle de lettre suit la cote : entête, prénom, carte, nombre du
    // solde — les quatre se lisent au titre, jamais au micro
    for (const sel of ['.abs-cal-entete-employes', '.abs-cal-jour-nom', '.abs-cal-jour-num', '.abs-corde-nom', '.abs-corde-planche', '.abs-corde-nombre']) {
      expect(nud(declarations(sel, CORDE))).toContain('font-size:var(--charte-taille-titre)')
    }
    // le chiffre n'est plus en mono : le dessin écrit la lettre et le nombre du
    // même coup de plume, à la police du corps
    expect(nud(declarations('.abs-cal-jour-num', CORDE))).not.toContain('var(--charte-mono)')
  })

  it('19. aujourdʼhui se lave, ça ne se devine pas', () => {
    // le dessin ne laisse pas un cheveu pâle dans une case : la journée est
    // lavée d'ambre sur UNE colonne, du haut de l'entête au bas de la pile, et
    // un trait de la graisse du fil court dedans. Ma version de la veille — une
    // largeur et demie de jour, née sous la règle — mesurée, débordait de
    // soixante pixels sur la voisine et ne teintait pas l'étiquette du jour.
    const lavage = nud(declarations('.abs-corde-lavage', CORDE))
    expect(lavage).toContain('top:0')
    expect(lavage).toContain('bottom:0')
    // la largeur se mesure en COLONNES, pas en pixels recopiés : la piste
    // s'étire au-delà de `largeurJour` sur un écran large, un `1.5 × largeurJour`
    // posé dans le JSX serait trop étroit de vingt-quatre pixels
    expect(lavage).toContain('width:calc(var(--abs-corde-lavage)*100%/var(--abs-corde-nb-jours))')
    expect(lavage).toContain('transform:translateX(-50%)')
    // en mode jour la journée vaut toute la piste : « une fois et demie » doit se
    // borner, sinon le débordement ouvre un ascenseur horizontal sous la corde
    expect(lavage).toContain('max-width:100%')
    // le lavage et le trait partagent le `left` du composant : ils tombent sur
    // le même anneau que les cartes, sinon le repère ment sur le jour
    const mêmeLeft = COMPOSANT.match(/left: `\$\{\(\(indexAujourdhui \+ 0\.5\) \/ nbJours\) \* 100\}%`/g) || []
    expect(mêmeLeft).toHaveLength(2)
    // le trait du jour a la graisse du fil, pas celle du filet : x 656, 657, 658
    expect(nud(declarations('.abs-corde-aujourdhui', CORDE))).toContain('width:var(--abs-corde-fil)')
    // et le lavage monte dans l'entête : le rectangle du dessin court de y 120
    // à la règle (172), arrondi du haut — et c'est l'encre qui passe DESSUS, pas
    // l'inverse. Un `z-index: -1` l'aurait téléporté derrière le fond du champ
    // (le pseudo ne crée pas de contexte, le sable de `.abs-cal-scroll` l'aurait
    // recouvert) : ce sont les deux étiquettes qui se positionnent, et elles
    // relisent le trait par-dessus le lavage.
    const lavageEntête = nud(declarations(".abs-cal-jour[data-aujourdhui='vrai']::before", CORDE))
    expect(lavageEntête).toContain('top:var(--abs-corde-descente-lavage)')
    expect(lavageEntête).toContain('bottom:0')
    expect(lavageEntête).toContain('opacity:0.14')
    expect(lavageEntête).not.toContain('z-index')
    for (const sel of ['.abs-cal-jour-nom', '.abs-cal-jour-num']) {
      expect(nud(declarations(sel, CORDE))).toContain('position:relative')
    }
  })

  it('20. la jauge est posée SUR le fil, pas au milieu de la ligne', () => {
    // relevé 08/12 : la barre du dessin va de y 190 a y 204 pour un fil a
    // 196-198 — son axe est CELUI du trait tendu. centree dans la bande, elle
    // flottait a soixante-douze pixels, a mi-hauteur de la carte, et le nombre
    // avec elle. Le `padding-top` se déduit du même fil-top que l'anneau : deux
    // cotes ecrites a la main se contredisent a la premiere retouche.
    const solde = declarations('.abs-corde-solde', CORDE)
    expect(nud(solde)).toContain('align-items:flex-start')
    expect(nud(solde)).toContain(
      'padding:calc(var(--abs-corde-fil-top)+var(--abs-corde-fil)/2-var(--abs-corde-jauge-hauteur)/2)',
    )
    // une BARRE cerclée d'encre, pas une ornière pointillée : le dessin remplit
    // (161, 93, 47) = `--charte-aplat` et laisse (209, 199, 187) = le filet
    const jauge = nud(declarations('.abs-corde-jauge', CORDE))
    expect(jauge).toContain('border:var(--charte-trait)solidvar(--charte-encre)')
    expect(jauge).not.toContain('dashed')
    expect(jauge).toContain('background:var(--charte-bordure)')
    expect(nud(declarations('.abs-corde-jauge i', CORDE))).toContain('background:var(--charte-aplat)')
    // et le nombre reste écrit A COTE, en encre, a la taille du dessin
    const nombre = nud(declarations('.abs-corde-nombre', CORDE))
    expect(nombre).toContain('color:var(--charte-encre)')
    expect(nombre).not.toContain('var(--charte-mono)')
  })

  it('21. les cotes du dessin ne se recopient pas dʼune memoire', () => {
    // la loi de ce fichier : une cote est une MESURE de `maquettes/absences-grille-1-corde.png`,
    // relevee sur l'image. Ces cinq nombres sont la mesure du 08/12 ; ils
    // remplacent les miens de la veille (fil a 2, descente a 21, anneau a 9,
    // cordons a 4 et a 6, lavage a 1,5), qui etaient ma confort, pas le dessin.
    const jetons = declarations('.abs-cal', CORDE)
    expect(jeton(jetons, '--abs-corde-descente-lavage')).toBe(24)
    expect(CORDE).not.toContain('--abs-corde-fil-top: 2px')
    expect(CORDE).not.toContain('--abs-corde-lavage: 1.5')
    // la carte pend de 14 sous le fil et fait 46 : elle ne tient plus dans sa
    // ligne de 50 — le debord est la loi du dessin, pas un accident a corriger
    expect(jeton(jetons, '--abs-corde-descente') + jeton(jetons, '--abs-corde-carte')).toBe(60)
  })
})
