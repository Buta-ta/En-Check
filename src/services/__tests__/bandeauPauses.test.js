// ═══════════════════════════════════════════════════════════════════════════
// 🖥️ LE BANDEAU DE LA BORNE — visible de tous, donc sans identités
//
// `encheck_pauses_en_cours` expose prénom, nom ET matricule, et elle est
// exécutable par `anon` (la clé publique, donc Internet). Le matricule est
// l'identifiant de connexion (`encheck_employee_login(p_matricule, p_pin)`) :
// le publier revient à diffuser la moitié d'une paire d'authentification.
//
// La variante `encheck_pauses_bandeau` est jugée ici sur un seul critère :
// ce qu'elle NE renvoie pas.
// ═══════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const MIGRATION = readFileSync(
  'supabase/migrations/20261125000001_ma_pause_ouvrir_et_bandeau.sql', 'utf8')

//  Corps de la fonction bandeau, commentaires SQL retirés.
function corpsBandeau() {
  const i = MIGRATION.indexOf('CREATE OR REPLACE FUNCTION public.encheck_pauses_bandeau')
  const j = MIGRATION.indexOf('$$;', MIGRATION.indexOf('AS $$', i))
  return MIGRATION.slice(MIGRATION.indexOf('AS $$', i), j).replace(/--[^\n]*/g, '')
}

describe('🖥️ Bandeau — ce qu’il ne doit jamais renvoyer', () => {
  it('ne renvoie ni identifiant, ni matricule', () => {
    const code = corpsBandeau()
    //  La jointure LIT `e.id = p.employee_id` — c'est normal et nécessaire.
    //  Ce qui compte est la liste SELECT : ce qui sort de la fonction.
    const liste = code.slice(code.indexOf('SELECT'), code.indexOf('FROM public.encheck_pauses'))
    expect(liste).not.toContain('employee_id')
    expect(liste).not.toContain('e.id')
    expect(liste).not.toContain('matricule')
  })

  it('renvoie un prénom et une initiale, jamais le nom complet', () => {
    const code = corpsBandeau()
    expect(code).toContain('e.first_name')
    expect(code).toContain('left(btrim(e.last_name), 1)')
    //  Une colonne `nom` ou `last_name` en sortie livrerait le nom complet.
    const sortie = MIGRATION.slice(
      MIGRATION.indexOf('RETURNS TABLE ('),
      MIGRATION.indexOf(')', MIGRATION.indexOf('RETURNS TABLE ('))
    )
    expect(sortie).not.toContain('last_name')
    expect(sortie).not.toContain('nom ')
  })

  it('ne montre que les pauses réellement en cours', () => {
    const code = corpsBandeau()
    expect(code).toContain('p.fin IS NULL')
    //  `ecartee` est une pause annulée par un administrateur : elle ne doit
    //  pas réapparaître sur un écran public.
    expect(code).toContain("p.statut IN ('reelle', 'presumee')")
    expect(code).not.toContain('ecartee')
  })
})

describe('🔐 Ouverture par jeton — même modèle que la fermeture', () => {
  it('déduit l’employé du jeton, ne le prend pas en paramètre', () => {
    //  La signature est sur plusieurs lignes : on la lit entière.
    const sig = MIGRATION.slice(
      MIGRATION.indexOf('FUNCTION public.encheck_ma_pause_ouvrir('),
      MIGRATION.indexOf('RETURNS jsonb')
    )
    expect(sig).toContain('p_jeton')
    expect(sig).not.toContain('p_employee')
    expect(MIGRATION).toContain("ERRCODE = '42501'")
  })

  it('délègue au lieu de dupliquer les règles d’ouverture', () => {
    //  Idempotence, fermeture des pauses de la veille, refus du futur :
    //  trois règles déjà écrites dans `encheck_pause_ouvrir`. Les recopier
    //  créerait deux vérités qui divergeraient à la première correction.
    expect(MIGRATION).toContain('RETURN public.encheck_pause_ouvrir(v_emp, p_debut, p_motif)')
  })
})

describe('📄 La séquence de bascule doit couvrir les DEUX sens', () => {
  it('ne demande plus de révoquer une fonction sans remplacement', () => {
    //  Défaut trouvé par l'App Pointage : le document révoquait
    //  `encheck_pause_ouvrir` alors qu'aucune variante par jeton n'existait.
    //  « Je pars en pause » serait tombé.
    const doc = readFileSync('docs/SECURITE-ECRITURES-ANONYMES.md', 'utf8')
    const aRevoquer = doc.slice(doc.indexOf('REVOKE EXECUTE'))
    if (aRevoquer.includes('encheck_pause_ouvrir')) {
      expect(doc).toContain('encheck_ma_pause_ouvrir')
    }
    //  Et la révocation du bandeau est isolée derrière un point d'arrêt.
    expect(doc).toContain("POINT D'ARRÊT")
  })
})
