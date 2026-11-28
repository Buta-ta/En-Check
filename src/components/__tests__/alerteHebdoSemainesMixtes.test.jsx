// src/components/__tests__/alerteHebdoSemainesMixtes.test.jsx
// ═══════════════════════════════════════════════════════════════════════════
//  UN DÉPASSEMENT PROUVÉ NE SE PERD PAS PARCE QU'UNE AUTRE SEMAINE EST FLOUE
//
//  Défaut d'origine : la carte exigeait `plafond.disponible === true`, or ce
//  drapeau vaut `false` dès qu'UNE semaine n'a pas pu être jugée. Une semaine
//  vérifiée à 44 h pour un seuil de 40 h — dépassement prouvé, réel — restait
//  donc invisible, uniquement parce qu'une AUTRE semaine manquait de règle.
//
//  Attente du fondateur, testée ici :
//    · afficher le dépassement de la semaine VÉRIFIÉE et ACTIVE ;
//    · signaler séparément les semaines indisponibles ;
//    · ne JAMAIS inventer d'alerte pour une semaine non évaluée ou désactivée.
//
//  ⚠️ Valeurs FICTIVES (40 h, 44 h). Aucune n'est une règle légale.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import AlerteHebdoCard from '../AlerteHebdoCard'

const semaine = (debut, fin, heures, seuil, depasse, extra = {}) => ({
  debut, fin, heures,
  seuil_applique: seuil,
  depasse,
  depassement_heures: depasse ? heures - seuil : 0,
  regle_resolue: true,
  seuil_source: 'entreprise',
  ...extra,
})

const texte = (plafond) =>
  renderToStaticMarkup(<AlerteHebdoCard plafond={plafond} />).replace(/<[^>]+>/g, ' ')

describe('Semaine vérifiée + semaine indisponible', () => {
  const mixte = {
    disponible: false,   // ← le drapeau global, faux dès qu'une semaine manque
    seuil: null,
    source: null,
    semaines: [
      semaine('2026-10-12', '2026-10-18', 44, 40, true),
      semaine('2026-10-19', '2026-10-25', 45, null, false, { regle_resolue: false }),
    ],
  }

  it('le dépassement PROUVÉ est affiché, avec son propre seuil', () => {
    const html = texte(mixte)
    expect(html).toContain('44 h pour un seuil de 40 h')
    expect(html).toContain('dépassement de 4 h')
  })

  it('la semaine sans verdict est signalée SÉPARÉMENT', () => {
    const html = texte(mixte)
    expect(html).toContain('45 h')
    expect(html).toContain('aucun verdict n’est prononcé')
  })

  it('aucun dépassement n’est inventé pour la semaine sans verdict', () => {
    const html = texte(mixte)
    //  Le seul dépassement chiffré est celui de la semaine vérifiée.
    expect(html.match(/dépassement de/g)).toHaveLength(1)
    //  Et cette semaine-là n'est jamais présentée comme conforme.
    expect(html).not.toMatch(/45 h pour un seuil/)
  })

  it('le titre annonce un dépassement, puisqu’il y en a un', () => {
    expect(texte(mixte)).toContain('Dépassement hebdomadaire')
  })
})

describe('Aucune semaine vérifiée en dépassement', () => {
  it('semaine sans seuil résolu : aucune alerte chiffrée', () => {
    const html = texte({
      disponible: false,
      seuil: null,
      semaines: [semaine('2026-10-19', '2026-10-25', 45, null, false, { regle_resolue: false })],
    })
    expect(html).toContain('aucun verdict n’est prononcé')
    expect(html).not.toMatch(/dépassement de/)
    //  Le titre ne promet pas ce que la carte ne dit pas.
    expect(html).toContain('Contrôle hebdomadaire')
    expect(html).not.toContain('Dépassement hebdomadaire')
  })

  it('alerte désactivée : le moteur ne produit aucun dépassement, la carte se tait', () => {
    //  Sans activation, `seuil_applique` vaut null et `depasse` reste faux :
    //  le moteur n'invente rien, la carte ne doit rien inventer non plus.
    const html = texte({
      disponible: true,
      seuil: null,
      semaines: [
        semaine('2026-10-19', '2026-10-25', 45, null, false),
      ],
    })
    //  Rendu vide : la carte ne dit rien du tout.
    expect(html.trim()).toBe('')
  })

  it('semaine partielle sans dépassement : aucune alerte', () => {
    const html = texte({
      disponible: true,
      seuil: 40,
      semaines: [
        semaine('2026-10-19', '2026-10-25', 30, 40, false, { partielle: true, joursEchues: 4 }),
      ],
    })
    expect(html).not.toMatch(/dépassement de/)
  })
})

describe('Deux semaines vérifiées, seuils différents', () => {
  it('chacune garde son seuil, et le total de dépassements est exact', () => {
    const html = texte({
      disponible: true,
      seuil: 45,
      source: 'entreprise',
      semaines: [
        semaine('2026-10-05', '2026-10-11', 46, 40, true),
        semaine('2026-10-12', '2026-10-18', 46, 45, true),
      ],
    })
    expect(html).toContain('46 h pour un seuil de 40 h — dépassement de 6 h')
    expect(html).toContain('46 h pour un seuil de 45 h — dépassement de 1 h')
    expect(html).toContain('2 semaines')
  })
})
