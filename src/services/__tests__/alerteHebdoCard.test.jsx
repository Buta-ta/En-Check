// src/services/__tests__/alerteHebdoCard.test.jsx
// ═══════════════════════════════════════════════════════════════════════════
// ⏰ LA CARTE D'ALERTE — visible quand elle est vraie, muette sinon
//
// Rendu serveur, aucune base. On vérifie le contrat passé au fondateur :
//   · case non cochée / seuil non prouvé  -> RIEN à l'écran ;
//   · alerte activée + semaine dépassée   -> les heures, le seuil, l'écart ;
//   · jamais le mot « légal », jamais un seuil présenté comme une règle
//     d'État : c'est le seuil de l'entreprise.
//
// ⚠️ Valeurs FICTIVES (45 h, 50 h, 52 h). Aucune n'est une obligation.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import AlerteHebdoCard from '../../components/AlerteHebdoCard'
import { jourCourt } from '../../utils/jourCourt'
import { evaluerSeuilsHebdo } from '../plafondHebdomadaire'

const H = (h) => h * 3600

/** Une évaluation réelle, produite par le service — pas un objet inventé. */
function evaluation({ seuil = 45, secondes = [H(50), H(38)] } = {}) {
  return evaluerSeuilsHebdo({
    semaines: secondes.map((s, i) => ({
      debut: i === 0 ? '2026-10-05' : '2026-10-12',
      fin: i === 0 ? '2026-10-11' : '2026-10-18',
      secondes: s,
      joursTravailles: 5,
      joursDansLaPeriode: 7,
    })),
    seuil,
    source: 'entreprise',
  })
}

const rendu = (plafond) => renderToStaticMarkup(<AlerteHebdoCard plafond={plafond} />)

describe('La carte d’alerte hebdomadaire', () => {
  it('ne rend RIEN quand aucune alerte n’est activée', () => {
    const plafond = {
      ...evaluation(),
      disponible: false,
      seuil: null,
      nb_depassees: 0,
      semaines: [],
    }
    expect(rendu(plafond)).toBe('')
  })

  it('ne rend rien quand le seuil est actif mais rien ne le dépasse', () => {
    expect(rendu(evaluation({ secondes: [H(40), H(44)] }))).toBe('')
  })

  it('ne rend rien sans évaluation du tout', () => {
    expect(rendu(undefined)).toBe('')
    expect(rendu(null)).toBe('')
  })

  it('affiche la semaine, les heures, le seuil et l’écart', () => {
    const html = rendu(evaluation())
    expect(html).toContain('Dépassement hebdomadaire')
    expect(html).toContain('Semaine du 5 oct. au 11 oct.')
    expect(html).toContain('50 h pour un seuil de 45 h')
    expect(html).toContain('dépassement de 5 h')
    //  Une seule semaine dépasse : la seconde (38 h) reste dehors.
    expect(html).not.toContain('Semaine du 12 oct.')
  })

  it('compte les semaines dépassées', () => {
    const html = rendu(evaluation({ secondes: [H(50), H(52)] }))
    expect(html).toContain('2 semaines')
    expect(html).toContain('Semaine du 12 oct.')
  })

  it('nomme le seuil comme un paramètre d’entreprise, jamais comme un texte', () => {
    const html = rendu(evaluation()).toLowerCase()
    expect(html).toContain('entreprise')
    expect(html).toContain('pas un plafond légal')
    //  La tournure est une négation assumée ; aucun autre « légal » ne traîne.
    expect(html.match(/légal/g) || []).toHaveLength(1)
  })

  it('formate les jours sans dépendre du fuseau', () => {
    expect(jourCourt('2026-10-05')).toBe('5 oct.')
    expect(jourCourt('2026-01-31')).toBe('31 janv.')
    expect(jourCourt('')).toBe('')
  })
})
