// ═══════════════════════════════════════════════════════════
// 🔤 LES INITIALES D'UN NOM
//
// Sert de repli quand un salarié n'a pas de photo. Isolé ici
// plutôt qu'exporté depuis un fichier de composants : un module
// qui mélange composants et fonctions utilitaires casse le
// rafraîchissement à chaud (React Fast Refresh).
// ═══════════════════════════════════════════════════════════

/**
 * « Awa », « Diallo » → « AD ». Jamais une chaîne vide : un cercle
 * sans rien dedans ressemble à une image cassée.
 */
export function initialesDe(prenom, nom) {
  const a = String(prenom || '').trim()
  const b = String(nom || '').trim()
  if (!a && !b) return '?'
  return `${a.charAt(0)}${b.charAt(0)}`.toUpperCase()
}

/**
 * « Hippo BIYOKILA » → « HB ». Pour les contexts où seul le nom
 * complet est disponible (bannières de pauses) : initiale du premier
 * mot + initiale du dernier mot.
 */
export function initialesDepuisNom(nomComplet) {
  const mots = String(nomComplet || '').trim().split(/\s+/).filter(Boolean)
  if (mots.length === 0) return '?'
  if (mots.length === 1) return mots[0].charAt(0).toUpperCase()
  return `${mots[0].charAt(0)}${mots[mots.length - 1].charAt(0)}`.toUpperCase()
}

export default initialesDe
