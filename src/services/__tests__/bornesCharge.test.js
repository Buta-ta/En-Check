import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { SEUILS_PAR_DEFAUT } from '../seuilsPointage'

const MIGRATION = readFileSync(
  'supabase/migrations/20261124000004_bornes_charge_reglables.sql', 'utf8')

// ─────────────────────────────────────────────────────────────────────────────
//  F4 — les bornes du taux de charge sortent du code
//
//  Le défaut n'était pas que 110 et 70 soient mauvais : c'est qu'ils étaient
//  écrits AU MILIEU de `generateAlerts`, donc invisibles et non réglables.
//  Une entreprise qui travaille structurellement à 115 % recevait le même
//  avertissement qu'une autre, sans recours.
//
//  La règle tenue ici : changer le porteur ne change pas le comportement.
//  Les valeurs par défaut restent identiques, la migration sème exactement
//  ce que le code appliquait déjà.
// ─────────────────────────────────────────────────────────────────────────────

describe('📊 F4 — bornes de charge réglables', () => {
  it('les défauts sont ceux que le code appliquait en dur', () => {
    //  Si quelqu'un « améliore » ces valeurs un jour, ce test doit tomber :
    //  ce serait un changement de comportement, pas un refactor.
    expect(SEUILS_PAR_DEFAUT.surchargePourcent).toBe(110)
    expect(SEUILS_PAR_DEFAUT.sousUtilisationPourcent).toBe(70)
  })

  it('la migration sème ces mêmes valeurs, au global', () => {
    expect(MIGRATION).toContain("('surcharge_pourcent', '110'")
    expect(MIGRATION).toContain("('sous_utilisation_pourcent', '70'")
    expect(MIGRATION).toContain('ON CONFLICT (cle) WHERE enterprise_id IS NULL DO NOTHING')
  })

  it('aucune entreprise existante n’est écrasée', () => {
    //  Un réglage propre doit survivre à la migration. Pas d'UPDATE, pas de
    //  DELETE : le seul geste est un INSERT conditionnel sur le global.
    expect(MIGRATION).not.toMatch(/UPDATE\s+(public\.)?encheck_reglages_pointage/i)
    expect(MIGRATION).not.toMatch(/DELETE\s+FROM\s+(public\.)?encheck_reglages_pointage/i)
  })

  it('la migration dit que ce ne sont pas des seuils de paie', () => {
    //  Le risque de ce lot : qu'un lecteur pressé prenne 110 % pour un
    //  déclencheur d'heures supplémentaires. Le fichier doit le dire.
    expect(MIGRATION).toMatch(/LECTURE/)
    expect(MIGRATION).toMatch(/PAS DE PAIE|pas de paie/i)
  })

  it('aucune borne n’est présentée comme légale', () => {
    //  D5 : une valeur n'est jamais « conforme » parce qu'on l'a choisie.
    const horsCommentaires = MIGRATION
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n')
    expect(horsCommentaires.toLowerCase()).not.toContain('légal')
    expect(horsCommentaires.toLowerCase()).not.toContain('legal')
  })
})
