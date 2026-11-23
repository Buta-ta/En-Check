// src/services/__tests__/origineSeuilHebdo.test.js
// ═══════════════════════════════════════════════════════════════════════════
// 🏷️ D'OÙ VIENT LE SEUIL HEBDOMADAIRE (constat P5)
//
// CE QUE FAISAIT LE PRODUIT
//   `getOvertimeSettings` fusionnait les défauts avec la ligne en base. L'écran
//   ne pouvait donc plus distinguer trois situations très différentes :
//     · l'entreprise a choisi 48 h ;
//     · personne n'a rien choisi, c'est le défaut du produit ;
//     · une ancienne sauvegarde a écrit 40 h sans qu'aucun humain ne le décide.
//   Les trois étaient présentées comme « seuil d'entreprise ». C'est faux dans
//   deux cas sur trois.
//
// CE QUE CES TESTS VERROUILLENT
//   1. le défaut du produit est 48 h, et il n'y a pas de second niveau par défaut ;
//   2. une valeur égale à un défaut connu n'est jamais présentée comme un choix ;
//   3. une lecture qui échoue ne prétend rien ;
//   4. l'écriture n'invente plus de seuil que personne n'a saisi ;
//   5. aucun libellé ne dit « légal », et le défaut n'est plus appelé « entreprise ».
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import FeatureService from '../featureService'
import {
  evaluerSeuilsHebdo,
  libelleOrigineSeuil,
  messageDepassement,
} from '../plafondHebdomadaire'

const H = (h) => h * 3600
const semaine = (heures) => [{
  debut: '2026-10-05',
  fin: '2026-10-11',
  secondes: H(heures),
  joursTravailles: 5,
  joursDansLaPeriode: 7,
}]

describe('Le défaut du produit', () => {
  it('le seuil d’alerte hebdomadaire par défaut est 48 h', () => {
    expect(FeatureService.getDefaultOvertimeSettings().weekly_threshold).toBe(48)
  })

  it('aucun second niveau n’est supposé par défaut', () => {
    //  48 h est le seuil ; un second palier n'existe que si l'entreprise le pose.
    expect(FeatureService.getDefaultOvertimeSettings().weekly_threshold_major).toBeNull()
  })
})

describe('L’origine d’une valeur enregistrée', () => {
  it('aucune règle enregistrée ⇒ défaut du produit', () => {
    expect(FeatureService.qualifierOrigineSeuilHebdo(null).origine).toBe('defaut_produit')
  })

  it('une valeur identique au défaut actuel ne prouve pas un choix', () => {
    //  48 h est le défaut : impossible de savoir si l'entreprise l'a choisi.
    const q = FeatureService.qualifierOrigineSeuilHebdo({ weekly_threshold: 48 })
    expect(q.origine).toBe('historique_incertain')
  })

  it('une valeur identique à l’ancien défaut (40 h) ne prouve pas un choix non plus', () => {
    const q = FeatureService.qualifierOrigineSeuilHebdo({ weekly_threshold: 40 })
    expect(q.origine).toBe('historique_incertain')
  })

  it('une valeur qui n’est pas un défaut connu est une décision d’entreprise', () => {
    const q = FeatureService.qualifierOrigineSeuilHebdo({ weekly_threshold: 45 })
    expect(q.origine).toBe('entreprise')
    expect(q.motif).toContain('45')
  })

  it('une ligne sans seuil hebdomadaire retombe sur le défaut du produit', () => {
    const q = FeatureService.qualifierOrigineSeuilHebdo({ weekly_threshold: null })
    expect(q.origine).toBe('defaut_produit')
  })

  it('une valeur illisible ne devient jamais « entreprise »', () => {
    expect(FeatureService.qualifierOrigineSeuilHebdo({ weekly_threshold: 'abc' }).origine).toBe('inconnue')
  })
})

describe('L’écriture n’invente plus de seuil', () => {
  it('un formulaire sans seuil hebdomadaire n’écrit aucun seuil hebdomadaire', () => {
    const payload = FeatureService.construirePayloadOvertimeSettings('ent-1', {
      daily_threshold: 8,
      rate_normal: 25,
    })

    expect(payload).not.toHaveProperty('weekly_threshold')
    expect(payload).not.toHaveProperty('weekly_threshold_major')
  })

  it('un seuil explicitement saisi est écrit', () => {
    const payload = FeatureService.construirePayloadOvertimeSettings('ent-1', {
      weekly_threshold: '50',
      weekly_threshold_major: 55,
    })

    expect(payload.weekly_threshold).toBe(50)
    expect(payload.weekly_threshold_major).toBe(55)
  })

  it('un seuil explicitement effacé est écrit à null, pas remplacé par un défaut', () => {
    const payload = FeatureService.construirePayloadOvertimeSettings('ent-1', {
      weekly_threshold_major: null,
    })

    expect(payload.weekly_threshold_major).toBeNull()
    expect(payload).not.toHaveProperty('weekly_threshold')
  })

  it('une chaîne vide ne crée pas une valeur', () => {
    const payload = FeatureService.construirePayloadOvertimeSettings('ent-1', {
      weekly_threshold: '',
    })
    expect(payload).not.toHaveProperty('weekly_threshold')
  })
})

describe('L’évaluation et les libellés', () => {
  it('sans source indiquée, l’évaluation ne prétend pas venir de l’entreprise', () => {
    const ev = evaluerSeuilsHebdo({ semaines: semaine(50), seuil: 48 })
    expect(ev.disponible).toBe(true)
    expect(ev.source).toBe('inconnue')
  })

  it('la source constatée est transmise telle quelle', () => {
    const ev = evaluerSeuilsHebdo({ semaines: semaine(50), seuil: 48, source: 'defaut_produit' })
    expect(ev.source).toBe('defaut_produit')
  })

  it('le message du défaut produit ne parle pas d’entreprise', () => {
    const ev = evaluerSeuilsHebdo({ semaines: semaine(50), seuil: 48, source: 'defaut_produit' })
    const message = messageDepassement(ev)

    expect(message).toContain('valeur par défaut du produit')
    expect(message).not.toContain('entreprise')
    expect(message).toContain('48 h')
  })

  it('le message d’une origine incertaine le dit, sans inventer', () => {
    const ev = evaluerSeuilsHebdo({ semaines: semaine(50), seuil: 48, source: 'historique_incertain' })
    expect(messageDepassement(ev)).toContain('origine à confirmer')
  })

  it('aucun libellé ne présente un seuil comme légal', () => {
    for (const source of ['entreprise', 'defaut_produit', 'historique_incertain', 'employe', 'contrat', 'inconnue']) {
      expect(libelleOrigineSeuil(source).toLowerCase()).not.toContain('légal')
      expect(libelleOrigineSeuil(source).toLowerCase()).not.toContain('legal')
    }
  })
})
