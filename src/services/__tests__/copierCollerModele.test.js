// ═══════════════════════════════════════════════════════════
// COPIER / COLLER UN MODÈLE DANS LE PLANNING — ce qui doit rester vrai
//
//   ① chaque modèle du dock a son bouton « Copier » ;
//   ② Ctrl/⌘+C copie le modèle survolé, Ctrl/⌘+V colle ;
//   ③ une case du calendrier (Semaine, Jour, Mois) accepte le collage
//     au clic comme au clavier ;
//   ④ le collage passe par les mêmes dépôts qu'un glisser-déposer ;
//   ⑤ rien ne fuit : les champs de saisie gardent leur copier natif,
//     et un texte sélectionné aussi ;
//   ⑥ les survols ne changent que le cadre.
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

import {
  decrireModele,
  estChampDeSaisie,
  libelleModele,
  paquetDepuisModele,
  raccourciPressePapiers,
} from '../../lib/planningCopie'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const planning = lire('src/pages/Planning.jsx')
const planningCss = lire('src/pages/PlanningAfroTech.css')

// ───────────────────────────────────────────────────────────
// Le module de décision (pur)
// ───────────────────────────────────────────────────────────

const appui = (key, options = {}) => ({
  key,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  target: options.target || { tagName: 'DIV' },
  ...options,
})

describe('les raccourcis du presse-papiers', () => {
  it('Ctrl+C et ⌘+C demandent la copie', () => {
    expect(raccourciPressePapiers(appui('c', { ctrlKey: true }))).toBe('copier')
    expect(raccourciPressePapiers(appui('C', { metaKey: true }))).toBe('copier')
  })

  it('Ctrl+V et ⌘+V demandent le collage', () => {
    expect(raccourciPressePapiers(appui('v', { ctrlKey: true }))).toBe('coller')
    expect(raccourciPressePapiers(appui('V', { metaKey: true }))).toBe('coller')
  })

  it('sans Ctrl ni ⌘, aucune touche ne nous appartient', () => {
    expect(raccourciPressePapiers(appui('c'))).toBeNull()
    expect(raccourciPressePapiers(appui('v'))).toBeNull()
    expect(raccourciPressePapiers(appui('x', { ctrlKey: true }))).toBeNull()
  })

  it('Ctrl+Alt+C (composition) n’est pas pris', () => {
    expect(raccourciPressePapiers(appui('c', { ctrlKey: true, altKey: true }))).toBeNull()
  })

  it('un texte sélectionné garde la copie du navigateur', () => {
    expect(raccourciPressePapiers(appui('c', { ctrlKey: true }), 'Bacary Sarr')).toBeNull()
    expect(raccourciPressePapiers(appui('c', { ctrlKey: true }), '   ')).toBe('copier')
  })

  it('aucun événement ne fait planter la page', () => {
    expect(raccourciPressePapiers(null)).toBeNull()
    expect(raccourciPressePapiers(undefined)).toBeNull()
  })
})

describe('les champs de saisie gardent leur presse-papiers natif', () => {
  it('input, textarea et select sont reconnus', () => {
    expect(estChampDeSaisie({ tagName: 'INPUT' })).toBe(true)
    expect(estChampDeSaisie({ tagName: 'textarea' })).toBe(true)
    expect(estChampDeSaisie({ tagName: 'SELECT' })).toBe(true)
  })

  it('un conteneur éditable aussi', () => {
    expect(estChampDeSaisie({ tagName: 'DIV', isContentEditable: true })).toBe(true)
    expect(estChampDeSaisie({ tagName: 'DIV', isContentEditable: false })).toBe(false)
    expect(estChampDeSaisie(null)).toBe(false)
  })

  it('Ctrl+V dans un champ n’est jamais intercepté', () => {
    const dansUnChamp = appui('v', { ctrlKey: true, target: { tagName: 'INPUT' } })
    expect(raccourciPressePapiers(dansUnChamp)).toBeNull()
  })
})

describe('le paquet collé ressemble à celui du dock', () => {
  const modele = {
    id: 'cm-1',
    name: 'Matin',
    label: 'Matin',
    kind: 'shift',
    color: '#B56235',
    start_time: '08:00',
    end_time: '17:00',
    has_break: true,
    break_start: '12:00',
    break_end: '13:00',
    variant: 'standard',
    schedule_id: 'sched-9',
  }

  it('sourceType vaut « dock » et le modèle voyage entier', () => {
    const paquet = paquetDepuisModele(modele)
    expect(paquet.sourceType).toBe('dock')
    expect(paquet.template).toBe(modele)
  })

  it('sans modèle, pas de paquet', () => {
    expect(paquetDepuisModele(null)).toBeNull()
  })

  it('le libellé retombe sur le nom puis sur « Modèle »', () => {
    expect(libelleModele(modele)).toBe('Matin')
    expect(libelleModele({ name: 'Nuit' })).toBe('Nuit')
    expect(libelleModele({})).toBe('Modèle')
    expect(libelleModele(null)).toBe('')
  })

  it('la ligne du dessous décrit chaque type', () => {
    expect(decrireModele(modele)).toBe('08:00 – 17:00')
    expect(decrireModele({ kind: 'rest' })).toBe('Repos')
    expect(decrireModele({ kind: 'leave' })).toBe('Congé / Absence')
    expect(
      decrireModele({ kind: 'break_only', break_start: '12:00', break_end: '13:00' })
    ).toBe('Pause 12:00 – 13:00')
    expect(decrireModele({})).toBe('')
  })
})

// ───────────────────────────────────────────────────────────
// Le branchement dans la page Planning
// ───────────────────────────────────────────────────────────

describe('le bouton « Copier » de chaque modèle', () => {
  it('le dock rend un bouton de copie par modèle', () => {
    expect(planning).toContain('className={`sk-brick-copy')
    expect(planning).toContain('copierModele(tpl)')
    expect(planning).toContain('ClipboardCopy')
  })

  it('le modèle survolé ou focus devient le modèle actif', () => {
    expect(planning).toContain('modeleActifRef.current = tpl')
    expect(planning).toContain('onMouseEnter={() => {')
  })

  it('le modèle copié est signalé visuellement', () => {
    expect(planning).toContain('modeleCopie?.template?.id === tpl.id ? "is-copie" : ""')
    expect(planningCss).toContain('.sk-brick-copy.is-copie')
    expect(planningCss).toContain('.sk-brick.is-copie')
  })
})

describe('le collage au clavier', () => {
  it('un seul écouteur clavier sur la fenêtre', () => {
    expect(planning).toContain('window.addEventListener("keydown", surTouche)')
    expect(planning).toContain('window.removeEventListener("keydown", surTouche)')
  })

  it('la décision est déléguée au module, jamais réécrite sur place', () => {
    expect(planning).toContain('raccourciPressePapiers(evenement, selection)')
    expect(planning).toContain('if (action === "copier")')
    expect(planning).toContain('if (action === "coller")')
  })

  it('la sélection de texte est transmise pour laisser passer le copier natif', () => {
    expect(planning).toContain('window.getSelection()')
  })

  it('Échap range le modèle copié', () => {
    expect(planning).toContain('if (evenement.key === "Escape" && modeleCopie)')
    expect(planning).toContain('oublierModeleCopie()')
  })

  it('Ctrl+V sans case survolée explique quoi faire', () => {
    expect(planning).toContain('Survolez une case du calendrier, puis appuyez sur Ctrl+V')
  })
})

describe('le collage dans une case, au clic comme au clavier', () => {
  it('la case Semaine se souvient du survol et offre son bouton', () => {
    expect(planning).toContain(
      'survolerCase("semaine", emp.id, dayItem.dateStr, dayItem.dayNum)'
    )
    expect(planning).toContain('collerModeleDansCellule(emp, dayItem)')
    expect(planning).toContain('is-cible-collage')
  })

  it('la vue Jour fait de même', () => {
    expect(planning).toContain('survolerCase("jour", emp.id, dayItem.dateStr, dayItem.dayNum)')
    expect(planning).toContain('className="sk-case-coller is-jour"')
  })

  it('la vue Mois colle sur la journée', () => {
    expect(planning).toContain('survolerCase("mois", null, cell.date, cellDayNum)')
    expect(planning).toContain('collerModeleSurJour(cell.date)')
    expect(planning).toContain('className="sk-case-coller is-mois"')
  })

  it('la case survolée est celle que Ctrl+V remplit', () => {
    expect(planning).toContain('if (caseCible.vue === "mois")')
    expect(planning).toContain('employees.find((item) => String(item.id) === String(caseCible.empId))')
  })
})

describe('coller revient exactement à glisser-déposer', () => {
  it('les deux dépôts acceptent un paquet explicite', () => {
    expect(planning).toContain(
      'const handleDropOnCell = async (e, targetEmp, targetDay, payloadExplicite = null) => {'
    )
    expect(planning).toContain(
      'const handleDropOnCalendarDay = (e, dateStr, payloadExplicite = null) => {'
    )
    expect(planning).toContain('const payload = payloadExplicite || draggedPayload;')
  })

  it('le collage envoie le même paquet que le dock', () => {
    expect(planning).toContain('paquetDepuisModele(modeleCopie.template)')
    expect(planning).toContain('const payload = payloadExplicite || draggedPayload || touchDragPayload;')
  })

  it('le collage ne passe pas par l’état du glisser (rendu pas encore appliqué)', () => {
    expect(planning).toContain('}, emp, dayItem, payload);')
    expect(planning).toContain('}, dateStr, payload);')
  })
})

describe('la barre de rappel du modèle copié', () => {
  it('elle nomme le modèle et annonce le geste', () => {
    expect(planning).toContain('className="sk-copie-bar"')
    expect(planning).toContain('role="status"')
    expect(planning).toContain('aria-live="polite"')
    expect(planning).toContain('<kbd>Ctrl</kbd>+<kbd>V</kbd>')
  })

  it('elle permet de coller ou d’annuler sans clavier', () => {
    expect(planning).toContain('className="sk-copie-coller"')
    expect(planning).toContain('className="sk-copie-annuler"')
    expect(planning).toContain('aria-label="Annuler la copie du modèle"')
  })
})

describe('les styles restent sobres', () => {
  it('les boutons Coller sont dessinés', () => {
    expect(planningCss).toContain('.sk-case-coller')
    expect(planningCss).toContain('.sk-copie-bar')
    expect(planningCss).toMatch(/\.sk-case-coller\s*\{[^}]*border-radius/)
  })

  it('le survol d’une case ne touche qu’au cadre', () => {
    const bloc = planningCss.match(/\.sk-td-cell\.is-cible-collage,[\s\S]*?\}/)
    expect(bloc).not.toBeNull()
    expect(bloc[0]).not.toMatch(/(^|[\s;{])color:/)
    expect(bloc[0]).not.toMatch(/(^|[\s;{])background:/)
    expect(bloc[0]).not.toMatch(/opacity/)
  })

  it('les cases restent utilisables au doigt', () => {
    const bloc = planningCss.match(/\.sk-case-coller\s*\{[^}]*\}/)
    expect(bloc[0]).toMatch(/min-height:\s*24px/)
  })
})
