// ═══════════════════════════════════════════════════════════
// 📎 JUSTIFICATIFS D'ABSENCE — RÈGLES ET AFFICHAGE
//
// Un seul endroit pour les formats acceptés, la taille limite et
// la façon de nommer un fichier déjà stocké.
// ═══════════════════════════════════════════════════════════

export const MAX_FILE_SIZE = 5 * 1024 * 1024
export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

/** 'https://…/certificat.pdf' → 'pdf' (ou 'image', ou 'other') */
export function typeDeFichier(url) {
  if (!url) return null
  const ext = url.split('.').pop().toLowerCase().split('?')[0]
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  return 'other'
}

/** 'https://…/1700000000_certificat.pdf' → 'certificat.pdf' */
export function nomDuFichier(url) {
  if (!url) return ''
  const parties = url.split('/')
  const nom = parties[parties.length - 1].split('?')[0]
  const motif = nom.match(/^\d+_(.+)$/)
  return decodeURIComponent(motif ? motif[1] : nom)
}

export function tailleLisible(bytes) {
  if (!bytes) return '0 o'
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}
