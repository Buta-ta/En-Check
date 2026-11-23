// ═══════════════════════════════════════════════════════════════════════════
// 🔒 LES GARDES D'ÉCRITURE DES PAUSES
//
// Ces tests ne vérifient pas qu'une fonction « a l'air correcte ». Ils
// vérifient une propriété précise, et une seule : **aucune fonction
// d'écriture sur les pauses ne peut être exécutée sans session.**
//
// POURQUOI CE TEST EXISTE
// ────────────────────────────────────────────────────────────────────────────
// La garde d'origine était :
//
//     IF NULLIF(coalesce(auth.jwt() ->> 'email', ''), '') IS NOT NULL
//        AND NOT public.encheck_est_admin_de(v_ent) THEN RAISE …
//
// Elle est raisonnable à la lecture et fausse à l'exécution : sans JWT,
// l'email est NULL, `NULL AND FALSE` vaut NULL, et un `IF` ne s'exécute
// jamais sur NULL. La garde s'ouvrait dans le seul cas qu'elle devait fermer.
//
// C'était une erreur de raisonnement, pas une faute de frappe. Une faute de
// frappe se voit en relisant ; une erreur de raisonnement se reproduit à
// l'identique des mois plus tard. D'où ce test : il nomme la forme fautive.
// ═══════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const MIGRATION = readFileSync(
  'supabase/migrations/20261127000001_gardes_ecriture_pauses.sql', 'utf8')

const FONCTIONS = [
  'encheck_pause_creer',
  'encheck_pauses_statuer',
  'encheck_pauses_supprimer',
  'encheck_pauses_annuler_decision',
  'encheck_pauses_restaurer',
]

/** Le corps de chaque fonction, dans le fichier de migration.
 *  Les espaces sont normalisés : on teste ce que dit la migration, pas la
 *  façon dont elle est alignée. */
function corpsDe (nom) {
  const debut = MIGRATION.indexOf(`FUNCTION public.${nom}(`)
  expect(debut, `fonction absente de la migration : ${nom}`).toBeGreaterThan(-1)
  const suite = MIGRATION.indexOf('CREATE OR REPLACE FUNCTION', debut + 1)
  const brut = MIGRATION.slice(debut, suite === -1 ? MIGRATION.length : suite)
  return brut.replace(/[ \t]+/g, ' ')
}

describe('🔒 Aucune écriture ne passe sans session', () => {
  it.each(FONCTIONS)('%s refuse explicitement l’absence d’identité', (nom) => {
    const corps = corpsDe(nom)
    expect(corps).toContain('auth.uid() IS NULL')
    expect(corps).toContain("ERRCODE = '42501'")
  })

  it.each(FONCTIONS)('%s n’a plus la garde qui échoue ouverte', (nom) => {
    //  C'est LA forme qui a laissé passer `anon`. Elle ne doit revenir
    //  sous aucune forme, y compris recopiée depuis un ancien fichier.
    const corps = corpsDe(nom)
    const fautive = /IF NULLIF\(coalesce\(auth\.jwt\(\) ->> 'email', ''\), ''\) IS NOT NULL\s*\n\s*AND NOT public\.encheck_est_admin_de/
    expect(fautive.test(corps)).toBe(false)
  })

  it.each(FONCTIONS)('%s vérifie les droits APRÈS avoir exigé une identité', (nom) => {
    //  L'ordre compte : vérifier les droits d'abord laisse passer le cas
    //  « pas d'identité ». On exige l'identité d'abord, les droits ensuite.
    const corps = corpsDe(nom)
    const posGarde = corps.indexOf('auth.uid() IS NULL')
    const posDroits = corps.indexOf('encheck_est_admin_de')
    expect(posGarde).toBeGreaterThan(-1)
    expect(posDroits).toBeGreaterThan(posGarde)
  })
})

describe('🔒 Ce que la correction ne doit pas casser', () => {
  it.each(FONCTIONS)('%s garde son search_path verrouillé', (nom) => {
    //  `SET search_path` protège contre un schéma malveillant placé avant
    //  `public`. Remplacer une fonction sans le reporter le retirerait
    //  silencieusement : on ferme une porte et on en ouvre une autre.
    expect(corpsDe(nom)).toContain("SET search_path TO 'public', 'pg_temp'")
  })

  it('les signatures d’origine sont conservées, valeurs par défaut comprises', () => {
    //  `CREATE OR REPLACE` refuse de retirer une valeur par défaut (42P13).
    //  Une signature amputée ferait échouer l'appel qui omet le motif.
    expect(corpsDe('encheck_pause_creer')).toContain('p_motif text DEFAULT NULL::text')
    expect(corpsDe('encheck_pauses_statuer')).toContain('p_motif text DEFAULT NULL::text')
    expect(corpsDe('encheck_pauses_supprimer')).toContain('p_motif text DEFAULT NULL::text')
    expect(corpsDe('encheck_pauses_annuler_decision')).toContain('p_motif text DEFAULT NULL::text')
  })

  it('la migration vérifie elle-même son résultat', () => {
    //  Une migration qui ne se contrôle pas peut « réussir » sans rien faire.
    //  C'est déjà arrivé ici : une migration appliquée sans son bloc de
    //  vérification avait laissé `anon` en place.
    expect(MIGRATION).toContain('DO $$')
    expect(MIGRATION).toContain('migration inapplicable')
  })
})
