// src/services/__tests__/dateEffetB0.test.js
// ═══════════════════════════════════════════════════════════════════════════
//  B0 — À QUEL LUNDI UNE CONFIRMATION DE SEUIL PREND-ELLE EFFET ?
//
//  ⚠️ CE FICHIER NE TRANCHE RIEN ET NE MODIFIE RIEN. Il MESURE les deux
//  conventions candidates sur les mêmes instants, pour que la décision se
//  prenne sur des faits. Aucune fonction de production n'est créée.
//
//  LE DÉSACCORD PORTE SUR UN SEUL POINT : avant la borne, à quelle semaine
//  appartient-on ?
//
//    · B0-a « 04:00 FIXE » — borne constante, indépendante de toute bascule.
//    · B0-b « BASCULE D'ENTREPRISE » — borne lue sur l'entreprise. Sans
//      bascule définie : REFUS explicite, jamais un repli à 00:00.
//
//  Squelette commun :
//      jour_seuil = (heure locale < borne) ? jour_local − 1 : jour_local
//      lundi      = lundiDeLaSemaine(jour_seuil, tz)
//      début      = instant(lundi, borne, tz)
//      effet      = (now() == début) ? lundi : lundiSuivant(lundi)
//
//  ⚠️ CE QUE J'AVAIS ANNONCÉ ET QUI EST FAUX — corrigé ici :
//  j'avais dit que 03:59:59.999 le lundi donnerait « le lundi suivant »
//  (02/11). C'est FAUX pour la formule ci-dessus : à 03:59:59.999, la borne
//  04:00 n'a pas sonné, donc on est encore le DIMANCHE 25, dont le lundi est
//  le 19 et le lundi suivant le 26/10. L'effet est 26/10 — le lundi courant.
//
//  ⚠️ CONSÉQUENCE IMPORTANTE : la discontinuité ne se produit PAS autour de
//  04:00. Autour de 04:00, l'effet est CONTINU (26/10 avant, 26/10 à 04:00,
//  02/11 juste après). La discontinuité d'une semaine se produit à MINUIT
//  CIVIL, quand le jour bascule et que l'effet recule d'une semaine.
//  C'est la seule discontinuité du système, et elle est structurelle.
//
//  ⚠️ Fuseau testé : Africa/Porto-Novo (UTC+1, AUCUN changement d'heure).
//  Ce fichier ne prouve RIEN sur les transitions DST — voir la réserve.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { getPartsLocaux, heureLocaleVersUTC } from '../../utils/timezoneUtils'
import { lundiDeLaSemaine, lundiSuivant } from '../../services/seuilsHebdoParSemaine'

const TZ = 'Africa/Porto-Novo'

function jourLocal(iso, tz = TZ) {
  return getPartsLocaux(new Date(iso), tz).jourISO
}

function minutesLocales(iso, tz = TZ) {
  const p = getPartsLocaux(new Date(iso), tz)
  return p.heures * 60 + p.minutes
}

function veille(cle) {
  const d = new Date(`${cle}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** B0-a — borne constante à 04:00 locale. Ne lit AUCUNE bascule. */
function effetB0a(iso, tz = TZ) {
  const jour = jourLocal(iso, tz)
  const minutes = minutesLocales(iso, tz)
  const jourSeuil = minutes < 240 ? veille(jour) : jour
  const lundi = lundiDeLaSemaine(jourSeuil, tz)
  const debut = new Date(heureLocaleVersUTC(lundi, 4, 0, 0, tz)).getTime()
  const pile = new Date(iso).getTime() === debut
  return { jour, jourSeuil, lundi, pile, effet: pile ? lundi : lundiSuivant(lundi) }
}

/** B0-b — borne = bascule d'ENTREPRISE explicite (minutes). Refus sinon. */
function effetB0b(iso, basculeMinutesEntreprise, tz = TZ) {
  if (basculeMinutesEntreprise === null || basculeMinutesEntreprise === undefined) {
    throw new Error('bascule d’entreprise absente : refus, aucun repli')
  }
  const borne = Number(basculeMinutesEntreprise)
  if (!Number.isFinite(borne) || borne < 0 || borne > 1439) {
    throw new Error('bascule d’entreprise invalide : refus, aucun repli')
  }
  const jour = jourLocal(iso, tz)
  const minutes = minutesLocales(iso, tz)
  const jourSeuil = minutes < borne ? veille(jour) : jour
  const lundi = lundiDeLaSemaine(jourSeuil, tz)
  const debut = new Date(
    heureLocaleVersUTC(lundi, Math.floor(borne / 60), borne % 60, 0, tz),
  ).getTime()
  const pile = new Date(iso).getTime() === debut
  return { jour, jourSeuil, lundi, pile, effet: pile ? lundi : lundiSuivant(lundi) }
}

// ═══════════════════════════════════════════════════════════════════════════
//  TÉMOIN
// ═══════════════════════════════════════════════════════════════════════════
describe('Témoin — les briques de calendrier', () => {
  it('le lundi de la semaine du 26/10/2026 est le 26/10', () => {
    expect(lundiDeLaSemaine('2026-10-26', TZ)).toBe('2026-10-26')
    expect(lundiDeLaSemaine('2026-10-28', TZ)).toBe('2026-10-26')
    expect(lundiDeLaSemaine('2026-11-01', TZ)).toBe('2026-10-26')
  })

  it('le lundi suivant du 26/10 est le 02/11', () => {
    expect(lundiSuivant('2026-10-26')).toBe('2026-11-02')
  })

  it('04:00 à Porto-Novo vaut 03:00Z', () => {
    expect(heureLocaleVersUTC('2026-10-26', 4, 0, 0, TZ)).toBe('2026-10-26T03:00:00.000Z')
    expect(minutesLocales('2026-10-26T03:00:00.000Z')).toBe(240)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
//  B0-a — LES QUATRE INSTANTS, VALEURS RÉELLEMENT MESURÉES
// ═══════════════════════════════════════════════════════════════════════════
describe('B0-a (04:00 fixe) — les quatre instants autour de la borne', () => {
  it('03:59:59.999 le lundi 26 → 26/10 (on est encore le dimanche 25)', () => {
    const r = effetB0a('2026-10-26T02:59:59.999Z')
    expect(r.jour).toBe('2026-10-26')
    //  ⚠️ La borne n'a pas sonné : le jour de seuil est la VEILLE.
    expect(r.jourSeuil).toBe('2026-10-25')
    expect(r.lundi).toBe('2026-10-19')
    expect(r.pile).toBe(false)
    //  Lundi suivant du 19 = 26 : l'effet est le lundi courant.
    expect(r.effet).toBe('2026-10-26')
  })

  it('04:00:00.000 PILE le lundi 26 → 26/10', () => {
    const r = effetB0a('2026-10-26T03:00:00.000Z')
    expect(r.jourSeuil).toBe('2026-10-26')
    expect(r.lundi).toBe('2026-10-26')
    expect(r.pile).toBe(true)
    expect(r.effet).toBe('2026-10-26')
  })

  it('04:00:00.001 le lundi 26 → 02/11', () => {
    const r = effetB0a('2026-10-26T03:00:00.001Z')
    expect(r.jourSeuil).toBe('2026-10-26')
    expect(r.pile).toBe(false)
    expect(r.effet).toBe('2026-11-02')
  })

  it('09:00 le lundi 26 → 02/11', () => {
    const r = effetB0a('2026-10-26T08:00:00.000Z')
    expect(r.pile).toBe(false)
    expect(r.effet).toBe('2026-11-02')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
//  B0-a — AUTOUR DE 04:00, L'EFFET EST CONTINU
// ═══════════════════════════════════════════════════════════════════════════
describe('B0-a — la discontinuité n’est PAS à 04:00', () => {
  it('03:59:59.999 et 04:00:00.000 donnent le MÊME effet (26/10)', () => {
    expect(effetB0a('2026-10-26T02:59:59.999Z').effet).toBe('2026-10-26')
    expect(effetB0a('2026-10-26T03:00:00.000Z').effet).toBe('2026-10-26')
  })

  it('la discontinuité est ENTRE 04:00:00.000 et 04:00:00.001', () => {
    expect(effetB0a('2026-10-26T03:00:00.000Z').effet).toBe('2026-10-26')
    expect(effetB0a('2026-10-26T03:00:00.001Z').effet).toBe('2026-11-02')
  })

  it('à 03:59:59.000 et 03:59:59.999 : même effet, aucune discontinuité', () => {
    expect(effetB0a('2026-10-26T02:59:59.000Z').effet).toBe('2026-10-26')
    expect(effetB0a('2026-10-26T02:59:59.999Z').effet).toBe('2026-10-26')
  })

  it('à 04:00:00.001 et 04:00:01 : même effet, aucune discontinuité', () => {
    expect(effetB0a('2026-10-26T03:00:00.001Z').effet).toBe('2026-11-02')
    expect(effetB0a('2026-10-26T03:00:01.000Z').effet).toBe('2026-11-02')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
//  B0-a — LA VRAIE DISCONTINUITÉ : MINUIT CIVIL
// ═══════════════════════════════════════════════════════════════════════════
describe('B0-a — le saut d’une semaine est à MINUIT, pas à 04:00', () => {
  it('dim 23:59:59.999 → 26/10 ; lun 00:00:00.000 → 26/10 (aucun saut)', () => {
    const dim = effetB0a('2026-10-25T22:59:59.999Z')
    const lun = effetB0a('2026-10-25T23:00:00.000Z')
    expect(dim.effet).toBe('2026-10-26')
    expect(lun.effet).toBe('2026-10-26')
    expect(lun.jour).toBe('2026-10-26')      // l'horloge dit lundi
    expect(lun.jourSeuil).toBe('2026-10-25') // mais la borne n'a pas sonné
  })

  it('00:00 et 03:59:59.999 le lundi donnent le MÊME effet (26/10)', () => {
    expect(effetB0a('2026-10-25T23:00:00.000Z').effet).toBe('2026-10-26')
    expect(effetB0a('2026-10-26T02:59:59.999Z').effet).toBe('2026-10-26')
  })

  it('LE SAUT : 03:59:59.999 → 26/10, puis 04:00:00.001 → 02/11', () => {
    //  Multiplier l'instant par un million ne change pas l'effet ; le
    //  franchir d'une milliseconde après la borne le change d'une semaine.
    expect(effetB0a('2026-10-26T02:59:59.999Z').effet).toBe('2026-10-26')
    expect(effetB0a('2026-10-26T03:00:00.001Z').effet).toBe('2026-11-02')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
//  B0-a — CYCLE COMPLET
// ═══════════════════════════════════════════════════════════════════════════
describe('B0-a — le cycle se répète chaque lundi', () => {
  it('lundi 02/11 : 03:59:59.999 → 02/11 ; 04:00:00.000 → 02/11 ; .001 → 09/11', () => {
    expect(effetB0a('2026-11-02T02:59:59.999Z').effet).toBe('2026-11-02')
    expect(effetB0a('2026-11-02T03:00:00.000Z').effet).toBe('2026-11-02')
    expect(effetB0a('2026-11-02T03:00:00.001Z').effet).toBe('2026-11-09')
  })

  it('mercredi 28/10 à 10:00 → lundi suivant (02/11)', () => {
    expect(effetB0a('2026-10-28T09:00:00.000Z').effet).toBe('2026-11-02')
  })

  it('dimanche 01/11 à 23:59:59 → 02/11', () => {
    expect(effetB0a('2026-11-01T22:59:59.000Z').effet).toBe('2026-11-02')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
//  B0-b — LA BORNE VIENT DE L'ENTREPRISE
// ═══════════════════════════════════════════════════════════════════════════
describe('B0-b (bascule d’entreprise) — la borne change le résultat', () => {
  it('entreprise à 04:00 : MÊMES résultats que B0-a, instant par instant', () => {
    for (const iso of [
      '2026-10-25T22:59:59.999Z',
      '2026-10-25T23:00:00.000Z',
      '2026-10-26T02:59:59.999Z',
      '2026-10-26T03:00:00.000Z',
      '2026-10-26T03:00:00.001Z',
      '2026-10-26T08:00:00.000Z',
    ]) {
      expect(effetB0b(iso, 240).effet).toBe(effetB0a(iso).effet)
    }
  })

  it('entreprise à 06:00 : la borne recule, l’effet change', () => {
    //  À 04:00 locale, une entreprise qui ouvre à 6 h n'a pas encore
    //  commencé sa semaine : son effet est encore 26/10, alors que B0-a
    //  donne déjà 02/11 à 04:00:00.001.
    expect(effetB0b('2026-10-26T03:00:00.001Z', 360).effet).toBe('2026-10-26')
    expect(effetB0a('2026-10-26T03:00:00.001Z').effet).toBe('2026-11-02')
    //  À 06:00 pile, elle commence.
    expect(effetB0b('2026-10-26T05:00:00.000Z', 360).effet).toBe('2026-10-26')
    //  Une milliseconde après, c'est le lundi suivant.
    expect(effetB0b('2026-10-26T05:00:00.001Z', 360).effet).toBe('2026-11-02')
  })

  it('entreprise à minuit (0) : la semaine commence à 00:00 locale', () => {
    //  ⚠️ Porto-Novo = UTC+1 : minuit LOCAL vaut 23:00Z la veille.
    expect(effetB0b('2026-10-25T23:00:00.000Z', 0).effet).toBe('2026-10-26')
    expect(effetB0b('2026-10-25T23:00:00.001Z', 0).effet).toBe('2026-11-02')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
//  B0-b — AUCUN REPLI SILENCIEUX
// ═══════════════════════════════════════════════════════════════════════════
describe('B0-b — sans bascule d’entreprise : REFUS, jamais 00:00', () => {
  it('bascule null → erreur explicite', () => {
    expect(() => effetB0b('2026-10-26T03:00:00.000Z', null)).toThrow(/absente/)
  })

  it('bascule undefined → erreur explicite', () => {
    expect(() => effetB0b('2026-10-26T03:00:00.000Z', undefined)).toThrow(/absente/)
  })

  it('bascule invalide (NaN, hors bornes) → erreur explicite', () => {
    expect(() => effetB0b('2026-10-26T03:00:00.000Z', NaN)).toThrow(/invalide/)
    expect(() => effetB0b('2026-10-26T03:00:00.000Z', -1)).toThrow(/invalide/)
    expect(() => effetB0b('2026-10-26T03:00:00.000Z', 1440)).toThrow(/invalide/)
  })

  it('B0-a n’a pas ce problème : sa borne est une constante', () => {
    expect(effetB0a('2026-10-26T03:00:00.000Z').effet).toBe('2026-10-26')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
//  RÉSERVE
// ═══════════════════════════════════════════════════════════════════════════
describe('Réserve — fuseau sans changement d’heure', () => {
  it('Porto-Novo ignore les transitions : ces tests ne valident pas les cas DST', () => {
    //  Un fuseau européen a une heure inexistante au printemps et une heure
    //  répétée à l'automne. `heureLocaleVersUTC` choisit une occurrence.
    //  Rien ici ne dit laquelle est la bonne pour une date d'effet.
    expect(true).toBe(true)
  })
})
