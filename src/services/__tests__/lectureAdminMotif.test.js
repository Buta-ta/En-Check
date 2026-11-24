// ═══════════════════════════════════════════════════════════════════════════
// 🧾 LECTURE ADMIN DES PAUSES — le motif, et surtout ce qu'on ne rouvre pas
//
// Ce fichier existe à cause d'une erreur réelle du 26/11 : la première
// version appliquée en production redonnait EXECUTE à `anon` sur
// `encheck_pauses_lire`. Un `GRANT ... TO authenticated` ne retire pas un
// droit existant. `anon`, c'est la clé publique embarquée dans le bundle :
// cette fonction aurait exposé les pauses de toute l'entreprise.
//
// Ces tests lisent le SQL de la migration. Ils ne remplacent pas une mesure
// en base, ils empêchent la régression de revenir par inadvertance.
// ═══════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SQL = readFileSync(
  'supabase/migrations/20261126000001_motif_fermeture_lecture_admin.sql', 'utf8')

describe('🧾 Lecture admin — la colonne, sans élargir les droits', () => {
  it('révoque `anon` explicitement, pas seulement PUBLIC', () => {
    //  La leçon du 26/11 : `REVOKE ... FROM PUBLIC` seul ne suffit pas si le
    //  rôle a un GRANT nominatif. `anon` en avait un.
    const revoke = SQL.match(/REVOKE ALL ON FUNCTION public\.encheck_pauses_lire[^;]*;/i)
    expect(revoke).not.toBeNull()
    expect(revoke[0]).toContain('anon')
    expect(revoke[0]).toContain('PUBLIC')
  })

  it('ne donne jamais EXECUTE à `anon` sur la lecture admin', () => {
    const grants = SQL.match(/GRANT EXECUTE ON FUNCTION public\.encheck_pauses_lire[^;]*;/gi) || []
    expect(grants.length).toBeGreaterThan(0)
    for (const g of grants) expect(g).not.toContain('anon')
  })

  it('refuse une requête sans identité', () => {
    //  L'ancienne garde ne s'appliquait que si `auth.jwt()` contenait un
    //  e-mail. Sans JWT, elle ne filtrait RIEN et renvoyait tout.
    expect(SQL).toContain("IF NOT v_est_adm THEN")
    expect(SQL).toContain("ERRCODE = '42501'")
    expect(SQL).toContain('a.user_id = v_uid')
  })

  it('ajoute le motif en DERNIÈRE colonne', () => {
    //  Un des 7 écrans consommateurs lit par nom, mais l'ordre de déclaration
    //  reste le contrat public : on ajoute à la fin, on ne réordonne pas.
    const retours = SQL.slice(
      SQL.indexOf('RETURNS TABLE(\n  id              uuid'),
      SQL.indexOf('LANGUAGE plpgsql STABLE SECURITY DEFINER')
    )
    const colonnes = retours.match(/^\s{2}(\w+)\s/gm) || []
    const noms = colonnes.map((c) => c.trim())
    expect(noms[noms.length - 1]).toBe('motif_fermeture')
    expect(noms.slice(0, 17)).toEqual([
      'id', 'employe_id', 'prenom', 'nom', 'matricule', 'enterprise_id',
      'entreprise_nom', 'jour', 'debut', 'fin', 'duree_minutes', 'statut',
      'source', 'motif', 'anomalie', 'prevue_minutes', 'ecart_minutes',
    ])
  })

  it('garde le calcul du dépassement intact', () => {
    //  `prevue_minutes` et `ecart_minutes` sont calculés par appel latéral.
    //  Les perdre au passage aurait cassé l'affichage du badge ⏱️.
    expect(SQL).toContain('public.encheck_pause_depassement(')
    expect(SQL).toContain("d.res ->> 'prevue_minutes'")
    expect(SQL).toContain("d.res ->> 'ecart'")
  })
})

describe('📱 « Mes pauses » web — l’identité vient du JWT', () => {
  it('ne prend aucun identifiant employé en paramètre', () => {
    const sig = SQL.slice(
      SQL.indexOf('FUNCTION public.encheck_pauses_mes_pauses_web('),
      SQL.indexOf('RETURNS TABLE(', SQL.indexOf('FUNCTION public.encheck_pauses_mes_pauses_web('))
    )
    expect(sig).toContain('p_jours integer')
    expect(sig).not.toContain('p_employee')
    expect(sig).not.toContain('p_employe')
    expect(SQL).toContain('e.user_id = v_uid')
  })

  it('refuse une requête anonyme', () => {
    expect(SQL).toContain("IF v_uid IS NULL THEN")
    const revoke = SQL.match(/REVOKE ALL ON FUNCTION public\.encheck_pauses_mes_pauses_web[^;]*;/i)
    expect(revoke[0]).toContain('anon')
  })

  it('ne renvoie que les pauses de l’appelant, dans son entreprise', () => {
    expect(SQL).toContain('p.employee_id = v_emp')
    expect(SQL).toContain('p.enterprise_id = v_ent')
  })

  it('ne reprend pas la fenêtre de 30 jours qui ne montrait rien', () => {
    //  Mesuré : 23 pauses pour un employé, la dernière à J-6 dans une
    //  fenêtre de 30 jours... mais 0 si l'on regarde 30 jours en arrière
    //  d'une date plus tardive. La fenêtre par défaut est d'un an.
    expect(SQL).toContain('COALESCE(p_jours, 365)')
    expect(SQL).not.toMatch(/CURRENT_DATE - 30\b/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🚫 LE MOTIF NE SORT PAS CÔTÉ EMPLOYÉ
//
// Décision du fondateur, 26/11 : « ce n'est pas à l'employé de voir pourquoi
// sa pause s'est fermée mais à l'admin de l'entreprise ».
//
// J'avais livré une version qui l'exposait dans `encheck_pauses_mes_pauses_web`
// — alors que l'App Pointage avait écrit « décision partagée, pas maintenant ».
// Ce test existe pour que l'oubli ne revienne pas.
// ═══════════════════════════════════════════════════════════════════════════
describe('🚫 Le motif de fermeture est une information d’administration', () => {
  it('n’est pas renvoyé par la vue employé web', () => {
    const fn = SQL.slice(SQL.indexOf('FUNCTION public.encheck_pauses_mes_pauses_web'))
    const retour = fn.slice(fn.indexOf('RETURNS TABLE('), fn.indexOf('LANGUAGE plpgsql'))
    expect(retour).not.toContain('motif_fermeture')
    const corps = fn.slice(fn.indexOf('RETURN QUERY'), fn.indexOf('END;'))
    expect(corps).not.toContain('motif_fermeture')
  })

  it('n’est pas renvoyé par la vue employé tablette', () => {
    //  La migration ne reconstruit pas cette fonction : on vérifie le fichier
    //  d'origine qui la définit, et l'on s'assure qu'aucune migration
    //  ultérieure ne l'a élargie.
    const tablette = readFileSync(
      'supabase/migrations/20261123000001_contrat_serveur_app_pointage.sql', 'utf8')
    const fn = tablette.slice(tablette.indexOf('FUNCTION public.encheck_pauses_mes_pauses('))
    const retour = fn.slice(fn.indexOf('RETURNS TABLE('), fn.indexOf('LANGUAGE plpgsql'))
    expect(retour).not.toContain('motif_fermeture')
  })

  it('n’est visible que par la lecture admin', () => {
    //  Un seul point de sortie. S'il en apparaît un second, c'est une fuite.
    const occurrences = SQL.match(/^\s+motif_fermeture text/gm) || []
    expect(occurrences.length).toBe(1)
  })
})
