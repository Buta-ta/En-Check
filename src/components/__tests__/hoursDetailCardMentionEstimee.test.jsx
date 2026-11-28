// src/components/__tests__/hoursDetailCardMentionEstimee.test.jsx
// ═══════════════════════════════════════════════════════════════════════════
//  « TOTAL BRUT » NE DOIT PAS SE LIRE COMME UN MONTANT DÛ
//
//  La carte de recherche affiche un total brut calculé à partir des heures
//  travaillées, y compris celles qui viennent d'une sortie ESTIMÉE. La paie,
//  elle, écarte ces heures tant qu'un humain ne les a pas validées. Les deux
//  chiffres ne se contredisent pas, mais l'écran doit dire lequel il montre.
//
//  ⚠️ Valeurs FICTIVES (1 000 XAF/h). Aucune n'est un montant réel.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import HoursDetailCard from '../SpotlightSearch/ResultCards/HoursDetailCard.jsx'

//  `employee.name` est requis par l'en-tête (initiales de l'avatar).
const EMPLOYE = { name: 'Awa Test', first_name: 'Awa', last_name: 'Test', matricule: 'MAT-001' }

/** Carte minimale : seule la valorisation et la part estimée comptent ici. */
function rendre({ presumed_seconds, total_gross = 8000 }) {
  const data = {
    employee: EMPLOYE,
    today: { worked: '0h00', entries: [], anomalies: [] },
    thisWeek: {},
    thisMonth: { presumed_seconds, total_worked: '8h00', rate: null },
    thisYear: {},
    valorization: {
      total_gross,
      currency: 'XAF',
      normal: { hours: '8h00', rate: 1000, amount: total_gross },
    },
    alerts: [],
  }
  return renderToStaticMarkup(<HoursDetailCard data={data} />).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
}

describe('mention de la part estimée sur le total brut', () => {
  it('total sans estimation : aucune mention, le chiffre se lit seul', () => {
    const texte = rendre({ presumed_seconds: 0 })
    expect(texte).toContain('Total brut')
    expect(texte).not.toContain('Montant indicatif')
    expect(texte).not.toContain('non validées')
  })

  it('total contenant des heures estimées : la réserve est écrite, avec le chiffre', () => {
    const texte = rendre({ presumed_seconds: 8 * 3600 })
    expect(texte).toContain('Montant indicatif')
    expect(texte).toContain('8 h estimées, non validées')
    //  La phrase dit explicitement que ce n'est pas ce qui sera payé.
    expect(texte).toContain('ne correspond pas nécessairement au montant payé')
  })

  it('la mention suit le total brut, jamais avant', () => {
    const texte = rendre({ presumed_seconds: 8 * 3600 })
    expect(texte.indexOf('Total brut')).toBeLessThan(texte.indexOf('Montant indicatif'))
  })

  it('aucun montant « hors estimation » n’est affiché', () => {
    //  Ce second montant demanderait la même logique de valorisation que le
    //  premier ; tant qu'elle n'est pas vérifiée, on ne l'invente pas.
    const texte = rendre({ presumed_seconds: 8 * 3600 }).toLowerCase()
    expect(texte).not.toContain('hors estimation')
    expect(texte).not.toContain('hors estim')
    //  Et le montant affiché reste EXACTEMENT celui du moteur.
    expect(texte).toContain('8 000')
  })

  it('part estimée arrondie à l’heure pleine : libellé lisible', () => {
    const texte = rendre({ presumed_seconds: 3 * 3600 })
    expect(texte).toContain('3 h estimées, non validées')
  })
})
