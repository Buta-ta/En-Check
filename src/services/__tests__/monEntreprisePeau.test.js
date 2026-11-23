// src/services/__tests__/monEntreprisePeau.test.js
// ═══════════════════════════════════════════════════════════════════════════
// 🧵 LA PEAU DE « MON ENTREPRISE » — deux fautes vues sur la capture, gardées
//
//   Le fondateur a envoyé la capture du 24/11. Deux défauts étaient DE MOI :
//   1. les rubans de colle étaient ROGNÉS — un `overflow: hidden` posé sur
//      deux cartes coupait les 8 px qui dépassent au-dessus du cadre ; il ne
//      restait qu'un liseré gris collé au bord ;
//   2. le rabat du coin était un triangle de la couleur du fond, sans trait :
//      il se lisait comme une tache, pas comme un coin replié.
//
//   Ce fichier lit le CSS et vérifie que la faute ne revient pas. Il ne juge
//   pas le rendu (jsdom ne peint rien) : il garde les deux RÈGLES.
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const CSS = readFileSync('src/pages/MonEntreprise.css', 'utf8')
const SANS_COMMENTAIRES = CSS.replace(/\/\*[\s\S]*?\*\//g, '')

/** Le corps d'une règle, par son sélecteur exact. */
function regle(selecteur) {
  const echappe = selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = SANS_COMMENTAIRES.match(new RegExp(`${echappe}\\s*\\{([^}]*)\\}`))
  return m ? m[1] : null
}

describe('Le ruban de colle n’est jamais rogné', () => {
  it('aucune carte ne porte overflow: hidden', () => {
    //  La faute exacte : `.me-carte--identite, .me-carte--regles { overflow: hidden }`
    expect(SANS_COMMENTAIRES).not.toMatch(/\.me-carte[^{]*\{[^}]*overflow:\s*hidden/)
  })

  it('le ruban dépasse bien au-dessus du cadre', () => {
    const ruban = regle('.me-carte::before')
    expect(ruban).not.toBeNull()
    expect(ruban).toMatch(/top:\s*-\d+px/)
  })

  it('le ruban est teinté du kraft, pas de la couleur du fond', () => {
    const ruban = regle('.me-carte::before')
    //  Un ruban fait de `--charte-sable` (le fond) était invisible sur la capture.
    expect(ruban).toMatch(/--charte-aplat/)
  })
})

describe('Le rabat du coin se lit comme un pli', () => {
  it('il porte un trait d’encre — sans lui, c’est une tache', () => {
    const rabat = regle('.me-carte::after')
    expect(rabat).not.toBeNull()
    expect(rabat).toMatch(/--charte-encre/)
  })

  it('la coupe prend le papier de la FEUILLE, pas le sable du fond', () => {
    const rabat = regle('.me-carte::after')
    //  La carte est posée sur la feuille : effacer avec `--charte-sable`
    //  laisserait un carré de la couleur de l'écran dans la feuille.
    expect(rabat).toMatch(/--charte-surface/)
  })
})
