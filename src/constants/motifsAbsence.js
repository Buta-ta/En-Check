// ═══════════════════════════════════════════════════════════
// 🎨 VOCABULAIRE PARTAGÉ DES ABSENCES
//
// Source unique de vérité : la page, le calendrier, le tiroir, le dock
// et les KPI lisent les MÊMES motifs, les MÊMES statuts et les MÊMES
// couleurs. Toute divergence entre les vues devient impossible.
//
// Depuis la personnalisation des motifs, `MOTIFS_PAR_DEFAUT` sert de
// REPLI : il est utilisé tant que la base n'a pas répondu, et pour les
// absences qui référencent un motif archivé ou inconnu.
// ═══════════════════════════════════════════════════════════

export const MOTIFS_PAR_DEFAUT = [
  { id: 'conge', label: 'Congé payé', color: '#10B981', bg: 'rgba(16,185,129,0.15)', emoji: '🌴' },
  { id: 'maladie', label: 'Maladie', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', emoji: '🏥' },
  { id: 'maternite', label: 'Maternité/Paternité', color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)', emoji: '👶' },
  { id: 'injustifie', label: 'Absence injustifiée', color: '#EF4444', bg: 'rgba(239,68,68,0.15)', emoji: '⚠️' },
  { id: 'formation', label: 'Formation', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)', emoji: '📚' },
  { id: 'deces', label: 'Décès/Deuil', color: '#6B7280', bg: 'rgba(107,114,128,0.15)', emoji: '🕊️' },
  { id: 'autre', label: 'Autre', color: '#9CA3AF', bg: 'rgba(156,163,175,0.15)', emoji: '📋' },
]

/** Alias historique : les premiers composants importent `MOTIFS` */
export const MOTIFS = MOTIFS_PAR_DEFAUT

// ⚠️ Les statuts sont stockés en français dans la base : 'en_attente',
//    'approuve', 'refuse'. Jamais 'pending' / 'approved' / 'rejected'.
export const STATUTS_ABSENCE = {
  en_attente: { id: 'en_attente', label: 'En attente', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  approuve: { id: 'approuve', label: 'Approuvé', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  refuse: { id: 'refuse', label: 'Refusé', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
}

export const MOTIF_PAR_DEFAUT = MOTIFS_PAR_DEFAUT[MOTIFS_PAR_DEFAUT.length - 1]

/**
 * Type MIME porté par le glisser-déposer d'un motif depuis le dock.
 * `text/plain` sert de repli : tous les navigateurs le remplissent.
 */
export const DATA_TRANSFER_MOTIF = 'application/x-encheck-motif'

/** Retrouve un motif dans une liste (celle de la base, si elle est chargée) */
export const getMotifConfig = (id, motifs = MOTIFS_PAR_DEFAUT) =>
  (motifs || MOTIFS_PAR_DEFAUT).find((m) => m.id === id) || MOTIF_PAR_DEFAUT

export const getStatutConfig = (id) => STATUTS_ABSENCE[id] || STATUTS_ABSENCE.en_attente

/* ═══ LE NOM D'UNE COULEUR ═══
   Une tuile de motif affichait `#10B981 · 2 absences` : la valeur technique
   d'un sélecteur, lue comme du texte, est une anomalie (fondateur, 08/12). La
   base garde l'hex (c'est lui qui peint), l'écran lit le NOM. Une couleur hors
   palette n'est pas un code-barres : on dit qu'elle est libre, et le nuancier
   reste à côté pour la montrer. */
export const NOMS_COULEURS_MOTIFS = {
  '#10B981': 'Vert sauge',
  '#059669': 'Vert sapin',
  '#3B82F6': 'Bleu ciel',
  '#6366F1': 'Bleu nuit',
  '#8B5CF6': 'Violet',
  '#F59E0B': 'Ambre',
  '#D97706': 'Ocra',
  '#C25E28': 'Brique',
  '#EF4444': 'Corail',
  '#EC4899': 'Rose',
  '#6B7280': 'Ardoise',
  '#9CA3AF': 'Gris',
  '#14B8A6': 'Lagune',
  '#84CC16': 'Lime',
}

/** Le nom lisible d'une couleur de motif (`var(--abs-emerald)` et les teintes
    libres compris) — jamais le hex brut, jamais une chaîne vide. */
export const nomDeCouleur = (couleur) => {
  const cle = (couleur || '').trim().toUpperCase()
  if (NOMS_COULEURS_MOTIFS[cle]) return NOMS_COULEURS_MOTIFS[cle]
  if (/^#[0-9A-F]{6}$/.test(cle)) return 'Couleur libre'
  if (!cle) return 'Sans couleur'
  return 'Couleur du thème'
}

/** Palette proposée au moment de personnaliser un motif */
export const PALETTE_MOTIFS = [
  '#10B981', '#059669', '#3B82F6', '#6366F1', '#8B5CF6',
  '#F59E0B', '#D97706', '#C25E28', '#EF4444', '#EC4899',
  '#6B7280', '#9CA3AF', '#14B8A6', '#84CC16',
]

/** Emojis proposés au moment de personnaliser un motif */
export const EMOJIS_MOTIFS = [
  '🌴', '🏖️', '🏥', '🤒', '👶', '🍼', '⚠️', '❗', '📚', '🎓',
  '🕊️', '🖤', '📋', '📝', '🎫', '🏠', '🚗', '⚡', '🔧', '☀️',
  '🌙', '💼', '🤝', '🎯', '🧘', '🩺', '💐', '🎂',
]

// ═══════════════════════════════════════════════════════════
// Apparence d'une barre d'absence dans le calendrier.
//
// Règle : la COULEUR dit le motif, le TRAIT dit le statut.
//   • approuvée  → fond plein aux couleurs du motif
//   • en attente → contour pointillé, fond vide (probable, pas acquis)
//   • refusée    → fond rouge barré, texte barré
// Ainsi un congé, une maladie et une formation restent discernables
// quel que soit leur statut.
// ═══════════════════════════════════════════════════════════
/** Fond translucide dérivé d'une couleur hex (#10B981 → rgba(16,185,129,0.15)) */
export function fondDepuisCouleur(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim())
  if (!m) return 'rgba(156,163,175,0.15)'
  const r = parseInt(m[1].slice(0, 2), 16)
  const g = parseInt(m[1].slice(2, 4), 16)
  const b = parseInt(m[1].slice(4, 6), 16)
  return `rgba(${r},${g},${b},0.15)`
}

export function styleBarreAbsence(absence, motifs = MOTIFS_PAR_DEFAUT) {
  const motif = getMotifConfig(absence?.reason, motifs)
  const statut = getStatutConfig(absence?.status)

  if (absence?.status === 'refuse') {
    return {
      motif,
      statut,
      fond: 'rgba(153,27,27,0.20)',
      bordure: '#B91C1C',
      texte: '#FCA5A5',
      barree: true,
      pointillee: false,
    }
  }

  if (absence?.status === 'en_attente') {
    return {
      motif,
      statut,
      fond: 'rgba(255,255,255,0.02)',
      bordure: motif.color,
      texte: motif.color,
      barree: false,
      pointillee: true,
    }
  }

  return {
    motif,
    statut,
    fond: motif.bg,
    bordure: motif.color,
    texte: motif.color,
    barree: false,
    pointillee: false,
  }
}
