// src/services/__tests__/controleIndisponibleRendu.test.jsx
// ═══════════════════════════════════════════════════════════════════════════
// 🧭 G7 — CE QUI EST RENDU, PAS SEULEMENT CE QUI EST CALCULÉ
//
//   Le défaut d'origine n'était pas dans la logique : la carte d'alerte était
//   juste muette. Le défaut était à l'ÉCRAN — un tableau d'heures sans un mot
//   sur le contrôle non fait. Ces tests rendent donc les deux composants.
//
//   La règle des deux ensemble : jamais les deux à la fois. Une alerte rouge
//   et une ligne « contrôle indisponible » se contrediraient.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import AlerteHebdoCard from '../../components/AlerteHebdoCard'
import ControleIndisponible from '../../components/ControleIndisponible'
import { evaluerSeuilsHebdo } from '../plafondHebdomadaire'

const H = (h) => h * 3600

const depasse = () =>
  evaluerSeuilsHebdo({
    semaines: [
      { debut: '2026-10-05', fin: '2026-10-11', secondes: H(50), joursTravailles: 5, joursDansLaPeriode: 7 },
    ],
    seuil: 45,
    source: 'entreprise',
  })

const silenceAucunSeuil = {
  disponible: false,
  motif_silence: 'aucun seuil hebdomadaire valide enregistré',
  seuil: null,
  nb_depassees: 0,
  semaines: [],
}

const renduLigne = (plafond) => renderToStaticMarkup(<ControleIndisponible plafond={plafond} />)

describe('La ligne « contrôle indisponible »', () => {
  it('ne s’affiche PAS quand le contrôle a été fait', () => {
    expect(renduLigne(depasse())).toBe('')
  })

  it('s’affiche quand aucun seuil n’a été choisi, avec sa raison', () => {
    const html = renduLigne(silenceAucunSeuil)
    expect(html).toContain('Contrôle indisponible')
    expect(html).toContain('Aucun seuil hebdomadaire choisi')
  })

  it('n’est pas une alerte : pas de rôle « alert », mais un état lisible', () => {
    const html = renduLigne(silenceAucunSeuil)
    expect(html).not.toContain('role="alert"')
    expect(html).toContain('role="status"')
  })

  it('ne prononce jamais le mot « conforme »', () => {
    expect(renduLigne(silenceAucunSeuil).toLowerCase()).not.toContain('conforme')
  })

  it('se tait aussi quand le plafond manque… en le disant', () => {
    //  `null` = le calcul n'a pas été produit. Ce n'est pas « rien à signaler ».
    const html = renduLigne(null)
    expect(html).toContain('Contrôle indisponible')
    expect(html).toContain('pas disponible pour cette période')
  })
})

describe('Les deux ne parlent jamais en même temps', () => {
  it('contrôle fait et dépassé : la carte parle, la ligne se taît', () => {
    const plafond = depasse()
    expect(renderToStaticMarkup(<AlerteHebdoCard plafond={plafond} />)).toContain('Dépassement hebdomadaire')
    expect(renduLigne(plafond)).toBe('')
  })

  it('contrôle non fait : la carte se taît, la ligne parle', () => {
    expect(renderToStaticMarkup(<AlerteHebdoCard plafond={silenceAucunSeuil} />)).toBe('')
    expect(renduLigne(silenceAucunSeuil)).not.toBe('')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
//  G7-bis — la règle des deux ensemble, contre les nouveaux cas
//
//  Les semaines en cours et à venir ont introduit trois façons de rendre la
//  ligne. Aucune ne doit jamais cohabiter avec la carte d'alerte : deux
//  messages simultanés se contrediraient, et c'est précisément ce que G7
//  interdit.
// ─────────────────────────────────────────────────────────────────────────────

describe('🖥️ G7-bis — exclusion mutuelle, cas étendus', () => {
  const rendre = (plafond) =>
    renderToStaticMarkup(
      <div>
        <AlerteHebdoCard plafond={plafond} />
        <ControleIndisponible plafond={plafond} />
      </div>,
    )

  it('dépassement prouvé + semaine partielle ⇒ la carte seule', () => {
    const html = rendre({
      disponible: true,
      seuil: 48,
      source: 'entreprise',
      semaines: [
        { debut: '2026-10-19', fin: '2026-10-25', heures: 60, depasse: true, depassement_heures: 12, partielle: true, joursEchues: 5, a_venir: false },
      ],
    })
    expect(html).toContain('Dépassement hebdomadaire')
    expect(html).not.toContain('e360-controle-indisponible')
  })

  it('semaine en cours sans dépassement ⇒ la ligne seule', () => {
    const html = rendre({
      disponible: true,
      seuil: 48,
      source: 'entreprise',
      semaines: [
        { debut: '2026-10-19', fin: '2026-10-25', heures: 20, depasse: false, partielle: true, joursEchues: 6, a_venir: false },
      ],
    })
    expect(html).toContain('e360-controle-indisponible')
    expect(html).not.toContain('Dépassement hebdomadaire')
  })

  it('semaine à venir ⇒ la ligne, et jamais un « conforme »', () => {
    const html = rendre({
      disponible: true,
      seuil: 48,
      source: 'entreprise',
      semaines: [
        { debut: '2026-10-26', fin: '2026-11-01', heures: 0, depasse: false, partielle: true, joursEchues: 0, a_venir: true },
      ],
    })
    expect(html).toContain('e360-controle-indisponible')
    expect(html).toMatch(/pas encore commencé/i)
    expect(html.toLowerCase()).not.toContain('conforme')
    expect(html).not.toContain('Dépassement hebdomadaire')
  })
})
