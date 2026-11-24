// src/services/__tests__/employeeInformationsPeau.test.js
// ═══════════════════════════════════════════════════════════════════════════
// 🧵 LA PEAU DE « MES INFORMATIONS » — les règles de la charte, gardées
//
//   La maquette retenue impose quatre choses qu'un CSS peut perdre sans qu'on
//   le voie à la relecture :
//   1. aucune couleur en dur — les tons viennent des jetons `--emp-*` ;
//   2. aucune ombre FLOUE — le seul relief admis est l'ombre dure à flou zéro ;
//   3. des rayons dans la liste blanche (6 / 8 / 11 / 12 / 999) ;
//   4. la bande de bogolan et le tampon incliné existent vraiment.
//
//   Ce fichier lit le CSS. Il ne juge pas le rendu (jsdom ne peint rien) : il
//   garde les règles que la capture du fondateur a validées.
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const CSS_BRUT = readFileSync('src/pages/employee/EmployeeInformations.css', 'utf8')
const CSS = CSS_BRUT.replace(/\/\*[\s\S]*?\*\//g, '')
const TOKENS = readFileSync('src/styles/tokens.css', 'utf8')

describe('Aucune couleur en dur', () => {
  it('le fichier ne contient pas un seul #hexadécimal', () => {
    expect(CSS.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull()
  })

  it('et pas davantage de rgba() littérale', () => {
    //  Une seule exception admise : aucune. Les lavis sont des jetons.
    expect(CSS.match(/rgba?\(/g)).toBeNull()
  })

  it('les jetons `--emp-*` utilisés sont tous déclarés dans tokens.css', () => {
    const utilises = new Set([...CSS.matchAll(/var\((--emp-[a-z0-9-]+)\)/g)].map((m) => m[1]))
    expect(utilises.size).toBeGreaterThan(5)
    for (const jeton of utilises) {
      expect(TOKENS, `jeton manquant : ${jeton}`).toContain(`${jeton}:`)
    }
  })
})

describe('Aucune ombre floue', () => {
  it('la seule ombre du fichier est l’ombre dure de la charte', () => {
    const ombres = [...CSS.matchAll(/box-shadow:\s*([^;]+);/g)].map((m) => m[1].trim())
    expect(ombres).toEqual(['var(--charte-ombre-dure)'])
  })

  it('aucun filtre de flou non plus', () => {
    expect(CSS).not.toMatch(/blur\(/)
  })
})

describe('Les rayons restent dans la liste blanche', () => {
  it('chaque border-radius est un jeton, ou l’une des valeurs admises', () => {
    const valeurs = [...CSS.matchAll(/border-radius:\s*([^;]+);/g)].map((m) => m[1].trim())
    expect(valeurs.length).toBeGreaterThan(3)
    for (const v of valeurs) {
      const ok = /var\(--charte-rayon-(champ|carte|badge|tuile|pilule)\)/.test(v)
      expect(ok, `rayon hors charte : ${v}`).toBe(true)
    }
  })
})

describe('Ce que la maquette retenue impose', () => {
  it('la bande de bogolan est un motif fait de traits, sans image', () => {
    expect(CSS).toMatch(/repeating-linear-gradient/)
    //  Un décor ne doit pas dépendre d'un fichier distant ni d'une photo.
    expect(CSS).not.toMatch(/background-image:\s*url\(/)
  })

  it('le tampon « à consulter » est incliné et en pointillé', () => {
    const tampon = CSS.match(/\.einfo-tampon-attente\s*\{([^}]*)\}/)
    expect(tampon).not.toBeNull()
    expect(tampon[1]).toMatch(/border:\s*\d+px\s+dashed/)
    expect(tampon[1]).toMatch(/transform:\s*rotate\(-\d+deg\)/)
  })

  it('le registre garde des filets entre les colonnes', () => {
    expect(CSS).toMatch(/\.einfo-ligne td\s*\{[^}]*border-right:/)
  })

  it('une ligne lue reste au registre : elle s’éteint, elle ne disparaît pas', () => {
    //  Aucune règle ne masque une ligne déjà lue.
    expect(CSS).not.toMatch(/\.einfo-lue[^{]*\{[^}]*display:\s*none/)
    expect(CSS).not.toMatch(/\.einfo-lue[^{]*\{[^}]*visibility:/)
  })

  it('le registre se replie sous 760 px au lieu de déborder', () => {
    expect(CSS).toMatch(/@media\s*\(max-width:\s*760px\)/)
  })
})
