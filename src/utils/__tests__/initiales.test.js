// ═══════════════════════════════════════════════════════════
// INITIALES — repli d'avatar sans photo
//
// Ce que ces tests défendent :
//  — un avatar sans photo doit toujours afficher quelque chose
//    (jamais un cercle vide) ;
//  — initialesDepuisNom sert les bannières de pause, où seul
//    le nom complet est disponible (« Hippo BIYOKILA » → « HB »).
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { initialesDe, initialesDepuisNom } from '../initiales'

describe('initialesDe — prénom + nom séparés', () => {
  it('compose les initiales en majuscules', () => {
    expect(initialesDe('Awa', 'Kone')).toBe('AK')
  })

  it('sans nom : l’initiale du prénom, jamais vide', () => {
    expect(initialesDe('Fatou', '')).toBe('F')
  })

  it('sans rien du tout : « ? » (pas un cercle vide)', () => {
    expect(initialesDe('', '')).toBe('?')
    expect(initialesDe(null, undefined)).toBe('?')
  })
})

describe('initialesDepuisNom — nom complet uniquement (pauses)', () => {
  it('premier mot + dernier mot', () => {
    expect(initialesDepuisNom('Hippo BIYOKILA')).toBe('HB')
  })

  it('trois mots : initiale du premier et du dernier', () => {
    expect(initialesDepuisNom('Awa Marie Kone')).toBe('AK')
  })

  it('un seul mot : sa première lettre', () => {
    expect(initialesDepuisNom('Koné')).toBe('K')
  })

  it('espaces multiples tolérés', () => {
    expect(initialesDepuisNom('  Hippo    BIYOKILA  ')).toBe('HB')
  })

  it('vide / null : « ? »', () => {
    expect(initialesDepuisNom('')).toBe('?')
    expect(initialesDepuisNom(null)).toBe('?')
  })
})
