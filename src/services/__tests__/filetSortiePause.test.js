// ═══════════════════════════════════════════════════════════════════════════
// 🪢 LE FILET « UNE SORTIE FERME LA PAUSE »
//
// Écrit par le lot App Pointage, appliqué en production le 23/11. Ces tests
// ne vérifient pas un fichier : ils vérifient que la migration qui est
// censée DÉCRIRE l'état de la base ne s'en écarte pas.
//
// POURQUOI CE FILET EXISTE
// ────────────────────────────────────────────────────────────────────────────
// Le 17/11 : pause ouverte 15:42, sortie pointée 17:20, pause jamais fermée.
// 5,9 jours plus tard, la borne affichait « Hippo B. 141:07 ». Le moteur
// d'alerte avait signalé dès 17:00 — une alerte signale, elle ne corrige pas.
//
// LES TROIS GARDE-FOUS, ET CE QUE CHACUN PROTÈGE
// ────────────────────────────────────────────────────────────────────────────
//   borné      → l'heure vient du pointage, jamais d'une estimation
//   visible    → motif 'sortie' + trace au journal
//   rattrapable→ le manager garde la main, la fermeture n'efface rien
// ═══════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const MIGRATION = readFileSync(
  'supabase/migrations/20261128000001_filet_sortie_ferme_pause.sql', 'utf8')

/** Le corps d'une fonction, espaces normalisés (on teste le sens, pas l'alignement). */
function corpsDe (nom) {
  const debut = MIGRATION.indexOf(`FUNCTION public.${nom}(`)
  expect(debut, `fonction absente : ${nom}`).toBeGreaterThan(-1)
  const suite = MIGRATION.indexOf('CREATE OR REPLACE FUNCTION', debut + 1)
  return MIGRATION.slice(debut, suite === -1 ? MIGRATION.length : suite).replace(/[ \t]+/g, ' ')
}

describe('🪢 Le filet ne peut pas casser un pointage', () => {
  it('toute erreur est rattrapée, jamais propagée', () => {
    //  C'est LE point : un employé qui badge doit badger, même si la
    //  fermeture de pause part de travers. Sans ce bloc, un défaut du filet
    //  deviendrait un défaut du pointage — et la borne refuserait le badge.
    const declencheur = corpsDe('encheck_pause_filet_sortie')
    //  On isole le corps de la fonction : plus bas dans le fichier, le bloc
    //  de vérification lève légitimement des exceptions, et un test trop
    //  large le confondrait avec le déclencheur.
    //  Jusqu'à la fermeture `$$;` de la fonction, pas au-delà : la suite du
    //  fichier contient le bloc de vérification, qui lève légitimement.
    const debutCorps = declencheur.indexOf('AS $$')
    const finCorps = declencheur.indexOf('$$;', debutCorps)
    const corps = declencheur.slice(debutCorps, finCorps)
    expect(corps).toContain('EXCEPTION WHEN OTHERS')
    expect(corps).toContain('RAISE WARNING')
    expect(corps).not.toMatch(/RAISE EXCEPTION/)
  })

  it('la fermeture elle-même est aussi protégée', () => {
    //  Une trace qui échoue ne doit pas annuler la fermeture.
    const capacite = corpsDe('encheck_pause_clore_sortie')
    expect(capacite).toContain('EXCEPTION WHEN OTHERS')
  })
})

describe('🪢 Borné : l’heure vient du pointage', () => {
  it('utilise NEW.check_time, jamais now()', () => {
    //  `now()` serait l'heure de l'insertion : à quelques secondes près elle
    //  ressemble au pointage, mais sur un import rejoué le lendemain elle
    //  inventerait une pause d'un jour. La donnée doit venir de la ligne.
    const declencheur = corpsDe('encheck_pause_filet_sortie')
    expect(declencheur).toContain('NEW.check_time')
    expect(declencheur).not.toContain('now()')
  })

  it('délègue à encheck_pause_fermer — une seule définition de « fermer »', () => {
    //  Recalculer la durée ici créerait une seconde règle de fermeture,
    //  qui divergerait de la première au premier changement de validation.
    expect(corpsDe('encheck_pause_clore_sortie'))
      .toContain("public.encheck_pause_fermer(p_employee, p_instant, 'sortie')")
  })

  it('ne se déclenche que sur une sortie', () => {
    const declencheur = corpsDe('encheck_pause_filet_sortie')
    expect(declencheur).toContain("lower(COALESCE(NEW.check_type, '')) = 'out'")
  })
})

describe('🪢 Visible et rattrapable', () => {
  it('laisse une trace au journal', () => {
    expect(corpsDe('encheck_pause_clore_sortie'))
      .toContain("'pause_fermee_sortie_auto'")
  })

  it('ne supprime rien : elle ferme, elle n’efface pas', () => {
    //  Fermer et effacer ne sont pas la même décision. Une pause effacée
    //  ne peut plus être rouverte par le manager.
    expect(MIGRATION).not.toMatch(/DELETE\s+FROM\s+public\.encheck_pauses/i)
  })
})

describe('🔒 Droits : internes, donc fermés', () => {
  it('ni anon ni authenticated ne peuvent exécuter le filet', () => {
    //  `encheck_pause_clore_sortie` est SECURITY DEFINER : ouverte à `anon`,
    //  elle permet de fermer la pause de n'importe qui sans session.
    //  Leur version la laissait ouverte — vérifié en production le 23/11.
    expect(MIGRATION).toContain('REVOKE ALL ON FUNCTION public.encheck_pause_clore_sortie')
    expect(MIGRATION).toContain('FROM PUBLIC, anon, authenticated')
  })

  it('la migration vérifie elle-même son résultat', () => {
    expect(MIGRATION).toContain('DO $$')
    expect(MIGRATION).toContain("t.tgenabled = 'O'")
    expect(MIGRATION).toContain('restent ouvertes à anon/authenticated')
  })
})
