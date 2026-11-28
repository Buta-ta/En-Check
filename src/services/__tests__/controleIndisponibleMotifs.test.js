// src/services/__tests__/controleIndisponibleMotifs.test.js
// ═══════════════════════════════════════════════════════════════════════════
//  « POURQUOI CE CONTRÔLE N'A PAS ÉTÉ FAIT » — ET LE DROIT DE NE PAS ACCUSER
//  UN RÉGLAGE QUI EXISTE
//
//  Deux champs de `plafond_hebdo` viennent encore de l'ancien chargeur, qui
//  résout SANS date ni employé : `seuil_propose` et `motif_silence`.
//  Ce fichier établit ce qu'ils peuvent, et ne peuvent pas, faire dire.
//
//  ⚠️ Constat de vérification, corrigé ici : quand AUCUNE semaine n'était
//  jugée faute de règle résolue (migration absente), l'écran affirmait
//  « Aucun seuil hebdomadaire choisi par l'entreprise ». Faux : un seuil de
//  45 h était enregistré. Un motif inconnu n'autorise pas à nommer une cause.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import {
  pourquoiControleIndisponible,
  RAISONS_INDISPONIBLE,
} from '../../lib/controleDisponible'

const juge = (heures, seuil, depasse) => ({
  disponible: true,
  seuil,
  seuil_majeur: null,
  source: 'entreprise',
  semaines: [{
    debut: '2026-10-19', fin: '2026-10-25', heures,
    depasse, depassement_heures: depasse ? heures - seuil : 0,
    joursEchues: 7, joursDansLaPeriode: 7, partielle: false, a_venir: false,
  }],
})

describe('Un contrôle FAIT ne lit jamais `motif_silence`', () => {
  it('semaine jugée sous le seuil : aucune ligne d’indisponibilité', () => {
    const plafond = juge(40, 40, false)
    //  Le motif périmé est présent, il ne doit rien provoquer.
    plafond.motif_silence = 'alerte non activée : la case n’est pas cochée'
    expect(pourquoiControleIndisponible(plafond)).toBe(null)
  })

  it('semaine jugée en dépassement : aucune ligne non plus', () => {
    const plafond = juge(44, 40, true)
    plafond.motif_silence = 'aucun seuil hebdomadaire valide enregistré'
    expect(pourquoiControleIndisponible(plafond)).toBe(null)
  })
})

describe('Un contrôle NON fait dit la vraie raison', () => {
  it('migration absente : on ne prétend pas qu’aucun seuil n’est choisi', () => {
    const plafond = {
      disponible: false,
      seuil: null,
      seuil_propose: 45,   // le seuil EXISTE, en réglage d'entreprise
      motif: "5 semaine(s) sans règle résolue : aucun verdict n'est prononcé pour elles",
      motif_silence: null,
      semaines: [],
    }
    const etat = pourquoiControleIndisponible(plafond)
    expect(etat.raison).toBe(RAISONS_INDISPONIBLE.regle_sans_verdict)
    expect(etat.raison).not.toMatch(/Aucun seuil hebdomadaire choisi/)
  })

  it('aucun seuil réellement choisi : là, on le dit', () => {
    const etat = pourquoiControleIndisponible({
      disponible: false, seuil: null, seuil_propose: null,
      motif: 'aucun seuil hebdomadaire valide enregistré', semaines: [],
    })
    expect(etat.raison).toBe(RAISONS_INDISPONIBLE.aucun_seuil)
  })

  it('alerte désactivée par une décision : on nomme la décision', () => {
    const etat = pourquoiControleIndisponible({
      disponible: false, seuil: null,
      motif: 'alerte désactivée par une décision enregistrée', semaines: [],
    })
    expect(etat.raison).toBe(RAISONS_INDISPONIBLE.desactive)
  })

  it('motif inconnu : on ne nomme AUCUNE cause précise', () => {
    const etat = pourquoiControleIndisponible({
      disponible: false, seuil: null, motif: 'autre chose', semaines: [],
    })
    expect(etat.raison).toBe(RAISONS_INDISPONIBLE.regle_sans_verdict)
    expect(etat.raison).not.toMatch(/Aucun seuil/)
  })

  it('le motif PROPRE du moteur prime sur `motif_silence`', () => {
    //  `motif_silence` décrit le réglage d'aujourd'hui ; `motif` décrit ce qui
    //  s'est réellement passé pour ces semaines.
    const etat = pourquoiControleIndisponible({
      disponible: false, seuil: null,
      motif: "3 semaine(s) sans règle résolue : aucun verdict n'est prononcé pour elles",
      motif_silence: 'alerte non activée : la case n’est pas cochée',
      semaines: [],
    })
    expect(etat.raison).toBe(RAISONS_INDISPONIBLE.regle_sans_verdict)
  })
})
