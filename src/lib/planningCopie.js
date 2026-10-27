// ═══════════════════════════════════════════════════════════
// COPIER / COLLER UN MODÈLE D'HORAIRE
//
// Le planning laisse déjà glisser un modèle dans une case. Ici on
// ajoute le geste du bureau : Ctrl/⌘+C sur un modèle, puis Ctrl/⌘+V
// sur une case — ou les boutons « Copier » / « Coller ».
//
// Ce module ne touche pas au DOM : il décide seulement si un
// raccourci doit être pris en compte, et décrit le modèle copié.
// ═══════════════════════════════════════════════════════════

const BALISES_DE_SAISIE = ['INPUT', 'TEXTAREA', 'SELECT']

/** Vrai si le focus est dans un champ : le navigateur garde son copier/coller. */
export function estChampDeSaisie(cible) {
  if (!cible) return false
  const balise = String(cible.tagName || '').toUpperCase()
  if (BALISES_DE_SAISIE.includes(balise)) return true
  return Boolean(cible.isContentEditable)
}

/**
 * Lit un appui clavier et rend l'action attendue :
 * « copier », « coller », ou null si le raccourci ne nous appartient pas.
 * On laisse passer le copier natif dès qu'un texte est sélectionné.
 */
export function raccourciPressePapiers(evenement, selection = '') {
  if (!evenement) return null
  const modificateur = Boolean(evenement.metaKey || evenement.ctrlKey)
  if (!modificateur || evenement.altKey) return null
  if (estChampDeSaisie(evenement.target)) return null

  const touche = String(evenement.key || '').toLowerCase()
  if (touche === 'c') {
    return String(selection || '').trim().length > 0 ? null : 'copier'
  }
  if (touche === 'v') return 'coller'
  return null
}

/** Le nom lisible d'un modèle, quel que soit son type. */
export function libelleModele(modele) {
  if (!modele) return ''
  return String(modele.label || modele.name || modele.titre || 'Modèle')
}

/** La ligne du second temps : « 08:00 – 17:00 », « Repos »… */
export function decrireModele(modele) {
  if (!modele) return ''
  if (modele.kind === 'rest') return 'Repos'
  if (modele.kind === 'leave') return 'Congé / Absence'
  if (modele.kind === 'break_only') {
    return `Pause ${modele.break_start || '--:--'} – ${modele.break_end || '--:--'}`
  }
  if (modele.start_time && modele.end_time) {
    return `${modele.start_time} – ${modele.end_time}`
  }
  return ''
}

/** Le paquet attendu par les dépôts du planning (même forme que le dock). */
export function paquetDepuisModele(modele) {
  if (!modele) return null
  return { sourceType: 'dock', template: modele }
}
