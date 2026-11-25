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
// la rubrique de la corde va jusqu'à la fin de la feuille
const CORDE = CSS.slice(CSS.search(/\.abs-cal\s*\{\s*--abs-corde-fil/))
if (!CORDE.startsWith('.abs-cal')) throw new Error('rubrique de la corde introuvable en fin de feuille')

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
    // le cercle se centre sur la colonne par le pseudo-élément, pas par un
    // pourcentage recopié du nombre de jours
    const anneau = nud(declarations('.abs-corde-anneaux i::before', CORDE))
    expect(anneau).toContain('left:50%')
    expect(anneau).toContain('translateX(-50%)')
  })

  it('5. lʼanneau creux et la pastille pleine : la forme, pas la couleur', () => {
    const creux = nud(declarations('.abs-corde-anneaux i::before', CORDE))
    expect(creux).toContain('background:var(--charte-sable)')
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

  it('6. la planche pend : sa ficelle entre dans le trait', () => {
    const attache = nud(declarations('.abs-corde-attache', CORDE))
    // la ficelle part du fil (descente, plus le rang) et descend jusqu'à la
    // planche : `top` et `height` se retrouvent au milieu du trait, c'est ça
    // « entrer dans le fil » plutôt que « toucher le fil »
    expect(attache).toContain('top:calc(-1*(var(--abs-corde-descente)')
    expect(attache).toContain('+var(--abs-corde-fil))')
    expect(attache.match(/var\(--abs-corde-rang,0\)/g)).toHaveLength(2)
    // un trait qui touche sans traverser ne retient rien — la leçon des anneaux
    // de la poutre, reprise à l'envers
    expect(declarations('.abs-corde-planche', CORDE)).toContain('--abs-corde-rang, 0')
  })

  it('6bis. au deuxième rang, la ficelle et le nœud suivent le fil', () => {
    // une ficelle de `descente` seulement laisse la deuxième planche retenue à
    // vingt-six pixels en dessous du trait ; un nœud sans le terme de rang y
    // laisse aussi la perle. Les deux formules doivent porter le rang.
    const ficelle = nud(declarations('.abs-corde-attache', CORDE))
    const nœud = nud(declarations('.abs-corde-noeud', CORDE))
    const rang = 'var(--abs-corde-rang,0)*var(--abs-corde-empilement)'
    expect(ficelle.match(new RegExp(rang.replace(/[().*]/g, '\\$&'), 'g'))).toHaveLength(2)
    expect(nœud).toContain(rang)
    // le nœud est CENTER sur le fil, à la même arithmétique que l'anneau
    const anneau = nud(declarations('.abs-corde-anneaux i::before', CORDE))
    for (const règle of [anneau, nœud]) {
      expect(règle).toContain('+var(--abs-corde-fil)/2-(var(--abs-corde-')
      expect(règle).toContain('+2*var(--charte-trait))/2)')
    }
    // et il est sur la ficelle, pas à côté
    expect(nœud).toContain('left:var(--charte-espace-3)')
    expect(ficelle).toContain('left:var(--charte-espace-3)')
  })

  it('7. la position de la planche vient du pourcentage de la période', () => {
    // a1 : lundi 19 → mercredi 21, index 0 à 2 sur 7 jours
    expect(grille).toContain('left:calc(0% + 2px)')
    expect(grille).toContain('width:calc(42')
    // en mode jour, la planche occupe toute lʼunique colonne
    expect(grilleJour).toContain('left:calc(0% + 2px)')
    expect(grilleJour).toContain('width:calc(100% - 4px)')
    expect(grilleJour).toContain('data-anneau="travaillé"')
    expect((grilleJour.match(/data-anneau=/g) || [])).toHaveLength(3) // un anneau par ligne
  })

  it('8. deux planches qui se chevauchent descendent dʼun rang, la ligne grandit', () => {
    // e1 porte a1 (19→21) et a4 (20→22) : elles se recouvrent, donc a4 prend
    // le rang 1 et la ligne annonce deux rangs
    const { ligne } = anneauxDe(grille, 'e1')
    expect(ligne).toContain('--abs-corde-rangs:2')
    expect(ligne).toContain('--abs-corde-rang:1')
    // le même nombre d'empilement pour la planche et pour la ligne : écrit
    // deux fois, il se contredit à la première retouche
    const planche = nud(declarations('.abs-corde-planche', CORDE))
    const règle = nud(declarations('.abs-corde-ligne', CORDE))
    expect(planche).toContain('var(--abs-corde-empilement)')
    expect(règle).toContain('var(--abs-corde-empilement)')
    expect(règle).toContain('min-height:calc(var(--abs-corde-hauteur)+(var(--abs-corde-rangs,1)-1)*var(--abs-corde-empilement))')
  })

  it('9. la hauteur de la ligne se calcule, et la grille respire moins', () => {
    const jetons = declarations('.abs-cal', CORDE)
    // pas un nombre posé là au clavier : la hauteur est la somme des trois
    // hauteurs qu'elle contient
    const hauteur = declarations('.abs-cal', CORDE).split('--abs-corde-hauteur:')[1].split(';')[0]
    expect(nud(hauteur)).toBe(
      'calc(var(--abs-corde-fil-top)+var(--abs-corde-descente)+var(--abs-corde-planche)+var(--charte-espace-1))',
    )
    const somme =
      jeton(jetons, '--abs-corde-fil-top') + jeton(jetons, '--abs-corde-descente') + jeton(jetons, '--abs-corde-planche') + 4
    expect(somme).toBeLessThan(60) // la grille faisait 78 px par ligne
    expect(somme).toBeGreaterThanOrEqual(jeton(jetons, '--abs-corde-planche') + jeton(jetons, '--abs-corde-descente'))
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
    for (const r of [...CORDE.matchAll(/border-radius:\s*([^;]+);/g)].map((m) => m[1].trim())) {
      expect(['var(--charte-rayon-champ)', 'var(--charte-rayon-carte)', 'var(--charte-rayon-pilule)']).toContain(r)
    }
  })

  it('15. tout ce que la corde appelle est déclaré sur .abs-cal', () => {
    // un `var(--x)` non déclaré retombe à 0 — c'est exactement comme ça que
    // l'anneau de la poutre s'était téléporté le 2/12
    // un var(--x, repli) est voulu : c'est un jeton que le JSX pose en ligne
    // (`--abs-corde-rang`, `--abs-corde-rangs`, `--abs-corde-plein`). Ce que la
    // feuille appelle SANS repli doit être déclaré.
    const appelés = [...CORDE.matchAll(/var\((--abs-corde-[a-z-]+)\)/g)].map((m) => m[1])
    expect(appelés.length).toBeGreaterThan(15)
    const Déclarés = declarations('.abs-cal', CORDE)
    for (const nom of new Set(appelés)) {
      expect(Déclarés).toContain(`${nom}:`)
    }
  })

  it('16. aucune media ne repositionne la corde', () => {
    const medias = CORDE.slice(CORDE.indexOf('@media'))
    for (const m of medias.matchAll(/^\s*([.:#][^,{]*)[,{]/gm)) {
      expect(['.abs-corde-nom', '.abs-corde-jauge']).toContain(m[1].trim())
    }
    expect(medias).not.toContain('.abs-corde-anneaux')
    expect(medias).not.toContain('.abs-corde-planche')
  })
})
