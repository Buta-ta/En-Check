// ═══════════════════════════════════════════════════════════════════════════
// 🔒 LA FUITE NOMS + MATRICULES EST FERMÉE
//
// Ce que ce test protège n'est pas une ligne de SQL : c'est une décision.
// `encheck_pauses_en_cours` renvoyait prénom, nom et matricule à `anon` —
// la clé publique. La fermer était l'objectif affiché depuis le début du lot.
// Si elle se rouvre un jour, ce test doit le dire.
//
// LA LEÇON QUE J'AI APPRISE EN L'ÉCRIVANT
// ────────────────────────────────────────────────────────────────────────────
// J'ai longtemps écrit « ces fonctions renvoient des identités parce qu'elles
// sont ouvertes à anon ». C'est faux. En `SECURITY DEFINER`, la fonction
// s'exécute avec les droits de son propriétaire : **l'ACL ne dit pas ce
// qu'elle peut lire, elle dit qui peut l'appeler**.
//
// Ma propre `encheck_pauses_bandeau` est exécutable par `anon`. Elle ne fuit
// pas parce que son corps est écrit pour ne pas fuir. Le vrai correctif est
// là — la révocation ferme un chemin, pas une faille.
// ═══════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const MIGRATION = readFileSync(
  'supabase/migrations/20261129000001_revocation_pauses_anon.sql', 'utf8')

describe('🔒 Les trois anciennes fonctions sont fermées', () => {
  it.each([
    'encheck_pauses_en_cours',
    'encheck_pause_ouvrir',
    'encheck_pause_fermer',
  ])('%s est révoquée de anon', (nom) => {
    expect(MIGRATION).toMatch(
      new RegExp(`REVOKE ALL ON FUNCTION public\\.${nom}\\([^)]*\\)\\s+FROM anon`))
  })

  it('la révocation est vérifiée, pas seulement écrite', () => {
    expect(MIGRATION).toContain('révocation incomplète')
  })
})

describe('📱 Ce que la tablette utilise encore reste ouvert', () => {
  it('le bandeau reste accessible à anon', () => {
    //  Vérifié dans leur code : la tablette appelle `encheck_pauses_bandeau`
    //  EN PREMIER et s'arrête là. Ce n'est pas un repli, c'est le chemin.
    //  Le fermer viderait le bandeau de toutes les tablettes.
    expect(MIGRATION).toContain("p.proname = 'encheck_pauses_bandeau'")
    expect(MIGRATION).toContain("n''est plus accessible à anon")
  })

  it('la révocation ne touche pas les variantes par jeton', () => {
    //  `encheck_ma_pause_ouvrir(p_jeton, …)` est le chemin sûr : c'est LUI
    //  qui doit rester ouvert, puisque la tablette n'a pas de session.
    expect(MIGRATION).not.toMatch(/REVOKE[^;]*encheck_ma_pause_ouvrir/)
    expect(MIGRATION).not.toMatch(/REVOKE[^;]*encheck_ma_pause_fermer/)
  })
})

describe('📝 La migration dit ce qu’elle ne règle pas', () => {
  it('nomme la conséquence pour une tablette sans jeton', () => {
    //  Une migration qui ne dit que ce qu'elle réussit laisse croire qu'elle
    //  a tout réglé. Ici, un cas dégradé subsiste et il est écrit.
    expect(MIGRATION).toContain('vidage de cache')
    expect(MIGRATION).toContain('le geste reste en file')
  })

  it('corrige explicitement mon ancien diagnostic sur SECURITY DEFINER', () => {
    //  Cette phrase-là est la vraie leçon : sans elle, le prochain lecteur
    //  refera le même raisonnement et cherchera la sécurité au mauvais endroit.
    //  Le texte est renvoyé à la ligne dans la migration : on compare un
    //  flux continu, sinon le test sanctionne la mise en forme.
    const plat = MIGRATION.replace(/\s+/g, ' ')
    expect(plat).toContain('SECURITY DEFINER` s\'exécute avec les droits')
    expect(plat).toContain("L'ACL ne décide pas de ce que la fonction a le droit")
  })
})
