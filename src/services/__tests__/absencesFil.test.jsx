import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import AbsencesFil from '../../components/AbsencesFil'
import {
  LE_FIL,
  largeurFiche,
  partagerEnRangs,
  mesuresFiche,
  periodeFiche,
} from '../../services/absencesFil'

// ═══════════════════════════════════════════════════════════
// 🧺 LE FIL — le contrat de l'onglet « Demandes employés »
//
// Maquette : `maquettes/absences-calendrier-D-fil.png`, retenue le 8/12 avec
// « j'attends à ce que le rendu respecte la maquette choisie ». Le dessin est
// une IMAGE, pas un gabarit : ses largeurs ne sont pas à l'échelle de la
// page. Ce fichier ne rejoue donc pas la capture — il garde les promesses qui
// ne se voient pas dessus :
//   1. une demande = une fiche, et plus une ligne par employé (le fil ne doit
//      rien copier du Planning, sinon on a deux grilles et zéro dossier) ;
//   2. la longueur vient de la période, le trait des jours ouvrés, le nombre
//      écrit de la règle de la maison — trois faits, trois sources, aucune
//      arithmétique ouverte deux fois ;
//   3. le fil se tend PAR RANG : quand la rangée se replie, chaque rang reçoit
//     sa corde et ses anneaux, sans qu'aucune media ne repositionne quoi que
//     ce soit à gauche ou à droite ;
//   4. l'anneau MORD la corde (leçon du 3/12 sur la poutre : posé à la même
//     valeur qu'elle, il la longeait et ne retenait rien).
// ═══════════════════════════════════════════════════════════

const RACINE = path.resolve(import.meta.dirname, '../../..')
const lire = (...chemins) => fs.readFileSync(path.join(RACINE, ...chemins), 'utf8')

// Les commentaires sont retirés d'office : cette plage explique ce qu'elle ne
// fait pas, et un verrou qui lit de la prose trouve ce qu'il cherche.
const FEUILLE = lire('src', 'pages', 'AbsencesAfroTech.css')
const CSS = FEUILLE.replace(/\/\*[\s\S]*?\*\//g, '')
const COMPOSANT = lire('src', 'components', 'AbsencesFil.jsx')
const PAGE = lire('src', 'pages', 'Absences.jsx')
const DESSINS = ['maquettes/absences-calendrier-D-fil.png', 'maquettes/planning-case-B2-dedans-la-fenetre.png']

/** Le corps d'une règle, sélecteur retiré. */
function declarations(sélecteur) {
  const i = CSS.indexOf(`${sélecteur} {`)
  if (i === -1) throw new Error(`règle absente de la feuille : ${sélecteur}`)
  const début = CSS.indexOf('{', i)
  const fin = CSS.indexOf('}', début)
  return CSS.slice(début + 1, fin)
}

/** Un jeton lu dans une plage de la feuille, par son nom — jamais par un nombre
    recopié dans l'attente du test. */
function jeton(plage, nom) {
  const trou = plage.split(`${nom}:`)[1]
  if (!trou) throw new Error(`jeton absent : ${nom}`)
  return Number(trou.trim().split(';')[0].replace('px', ''))
}

const nud = (chaîne) => chaîne.replace(/\s+/g, '')

// Les lignes de CODE, commentaires retirés : un verrou qui cherche
// `<AbsencesHamac` dans tout `Absences.jsx` se fait avoir par la phrase qui
// explique pourquoi il n'y en a plus.
const codes = (src) => src.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//') && !l.startsWith('*') && !l.startsWith('/*'))
const porte = (src, motif) => codes(src).some((l) => l.includes(motif))

// ── le jeu de données : des demandes, pas des absences ────────────────────
// Le 27 nov. 2026 est un vendredi, le 30 un lundi : la période fait quatre
// jours calendaires et deux jours ouvrés. C'est le seul endroit du fichier où
// un nombre de jours s'écrit, et il s'écrit en dates.
const du = (début, fin, plus = {}) => ({
  // un `id` posé à la main quand le test doit pointer dedans (la carte des
  // conflits, par exemple) ; sinon la période suffit à nommer la fiche
  id: plus.id || `${début}→${fin}`,
  start_date: début,
  end_date: fin,
  status: 'en_attente',
  employees: { first_name: 'Hippo', last_name: 'Biyokila', photo_url: null },
  enterprise_id: 'ent-1',
  employee_id: 'emp-1',
  created_at: '2026-11-01T08:00:00Z',
  reason: 'conge',
  ...plus,
})

function rendre(props = {}) {
  return renderToStaticMarkup(<AbsencesFil {...props} />)
}

describe('🧺 le fil — les nombres', () => {
  it('0. la maquette retenue est dans le dépôt', () => {
    for (const d of DESSINS) {
      expect(fs.existsSync(path.join(RACINE, d)), `dessin absent : ${d}`).toBe(true)
    }
  })

  it('1. le calcul et la feuille disent le même écart et le même retrait', () => {
    const section = declarations('.abs-fil')
    expect(jeton(section, '--abs-fil-ecart')).toBe(LE_FIL.ecart)
    expect(jeton(section, '--abs-fil-retrait')).toBe(LE_FIL.retrait)
    // l'écart est un cran de l'échelle (D-013), pas un nombre libre
    expect([2, 3, 4, 8, 12, 16, 24, 32, 48]).toContain(LE_FIL.ecart)
  })

  it('2. trois nombres tendent le fil, et ils sont lus dans la feuille', () => {
    const section = declarations('.abs-fil')
    const corde = jeton(section, '--abs-fil-corde')
    const saut = jeton(section, '--abs-fil-saut')
    const anneau = jeton(section, '--abs-fil-anneau')
    expect([corde, saut, anneau]).toEqual([4, 24, 10])
    // un anneau plus étroit que la corde qu'il enfile ne la mord pas
    expect(anneau).toBeGreaterThan(corde)
    // la descente est plus haute que l'anneau : il a de l'air au-dessus du bois
    expect(saut).toBeGreaterThan(anneau)
  })

  it('3. l’anneau mord la corde : son centre tombe au centre du trait', () => {
    const règle = nud(declarations('.abs-fiche::after'))
    expect(règle).toContain('top:calc(-1*var(--abs-fil-saut)-(var(--abs-fil-corde)+var(--abs-fil-anneau))/2)')
    const section = declarations('.abs-fil')
    const corde = jeton(section, '--abs-fil-corde')
    const saut = jeton(section, '--abs-fil-saut')
    const anneau = jeton(section, '--abs-fil-anneau')
    // |top| − rayon = saut + demi-corde, l'arithmétique de la morsure
    expect(Math.abs(-(saut + (corde + anneau) / 2)) - anneau / 2).toBe(saut + corde / 2)
    // et surtout : l'anneau ne se pose PAS au ras du saut (la panne du 3/12)
    expect(nud(règle)).not.toContain('top:calc(-1*var(--abs-fil-saut))')
  })

  it('4. le filin traverse le saut ET la corde, pas plus', () => {
    const règle = declarations('.abs-fiche::before')
    const brut = (propriété) => {
      const trouvée = règle.match(new RegExp(`${propriété}:\\s*([^;]+);`))
      expect(trouvée, `propriété absente du filin : ${propriété}`).not.toBeNull()
      return nud(trouvée[1])
    }
    // on dépouille le `calc`, le signe et les parenthèses : ce qui reste, c'est
    // l'arithmétique, et c'est elle que la loi engage — « ce qui monte est
    // exactement haut de ce qui est descendu », sinon un cheveu reste au-dessus
    // du fil, ou la fiche décolle du trait
    const dépouillé = (v) => v.replace(/calc\(|-1\*|[()]/g, '')
    const haut = brut('top')
    const hauteur = brut('height')
    expect(dépouillé(haut)).toBe(dépouillé(hauteur))
    for (const nom of ['var(--abs-fil-saut)', 'var(--abs-fil-corde)']) {
      expect(haut, `le filin ne traverse pas ${nom}`).toContain(nom)
      expect(hauteur, `le filin ne mesure pas ${nom}`).toContain(nom)
    }
    // une seule addition : ni l'anneau dedans, ni un cran d'œil de plus
    expect((dépouillé(haut).match(/\+/g) || []).length).toBe(1)
    expect(haut).not.toContain('var(--abs-fil-anneau)')
    // 2 px, l'épaisseur d'un trait d'encre — pas un ruban
    expect(jeton(règle, 'width')).toBe(2)
    // et le filin est muet : ce qui se clique, c'est la fiche
    expect(règle).toContain('pointer-events: none')
  })

  it('5. la corde est le bord du RANG, pas du bloc : chaque repli a son fil', () => {
    const rang = nud(declarations('.abs-fil-rang'))
    expect(rang).toContain('border-top:var(--abs-fil-corde)solidvar(--charte-encre)')
    // le conteneur des fils, lui, ne tend rien : s'il portait la corde, un rang
    // qui tombe à l'écran pendrait dans le vide sous un trait resté en haut
    const fils = declarations('.abs-fil-fils')
    expect(fils).not.toContain('border-top')
    expect(declarations('.abs-fil-fil')).not.toContain('border-top')
  })

  it('6. une fiche d’un jour a la place d’un nom, trois semaines ne mangent pas le mur', () => {
    expect(largeurFiche(1)).toBe(LE_FIL.base)
    expect(largeurFiche(2)).toBe(LE_FIL.base + LE_FIL.jour)
    expect(largeurFiche(0)).toBe(LE_FIL.base)
    expect(largeurFiche('' )).toBe(LE_FIL.base)
    // le plafond se atteint exactement, et il n'est pas un arrondi vague
    const auDessus = Math.ceil((LE_FIL.plafond - LE_FIL.base) / LE_FIL.jour) + 1
    expect(largeurFiche(auDessus)).toBe(LE_FIL.plafond)
    expect(largeurFiche(auDessus - 1)).toBeLessThan(LE_FIL.plafond)
    expect(largeurFiche(900)).toBe(LE_FIL.plafond)
  })

  it('7. la longueur vient de la période, le nombre écrit de la règle de la maison', () => {
    // vendredi → lundi : quatre jours de vie sociale, deux jours ouvrés
    const semaine = mesuresFiche(du('2026-11-27', '2026-11-30'), { calendaires: 4, ouvres: 2 })
    expect(semaine.span).toBe(4)
    expect(semaine.ouvr).toBe(2)
    expect(semaine.comptes).toBe(2)
    // l'absence qui compte les fériés décompte la période entière
    expect(mesuresFiche(du('2026-11-27', '2026-11-30', { count_holidays_as_leave: true }), { calendaires: 4, ouvres: 2 }).comptes).toBe(4)
    // et le champ écrit sur la ligne passe avant les deux : c'est lui que lit la
    // carte détaillée, deux affichages d'un même nombre, jamais deux calculs
    expect(mesuresFiche(du('2026-11-27', '2026-11-30', { days_count: 7 }), { calendaires: 4, ouvres: 2 }).comptes).toBe(7)
    // le trait n'est jamais plus long que la fiche
    expect(mesuresFiche(du('2026-11-27', '2026-11-30'), { calendaires: 4, ouvres: 99 }).ouvr).toBe(4)
  })

  it('8. zéro jour ouvré, zéro trait — pas de plancher qui mentirait', () => {
    const weekEnd = mesuresFiche(du('2026-11-07', '2026-11-08'), { calendaires: 2, ouvres: 0 })
    expect(weekEnd.span).toBe(2)
    expect(weekEnd.ouvr).toBe(0)
    const html = rendre({ demandes: [du('2026-11-07', '2026-11-08', { id: 'week-end', days_count: undefined, working_days: undefined })] })
    expect(nud(html)).toContain('--abs-fiche-trait:0%')
  })

  it('9. un rang tient ce qu’il peut, le reste pend au-dessous', () => {
    const une = { jours: 1, large: largeurFiche(1) }
    const utile = LE_FIL.cordeDefaut - 2 * LE_FIL.retrait
    const attendu = Math.floor((utile + LE_FIL.ecart) / (largeurFiche(1) + LE_FIL.ecart))
    const rangs = partagerEnRangs(Array.from({ length: attendu + 3 }, (_, i) => ({ ...une, jours: 1, id: `f${i}` })), LE_FIL.cordeDefaut)
    expect(rangs[0]).toHaveLength(attendu)
    expect(rangs.length).toBeGreaterThan(1)
    // et la somme d'un rang ne déborde jamais du trait
    for (const r of rangs.slice(0, -1)) {
      const occupation = r.reduce((s, f) => s + largeurFiche(f.jours), 0) + (r.length - 1) * LE_FIL.ecart
      expect(occupation).toBeLessThanOrEqual(utile)
    }
  })

  it('10. une fiche plus large que le fil garde son rang, seule', () => {
    const géante = [{ jours: 1, id: 'a' }, { jours: 900, id: 'b' }, { jours: 1, id: 'c' }]
    const rangs = partagerEnRangs(géante, 460)
    expect(rangs.flatMap((r) => r.map((f) => f.id))).toEqual(['a', 'b', 'c'])
    expect(rangs.find((r) => r[0].id === 'b')).toHaveLength(1)
  })

  it('11. la période se dit en jours et en mois, et le mois se répète s’il change', () => {
    expect(periodeFiche('2026-11-27', '2026-11-30')).toBe('27 → 30 nov')
    expect(periodeFiche('2026-11-27', '2026-11-27')).toBe('27 nov')
    expect(periodeFiche('2026-11-30', '2026-12-04')).toBe('30 nov → 4 déc')
    expect(periodeFiche(null, null)).toBe('—')
  })
})

describe('🧺 le fil — la figure', () => {
  it('12. une fiche par demande, jamais une ligne par employé', () => {
    const demandes = [
      du('2026-11-27', '2026-11-30', { id: 'p1' }),
      du('2026-12-01', '2026-12-02', { id: 'p2', employee_id: 'emp-1' }),
      du('2026-12-03', '2026-12-04', { id: 'a1', status: 'approuve' }),
    ]
    const html = rendre({ demandes })
    expect(html.match(/data-testid="abs-fiche"/g)).toHaveLength(3)
    // même employé, trois fiches : c'est le dossier qui pend, pas la personne
    expect(html.match(/class="abs-fiche-nom"/g)).toHaveLength(3)
  })

  it('13. deux fils, pas trois : ce qui attend, ce qui est jugé', () => {
    const html = rendre({
      demandes: [
        du('2026-11-27', '2026-11-30', { id: 'p1' }),
        du('2026-12-01', '2026-12-02', { id: 'a1', status: 'approuve' }),
        du('2026-12-03', '2026-12-04', { id: 'r1', status: 'refuse', review_comment: 'solde insuffisant' }),
      ],
    })
    expect(html).toContain('data-fil="attente"')
    expect(html).toContain('data-fil="repondues"')
    expect(html).toContain('À valider')
    expect(html).toContain('Répondues')
    // le refus pend AUSSI sur le fil des réponses — un troisième fil pour trois
    // statuts ferait une colonne de plus pour dire la même chose
    expect(html).toContain('data-statut="refuse"')
    expect(html).toContain('refusée · solde insuffisant')
    expect(html.match(/data-fil="/g)).toHaveLength(2)
  })

  it('14. un fil sans linge ne se tend pas', () => {
    const html = rendre({ demandes: [du('2026-11-27', '2026-11-30', { id: 'p1' })] })
    expect(html).not.toContain('data-fil="repondues"')
    expect(html).not.toContain('data-fil="attente" data-vide')
    const vide = rendre({ demandes: [] })
    expect(vide).toContain('data-testid="abs-fil-vide"')
    expect(vide).not.toContain('abs-fil-fils')
  })

  it('15. « en attente » se dit par un mot, posé sur le bois — jamais par la teinte seule', () => {
    const html = rendre({ demandes: [du('2026-11-27', '2026-11-30', { id: 'p1' })] })
    expect(html).toContain('abs-fiche-onglet')
    expect(html).toContain('attente')
    // une fiche jugée n'a pas de rabat : le rabat dit l'attente, pas le statut
    const jugée = rendre({ demandes: [du('2026-11-27', '2026-11-30', { id: 'a1', status: 'approuve' })] })
    expect(jugée).not.toContain('abs-fiche-onglet')
  })

  it('16. la pile se vide une fiche à la fois, par les gestes de la page', () => {
    const html = rendre({ demandes: [du('2026-11-27', '2026-11-30', { id: 'p1' })] })
    expect(html).toContain('abs-fil-outils')
    expect(html).toContain('aria-label="La pile, une fiche à la fois"')
    // le refus ne se fait pas en masse : c'est une réponse, elle se motive
    expect(COMPOSANT).toContain("la réponse se motive, une par une")
    expect(COMPOSANT).toContain('surApprouver(premiere.demande)')
    expect(COMPOSANT).toContain('surRefuser(premiere.demande)')
    // la plus ancienne d'abord, pas la plus récente du dépôt
    expect(COMPOSANT).toContain(".sort((a, b) => String(a.demande.created_at || '')")
    // et les outils ne pendent pas au fil des réponses : il n'y a rien à valider là
    const jugées = rendre({ demandes: [du('2026-11-27', '2026-11-30', { id: 'a1', status: 'approuve' })] })
    expect(jugées).not.toContain('abs-fil-outils')
  })

  it('17. le conflit se nomme, il ne se devine pas', () => {
    const html = rendre({
      demandes: [du('2026-11-27', '2026-11-30', { id: 'a1', status: 'approuve' })],
      conflitsParDemande: { a1: { id: 'c1', absence_id: 'a1' } },
    })
    expect(html).toContain('data-conflict="oui"')
    expect(html).toContain('conflit')
  })

  it('18. le solde est cloué à droite et trié du plus court, sans second calcul', () => {
    const html = rendre({
      demandes: [du('2026-11-27', '2026-11-30', { id: 'p1' })],
      soldes: [
        { id: 'e1', initiales: 'HB', pris: 8, plafond: 30, restant: 22, court: false },
        { id: 'e2', initiales: 'RA', pris: 30, plafond: 30, restant: 0, court: true },
      ],
    })
    expect(html).toContain('aria-label="Soldes de congés, du plus court au plus long"')
    expect(html).toContain('data-court="oui"')
    expect(html).toContain('épuisé')
    // les nombres du solde viennent de la page, et elle-même les lit du calcul
    // de la poutre : rien de neuf sous le soleil des classeurs
    expect(PAGE).toContain('const soldesDuFil = useMemo(')
    expect(PAGE).toContain('joursPrisParEmploye[id]')
    expect(PAGE).toContain('leaveConfig.annual_leave_cap')
  })

  it('19. les quatre phrases du pied sont celles du dessin', () => {
    const html = rendre({ demandes: [du('2026-11-27', '2026-11-30', { id: 'p1' })] })
    const pied = html.slice(html.indexOf('abs-fil-captions'))
    for (const phrase of [
      'le fil tient le temps, de gauche à droite',
      'l’anneau mord la corde, jamais il ne la longe',
      'le trait sous la fiche = les jours ouvrés',
      'clic sur une fiche = elle se détache',
    ]) {
      expect(pied.includes(phrase), `phrase absente du pied : ${phrase}`).toBe(true)
    }
  })
})

describe('🧺 le fil — le câblage de la page', () => {
  it('20. l’onglet pend au fil, et la liste en lignes est partie', () => {
    expect(porte(PAGE, '<AbsencesFil')).toBe(true)
    expect(porte(PAGE, 'data-testid="abs-demandes-liste"')).toBe(false)
    // la fiche détaillée reste la fiche OUVERTE : détacher, c'est la poser
    expect(porte(PAGE, '<DemandeCongeCard')).toBe(true)
    expect(PAGE).toContain('La fiche en main · posée sur la table')
    expect(PAGE).toContain('Rependre la fiche')
  })

  it('21. cliquer une fiche la détache, et une seule est en main', () => {
    expect(PAGE).toContain('const [ficheEnMain, setFicheEnMain] = useState(null)')
    expect(PAGE).toContain('setFicheEnMain((d) => (d === id ? null : id))')
    expect(COMPOSANT).toContain('enMain: enMain === d.id')
    expect(COMPOSANT).toContain('détacher la fiche et la poser sur la table')
    // et la fiche en main ne se pend pas deux fois : `aria-pressed` n'a plus
    // de sens sur une fiche qui n'est plus au fil
    expect(COMPOSANT).not.toContain('aria-pressed')
  })

  it('22. le fil n’écrit rien : il appelle les fenêtres qui existent', () => {
    // aucun `supabase` dans le composant — la page seule écrit
    expect(COMPOSANT).not.toContain('supabase')
    expect(PAGE).toContain("surApprouver={(d) => openReviewModal(d, 'approuve')}")
    expect(PAGE).toContain("surRefuser={(d) => openReviewModal(d, 'refuse')}")
    expect(PAGE).toContain('surDocument={handleViewRequestDocument}')
  })

  it('23. le conflit d’une demande se lit par l’absence qu’elle a laissée', () => {
    expect(PAGE).toContain('if (a.leave_request_id) map[a.leave_request_id] = a')
    // un seul index de conflits, celui de la page ; le fil ne cherche pas dans la liste
    expect(PAGE).toContain('conflitParAbsence[a.id]')
    expect(COMPOSANT).toContain('conflitsParDemande[d.id]')
    expect(COMPOSANT).not.toContain('.find(')
  })

  it('24. la peau du fil tient la charte : pas de hex, pas de flou, des rayons fermés', () => {
    const début = FEUILLE.indexOf('🧺 LE FIL')
    expect(début).toBeGreaterThan(-1)
    const fin = FEUILLE.indexOf('/* La tuile de motif en tête de ligne', début)
    const plage = FEUILLE.slice(début, fin)
    expect(plage.match(/#[0-9a-fA-F]{3,8}\b/g) || []).toHaveLength(0)
    for (const ombre of plage.match(/box-shadow\s*:\s*[^;]+;/g) || []) {
      for (const groupe of ombre.split(',')) {
        const nombres = (groupe.match(/-?\d*\.?\d+px|-?\d*\.?\d+(?![\d.])/g) || []).map(parseFloat).filter((n) => !Number.isNaN(n))
        if (/inset/.test(groupe)) continue
        expect(nombres[2] || 0, `ombre floue : ${groupe.trim()}`).toBe(0)
      }
    }
    for (const rayon of plage.match(/border-radius\s*:\s*[^;]+;/g) || []) {
      expect(rayon, `rayon hors charte : ${rayon}`).toMatch(/var\(--charte-rayon-|999|0/)
    }
  })

  it('26. détacher laisse le crochet à la place, de la largeur du bois parti', () => {
    const pendue = rendre({ demandes: [du('2026-11-27', '2026-11-30', { id: 'p1' })] })
    expect(pendue).not.toContain('abs-fiche-crochet')
    const enMain = rendre({
      demandes: [du('2026-11-27', '2026-11-30', { id: 'p1' })],
      enMain: 'p1',
    })
    expect(enMain).toContain('data-testid="abs-fiche-crochet"')
    // plus de bois cliquable sur le fil : la fiche est en bas
    expect(enMain).not.toContain('data-testid="abs-fiche"')
    // le crochet garde la LARGEUR de ce qui est parti (le rang ne se referme pas)
    expect(enMain).toContain('--abs-fiche-largeur:294px')
    // …et sa place est annoncée dans l'intitulé du fil
    expect(enMain).toContain('1 en main')
    // la hauteur réservée est la même que celle du bois : un cran, deux usages
    const bois = jeton(declarations('.abs-fil'), '--abs-fiche-bois')
    expect(bois).toBe(96)
    // les deux lisent LE jeton, ils ne redisent pas 96
    expect(nud(declarations('.abs-fiche-corps'))).toContain('min-height:var(--abs-fiche-bois)')
    expect(nud(declarations('.abs-fiche-crochet'))).toContain('min-height:var(--abs-fiche-bois)')
  })

  it('27. à 390 px, une fiche de trois semaines sature le fil sans le crever', () => {
    // le calcul donne la longueur dessinée…
    expect(largeurFiche(21)).toBe(LE_FIL.plafond)
    // …mais la feuille la borne au fil : `min(…, 100%)`, jamais un `width` nu
    const fiche = declarations('.abs-fiche')
    expect(nud(fiche)).toContain('width:min(var(--abs-fiche-largeur,216px),100%)')
    // et le repli de la feuille est bien la fiche d’un jour du calcul : le même
    // nombre, écrit une fois de chaque côté, relu ici — pas laissé à l'œil
    expect(Number(nud(fiche).split('abs-fiche-largeur,')[1].split(')')[0].replace('px', ''))).toBe(LE_FIL.base)
    // le composant ne pose plus de `width` en dur : il ne fournit qu'une variable
    expect(porte(COMPOSANT, "width: `${f.large}px`")).toBe(false)
    expect(porte(COMPOSANT, "'--abs-fiche-largeur': `${f.large}px`")).toBe(true)
  })

  it('25. aucune media ne repositionne le fil : le repli est un calcul, pas un correctif', () => {
    // deux médias coupent à 900 px dans cette feuille (le dock, puis le fil) :
    // lire le premier trouvé vérifierait le voisin
    let bloc = ''
    for (let i = CSS.indexOf('@media (max-width: 900px)'); i !== -1; i = CSS.indexOf('@media (max-width: 900px)', i + 1)) {
      let n = 0
      let fin = i
      for (let j = CSS.indexOf('{', i); j < CSS.length; j += 1) {
        if (CSS[j] === '{') n += 1
        if (CSS[j] === '}') { n -= 1; if (n === 0) { fin = j; break } }
      }
      const candidat = CSS.slice(i, fin + 1)
      if (candidat.includes('.abs-fil-corps')) { bloc = candidat; break }
    }
    expect(bloc, 'aucun média à 900 px ne s’occupe du fil').not.toBe('')
    // la seule chose que la coupe change : le mur des soldes descend sous les fils
    expect(bloc).toContain('.abs-fil-corps { flex-direction: column; }')
    expect(bloc).not.toContain('.abs-fiche {')
    // aucune corde ne se repeint à la coupe : le trait reste au rang
    expect(bloc).not.toMatch(/border-top:\s*var\(--abs-fil-corde\)/)
    // et le rang ne connaît ni gauche ni droite à corriger
    expect(declarations('.abs-fil-rang')).not.toMatch(/left:|right:/)
  })
})
