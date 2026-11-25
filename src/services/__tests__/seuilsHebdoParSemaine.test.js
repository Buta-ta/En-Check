import { describe, it, expect } from 'vitest'
import {
  lundiDeLaSemaine,
  lundiSuivant,
  choisirPalier,
  construirePaliers,
} from '../seuilsHebdoParSemaine'

// ═══════════════════════════════════════════════════════════════════════════
//  RÉSOLUTION DES SEUILS PAR SEMAINE — module pur, sans base
//
//  Valeurs FICTIVES (42 h, 45 h, 50 h). Aucune n'est une règle légale.
// ═══════════════════════════════════════════════════════════════════════════

const V = (cle, valeur, date_effet, origine = 'entreprise') => ({ cle, valeur, date_effet, origine })

describe('lundiDeLaSemaine', () => {
  it('rend le lundi de la semaine, quel que soit le jour donné', () => {
    expect(lundiDeLaSemaine('2026-10-19')).toBe('2026-10-19')  // lundi
    expect(lundiDeLaSemaine('2026-10-21')).toBe('2026-10-19')  // mercredi
    expect(lundiDeLaSemaine('2026-10-25')).toBe('2026-10-19')  // dimanche
  })

  it('lit le jour DANS LE FUSEAU avant de chercher le lundi', () => {
    //  23:30 UTC le dimanche 25/10 = 00:30 lundi à Porto-Novo (UTC+1).
    //  La semaine n'est donc PAS celle du 19 : c'est un défaut de lecture
    //  classique, et c'est exactement pourquoi le fuseau est un paramètre.
    expect(lundiDeLaSemaine('2026-10-25T23:30:00Z', 'Africa/Porto-Novo')).toBe('2026-10-26')
    expect(lundiDeLaSemaine('2026-10-25T23:30:00Z', 'UTC')).toBe('2026-10-19')
  })

  it('rattache le 1ᵉʳ janvier au lundi de DÉCEMBRE (semaine à cheval sur l’année)', () => {
    //  Le 01/01/2027 est un vendredi : sa semaine commence le 28/12/2026.
    expect(lundiDeLaSemaine('2027-01-01', 'Africa/Porto-Novo')).toBe('2026-12-28')
  })

  it('rend null sur une entrée inexploitable, sans inventer de date', () => {
    expect(lundiDeLaSemaine(null)).toBe(null)
    expect(lundiDeLaSemaine('pas une date')).toBe(null)
  })

  it('un fuseau inconnu ne casse pas la lecture (repli UTC)', () => {
    expect(lundiDeLaSemaine('2026-10-21', 'Zone/Inexistante')).toBe('2026-10-19')
  })
})

describe('lundiSuivant', () => {
  it('avance de sept jours', () => {
    expect(lundiSuivant('2026-10-19')).toBe('2026-10-26')
    expect(lundiSuivant('2026-12-28')).toBe('2027-01-04')
  })
})

describe('construirePaliers', () => {
  it('sans aucune version, un seul palier de repli (réglage d’entreprise)', () => {
    const paliers = construirePaliers({ versions: [], repli: { seuil: 42 } })
    expect(paliers).toHaveLength(1)
    expect(paliers[0].depuis).toBe(null)
    expect(paliers[0].seuil).toBe(42)
  })

  it('trie du plus récent au plus ancien', () => {
    const paliers = construirePaliers({
      versions: [V('alerte_hebdo_heures', 40, '2026-01-01'), V('alerte_hebdo_heures', 45, '2026-10-21')],
    })
    //  Les versions triées, puis le palier de repli (depuis === null) en fin.
    expect(paliers.map((p) => p.depuis)).toEqual(['2026-10-21', '2026-01-01', null])
  })

  it('garde le repli d’entreprise pour la période ANTÉRIEURE à la première version', () => {
    const paliers = construirePaliers({
      versions: [V('alerte_hebdo_heures', 45, '2026-10-21')],
      repli: { seuil: 42 },
    })
    const ancien = choisirPalier(paliers, '2026-05-04')
    expect(ancien.depuis).toBe(null)
    expect(ancien.seuil).toBe(42)
  })
})

describe('choisirPalier', () => {
  const paliers = construirePaliers({
    versions: [V('alerte_hebdo_heures', 40, '2026-01-01'), V('alerte_hebdo_heures', 45, '2026-10-21')],
    repli: { seuil: 42 },
  })

  it('une règle du mercredi ne s’applique PAS à la semaine en cours', () => {
    //  Lundi 19/10 : la version du 21/10 n'existe pas encore à cette date.
    expect(choisirPalier(paliers, '2026-10-19').seuil).toBe(40)
  })

  it('elle s’applique au lundi suivant', () => {
    expect(choisirPalier(paliers, '2026-10-26').seuil).toBe(45)
  })

  it('une version entrant en vigueur APRÈS le lundi ne s’applique jamais avant', () => {
    const futur = construirePaliers({ versions: [V('alerte_hebdo_heures', 50, '2027-06-01')] })
    //  La version de juin 2027 ne s'applique pas en 2026 : on retombe sur le
    //  repli, jamais sur « la plus ancienne » par commodité — ce serait
    //  appliquer une règle avant son entrée en vigueur.
    const palier = choisirPalier(futur, '2026-10-19')
    expect(palier.depuis).toBe(null)
    expect(palier.seuil).toBe(null)   // aucun repli fourni : aucun seuil inventé
  })

  it('sans lundi, aucune décision n’est prise', () => {
    expect(choisirPalier(paliers, null)).toBe(null)
  })
})
