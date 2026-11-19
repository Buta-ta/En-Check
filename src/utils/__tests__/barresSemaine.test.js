import { describe, it, expect } from 'vitest'
import { grouperAbsences } from '../barresSemaine'

const semaine = (etats) => etats.map((e) => (e === null
  ? { etat: 'rien', mot: 'Rien ce jour' }
  : { etat: 'conge', mot: e }))

describe('les barres de la semaine', () => {
  it('ne fait aucune barre pour un jour isolé', () => {
    expect(grouperAbsences(semaine([null, 'Congé', null]))).toEqual([])
  })

  it('fait une barre d’un congé du mardi au jeudi', () => {
    expect(grouperAbsences(semaine([null, 'Congé', 'Congé', 'Congé', null, null, null])))
      .toEqual([{ debut: 1, fin: 3, mot: 'Congé' }])
  })

  it('coupe la barre quand le motif change', () => {
    expect(grouperAbsences(semaine(['Maladie', 'Maladie', 'Congé', 'Congé'])))
      .toEqual([
        { debut: 0, fin: 1, mot: 'Maladie' },
        { debut: 2, fin: 3, mot: 'Congé' },
      ])
  })

  it('va jusqu’au dimanche', () => {
    expect(grouperAbsences(semaine([null, null, null, null, null, 'Congé', 'Congé'])))
      .toEqual([{ debut: 5, fin: 6, mot: 'Congé' }])
  })

  it('ne fabrique rien sur une semaine vide', () => {
    expect(grouperAbsences(semaine([null, null, null, null, null, null, null]))).toEqual([])
  })
})
