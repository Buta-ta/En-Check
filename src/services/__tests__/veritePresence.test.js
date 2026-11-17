// ═══════════════════════════════════════════════════════════
// LA VÉRITÉ DU TABLEAU DE BORD — P0
//
// Ce que ces tests défendent :
//  — un nom cassé (U+FFFD) ne doit jamais atteindre l'écran ;
//  — le mot « absent » n'apparaît qu'après la fin du poste
//    (heure locale de l'entreprise, seuil auto_close_time) ;
//  — le libellé « pas encore pointé » tant que le poste court.
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { nettoyerTexte } from '../../lib/nettoyageTexte'
import { finPosteDepassee, libelleSansPointage } from '../../lib/etatPresence'

describe('nettoyageTexte — garde d’affichage des noms', () => {
  it('retire le caractère de remplacement U+FFFD d’un nom', () => {
    expect(nettoyerTexte('Koné\uFFFDKOMI')).toBe('KonéKOMI')
  })

  it('retire les espaces insécables / zéro large / BOM invisibles', () => {
    expect(nettoyerTexte('\u200BFatou\u200C\uFEFF')).toBe('Fatou')
  })

  it('ne touche pas un nom propre', () => {
    expect(nettoyerTexte('Koné KOMI (EN-NOUS)')).toBe('Koné KOMI (EN-NOUS)')
  })

  it('accepte des valeurs vides et non-texte', () => {
    expect(nettoyerTexte('')).toBe('')
    expect(nettoyerTexte(null)).toBe('')
    expect(nettoyerTexte(undefined)).toBe('')
    expect(nettoyerTexte(42)).toBe('42')
  })
})

describe('finPosteDepassee — « absent » seulement après la fin du poste', () => {
  it('défaut : seuil 18:00, fuseau local (cohérence libellé/booléen)', () => {
    const depassee = finPosteDepassee({})
    expect(typeof depassee).toBe('boolean')
    expect(libelleSansPointage(depassee)).toBe(depassee ? 'absents' : 'pas encore pointés')
  })

  it('fermeture 23:59 : le poste n’est « terminé » qu’à 23 h 59', () => {
    const d = new Date()
    const attendOn = d.getHours() < 23 || (d.getHours() === 23 && d.getMinutes() < 59)
    expect(finPosteDepassee({ auto_close_time: '23:59' })).toBe(!attendOn)
  })

  it('fermeture 06:00 : le poste est dépassé dès 6 h', () => {
    expect(finPosteDepassee({ auto_close_time: '06:00' })).toBe(new Date().getHours() >= 6)
  })

  it('fuseau explicite : le seuil se juge à l’heure de l’entreprise', () => {
    // Porto-Novo = UTC+1, fixe toute l’année : 18 h locales = 17 h UTC.
    const depassee = finPosteDepassee({ auto_close_time: '18:00', timezone: 'Africa/Porto-Novo' })
    const now = new Date()
    const minutesLocales = (((now.getUTCHours() + 1) % 24) * 60) + now.getUTCMinutes()
    expect(depassee).toBe(minutesLocales >= 18 * 60)
  })

  it('libellé singulier / pluriel', () => {
    expect(libelleSansPointage(false)).toBe('pas encore pointés')
    expect(libelleSansPointage(false, true)).toBe('pas encore pointé')
    expect(libelleSansPointage(true)).toBe('absents')
    expect(libelleSansPointage(true, true)).toBe('absent')
  })
})
