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
import { construirePresentsAujourdhui, finPosteDepassee, libelleSansPointage } from '../../lib/etatPresence'

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

describe('construirePresentsAujourdhui — profils de la bannière hero', () => {
  const pointage = (id, { first_name = '', last_name = '', photo_url = null, photoPointage = null } = {}) => ({
    employee_id: id,
    employees: { first_name, last_name, matricule: `M-${id}`, photo_url },
    pointages_photos: photoPointage ? [{ id: `p-${id}`, photo_url: photoPointage }] : [],
  })

  it('dédoublonne par employé : deux pointages du jour = un profil', () => {
    const presents = construirePresentsAujourdhui([
      pointage('e1', { first_name: 'Awa', last_name: 'Kone' }),
      pointage('e1', { first_name: 'Awa', last_name: 'Kone' }),
      pointage('e2', { first_name: 'Ibrahim', last_name: 'Diop' }),
    ])
    expect(presents).toHaveLength(2)
    expect(presents.map((p) => p.id)).toEqual(['e1', 'e2'])
  })

  it('conserve l’ordre des pointages (le plus récent d’abord)', () => {
    const presents = construirePresentsAujourdhui([
      pointage('e3', { first_name: 'Zina' }),
      pointage('e1', { first_name: 'Awa' }),
      pointage('e2', { first_name: 'Ibrahim' }),
    ])
    expect(presents.map((p) => p.id)).toEqual(['e3', 'e1', 'e2'])
  })

  it('la photo du pointage du jour prime sur la photo du profil', () => {
    const presents = construirePresentsAujourdhui([
      pointage('e1', { photo_url: 'https://cdn/profil.jpg', photoPointage: 'https://cdn/pointage.jpg' }),
    ])
    expect(presents[0].photo).toBe('https://cdn/pointage.jpg')
  })

  it('sans photo de pointage : la photo du profil, sinon null', () => {
    const presents = construirePresentsAujourdhui([
      pointage('e1', { photo_url: 'https://cdn/profil.jpg' }),
      pointage('e2', {}),
    ])
    expect(presents[0].photo).toBe('https://cdn/profil.jpg')
    expect(presents[1].photo).toBeNull()
  })

  it('compose nomComplet et tolère un employé sans nom', () => {
    const presents = construirePresentsAujourdhui([
      pointage('e1', { first_name: 'Awa', last_name: 'Kone' }),
      pointage('e2', {}),
    ])
    expect(presents[0].nomComplet).toBe('Awa Kone')
    expect(presents[1].nomComplet).toBe('')
  })

  it('ignore les pointages sans employé et accepte l’entrée vide', () => {
    expect(construirePresentsAujourdhui([])).toEqual([])
    expect(construirePresentsAujourdhui(null)).toEqual([])
    expect(construirePresentsAujourdhui([{ employees: {} }])).toEqual([])
  })
})
