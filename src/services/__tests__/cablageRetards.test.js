import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ═══════════════════════════════════════════════════════════════════════════
// CÂBLAGE DE LA PAGE « RETARDS » — une seule source de grille
// ═══════════════════════════════════════════════════════════════════════════
//  Constats du 16/10/2026, validés en production :
//
//   · Hippo BIYOKILA : l'alerte « Retard à l'arrivée » annonçait
//     « la grille « Journée de travail » prévoit 08:00 : 177 minute(s) » alors
//     que l'employé a un horaire personnalisé 09:00 (vrai retard : 117 min).
//     Le générateur d'alertes ne sait pas lire les horaires personnalisés.
//
//   · Pharmacie Blanche Gomes (option Planning NON souscrite) : la page
//     Retards affichait « Prévu 08:00 ±15min » et 13h05 « perdu » pour 3
//     employés, parce que la page lisait `employee_schedules` / `work_schedules`
//     elle-même — sans filtre `is_active`, sans dates d'effet, sans vérifier
//     que la grille liée appartient à la même entreprise.
//
//  La règle du cadre (16/10) : le calcul d'un retard appartient UNIQUEMENT à
//  `encheck_retards_plage` → `encheck_journee_recalculee` →
//  `encheck_grille_au_jour` (grilles actives, datées, option Planning). La
//  page ne fait que de la présentation ; les alertes vraies sont recalibrées
//  par `encheck_alertes_recalibrer` ; une entreprise sans option Planning ne
//  subit AUCUN jugement de ponctualité.
//
//  Analyse lexicale, sans React ni jsdom (même contrat que
//  cablageModifierPointage.test.js) : elle ne prouve pas le rendu, elle prouve
//  que le calcul ne repose plus sur une lecture parallèle des tables.

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const pageRetards = readFileSync(join(RACINE, 'pages', 'Retards.jsx'), 'utf8')
const serviceRetards = readFileSync(join(RACINE, 'services', 'retardsService.js'), 'utf8')
const migration = readFileSync(
  join(RACINE, '..', 'supabase', 'migrations', '20261016000003_retards_source_unique_et_recalibrage_alertes.sql'),
  'utf8'
)

describe('Page « Retards » — le calcul vient de la source unique SQL', () => {
  it('1) la page appelle la RPC unique `encheck_retards_plage` (et elle seule pour le calcul)', () => {
    expect(pageRetards).toContain('encheck_retards_plage')
    // La RPC est appelée avec la plage demandée et l'entreprise ciblée.
    expect(pageRetards).toMatch(/p_enterprise:\s*targetEnterpriseId === 'all' \? null : targetEnterpriseId/)
    expect(pageRetards).toMatch(/p_du:\s*startDate/)
    expect(pageRetards).toMatch(/p_au:\s*endDate/)
  })

  it('2) la page ne lit JAMAIS employee_schedules ni work_schedules directement', () => {
    // C'est précisément la classe de bug vécue : deux lectures, deux vérités.
    expect(pageRetards).not.toMatch(/from\('employee_schedules'\)/)
    expect(pageRetards).not.toMatch(/from\('work_schedules'\)/)
    expect(serviceRetards).not.toMatch(/from\('employee_schedules'\)/)
    expect(serviceRetards).not.toMatch(/from\('work_schedules'\)/)
  })

  it('3) l\'ancienne résolution JS (perso → défaut par entreprise) a disparu', () => {
    expect(pageRetards).not.toContain('defaultScheduleByEnterprise')
    expect(pageRetards).not.toContain('employeeSchedulesMap')
    expect(pageRetards).not.toContain('retardsCalcules.push')
  })

  it('4) la migration branche recalibrage + règle « sans option planning » + source unique', () => {
    // Le calcul de la page passe par la journée recalculée (la source unique).
    expect(migration).toContain('encheck_retards_plage')
    expect(migration).toContain('encheck_journee_recalculee')
    // Les alertes vraies sont réécrites avec les chiffres du jour visé.
    expect(migration).toContain('encheck_alertes_recalibrer')
    expect(migration).toMatch(/PERFORM public\.encheck_alertes_recalibrer\(p_enterprise, true\)/)
    // Règle métier : sans option Planning, aucun jugement horaire (page ET alertes).
    expect(migration).toContain('sans_option_planning')
    expect(migration).toContain('module planning non souscrit')
  })
})
