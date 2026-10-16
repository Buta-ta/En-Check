import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { setActiveTimezone } from '../../utils/timezoneUtils'

setActiveTimezone('Africa/Porto-Novo')

const ROOT = process.cwd()

// ── « TOUJOURS STATUER » (décision du commanditaire, 16/10 soir) ────────────
//   « je voudrais que les sorties présumées soient toujours statuer :
//    quand l'admin ou le super admin valide, l'heure de sortie présumée reste
//    et est marquée dans « modifier le pointage », quand l'admin écarte, ces
//    heures présumées disparaissent. »

describe('⚖️ Sorties présumées — toujours statuables (16/10 soir)', () => {
  const migration = readFileSync(
    ROOT + '/supabase/migrations/20261016000005_sorties_presumees_toujours_statuables.sql', 'utf8')
  const migrationPauses = readFileSync(
    ROOT + '/supabase/migrations/20261016000004_pauses_intelligentes.sql', 'utf8')
  const pointages = readFileSync(ROOT + '/src/pages/Pointages.jsx', 'utf8')
  const fiche = readFileSync(ROOT + '/src/components/ModifierPointage.jsx', 'utf8')

  it('1) 42804 réparé : encheck_pauses_lire caste les varchar en ::text', () => {
    // Erreur de prod : « Returned type character varying(100) does not match
    // expected type text in column 3 » → la page Pauses était en 400.
    // Le RETURN QUERY doit caster TOUTE colonne étrangère (employees/enterprises).
    expect(migration).toMatch(/e\.first_name::text/)
    expect(migration).toMatch(/e\.last_name::text/)
    expect(migration).toMatch(/e\.matricule::text/)
    expect(migration).toMatch(/ent\.name::text/)
    // Le fichier 000004 (install fraîche) porte le même correctif.
    expect(migrationPauses).toMatch(/e\.first_name::text/)
    expect(migrationPauses).toMatch(/ent\.name::text/)
  })

  it('2) contrat RPC : encheck_estimation_decider (les NOMS des paramètres font foi)', () => {
    // Leçon 404 du 16/10 : PostgREST traduit chaque clé JS en argument nommé.
    expect(migration).toContain('encheck_estimation_decider(')
    expect(migration).toContain('p_decision     text')
    expect(migration).toContain('p_heure_sortie timestamptz')
    expect(migration).toContain('p_niveau       smallint')
    // Consigne VALIDE (l'heure reste, marquée) et ÉCARTER = disparition des
    // écrans via la ligne 'sortie_presumee_rejetee' (hors calcul, jamais
    // supprimée) + journal.
    expect(migration).toContain("'sortie_presumee_rejetee'")
    expect(migration).toContain('encheck_estimation_decider')
    expect(migration).toMatch(/estimation_validee_le\s*=\s*now\(\)/)
    // Jamais de suppression : le compte-rendu reste pour l'audit.
    expect(migration).not.toMatch(/DELETE\s+FROM\s+public\.attendances/)
  })

  it('3) contrat RPC : encheck_estimation_deplacer (déplacement sans blanchiment)', () => {
    expect(migration).toContain('encheck_estimation_deplacer(')
    expect(migration).toContain('p_heure  timestamptz')
    // La ligne reste une estimation : la marque survit.
    expect(migration).toMatch(/is_auto_closed/)
  })

  it('4) bandeau : les boutons Valider/Écarter fonctionnent TOUJOURS (fin de « rien à statuer »)', () => {
    expect(pointages).toContain("statuerEstimation(p.lastOut, 'valider')")
    expect(pointages).toContain("statuerEstimation(p.lastOut, 'rejeter')")
    expect(pointages).toContain('encheck_estimation_decider')
    expect(pointages).toContain('p_decision: action')
    // L'ancien cul-de-sac (estimation à l'écran, boutons morts) est révolu.
    expect(pointages).not.toContain('rien à statuer')
  })

  it('5) fiche « Modifier le pointage » : reste + marquée si validée, disparaît si écartée', () => {
    // Marque visible sur chaque ligne présumée.
    expect(fiche).toContain('Sortie présumée validée')
    expect(fiche).toContain('Sortie présumée — à statuer')
    // La sauvegarde ne blanchit plus : les lignes présumées sortent du cycle
    // delete/insert de replace_attendance_day.
    expect(fiche).toMatch(/lignesPresumees\s*=\s*pointages\.filter\(\s*p\s*=>\s*p\.__estimation\s*\)/)
    expect(fiche).toContain('encheck_estimation_deplacer')
    expect(fiche).toContain('encheck_estimation_decider')
    // « Écarter » = disparition complète de la fiche (plus de notice).
    expect(fiche).not.toContain('lignes d’audit masquées')
    expect(fiche).not.toContain("d'audit masquée")
  })
})
