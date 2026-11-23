// ═══════════════════════════════════════════════════════════════════════════
// 🕒 « MES PAUSES » — la vue de l'employé sur ses propres pauses
//
// La RPC `encheck_pauses_mes_pauses_web()` ne prend AUCUN paramètre
// d'identité : l'employé vient de `auth.uid()`, donc du JWT. C'est la règle
// posée depuis le début de ce lot — un identifiant qui circule ne prouve
// rien, une session si.
//
// CE QUE CETTE VUE NE MONTRE PAS : `motif_fermeture`. Décision du fondateur
// (26/11) : « ce n'est pas à l'employé de voir pourquoi sa pause s'est
// fermée mais à l'admin de l'entreprise ». La RPC ne la renvoie pas, et ce
// module ne l'invente pas — un test le vérifie.
// ═══════════════════════════════════════════════════════════════════════════
import { db } from '../lib/db'

/** Les libellés d'anomalie, côté employé. Volontairement neutres, sans chiffre
 *  d'administration (le dépassement se juge côté admin). */
export const ANOMALIES_EMPLOYE = {
  sans_reprise: 'Sans reprise enregistrée',
  trop_longue: 'Pause longue',
  depassement: 'Plus longue que prévu',
}

export const STATUTS_EMPLOYE = {
  reelle: 'Pointée',
  presumee: 'Prévue',
  validee: 'Validée',
  ecartee: null, //  une pause écartée par l'admin ne regarde pas l'employé
}

/**
 * Charge les pauses de l'employé connecté.
 *
 * Ne lève jamais : un écran d'heures qui tombe en erreur à cause d'une
 * section secondaire serait une régression. En cas de problème, on renvoie
 * une liste vide et `erreur: true` — l'appelant peut choisir de le dire.
 */
export async function chargerMesPauses (client = null) {
  try {
    const c = client || db()
    const { data, error } = await c.rpc('encheck_pauses_mes_pauses_web', {})
    if (error) return { pauses: [], erreur: true }
    return { pauses: Array.isArray(data) ? data : [], erreur: false }
  } catch {
    return { pauses: [], erreur: true }
  }
}

/** « 1 h 51 » / « 45 min » — lisible sans être technique. */
export function dureeLisible (minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const reste = m % 60
  return reste === 0 ? `${h} h` : `${h} h ${String(reste).padStart(2, '0')}`
}

/** « 12:05 » dans le fuseau demandé. */
export function heureCourte (iso, fuseau) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      ...(fuseau ? { timeZone: fuseau } : {}),
    })
  } catch {
    return null
  }
}

/**
 * Prépare les lignes pour l'affichage. Une entrée = une pause, jamais
 * fusionnée avec une autre : l'employé doit pouvoir compter ce qu'il voit.
 */
export function presenterMesPauses (lignes = [], { fuseau } = {}) {
  return (lignes || [])
    //  Une pause écartée par l'administration n'a rien à faire sous les yeux
    //  de l'employé : elle n'existe plus pour lui.
    .filter((l) => l && l.statut !== 'ecartee')
    .map((l) => {
      const ouverte = !l.fin
      return {
        id: l.id,
        jour: l.jour,
        debut: heureCourte(l.debut, fuseau),
        fin: heureCourte(l.fin, fuseau),
        ouverte,
        duree: ouverte ? null : dureeLisible(l.duree_minutes),
        dureeMinutes: Number(l.duree_minutes) || 0,
        statut: STATUTS_EMPLOYE[l.statut] || null,
        anomalie: ANOMALIES_EMPLOYE[l.anomalie] || null,
      }
    })
    .sort((a, b) => String(b.jour || '').localeCompare(String(a.jour || '')))
}

/** Total des minutes des pauses fermées — « ce mois-ci, 3 h 20 de pause ». */
export function totalMinutes (lignes = []) {
  return (lignes || []).reduce(
    (somme, l) => somme + (l.ouverte ? 0 : (Number(l.dureeMinutes) || 0)),
    0
  )
}
