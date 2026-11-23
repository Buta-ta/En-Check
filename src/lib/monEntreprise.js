// src/lib/monEntreprise.js
// ═══════════════════════════════════════════════════════════════════════════
// 🏢 « MON ENTREPRISE » — la logique, sans React
//
// Trois questions, trois fonctions pures :
//   1. quelles entreprises cet administrateur peut-il voir ?
//   2. quel modèle le produit propose-t-il, et est-il APPLIQUÉ ou seulement
//      PROPOSÉ ?
//   3. comment nommer l'état d'une règle sans jamais laisser croire à une loi ?
//
// ⚠️ Aucun modèle de ce fichier n'est présenté comme une obligation légale.
//    Le rattachement pays → modèle est VIDE tant qu'aucune source vérifiée
//    n'existe (décision D5) : le produit propose, l'entreprise confirme.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Les modèles proposés par le produit. Des POINTS DE DÉPART, pas des règles :
 * le 48 h est le défaut du produit (décision du 24/10/2026) ; le 50 h est une
 * seconde proposition. Aucun des deux n'est étiqueté « légal ».
 */
export const MODELES_HEBDO = [
  { id: 'produit-48', heures: 48, libelle: '48 h — défaut du produit' },
  { id: 'produit-50', heures: 50, libelle: '50 h — proposition du produit' },
]

/**
 * Pays → modèle pré-sélectionné.
 * ⚠️ VOLONTAIREMENT VIDE : aucune source pays n'a été vérifiée (D5). Inventer
 * « au Bénin, 48 h » serait exactement la faute qu'on s'interdit. Le jour où
 * une source existe, elle s'ajoute ici, avec sa référence.
 */
export const MODELES_PAR_PAYS = Object.freeze({})

/** Le modèle proposé pour un pays, ou le défaut du produit. */
export function modelePropose(pays, modelesParPays = MODELES_PAR_PAYS) {
  const code = String(pays || '').toUpperCase()
  const id = code ? modelesParPays[code] : null
  return MODELES_HEBDO.find((m) => m.id === id) || MODELES_HEBDO[0]
}

/**
 * L'état d'un modèle face à la règle en vigueur.
 *
 * `statut_source` ∈ 'propose' | 'applique' | 'confirme_autre'
 *   · propose        : la valeur proposée n'est pas (ou pas encore) enregistrée ;
 *   · applique       : la règle en vigueur vaut exactement la proposition ;
 *   · confirme_autre : l'entreprise a enregistré autre chose — on ne l'écrase
 *                      pas, on le dit.
 */
export function statutModele({ valeurRegle, modele = modelePropose() }) {
  if (valeurRegle === null || valeurRegle === undefined) {
    return { statut_source: 'propose', valeur: modele.heures, ecart: null }
  }
  const valeur = Number(valeurRegle)
  if (!Number.isFinite(valeur)) {
    return { statut_source: 'propose', valeur: modele.heures, ecart: null }
  }
  if (valeur === modele.heures) {
    return { statut_source: 'applique', valeur, ecart: 0 }
  }
  return { statut_source: 'confirme_autre', valeur, ecart: valeur - modele.heures }
}

/** Le libellé qui accompagne ce statut. Jamais le mot « légal ». */
export function libelleStatutModele(statut) {
  switch (statut) {
    case 'applique':
      return 'Modèle confirmé par l’entreprise'
    case 'confirme_autre':
      return 'L’entreprise a enregistré une autre valeur'
    default:
      return 'Proposition du produit — non appliquée'
  }
}

/**
 * Les entreprises visibles par cet administrateur.
 * Un super-admin voit tout ; les autres, uniquement celles auxquelles ils ont
 * accès (jamais une entreprise choisie dans l'URL).
 */
export function entreprisesVisibles(admin, entreprises = []) {
  if (!admin) return []
  const liste = Array.isArray(entreprises) ? entreprises : []
  if (admin.role === 'super_admin') return liste

  const autorisees = new Set(
    [admin.enterprise_id, admin.selectedEnterprise?.id]
      .concat(
        Array.isArray(admin.enterprises)
          ? admin.enterprises.map((e) => (typeof e === 'string' ? e : e?.id))
          : [],
      )
      .filter(Boolean),
  )
  return liste.filter((entreprise) => autorisees.has(entreprise?.id))
}

/** Une entreprise demandée est-elle réellement accessible ? */
export function accesAutorise(admin, entrepriseId, entreprises = []) {
  if (!admin || !entrepriseId) return false
  if (admin.role === 'super_admin') return true
  return entreprisesVisibles(admin, entreprises).some((e) => e.id === entrepriseId)
}

/**
 * Où mène le bouton « Retour » de la page « Mon entreprise ».
 *
 * On ne devine pas : on regarde ce que le routeur sait de l'historique.
 * `history.state.idx` est l'index de l'entrée courante dans la session ; à 0,
 * il n'y a rien derrière et `navigate(-1)` sortirait de l'application (ou ne
 * ferait rien du tout, selon le navigateur) — le pire des deux mondes pour un
 * bouton qu'on vient de dessiner.
 *
 * ⚠️ Le repli n'est pas le menu : c'est le tableau de bord, la page d'accueil
 *    de tout administrateur connecté. Un retour doit toujours aboutir.
 */
export const ACCUEIL_ADMIN = '/dashboard'

export function cibleRetour(idx) {
  return Number(idx) > 0 ? 'precedent' : ACCUEIL_ADMIN
}

/** « 45 » → « 45 h » ; null → « non configuré » (jamais 0, jamais un défaut). */
export function formaterHeures(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return 'non configuré'
  const nombre = Number(valeur)
  if (!Number.isFinite(nombre)) return 'valeur illisible'
  return `${nombre} h`
}

/** Les clés éditables dans cet écran, avec leur libellé et leur raison d'être. */
export const REGLES_AFFICHEES = [
  {
    cle: 'alerte_hebdo_heures',
    libelle: 'Seuil d’alerte hebdomadaire',
    aide: 'Au-delà de ce seuil, une semaine est signalée dans la fiche employé.',
  },
  {
    cle: 'alerte_hebdo_niveau2_heures',
    libelle: 'Second niveau d’alerte',
    aide: 'Facultatif. Doit dépasser le premier seuil.',
  },
  {
    cle: 'repos_minimum_heures',
    libelle: 'Repos minimum entre deux journées',
    aide: 'Contrôle de repos quotidien. 24 h au plus.',
  },
]
