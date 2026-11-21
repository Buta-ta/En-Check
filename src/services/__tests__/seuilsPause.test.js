import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  BORNES_SEUILS_PAUSE,
  SEUILS_PAR_DEFAUT,
  validerSeuilsPause,
} from '../seuilsPointage'

const MIGRATION = readFileSync(
  'supabase/migrations/20261105000001_seuils_pause_temps_travail.sql', 'utf8')

// ─────────────────────────────────────────────────────────────────────────────
// Les deux seuils de pause — décisions du 17/11/2026
//   « 15 minutes de tolérance pour le seuil de dépassement pour la pause »
//   « je veux savoir qui a touché au seuil » · « trace les 2 champs »
// ─────────────────────────────────────────────────────────────────────────────

describe('⏱️ Seuils de pause — valeurs et bornes', () => {
  it('les valeurs d’usage sont 15 et 120, et semées en base', () => {
    expect(SEUILS_PAR_DEFAUT.pauseToleranceMinutes).toBe(15)
    expect(SEUILS_PAR_DEFAUT.pauseDureeMaxMinutes).toBe(120)
    //  Semer une valeur que le moteur appliquait déjà ne change aucun calcul :
    //  le plafond était lu depuis 000004:581 avec 120 pour défaut codé.
    expect(MIGRATION).toContain("('pause_tolerance_minutes', '15'")
    expect(MIGRATION).toContain("('pause_duree_max_minutes', '120'")
  })

  it('la tolérance de retard d’arrivée n’est jamais touchée', () => {
    //  `late_tolerance_minutes` vit dans la grille horaire : autre grandeur,
    //  autre écran. La migration peut la NOMMER (un commentaire explique
    //  justement qu'elle n'y touche pas) ; ce qui est interdit, c'est de
    //  l'écrire — en base ou en réglage.
    const horsCommentaires = MIGRATION
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n')
    expect(horsCommentaires).not.toContain('late_tolerance_minutes')
    expect(MIGRATION).not.toMatch(/UPDATE\s+(public\.)?work_schedules/)
    expect(MIGRATION).not.toMatch(/INSERT\s+INTO\s+(public\.)?work_schedules/)
  })

  it('les bornes du JS et celles du SQL sont les mêmes', () => {
    //  Deux endroits se justifient (refuser une saisie sans aller-retour, et
    //  refuser une écriture directe) ; deux VALEURS ne se justifient pas.
    expect(MIGRATION).toContain('p_valeur < 0 OR p_valeur > 240')
    expect(BORNES_SEUILS_PAUSE.pauseToleranceMinutes).toMatchObject({ min: 0, max: 240 })
    expect(MIGRATION).toContain('p_valeur < 15 OR p_valeur > 600')
    expect(BORNES_SEUILS_PAUSE.pauseDureeMaxMinutes).toMatchObject({ min: 15, max: 600 })
  })

  it('refuse une tolérance supérieure au plafond', () => {
    const verdict = validerSeuilsPause({ toleranceMinutes: 200, maxMinutes: 120 })
    expect(verdict.ok).toBe(false)
    expect(verdict.erreur).toContain('ne peut pas dépasser')
    //  La base refuse la même chose, avec le même mot.
    expect(MIGRATION).toContain('ne peut pas dépasser le plafond')
  })

  it('refuse un plafond à 0 — un plafond nul effacerait toutes les pauses', () => {
    const verdict = validerSeuilsPause({ toleranceMinutes: 0, maxMinutes: 0 })
    expect(verdict.ok).toBe(false)
    expect(verdict.erreur).toContain('entre 15 et 600')
  })

  it('accepte 0 en tolérance : signaler au premier dépassement est un choix', () => {
    const verdict = validerSeuilsPause({ toleranceMinutes: 0, maxMinutes: 120 })
    expect(verdict.ok).toBe(true)
    expect(verdict.valeurs).toEqual({ toleranceMinutes: 0, maxMinutes: 120 })
  })

  it('refuse un nombre à virgule plutôt que de l’arrondir', () => {
    const verdict = validerSeuilsPause({ toleranceMinutes: '15.5', maxMinutes: 120 })
    expect(verdict.ok).toBe(false)
    expect(verdict.erreur).toContain('entiers')
  })

  it('refuse un champ vidé, sans écraser la valeur en base', () => {
    expect(validerSeuilsPause({ toleranceMinutes: '', maxMinutes: '120' }).ok).toBe(false)
    expect(validerSeuilsPause({ toleranceMinutes: '15', maxMinutes: '' }).ok).toBe(false)
  })
})

describe('⏱️ Seuils de pause — qui a touché, et quoi', () => {
  it('l’écriture est gardée par l’appartenance à l’entreprise', () => {
    expect(MIGRATION).toContain('public.encheck_est_admin_de(p_enterprise)')
    //  Lecture ET écriture, pas seulement l'écriture : les deux fonctions
    //  SECURITY DEFINER contournent la RLS, donc elles doivent se garder seules.
    const lectures = MIGRATION.split('encheck_est_admin_de(p_enterprise)').length - 1
    expect(lectures).toBe(2)
  })

  it('le nom de l’auteur est écrit sur les deux réglages', () => {
    //  `maj_par` était une colonne morte : toujours NULL, jamais écrite.
    expect(MIGRATION).toContain('maj_par = v_qui')
    expect(MIGRATION).toContain('public.encheck_auteur_actuel()')
    expect(MIGRATION).toContain('first_name')
    expect(MIGRATION).toContain('last_name')
  })

  it('les deux champs sont tracés, avec l’ancienne valeur', () => {
    //  « trace les 2 champs » : une trace par champ, pas une trace par
    //  enregistrement — sinon on ne sait pas lequel des deux a bougé.
    const traces = MIGRATION.split('public.encheck_journal_tracer(').length - 1
    expect(traces).toBe(2)
    expect(MIGRATION).toContain("'pause_tolerance_minutes : '")
    expect(MIGRATION).toContain("'pause_duree_max_minutes : '")
    //  L'ancienne valeur vient de l'instantané jsonb lu AVANT l'écriture.
    expect(MIGRATION).toContain("COALESCE(v_avant #>> '{valeur}', 'valeur d''usage')")
    expect(MIGRATION).toContain("'reglage_seuil'")
  })

  it('la trace part dans le journal append-only, jamais dans un journal neuf', () => {
    //  Réutiliser `encheck_pointages_journal` évite une troisième table
    //  d'audit — et son onglet « Journal des envois » existe déjà.
    expect(MIGRATION).toContain("'encheck_reglages_pointage', v_id")
    expect(MIGRATION).not.toMatch(/CREATE TABLE[^;]*journal/i)
  })

  it('l’écriture est une seule opération, pas deux appels indépendants', () => {
    expect(MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.encheck_seuil_ecrire(')
    expect(MIGRATION).toContain('RETURNS jsonb')
    //  Bornes AVANT toute écriture, DANS la RPC : rien ne se pose en base puis
    //  n'est refusé. On mesure dans le corps de la fonction, pas dans le fichier
    //  (où la définition de `encheck_seuil_borne` vient forcément en premier).
    const corps = MIGRATION.slice(
      MIGRATION.indexOf('CREATE OR REPLACE FUNCTION public.encheck_seuil_ecrire('))
    expect(corps.indexOf('public.encheck_seuil_borne(')).toBeGreaterThan(-1)
    expect(corps.indexOf('public.encheck_seuil_borne(')).toBeLessThan(
      corps.indexOf('INSERT INTO public.encheck_reglages_pointage'))
  })

  it('un écran ne réécrit aucun seuil en dur : le service est la source', () => {
    const page = readFileSync('src/pages/ConfigurationPointeuse.jsx', 'utf8')
    expect(page).toContain("validerSeuilsPause")
    expect(page).toContain("encheck_seuil_ecrire")
    expect(page).toContain("invaliderCacheSeuils(selectedEntId)")
  })
})
