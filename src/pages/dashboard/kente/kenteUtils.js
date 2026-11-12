// ═══════════════════════════════════════════════════════════
// Console kente — utilitaires partagés (constantes, règles v1, badge)
// ═══════════════════════════════════════════════════════════

export const JOURS_OPTIONS = [7, 30, 90]
export const JOURS_FR = {
  7: '7 derniers jours',
  30: '30 derniers jours',
  90: '90 derniers jours',
}
export const JOURS_SEMAINE = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
export const PALETTE_KENTE = ['#c9a961', '#a04a22', '#e0c88f', '#8b3e1d', '#6b4a2f', '#d1653a']

export function pctDelta(actuel, precedent) {
  if (!precedent || precedent <= 0) return null
  return Math.round(((actuel - precedent) / precedent) * 100)
}

export function formatDelta(delta) {
  if (delta === null || delta === undefined) return ''
  return `${delta > 0 ? '+' : ''}${delta} %`
}


export function couleurCellule(valeur, max) {
  if (!valeur) return 'rgba(201, 169, 97, 0.07)'
  if (!max) return 'rgba(192, 90, 43, 0.28)'
  const t = valeur / max
  if (t < 0.25) return 'rgba(192, 90, 43, 0.30)'
  if (t < 0.5) return 'rgba(192, 90, 43, 0.55)'
  if (t < 0.75) return 'rgba(214, 118, 60, 0.82)'
  return '#eba35c'
}

export function moyenne(arr) {
  if (!arr?.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

// ── Insights à règles (déterministes, sans LLM) ────────────
export function choisirInsight({ serie, heatmap, tendance, stats }) {
  const dSemaine = pctDelta(tendance?.entrees_7j, tendance?.entrees_7j_prev)
  const entreesJour = serie?.length ? serie[serie.length - 1].entrees : 0
  const moy7 = moyenne(serie?.slice(-7).map((p) => p.entrees) || [])
  const dJour = pctDelta(entreesJour, moy7)

  // Pic du matin sur la heatmap
  let heurePic = null
  let totalHeures = 0
  let totalMatin = 0
  if (Array.isArray(heatmap)) {
    const parHeure = new Array(24).fill(0)
    for (const ligne of heatmap) {
      ligne.forEach((v, h) => {
        parHeure[h] += v
        totalHeures += v
      })
    }
    totalMatin = parHeure.slice(0, 12).reduce((a, b) => a + b, 0)
    let idx = 0
    parHeure.forEach((v, h) => {
      if (v > parHeure[idx]) idx = h
    })
    if (parHeure[idx] > 0) heurePic = idx
  }
  const pctMatin = totalHeures ? Math.round((totalMatin / totalHeures) * 100) : null

  if (dSemaine !== null && Math.abs(dSemaine) >= 8) {
    return `Pointages ${dSemaine > 0 ? 'en hausse' : 'en baisse'} de ${Math.abs(dSemaine)} % sur 7 jours : ${tendance.entrees_7j} pointages contre ${tendance.entrees_7j_prev} la semaine précédente.`
  }
  if (heurePic !== null && pctMatin !== null && pctMatin >= 55) {
    return `Le pic d'arrivées se situe vers ${heurePic} h : ${pctMatin} % des pointages tombent le matin (avant midi) sur la période.`
  }
  if (dJour !== null && Math.abs(dJour) >= 20 && entreesJour > 0) {
    return dJour > 0
      ? `Journée forte : ${entreesJour} pointages contre une moyenne de ${Math.round(moy7)} par jour sur les 7 derniers jours.`
      : `Journée calme : ${entreesJour} pointages contre une moyenne de ${Math.round(moy7)} par jour sur les 7 derniers jours.`
  }
  // Meilleur / plus calme jour de la semaine (7 derniers jours)
  if (serie?.length >= 5) {
    const parSemaine = new Map()
    serie.slice(-7).forEach((p) => {
      const j = p.jourSemaine
      parSemaine.set(j, (parSemaine.get(j) || 0) + p.entrees)
    })
    const entrees = [...parSemaine.entries()]
    entrees.sort((a, b) => b[1] - a[1])
    if (entrees.length >= 2 && entrees[0][1] > 0 && entrees[entrees.length - 1][1] >= 0) {
      const [meilleur, vMeilleur] = entrees[0]
      const [calme, vCalme] = entrees[entrees.length - 1]
      if (meilleur !== calme) {
        return `${JOURS_SEMAINE[meilleur]} est le jour le plus fréquenté (${vMeilleur} pointages sur 7 jours), ${JOURS_SEMAINE[calme]} le plus calme (${vCalme}).`
      }
    }
  }
  const taux = stats?.tauxPresence
  if (typeof taux === 'number' && taux > 0) {
    const manquants = (stats.absentsToday || 0) + (stats.congesToday || 0)
    return `Taux de présence aujourd'hui : ${taux} %${manquants > 0 ? ` — ${manquants} employé${manquants > 1 ? 's' : ''} manquant${manquants > 1 ? 's' : ''} (absents et congés).` : ' — effectif complet.'}`
  }
  return 'Pas assez de données sur la période pour dégager une tendance.'
}

export function notePrevision({ heatmap, jours }) {
  if (!Array.isArray(heatmap) || !heatmap.length) return null
  let total = 0
  let totalWeekend = 0
  const parJour = new Array(7).fill(0)
  heatmap.forEach((ligne, j) => {
    ligne.forEach((v) => {
      total += v
      parJour[j] += v
      if (j >= 5) totalWeekend += v
    })
  })
  if (!total) return null
  const jourMax = parJour.indexOf(Math.max(...parJour))
  const pctWeekend = Math.round((totalWeekend / total) * 100)
  return `Sur ${jours} jours, le flux est le plus dense le ${JOURS_SEMAINE[jourMax]} ; le week-end pèse ${pctWeekend} % du total des pointages.`
}

export function noteSante({ sante }) {
  if (!sante) return null
  const { assiduite, regularite } = sante
  if (assiduite >= 85 && regularite >= 70) {
    return `Assiduité saine (${assiduite} %) et activité régulière sur la semaine glissante : la présence tient ses niveaux.`
  }
  if (assiduite < 70) {
    return `Assiduité en retrait : ${assiduite} % des effectifs ont pointé sur la semaine glissante.`
  }
  if (regularite < 55) {
    return `Activité irrégulière : l'effectif présent fluctue fortement d'un jour à l'autre (régularité ${regularite} %).`
  }
  return `Assiduité ${assiduite} %, régularité ${regularite} % — surveiller les jours les plus calmes du calendrier.`
}

