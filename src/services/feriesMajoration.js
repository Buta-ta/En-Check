// src/services/feriesMajoration.js
// ═══════════════════════════════════════════════════════════════════════════
// 🎌 MAJORATION DES JOURS FÉRIÉS — résolution pays → entreprise → férié
// ═══════════════════════════════════════════════════════════════════════════
//
// POURQUOI CE FICHIER EXISTE
//   L'écran « Taux jours fériés (%) » enregistrait un taux par entreprise, la
//   fiche de paie l'affichait… et le calcul ne l'appliquait jamais : un jour
//   férié travaillé était payé comme un mardi ordinaire (constat A1 de
//   docs/AUDIT-ALGORITHMES-ET-ANTICIPATION.md).
//
//   Brancher le taux ne suffit pas : En-Check couvre 14 pays, et le taux d'un
//   férié n'est pas une constante, c'est une règle — avec un plancher légal qui
//   dépend du pays.
//
// CE QUE CE FICHIER NE FAIT PAS — ET NE DOIT PAS FAIRE
//   Il ne remplit AUCUNE valeur légale. Un plancher saisi « de mémoire » est
//   plus dangereux qu'un plancher absent : il produit une paie fausse avec
//   l'autorité du produit par-dessus.
//
//   Chaque pays porte donc un `statut` :
//     · 'verifie'                 → valeur sourcée, applicable ;
//     · 'a_sourcer'               → on ne sait pas encore (état honnête) ;
//     · 'aucune_obligation_legale'→ le zéro est CONNU, pas subi.
//   La distinction « 0 parce que la loi ne l'exige pas » / « 0 parce qu'on ne
//   sait pas » est une exigence de la spécification (P6).
//
//   Tant que D5 (source juridique) n'a pas livré, tous les pays sont
//   'a_sourcer' : le moteur applique alors le taux de l'entreprise, ou le
//   contrat produit (100 %) AVEC un avertissement explicite — jamais un zéro
//   silencieux.
//
// SPÉCIFICATION : docs/SPEC-FERIES-MAJORATION-MULTIPAYS.md
// ═══════════════════════════════════════════════════════════════════════════

/** États possibles d'un plancher national. */
export const STATUTS_PLANCHER = Object.freeze({
  VERIFIE: 'verifie',
  A_SOURCER: 'a_sourcer',
  AUCUNE_OBLIGATION: 'aucune_obligation_legale',
})

/**
 * Contrat produit, PAS une règle légale.
 * Utilisé seulement quand ni l'entreprise ni le pays ne donnent de valeur —
 * et toujours accompagné d'un avertissement.
 */
export const TAUX_FERIE_PAR_DEFAUT = 100

/**
 * Planchers légaux par pays.
 *
 * ⚠️ Aucune valeur n'est remplie : c'est volontaire (D5). Le jour où une
 * source est disponible, on renseigne `taux`, `source`, `verifie_le` et on
 * passe `statut` à 'verifie'. Aucun autre code n'est à modifier.
 */
export const PLANCHERS_FERIES = Object.freeze({
  BJ: { statut: STATUTS_PLANCHER.A_SOURCER, taux: null, source: null, verifie_le: null, zone: null },
  SN: { statut: STATUTS_PLANCHER.A_SOURCER, taux: null, source: null, verifie_le: null, zone: null },
  CI: { statut: STATUTS_PLANCHER.A_SOURCER, taux: null, source: null, verifie_le: null, zone: null },
  ML: { statut: STATUTS_PLANCHER.A_SOURCER, taux: null, source: null, verifie_le: null, zone: null },
  BF: { statut: STATUTS_PLANCHER.A_SOURCER, taux: null, source: null, verifie_le: null, zone: null },
  NE: { statut: STATUTS_PLANCHER.A_SOURCER, taux: null, source: null, verifie_le: null, zone: null },
  CM: { statut: STATUTS_PLANCHER.A_SOURCER, taux: null, source: null, verifie_le: null, zone: null },
  MG: { statut: STATUTS_PLANCHER.A_SOURCER, taux: null, source: null, verifie_le: null, zone: null },
  MA: { statut: STATUTS_PLANCHER.A_SOURCER, taux: null, source: null, verifie_le: null, zone: null },
  TN: { statut: STATUTS_PLANCHER.A_SOURCER, taux: null, source: null, verifie_le: null, zone: null },
  DZ: { statut: STATUTS_PLANCHER.A_SOURCER, taux: null, source: null, verifie_le: null, zone: null },
  FR: { statut: STATUTS_PLANCHER.A_SOURCER, taux: null, source: null, verifie_le: null, zone: null },
  BE: { statut: STATUTS_PLANCHER.A_SOURCER, taux: null, source: null, verifie_le: null, zone: null },
  // La Suisse n'a pas de plancher fédéral unique : le canton est obligatoire.
  CH: { statut: STATUTS_PLANCHER.A_SOURCER, taux: null, source: null, verifie_le: null, zone: 'canton' },
  OTHER: { statut: STATUTS_PLANCHER.A_SOURCER, taux: null, source: null, verifie_le: null, zone: null },
})

/** Pays dont le plancher ne peut pas être résolu sans une zone infranationale. */
export const PAYS_EXIGEANT_ZONE = Object.freeze(['CH'])

/**
 * ISO 3 → ISO 2, pour les 14 pays du catalogue + les voisins fréquents.
 *
 * POURQUOI : `holidayService` raisonne en ISO 2 (`BJ`, `FR`) et
 * `currencyService` indexe en ISO 3 (`BEN`, `FRA`). Un plancher construit sur
 * le mauvais code ne s'applique jamais — et ne le dit pas. Une seule
 * normalisation, utilisée partout.
 */
const ISO3_VERS_ISO2 = Object.freeze({
  BEN: 'BJ', SEN: 'SN', CIV: 'CI', MLI: 'ML', BFA: 'BF', NER: 'NE',
  TGO: 'TG', GIN: 'GN', GNB: 'GW',
  CMR: 'CM', CAF: 'CF', TCD: 'TD', COG: 'CG', GAB: 'GA', GNQ: 'GQ',
  MDG: 'MG', MAR: 'MA', TUN: 'TN', DZA: 'DZ', MRT: 'MR', COD: 'CD',
  FRA: 'FR', BEL: 'BE', CHE: 'CH', CAN: 'CA', USA: 'US',
})

/** Codes ISO 2 connus du catalogue (pays + « autre »). */
const ISO2_CONNUS = new Set(Object.keys(PLANCHERS_FERIES))

/**
 * Normalise un code pays en ISO 2 majuscule.
 * Accepte ISO 2 (`bj`), ISO 3 (`BEN`) et les espaces parasites.
 * @returns {string|null} le code ISO 2, ou null si le code n'est pas reconnu
 */
export function normaliserCodePays(code) {
  if (code == null) return null
  const brut = String(code).trim().toUpperCase()
  if (!brut) return null
  if (brut.length === 2) return ISO2_CONNUS.has(brut) ? brut : null
  if (brut.length === 3) {
    const iso2 = ISO3_VERS_ISO2[brut]
    return iso2 && ISO2_CONNUS.has(iso2) ? iso2 : null
  }
  return null
}

/**
 * Plancher applicable à un pays (ou null si le pays est inconnu).
 * Un plancher `verifie` sans taux exploitable est traité comme non sourcé.
 */
export function plancherPour(pays, { planchers = PLANCHERS_FERIES } = {}) {
  const code = normaliserCodePays(pays)
  if (!code) return null
  const entree = planchers?.[code]
  if (!entree) return null
  return { pays: code, ...entree }
}

/**
 * Taux exploitable d'un plancher vérifié, ou null.
 * Un `taux` de 0 est une valeur parfaitement valide (« aucune obligation »).
 */
function tauxPlancherVerifie(plancher) {
  if (!plancher) return null
  if (plancher.statut !== STATUTS_PLANCHER.VERIFIE) return null
  if (plancher.taux === null || plancher.taux === undefined) return null
  const n = Number(plancher.taux)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * Une valeur de taux est-elle exploitable ? (0 est valide, null/négatif non)
 */
export function estTauxValide(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return false
  const n = Number(valeur)
  return Number.isFinite(n) && n >= 0
}

/**
 * Résout la majoration d'un jour férié.
 *
 * ORDRE DE RÉSOLUTION (du plus précis au plus général) :
 *   0. le jour est déclaré « travaillé chez nous »  → aucune majoration férié
 *   1. exception d'entreprise sur CE férié          → `ferie`
 *   2. politique de l'entreprise                    → `entreprise`
 *   3. plancher national vérifié                    → `plancher`
 *   4. contrat produit (100 %) + avertissement      → `defaut`
 *
 * GARDE-FOU : une politique d'entreprise explicitement enregistrée SOUS un
 * plancher vérifié est refusée (`bloque: true`) plutôt que payée en silence.
 *
 * @param {object} options
 * @param {string} options.pays            code pays (ISO 2 ou 3)
 * @param {string|null} [options.zone]     zone infranationale (canton suisse)
 * @param {number|string|null} [options.tauxEntreprise] valeur réglée par l'entreprise
 * @param {boolean} [options.entrepriseConfiguree] vrai si la valeur vient d'un réglage enregistré
 * @param {object|null} [options.ferie]    férié résolu par HolidayService
 * @param {object} [options.planchers]     catalogue injectable (tests)
 * @returns {{
 *   tauxPercent: number, niveau: string, motif: string,
 *   source: string|null, bloque: boolean, avertissements: string[]
 * }}
 */
export function resoudreMajorationFerie({
  pays = null,
  zone = null,
  tauxEntreprise = null,
  entrepriseConfiguree = false,
  ferie = null,
  planchers = PLANCHERS_FERIES,
} = {}) {
  const avertissements = []
  const code = normaliserCodePays(pays)
  const plancher = plancherPour(code, { planchers })
  const tauxPlancher = tauxPlancherVerifie(plancher)

  if (!code) {
    avertissements.push('pays_inconnu')
  } else if (PAYS_EXIGEANT_ZONE.includes(code) && !zone) {
    avertissements.push('zone_requise')
  }

  const resultat = (tauxPercent, niveau, motif, extra = {}) => ({
    tauxPercent,
    niveau,
    motif,
    source: extra.source ?? null,
    bloque: extra.bloque === true,
    avertissements: [...avertissements, ...(extra.avertissements || [])],
  })

  // ── 0. Férié déclaré « travaillé chez nous » : pas de majoration férié.
  if (ferie && ferie.is_worked === true) {
    return resultat(0, 'jour_travaille', 'Férié déclaré travaillé chez nous — heures sup ordinaires.')
  }

  // ── 1. Exception explicite sur ce férié (dérogation d'entreprise).
  //  Un férié global porte toujours un `overtime_rate` (100 par défaut côté
  //  HolidayService) : ce n'est PAS une décision d'entreprise. On ne l'accepte
  //  donc que s'il s'agit d'une dérogation (`has_override`) ou d'un férié
  //  propre à l'entreprise.
  const estExceptionEntreprise =
    ferie && (ferie.has_custom_rate === true || ferie.is_global === false)
  if (estExceptionEntreprise && estTauxValide(ferie.overtime_rate)) {
    const taux = Number(ferie.overtime_rate)
    if (tauxPlancher !== null && taux < tauxPlancher) {
      return resultat(taux, 'ferie', `Exception sur « ${ferie.name || 'férié'} » sous le plancher pays.`, {
        bloque: true,
        source: plancher?.source ?? null,
      })
    }
    return resultat(taux, 'ferie', `Exception sur « ${ferie.name || 'férié'} » (dérogation d'entreprise).`, {
      source: plancher?.source ?? null,
    })
  }

  // ── 2. Politique de l'entreprise.
  if (estTauxValide(tauxEntreprise)) {
    const taux = Number(tauxEntreprise)
    if (entrepriseConfiguree && tauxPlancher !== null && taux < tauxPlancher) {
      return resultat(taux, 'entreprise', 'Politique d’entreprise sous le plancher pays.', {
        bloque: true,
        source: plancher?.source ?? null,
      })
    }
    if (!entrepriseConfiguree && tauxPlancher !== null && taux < tauxPlancher) {
      //  Valeur par défaut (jamais enregistrée) sous le plancher : ce n'est pas
      //  une faute de l'entreprise, c'est le produit qui doit s'aligner.
      return resultat(tauxPlancher, 'plancher', 'Plancher pays appliqué (aucune politique enregistrée).', {
        source: plancher?.source ?? null,
      })
    }
    if (!entrepriseConfiguree) {
      //  La valeur vient du contrat produit (réglages fusionnés), pas d'une
      //  décision humaine : elle s'applique, mais elle ne s'appelle pas
      //  « politique de l'entreprise ».
      avertissements.push('plancher_non_source')
      return resultat(taux, 'defaut', 'Taux par défaut du produit — plancher pays non sourcé.')
    }
    return resultat(taux, 'entreprise', 'Politique de l’entreprise.')
  }

  // ── 3. Plancher national vérifié.
  if (tauxPlancher !== null) {
    return resultat(tauxPlancher, 'plancher', 'Plancher légal du pays.', {
      source: plancher?.source ?? null,
    })
  }

  // ── 4. Contrat produit, avec avertissement : jamais silencieux.
  if (plancher?.statut === STATUTS_PLANCHER.AUCUNE_OBLIGATION) {
    avertissements.push('aucune_obligation_legale')
  } else {
    avertissements.push('plancher_non_source')
  }
  return resultat(TAUX_FERIE_PAR_DEFAUT, 'defaut', 'Taux par défaut du produit — plancher pays non sourcé.')
}

/**
 * Résumé lisible d'une résolution, pour l'écran et pour la preuve.
 * Exemple : « +150 % — politique de l'entreprise ».
 */
export function libelleResolution(resolution) {
  if (!resolution) return ''
  const pct = Number(resolution.tauxPercent)
  const taux = Number.isFinite(pct) ? `+${pct} %` : '—'
  return `${taux} — ${resolution.motif}`
}

export default {
  STATUTS_PLANCHER,
  PLANCHERS_FERIES,
  PAYS_EXIGEANT_ZONE,
  TAUX_FERIE_PAR_DEFAUT,
  normaliserCodePays,
  plancherPour,
  estTauxValide,
  resoudreMajorationFerie,
  libelleResolution,
}
