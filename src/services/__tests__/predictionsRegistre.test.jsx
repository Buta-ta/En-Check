// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════════════
//  PRÉDICTIONS · LE REGISTRE — maquette retenue `predictions-F-registre.png`
//  (28/11/2026) : « je choisis le F. code maintenant ».
//
//  Ce que ce fichier défend, et qui n'était pas vrai avant :
//
//    · la page ne porte plus UNE SEULE couleur en dur : elle suit le thème
//      clair/sombre par les jetons, comme le reste de l'application ;
//    · aucune ombre floue, aucun verre dépoli (C9 / D-016), coins carrés ;
//    · une alerte dit toujours son mot ET sa lettre — la couleur ne porte
//      jamais l'information seule (C7) ;
//    · les écarts sont signés : un « −12 % » se lit même en noir et blanc
//      (C7, encore) ;
//    · et surtout : les SEPT jeux de données du service sont encore là.
//      Une refonte qui embellit en perdant deux blocs n'est pas une refonte,
//      c'est une régression bien habillée.
//
//  La prose du fichier explique l'AVANT (elle cite l'ancien fond sombre) :
//  toutes les mesures se font donc sur le code COMMENTAIRES RETIRÉS. Un
//  contrat qui cherche `#hex` dans un commentaire se fait avoir par sa
//  propre explication — c'est déjà arrivé dans ce dépôt.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'

import Predictions from '../../pages/Predictions'

const SOURCE = readFileSync('src/pages/Predictions.jsx', 'utf8')
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

// ── la base simulée : le service rend les sept jeux, la page doit tout dire ──
const DONNEES = vi.hoisted(() => ({
  summary: {
    critical_alerts: 3, warning_alerts: 2, overloaded_employees: 4,
    risky_teams: 2, impactful_absences: 1, staffing_needs: 1,
    avg_duration_variance_percent: -12.5,
  },
  alerts: [
    {
      prediction_type: 'workload_alert', target_type: 'employee', target_id: 'e1',
      severity: 'critical', title: 'Surcharge employé', message: 'Quatre tâches en retard',
    },
    {
      prediction_type: 'absence_impact', target_type: 'team', target_id: 't1',
      severity: 'warning', title: 'Impact absence', message: 'Deux absences la semaine prochaine',
    },
  ],
  durations: [
    {
      category_id: 'c1', category_name: 'Récolte', completed_count: 12,
      expected_avg_minutes: 90, actual_avg_minutes: 105, variance_percent: 16.7,
    },
    {
      category_id: 'c2', category_name: 'Contrôle', completed_count: 8,
      expected_avg_minutes: 60, actual_avg_minutes: 45, variance_percent: -25,
    },
  ],
  staffing_needs: [
    {
      team_id: 't1', team_name: 'Équipe Kandi', severity: 'critical',
      open_tasks: 9, load_per_member_hours: 6.5, estimated_additional_people: 2,
      overdue_tasks: 3, completion_rate: 41,
      recommendation: 'Détacher deux personnes du pôle contrôle.',
    },
  ],
  employee_workloads: [
    {
      employee_id: 'e1', employee_name: 'Amina B.', position: 'Chef de champ',
      severity: 'critical', open_tasks: 7, planned_minutes: 480, predicted_real_hours: 11.5,
    },
  ],
  team_workloads: [
    {
      team_id: 't1', team_name: 'Équipe Kandi', severity: 'warning',
      completion_rate: 62, member_count: 5, open_tasks: 9, load_per_member_hours: 6.5,
    },
  ],
  absence_impact: [
    {
      team_id: 't1', team_name: 'Équipe Kandi', severity: 'warning',
      absent_count: 2, impacted_tasks: 5, direct_tasks: 3,
      message: 'La récolte glisse de deux jours.',
    },
  ],
}))

vi.mock('../../services/predictionService', () => ({
  getPredictionDashboard: vi.fn(async () => ({ data: DONNEES, error: null })),
}))
vi.mock('../../services/featureService', () => ({
  default: { hasFeature: vi.fn(async () => true) },
  FEATURES: { PREDICTIONS: 'predictions' },
}))

// ── le montage ─────────────────────────────────────────────────────────────
let hote, racine
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.setItem('admin', JSON.stringify({
    role: 'super_admin', selectedEnterprise: { id: 'ent-1', name: 'Kandi' },
  }))
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
})
afterEach(async () => {
  await act(async () => racine.unmount())
  hote.remove()
  document.body.innerHTML = ''
  localStorage.clear()
})

const afficher = async () => {
  await act(async () => {
    racine.render(<MemoryRouter><Predictions /></MemoryRouter>)
  })
  // le chargement est asynchrone : une seconde passe laisse le `useEffect`
  // poser les données du service avant qu'on lise le document.
  await act(async () => { await Promise.resolve() })
  return document.body.textContent
}

// ── 1. aucun littéral de couleur : la page suit les jetons ────────────────
describe('la page suit les jetons, pas les littéraux', () => {
  it('ne contient aucun code couleur, même pas une seule fois', () => {
    const litteraux = CODE.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/g) || []
    expect(litteraux, litteraux.join(', ')).toEqual([])
  })

  it('ne définit ses couleurs que par `var(--charte-…)`', () => {
    const jetons = new Set(CODE.match(/--charte-[a-z]+/g) || [])
    // les douze jetons de la charte, et rien d'inventé
    for (const jeton of jetons) {
      expect([
        '--charte-encre', '--charte-surface', '--charte-bordure', '--charte-douce',
        '--charte-texte', '--charte-trait', '--charte-mono', '--charte-sable',
        '--charte-aplat', '--charte-erreur', '--charte-alerte', '--charte-succes',
      ], `${jeton} n’est pas un jeton de la charte`).toContain(jeton)
    }
    expect(jetons.size).toBeGreaterThanOrEqual(10)
  })
})

// ── 2. le registre : pas de flou, pas de verre, coins carrés ──────────────
describe('le registre ne floute rien', () => {
  it('aucun verre dépoli (C9 / D-016)', () => {
    expect(CODE).not.toContain('backdropFilter')
    expect(CODE).not.toContain('backdrop-filter')
  })

  it('toutes les ombres ont un flou nul — c’est une ombre dure, pas une brume', () => {
    const ombres = [...CODE.matchAll(/boxShadow:\s*'([^']*)'/g)].map((m) => m[1]).filter((o) => o !== 'none')
    // trois ombres PORTÉES : la feuille, chaque registre, chaque bouton.
    expect(ombres.length).toBeGreaterThanOrEqual(3)
    for (const ombre of ombres) {
      // une ombre CSS : décalage X, décalage Y, FLOU, [étalement], couleur.
      // L'étalement est optionnel — c'est justement ce qui m'a fait écrire un
      // faux positif la première fois : `4px 4px 0 0 encre` a quatre longueurs,
      // la troisième seule est le flou.
      //  `0` s'écrit sans unité dans une ombre : `4px 4px 0 0` est valide,
      //  et c'est cette forme-là que porte le registre. On accepte `0` et
      //  `0px`, on refuse tout le reste.
      const longueurs = (ombre.match(/-?\d+(?:\.\d+)?(?:px)?/g) || [])
      expect(longueurs.length, `ombre illisible : ${ombre}`).toBeGreaterThanOrEqual(2)
      expect(longueurs[2], `flou non nul : ${ombre}`).toMatch(/^0(px)?$/)
      // et aucune ombre ne doit flouter par un mot-clé détourné
      expect(ombre).not.toMatch(/\bblur\(/)
      expect(ombre).not.toMatch(/filter\s*:/)
    }
  })

  it('aucun rayon : le registre a des coins carrés', () => {
    const rayons = [...CODE.matchAll(/borderRadius:\s*([^,\n}]+)/g)].map((m) => m[1].trim())
    expect(rayons.length).toBeGreaterThan(0)
    for (const r of rayons) expect(r, `rayon hors registre : ${r}`).toMatch(/^0$/)
  })
})

// ── 3. C7 : le statut se lit sans la couleur ──────────────────────────────
describe('le statut se lit sans la couleur', () => {
  it('chaque sévérité écrit son mot, et porte sa lettre', () => {
    for (const [cle, mot, lettre] of [
      ['critical', 'Critique', 'C'], ['warning', 'Attention', 'A'], ['info', 'Info', 'I'],
    ]) {
      const ligne = SOURCE.match(new RegExp(`${cle}:\\s*\\{[^}]*\\}`))?.[0] || ''
      expect(ligne, `sévérité ${cle} absente`).toContain(`mot: '${mot}'`)
      expect(ligne).toContain(`lettre: '${lettre}'`)
    }
    // le tampon rend la lettre ET le mot, jamais la couleur seule
    const tampon = SOURCE.slice(SOURCE.indexOf('function Tampon'), SOURCE.indexOf('function Registre'))
    expect(tampon).toContain('{v.lettre}')
    expect(tampon).toContain('{v.mot}')
  })

  it('les écarts sont signés, dans les deux sens, avec un vrai moins', () => {
    //  La règle : le signe s'écrit, et le négatif prend U+2212 (le moins
    //  typographique), pas le trait d'union ASCII — qui n'a ni la même
    //  largeur ni la même hauteur, et se lit comme un tiret de liaison.
    expect(CODE).toContain('const signe')
    expect(CODE).toContain('`+${corps}`')
    //  Le moins est écrit en ÉCHAPPEMENT Unicode dans la source : il se lit
    //  dans le code, et il ne se confond pas avec un trait d'union à l'œil.
    expect(CODE).toMatch(/u2212\$\{corps\}/)
    expect(CODE).not.toContain("${v > 0 ? '+' : ''}")
  })
})

// ── 4. la refonte n’a rien perdu des sept jeux ────────────────────────────
describe('aucune donnée n’a été perdue en route', () => {
  it('les sept jeux du service sont encore lus par la page', () => {
    for (const cle of [
      'summary', 'alerts', 'durations', 'employee_workloads',
      'team_workloads', 'absence_impact', 'staffing_needs',
    ]) {
      expect(CODE, `le bloc ${cle} a disparu`).toContain(`data.${cle}`)
    }
  })

  it('la page rendue montre les sept blocs, chiffres compris', async () => {
    const texte = await afficher()

    // les six cases du bilan
    expect(texte).toContain('Bilan')
    for (const mot of ['critiques', 'attention', 'surchargés', 'équipes à risque', 'absences', 'écart moyen']) {
      expect(texte, `case « ${mot} » manquante`).toContain(mot)
    }

    // les alertes, avec leur mot de sévérité
    expect(texte).toContain('Surcharge employé')
    expect(texte).toContain('Critique')
    expect(texte).toContain('Attention')

    // durées : prévu / réel / écart signé
    expect(texte).toContain('Durées : prévu / réel')
    expect(texte).toContain('Récolte')
    //  Écrits en français : virgule décimale, et un vrai moins (U+2212)
    //  pour les écarts négatifs. Avant, la page disait « -12.5 % ».
    expect(texte).toContain('+16,7 %')
    expect(texte).toContain('−12,5 %')

    // les quatre blocs qui ne figuraient pas dans la maquette, mais qui restent
    expect(texte).toContain('Charge par employé')
    expect(texte).toContain('Amina B.')
    expect(texte).toContain('Charge par équipe')
    expect(texte).toContain('Absences à impact')
    expect(texte).toContain('Besoins de renfort')
    expect(texte).toContain('Détacher deux personnes du pôle contrôle.')
  })
})
