// ═══════════════════════════════════════════════════════════════════════════
// 🧪 TESTS — UNE DÉCISION NE S’EXERCICE QUE SUR UNE LIGNE CONSIGNÉE
// ═══════════════════════════════════════════════════════════════════════════
//  CE QUI S’EST PASSÉ, APRÈS LE 404 DU MÊME MATIN
//    08:36 — clic « Valider » → 404 : le JS envoyait le paramètre `p_action`,
//            la base déclare `p_decision` (corrigé dans la PR #9, gardé par
//            `cablageRpc.test.js`).
//    08:54 — clic « Valider » → 400 :
//              invalid input syntax for type uuid: "virtual-out-e24bb1d9-222e-4ef6-90d3-71f9676f68ea"
//            le nom du paramètre était bon, la VALEUR ne pouvait pas l’être :
//            `encheck_estimation_statuer(p_ids uuid[], …)` attend une clé
//            primaire de `attendances`, et l’appli avait sous la main une sortie
//            que le moteur d’AFFICHAGE venait d’inventer à la lecture
//            (`hoursCalculator.js` : `id: 'virtual-out-' + id_de_l_entree`).
//
//  LES DEUX RÉPARATIONS QUI NE SE VALENT PAS
//    · fabriquer un faux uuid, ou un `uuid_v5` de complaisance, pour que le
//      bouton « marche » : LA PROTECTION EST LA PREUVE — l’agrégat ne doit pas
//      exister s’il n’est pas en base. Cette voie est fermée par ces tests.
//    · ne plus proposer la décision tant qu’il n’y a rien à statuer, et le DIRE :
//      c’est ce que verrouille ce fichier.
//
//  POURQUOI ON NE TOUCHE PAS À `estEstimationNonValidee`
//    Cette fonction gouverne la PAIE (`filtrerPointagesPayables`) : une sortie
//    inventée doit rester NON PAYABLE, qu’elle soit en base ou non. Assouplir ce
//    prédicat pour faire taire le 400 aurait transformé une erreur d’affichage
//    en paiement d’une heure que personne n’a pointée. Le bandeau a donc son
//    propre prédicat, `estLigneConsigneeEnBase` — et le cas 8 ci-dessous écrit
//    cette séparation pour qu’on ne la « simplifie » jamais dans l’autre sens.
//
//  Aucun appel réseau : `../../lib/supabase` est mocké, comme dans le reste de la suite.

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn() },
  supabaseEmployee: { from: vi.fn() },
  default: { from: vi.fn() },
}))

import {
  estIdentifiantDeBase,
  estLigneConsigneeEnBase,
  formatConfianceEstimation,
  estEstimationNonValidee,
  filtrerPointagesPayables,
} from '../seuilsPointage'

// Un uuid VRAI, relevé dans le message d’erreur du 16/10 : c’est l’id du badge
// d’ENTRÉE que la sortie inventée a collé derrière son préfixe.
const UUID_ENTREE = 'e24bb1d9-222e-4ef6-90d3-71f9676f68ea'
const UUID_SORTIE = '7c1f0a42-9d3b-4e77-8a15-0b6c2d4e9113'
const ID_INVENTE = `virtual-out-${UUID_ENTREE}`

const sortieInventee = {
  id: ID_INVENTE,
  check_type: 'out',
  check_time: '2026-10-16T00:41:00.000Z',
  is_auto_closed: true,
  __virtual: true,
}

const sortieConsignee = {
  id: UUID_SORTIE,
  check_type: 'out',
  check_time: '2026-10-16T00:41:00.000Z',
  is_auto_closed: true,
  estimation_validee_le: null,
  estimation_remplacee_le: null,
}

const entreeReelle = {
  id: UUID_ENTREE,
  check_type: 'in',
  check_time: '2026-10-15T21:55:00.000Z',
  is_auto_closed: false,
}

describe('« identifiant de base » refuse toute facture JS', () => {
  it('accepte un uuid de clé primaire', () => {
    expect(estIdentifiantDeBase(UUID_SORTIE)).toBe(true)
    // Majuscules : Postgres les normalise, le type `uuid` aussi.
    expect(estIdentifiantDeBase(UUID_SORTIE.toUpperCase())).toBe(true)
  })

  it('refuse l’id inventé par le moteur d’affichage', () => {
    expect(estIdentifiantDeBase(ID_INVENTE)).toBe(false)
  })

  it('refuse l’uuid sans préfixe mais tronqué, mal délimité ou non textuel', () => {
    expect(estIdentifiantDeBase('7c1f0a42-9d3b-4e77-8a15')).toBe(false)
    expect(estIdentifiantDeBase(`${UUID_SORTIE }extra`)).toBe(false)
    expect(estIdentifiantDeBase(null)).toBe(false)
    expect(estIdentifiantDeBase(undefined)).toBe(false)
    expect(estIdentifiantDeBase(42)).toBe(false)
    expect(estIdentifiantDeBase(UUID_SORTIE.split('-'))).toBe(false)
  })
})

describe('ligne consignée vs ligne inventée', () => {
  it('une sortie marquée __virtual n’est pas une cible de décision', () => {
    expect(estLigneConsigneeEnBase(sortieInventee)).toBe(false)
  })

  it('une ligne auto_close réellement en base l’est', () => {
    expect(estLigneConsigneeEnBase(sortieConsignee)).toBe(true)
    // Un badge normal (jamais estimé) a aussi un id de base : c’est la base qui
    // décide, pas l’habillage — le `WHERE is_auto_closed` de la fonction SQL garde la main.
    expect(estLigneConsigneeEnBase(entreeReelle)).toBe(true)
  })

  it('la forme de l’id fait garde-fou même si la marque __virtual manque', () => {
    // Cas réel : un objet fabriqué demain dans un autre fichier, sans le drapeau.
    expect(estLigneConsigneeEnBase({ id: ID_INVENTE, is_auto_closed: true })).toBe(false)
    expect(estLigneConsigneeEnBase(null)).toBe(false)
    expect(estLigneConsigneeEnBase(undefined)).toBe(false)
  })
})

describe('séparation des préoccupations — verrou, pas bénédiction', () => {
  it('une sortie inventée reste NON PAYABLE : on n’a pas touché au prédicat de paie', () => {
    expect(estEstimationNonValidee(sortieInventee)).toBe(true)
    expect(filtrerPointagesPayables([entreeReelle, sortieInventee]).map((a) => a.id))
      .toEqual([UUID_ENTREE])
  })

  it('une estimation consignée et validée redevient payable', () => {
    const validee = { ...sortieConsignee, estimation_validee_le: '2026-10-16T09:00:00.000Z' }
    expect(estEstimationNonValidee(validee)).toBe(false)
    expect(filtrerPointagesPayables([entreeReelle, validee]).map((a) => a.id).sort())
      .toEqual([UUID_ENTREE, UUID_SORTIE].sort())
  })

  it('les deux prédicats ne sont pas la même question', () => {
    // « non validée » ≠ « consignée en base » : la ligne inventée à l'écran est
    // non validée et pas (encore) en base ; la ligne validée est consignée par
    // id. (Depuis le 16/10 soir, même la ligne à l'écran est STATUABLE via
    // `encheck_estimation_decider` — ces prédicats parlent de STOCKAGE, pas de
    // boutons.) Écrire les deux assertions ensemble empêche de les confondre.
    expect(estEstimationNonValidee(sortieConsignee)).toBe(true)
    expect(estLigneConsigneeEnBase(sortieConsignee)).toBe(true)
    expect(estEstimationNonValidee(null)).toBe(false)
    expect(estLigneConsigneeEnBase(null)).toBe(false)
  })
})

describe('marquage de toute sortie inventée — lecture des sources', () => {
  const calcSrc = readFileSync(new URL('../hoursCalculator.js', import.meta.url), 'utf8')

  it('tout objet `virtual-out-` porte la marque __virtual: true', () => {
    const marques = [...calcSrc.matchAll(/id: `virtual-out-\$\{/g)]
    // Le jour où le fichier bouge, ce test doit rougir de lui-même plutôt que
    // de passer vert sur un échantillon vide.
    expect(marques.length).toBeGreaterThan(0)
    for (const m of marques) {
      const apres = calcSrc.slice(m.index, m.index + 900)
      expect(apres).toContain('__virtual: true')
    }
  })

  it('les deux boutons du bandeau STATUENT TOUJOURS (base ET écran) — règle du 16/10 soir', () => {
    //  Décision du commanditaire : « je voudrais que les sorties présumées
    //  soient toujours statuer ». L'ancien garde-fou `estLigneConsigneeEnBase`
    //  (« sortie estimée à l'écran · rien à statuer ») a été RETIRÉ : les
    //  boutons appellent `encheck_estimation_decider`, qui consigne la décision
    //  même en mode ombre.
    const pageSrc = readFileSync(
      new URL('../../pages/Pointages.jsx', import.meta.url),
      'utf8',
    )
    expect(pageSrc).not.toContain('estLigneConsigneeEnBase(p.lastOut)')
    expect(pageSrc).not.toContain('rien à statuer')
    const appels = [...pageSrc.matchAll(/statuerEstimation\(p\.lastOut,/g)]
    expect(appels.length).toBe(3) // Valider + Écarter + Ajuster, un seul bandeau (arbitrage contextuel) dans l’app
  })
})

describe('la confiance d’une estimation est un mot, pas un pourcentage', () => {
  it('rend le mot tel que la base l’écrit (colonne text, migration l.1006)', () => {
    expect(formatConfianceEstimation('faible')).toBe('faible')
    expect(formatConfianceEstimation('élevée')).toBe('élevée')
    expect(formatConfianceEstimation('pas un nombre')).toBe('pas un nombre')
  })

  it('accepte un ratio 0…1 et un pourcentage déjà échelonné', () => {
    expect(formatConfianceEstimation(0.85)).toBe('85 %')
    expect(formatConfianceEstimation('0.85')).toBe('85 %')
    expect(formatConfianceEstimation(72)).toBe('72 %')
  })

  it('un nombre hors échelle retombe sur sa forme textuelle, jamais sur NaN', () => {
    expect(formatConfianceEstimation(150)).toBe('150')
    expect(formatConfianceEstimation(-3)).toBe('-3')
    expect(formatConfianceEstimation(Number.NaN)).toBe(null)
    expect(formatConfianceEstimation(Number.POSITIVE_INFINITY)).toBe(null)
    expect(formatConfianceEstimation('NaN')).toBe('NaN') // texte tel quel : assumé, mais ce n'est pas à nous d'inventer
  })

  it('rend null pour l’absence, ce qui éteigne le fragment d’étiquette', () => {
    expect(formatConfianceEstimation(null)).toBe(null)
    expect(formatConfianceEstimation(undefined)).toBe(null)
    expect(formatConfianceEstimation('')).toBe(null)
  })
})
