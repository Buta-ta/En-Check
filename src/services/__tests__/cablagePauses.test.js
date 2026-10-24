import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { setActiveTimezone } from '../../utils/timezoneUtils'

setActiveTimezone('Africa/Porto-Novo')

const ROOT = process.cwd()

// ── Contrat RPC attendu par l'app de pointage (LOT D, autre équipe) ────────
//  Cette app ne lit/écrit AUCUNE table en direct : uniquement ces 2 RPC.

describe('🔌 Câblage Pauses — app de pointage + migration 000004', () => {
  const migration = readFileSync(
    ROOT + '/supabase/migrations/20261016000004_pauses_intelligentes.sql', 'utf8')

  it('migration 000004 : table dédiée encheck_pauses (JAMAIS dans attendances)', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.encheck_pauses')
    expect(migration).toContain('presumee')
    expect(migration).toContain('sans_reprise')
    expect(migration).toContain('trop_longue')
    // Doctrine « on marque, on ne supprime pas » : la décision est un statut
    expect(migration).toContain("encheck_pauses_statut_chk CHECK (statut IN")
    // jamais de DELETE sur les pauses
    expect(migration).not.toMatch(/DELETE\s+FROM\s+public\.encheck_pauses/)
  })

  it('contrat app : encheck_pause_ouvrir / encheck_pause_fermer → jsonb', () => {
    expect(migration).toContain('public.encheck_pause_ouvrir(')
    expect(migration).toContain('public.encheck_pause_fermer(')
    expect(migration).toContain('RETURNS jsonb')
    // hors-ligne : idempotence par (employee, debut)
    expect(migration).toContain('encheck_pauses_debut_uk')
    expect(migration).toContain("'deja', true")
    // leçon MADEDE : aucune écriture app dans attendances
    expect(migration).not.toMatch(/INSERT INTO (public\.)?attendances/)
    expect(migration).not.toMatch(/UPDATE (public\.)?attendances/)
  })

  it('moteur : présomption marquée + anomalies → alertes idempotentes', () => {
    expect(migration).toContain('public.encheck_pauses_controler(')
    expect(migration).toContain('encheck_pause_prevue')
    expect(migration).toContain('public.encheck_pauses_alerter(')
    // idempotence : 1 alerte par (titre, employé, jour) — vérifié avant poser
    expect(migration).toContain('v_deja')
    expect(migration).toContain('encheck_alerte_poser(')
    // seuils maison (encheck_reglages_pointage) lus via encheck_seuil
    expect(migration).toContain('pause_fenetre_jours')
    expect(migration).toContain('pause_duree_max_minutes')
    // encheck_alertes_scan branché sur le moteur
    expect(migration).toContain('PERFORM public.encheck_pauses_controler(p_enterprise)')
  })

  it('page Pauses + service câblés (App.jsx, navigation Dashboard)', () => {
    expect(existsSync(ROOT + '/src/pages/Pauses.jsx')).toBe(true)
    const app = readFileSync(ROOT + '/src/App.jsx', 'utf8')
    const dashboardNavigation = readFileSync(ROOT + '/src/components/DashboardExperience.jsx', 'utf8')
    expect(app).toContain("import Pauses from './pages/Pauses'")
    expect(app).toContain('path="/pauses"')
    // accès sans module (pas de gate option) — l'arbitre statue
    expect(dashboardNavigation).toContain("label: 'Pauses', icon: Coffee, path: '/pauses', show: true")
  })

  it('timer dynamique des pauses réelles câblé en direct sur Pauses, Dashboard et Pointages', () => {
    const pausesPage = readFileSync(ROOT + '/src/pages/Pauses.jsx', 'utf8')
    const pausesSections = readFileSync(ROOT + '/src/components/PausesAfroTechSections.jsx', 'utf8')
    const dashboardPage = readFileSync(ROOT + '/src/pages/Dashboard.jsx', 'utf8')
    const dashboardExp = readFileSync(ROOT + '/src/components/DashboardExperience.jsx', 'utf8')
    const pointagesPage = readFileSync(ROOT + '/src/pages/Pointages.jsx', 'utf8')
    const pointagesSections = readFileSync(ROOT + '/src/components/PointagesAfroTechSections.jsx', 'utf8')

    expect(pausesPage).toContain("table: 'encheck_pauses'")
    expect(pausesSections).toContain('formaterTempsPauseEnDirect')
    expect(dashboardPage).toContain("table: 'encheck_pauses'")
    expect(dashboardExp).toContain('formaterTempsPauseEnDirect')
    // Pointages ne déclare plus ses tables en direct dans la page : le
    // canal est construit par useDirectPointages (un canal PAR table), qui
    // publie `encheck_pauses` avec `attendances`.
    const directPointages = readFileSync(ROOT + '/src/hooks/useDirectPointages.js', 'utf8')
    const tablesSuivies = readFileSync(ROOT + '/src/utils/directPointages.js', 'utf8')
    expect(pointagesPage).toContain('useDirectPointages')
    expect(directPointages).toContain('TABLES_SUIVIES.forEach(abonner)')
    expect(tablesSuivies).toContain("['attendances', 'encheck_pauses']")
    expect(pointagesPage).toContain('formaterTempsPauseEnDirect')
    expect(pointagesSections).toContain('formaterTempsPauseEnDirect')
    expect(pausesSections).toContain('pauses-v2-back-btn')
    expect(pausesSections).toContain('ArrowLeft')
  })
})
