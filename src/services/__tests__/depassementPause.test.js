// ═══════════════════════════════════════════════════════════════════════════
// ⏱️ DÉPASSEMENT DE PAUSE — la règle, pas le décor
//
// Ce que ces tests défendent, dans l'ordre du risque :
//
//   ① l'égalité vaut tolérance (75 pour 60 + 15 ne signale pas) ;
//   ② une pause plus courte que prévue n'est JAMAIS un dépassement ;
//   ③ sans grille, on ne juge pas — on n'invente pas un créneau de 0 min ;
//   ④ `depassement` et `trop_longue` ne se recouvrent pas ;
//   ⑤ le badge s'écrit sans violer la contrainte CHECK ;
//   ⑥ une pause écartée ou en cours n'est pas rejugée ;
//   ⑦ l'alerte n'est posée qu'une fois ;
//   ⑧ le jugement ne peut pas empêcher une reprise d'être notée.
// ═══════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  ANOMALIES_BADGES,
  badgeAnomalieDetaillee,
  libelleDepassement,
} from '../pausesService'

const MIGRATION = readFileSync(
  'supabase/migrations/20261122000001_depassement_pause_trois_signaux.sql', 'utf8')

// ─────────────────────────────────────────────────────────────────────────────
// 1. La migration dit ce qu'elle fait
// ─────────────────────────────────────────────────────────────────────────────

describe('⏱️ Dépassement — la règle en base', () => {
  it('lit le seuil de l’entreprise, avec 15 en valeur d’usage', () => {
    expect(MIGRATION).toContain("'pause_tolerance_minutes', 15")
    expect(MIGRATION).toContain('public.encheck_seuil(p_enterprise,')
  })

  it('compare au créneau de la grille, jamais à une durée absolue', () => {
    //  La décision du fondateur porte sur l'écart au créneau prévu.
    //  Si un jour quelqu'un remplace `encheck_pause_prevue` par un plafond
    //  fixe, ce test tombe — et c'est exactement ce qu'on veut.
    expect(MIGRATION).toContain('public.encheck_pause_prevue(p_employee, p_enterprise, p_jour)')
    expect(MIGRATION).toContain("'ecart',          v_ecart")
  })

  it('l’égalité est tolérée : `>` et non `>=`', () => {
    //  75 min pour 60 prévues avec une tolérance de 15 : « tolérer 15 min »
    //  veut dire que 15 passent. Un `>=` signalerait une pause parfaitement
    //  dans la règle.
    expect(MIGRATION).toContain("'depasse',        v_ecart > v_tol")
    expect(MIGRATION).not.toContain('v_ecart >= v_tol')
  })

  it('ne juge pas sans grille', () => {
    expect(MIGRATION).toContain("'aucune_grille'")
    expect(MIGRATION).toContain("'creneau_nul'")
    //  Un créneau de 0 min rendrait tout dépassement : on refuse de juger.
    expect(MIGRATION).toContain('IF v_minutes <= 0 THEN')
  })

  it('élargit la contrainte d’anomalie sans perdre les valeurs existantes', () => {
    expect(MIGRATION).toContain('DROP CONSTRAINT IF EXISTS encheck_pauses_anomalie_chk')
    expect(MIGRATION).toContain("'sans_reprise', 'trop_longue', 'depassement'")
    //  Le DROP sans le ADD laisserait la table sans garde-fou.
    expect(MIGRATION).toContain('ADD CONSTRAINT encheck_pauses_anomalie_chk')
  })

  it('ne recouvre jamais `trop_longue` par `depassement`', () => {
    //  Une pause déjà signalée pour durée absolue garde son signal le plus
    //  grave. Deux badges contradictoires sur la même ligne n'aideraient personne.
    expect(MIGRATION).toContain("NOT IN ('trop_longue', 'depassement')")
  })

  it('ne rejuge ni une pause écartée, ni une pause en cours', () => {
    expect(MIGRATION).toContain("'ecartee'")
    expect(MIGRATION).toContain('IF v_p.fin IS NULL THEN')
    expect(MIGRATION).toContain("'en_cours'")
  })

  it('l’alerte est dédupliquée et ne bloque jamais', () => {
    expect(MIGRATION).toContain('v_deja')
    expect(MIGRATION).toContain("'Pause dépassée'")
    //  Une alerte qui échoue ne doit pas empêcher la pause d'exister.
    expect(MIGRATION).toContain('RAISE WARNING')
  })

  it('le jugement ne peut pas empêcher une reprise d’être notée', () => {
    //  L'employé est en train de pointer : sa pause se ferme d'abord,
    //  le jugement vient après, dans son propre bloc protégé.
    const fermeture = MIGRATION.slice(MIGRATION.indexOf('CREATE OR REPLACE FUNCTION public.encheck_pause_fermer'))
    const iUpdate = fermeture.indexOf('UPDATE public.encheck_pauses')
    const iJuger = fermeture.indexOf('encheck_pause_juger(v_id)')
    expect(iUpdate).toBeGreaterThan(-1)
    //  La fermeture se fait AVANT le jugement : la reprise est notée même
    //  si le juge tombe.
    expect(iJuger).toBeGreaterThan(iUpdate)
    //  Et l'appel est dans son propre bloc protégé : `BEGIN` juste avant,
    //  `EXCEPTION WHEN OTHERS` juste après. Un `RAISE` non rattrapé ferait
    //  échouer la reprise d'un employé à cause d'une règle de confort.
    const bloc = fermeture.slice(iJuger, iJuger + 400)
    expect(bloc).toContain('EXCEPTION WHEN OTHERS')
    //  L'appel est précédé d'un `BEGIN` de bloc (le `BEGIN` de la fonction
    //  est bien plus haut, à l'ouverture). On repère le dernier `BEGIN`
    //  avant l'appel et on s'assure qu'aucun `END` ne vient le clore.
    const avantAppel = fermeture.slice(0, iJuger)
    const iBloc = avantAppel.lastIndexOf('BEGIN')
    expect(iBloc).toBeGreaterThan(-1)
    expect(avantAppel.slice(iBloc)).not.toContain('END;')
    expect(bloc.indexOf('EXCEPTION')).toBeLessThan(bloc.indexOf('END;'))
  })

  it('la lecture expose les deux chiffres, et le DROP est suivi de son GRANT', () => {
    expect(MIGRATION).toContain('prevue_minutes integer, ecart_minutes integer')
    const lire = MIGRATION.slice(MIGRATION.indexOf('DROP FUNCTION IF EXISTS public.encheck_pauses_lire'))
    //  DROP sans GRANT = fonction sans droits = écran des pauses vide.
    expect(lire).toContain('GRANT EXECUTE ON FUNCTION public.encheck_pauses_lire')
  })

  it('ne touche pas la tolérance de retard d’arrivée', () => {
    const lignesUtiles = MIGRATION.split('\n').filter((l) => !l.trim().startsWith('--'))
    expect(lignesUtiles.join('\n')).not.toContain('late_tolerance_minutes')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Le badge tel que l'écran l'affiche
// ─────────────────────────────────────────────────────────────────────────────

describe('⏱️ Dépassement — le badge', () => {
  it('a sa propre entrée, distincte de « très longue »', () => {
    expect(ANOMALIES_BADGES.depassement).toBeTruthy()
    expect(ANOMALIES_BADGES.depassement.label).not.toBe(ANOMALIES_BADGES.trop_longue.label)
    expect(ANOMALIES_BADGES.depassement.color).not.toBe(ANOMALIES_BADGES.trop_longue.color)
  })

  it('dit POURQUOI, avec les deux chiffres', () => {
    const p = { anomalie: 'depassement', ecartMinutes: 18, prevueMinutes: 60 }
    const badge = badgeAnomalieDetaillee(p)
    expect(badge.label).toContain('18')
    expect(badge.label).toContain('60')
    expect(badge.raison).toBe('18 min de plus que les 60 min prévues')
  })

  it('reste lisible si les chiffres manquent', () => {
    //  La RPC peut ne pas remonter les chiffres (vieille ligne jamais jugée,
    //  grille modifiée depuis). Le badge ne doit pas afficher « NaN ».
    const badge = badgeAnomalieDetaillee({ anomalie: 'depassement' })
    expect(badge.label).toContain('Dépassement')
    expect(badge.label).not.toContain('NaN')
    expect(badge.label).not.toContain('undefined')
  })

  it('ne se mêle pas aux autres anomalies', () => {
    expect(badgeAnomalieDetaillee({ anomalie: 'sans_reprise' }).label)
      .toBe(ANOMALIES_BADGES.sans_reprise.label)
    expect(badgeAnomalieDetaillee({ anomalie: 'trop_longue' }).label)
      .toBe(ANOMALIES_BADGES.trop_longue.label)
    expect(badgeAnomalieDetaillee({ anomalie: null })).toBeNull()
  })

  it('le libellé d’un écart nul ou négatif ne promet pas un dépassement', () => {
    expect(libelleDepassement({ anomalie: 'depassement', ecartMinutes: 0, prevueMinutes: 60 }))
      .toBe('0 min de plus que les 60 min prévues')
    expect(libelleDepassement({ anomalie: 'sans_reprise' })).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Le câblage : si on débranche, l'écran redevient décoratif
// ─────────────────────────────────────────────────────────────────────────────

describe('⏱️ Dépassement — le câblage tient', () => {
  it('la page Pauses lance le rattrapage', () => {
    const page = readFileSync('src/pages/Pauses.jsx', 'utf8')
    expect(page).toContain('encheck_pauses_juger_lot')
    //  Une seule fois par entreprise, pas dans une boucle de rendu.
    expect(page).toContain('p_jours: 30')
  })

  it('le badge du dépassement ne porte pas le rouge des ruptures', () => {
    const css = readFileSync('src/pages/PointagesAfroTech.css', 'utf8')
    expect(css).toContain('.pauses-v2-status-pill.is-depassement')
    const ecran = readFileSync('src/components/PausesAfroTechSections.jsx', 'utf8')
    expect(ecran).toContain("p.anomalie === 'depassement'")
    expect(ecran).toContain('badgeAnomalieDetaillee')
  })

  it('les deux chiffres remontés par la base sont gardés dans le modèle', () => {
    const service = readFileSync('src/services/pausesService.js', 'utf8')
    expect(service).toContain('prevueMinutes:')
    expect(service).toContain('ecartMinutes:')
    //  `Number.isFinite(Number(null))` vaut true avec 0 : sans le garde-fou,
    //  une pause ordinaire afficherait « 0 min de plus ». On vérifie le
    //  traitement explicite, pas la conversion nue.
    expect(service).toContain('Number.isFinite(Number(l.prevue_minutes))')
  })
})
