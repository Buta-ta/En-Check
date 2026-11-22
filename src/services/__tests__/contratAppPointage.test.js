// ═══════════════════════════════════════════════════════════════════════════
// 🔌 CONTRAT SERVEUR APP POINTAGE — deux ajouts livrés à l'équipe
//
// Ce que ces tests empêchent de revenir :
//
//   ① ouvrir `encheck_pauses_lire` à `anon` « pour faire simple » —
//     la tablette verrait les pauses de tous les employés ;
//   ② accepter un `p_employee` en paramètre de la lecture employé —
//     un identifiant circule, il ne prouve rien ;
//   ③ laisser l'ancienne signature de `encheck_pause_fermer` cohabiter —
//     les appels à 2 arguments choisiraient celle qui n'écrit pas le motif ;
//   ④ inventer un motif de fermeture pour les pauses du passé.
// ═══════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const MIGRATION = readFileSync(
  'supabase/migrations/20261123000001_contrat_serveur_app_pointage.sql', 'utf8')

describe('🔌 Contrat serveur — « mes pauses »', () => {
  it('exige un JETON, jamais un identifiant employé', () => {
    //  La demande initiale était `p_employee`. Un identifiant circule sur
    //  la tablette : avec lui, n'importe qui lirait les pauses d'un collègue.
    expect(MIGRATION).toContain('p_jeton text')
    expect(MIGRATION).not.toContain('p_employee uuid,\n  p_du')
    expect(MIGRATION).toContain('public.encheck_session_employe(p_jeton)')
  })

  it('refuse une session absente ou expirée', () => {
    expect(MIGRATION).toContain("RAISE EXCEPTION 'Session employé invalide ou expirée.'")
    expect(MIGRATION).toContain("ERRCODE = '42501'")
  })

  it('nomme les variables au lieu de copier la ligne de la table', () => {
    //  `encheck_session_employe` renvoie 4 colonnes, `employee_sessions` en a 9.
    //  `SELECT * INTO` d'un type de table aligne par position : `device_id`
    //  (text) atterrit dans une colonne uuid → erreur 22P02. Mesuré en base.
    expect(MIGRATION).toContain('INTO v_emp, v_ent')
    expect(MIGRATION).not.toContain('v_sess public.employee_sessions')
    expect(MIGRATION).not.toContain('SELECT * INTO v_sess')
  })

  it('ne peut renvoyer que les pauses de la personne identifiée', () => {
    expect(MIGRATION).toContain('WHERE p.employee_id = v_emp')
    expect(MIGRATION).toContain('AND p.enterprise_id = v_ent')
  })

  it('remonte les deux chiffres du dépassement', () => {
    expect(MIGRATION).toContain('prevue_minutes integer, ecart_minutes integer, tolerance_minutes integer')
    expect(MIGRATION).toContain('prevue_debut time, prevue_fin time')
  })

  it('n’ouvre jamais la lecture admin aux anonymes', () => {
    //  `encheck_pauses_lire` vérifie l'appartenance à l'entreprise, pas
    //  l'identité. GRANT à `anon` = toutes les pauses de tous les employés.
    //  L'assertion précédente ne testait rien (elle comparait toujours vrai).
    //  On vérifie la seule chose qui compte : aucun GRANT de cette migration
    //  ne donne `encheck_pauses_lire` à `anon`.
    const grants = MIGRATION.match(/GRANT[^;]*;/gi) || []
    const versAnon = grants.filter(
      (g) => /encheck_pauses_lire/i.test(g) && /\banon\b/i.test(g)
    )
    expect(versAnon).toEqual([])
    //  Et la nouvelle lecture employé, elle, est bien ouverte à `anon` —
    //  sinon la tablette ne pourrait pas l'appeler.
    const versMesPauses = grants.filter((g) => /encheck_pauses_mes_pauses/i.test(g))
    expect(versMesPauses.some((g) => /\banon\b/i.test(g))).toBe(true)
  })
})

describe('🔌 Contrat serveur — le motif de fermeture', () => {
  it('n’accepte que deux valeurs, et le passé reste NULL', () => {
    expect(MIGRATION).toContain("motif_fermeture IN ('reprise', 'sortie')")
    expect(MIGRATION).toContain('motif_fermeture IS NULL OR')
    //  Les pauses existantes n'ont pas de motif : on ne leur en invente pas.
    expect(MIGRATION).toContain('Elle ne remplit pas `motif_fermeture`')
  })

  it('supprime l’ancienne signature à 2 paramètres', () => {
    //  Sinon les deux fonctions cohabitent et un appel à 2 arguments prend
    //  l'ancienne, qui n'écrit jamais le motif. Mesuré : 2 lignes avant DROP.
    expect(MIGRATION).toContain('DROP FUNCTION IF EXISTS public.encheck_pause_fermer(uuid, timestamptz);')
    const iDrop = MIGRATION.indexOf('DROP FUNCTION IF EXISTS public.encheck_pause_fermer')
    const iCreate = MIGRATION.indexOf('CREATE OR REPLACE FUNCTION public.encheck_pause_fermer')
    expect(iCreate).toBeGreaterThan(-1)
    //  La création vient d'abord, le DROP après — sinon on crée la fonction
    //  puis on supprime... une signature différente, ce qui marche, mais
    //  l'ordre inverse serait un piège à la relecture.
    expect(iDrop).toBeGreaterThan(iCreate)
  })

  it('un motif inconnu ne bloque pas la fermeture', () => {
    //  L'employé est en train de pointer : sa reprise doit être notée même
    //  si l'app tierce envoie un motif absurde.
    expect(MIGRATION).toContain("ELSE 'reprise' END")
    expect(MIGRATION).toContain("lower(btrim(COALESCE(p_motif, '')))")
  })

  it('garde le jugement protégé : il ne bloque pas la reprise', () => {
    const fn = MIGRATION.slice(MIGRATION.indexOf('CREATE OR REPLACE FUNCTION public.encheck_pause_fermer'))
    const iUpdate = fn.indexOf('UPDATE public.encheck_pauses')
    const iJuger = fn.indexOf('encheck_pause_juger(v_id)')
    expect(iJuger).toBeGreaterThan(iUpdate)
    expect(fn.slice(iJuger, iJuger + 400)).toContain('EXCEPTION WHEN OTHERS')
  })

  it('rend le motif dans sa réponse, pour que l’app puisse le confirmer', () => {
    expect(MIGRATION).toContain("'motif_fermeture', v_motif")
  })

  it('repose les droits après le DROP', () => {
    //  Un DROP sans GRANT = fonction sans droits = pointage cassé en silence.
    const apresDrop = MIGRATION.slice(MIGRATION.indexOf('DROP FUNCTION IF EXISTS public.encheck_pause_fermer'))
    expect(apresDrop).toContain('GRANT EXECUTE ON FUNCTION public.encheck_pause_fermer(uuid, timestamptz, text)')
    expect(apresDrop).toContain('TO anon, authenticated, service_role')
  })
})
