// ═══════════════════════════════════════════════════════════
// 🎨 VOCABULAIRE PARTAGÉ DES ABSENCES
//
// Source unique de vérité : la page Absences, le calendrier mensuel
// et le tiroir de détail lisent les MÊMES motifs, les MÊMES statuts
// et les MÊMES couleurs. Un motif = un id, un libellé, une couleur,
// un emoji. Toute divergence entre les vues devient impossible.
// ═══════════════════════════════════════════════════════════

export const MOTIFS = [
  { id: 'conge', label: 'Congé payé', color: '#10B981', bg: 'rgba(16,185,129,0.15)', emoji: '🌴' },
  { id: 'maladie', label: 'Maladie', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', emoji: '🏥' },
  { id: 'maternite', label: 'Maternité/Paternité', color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)', emoji: '👶' },
  { id: 'injustifie', label: 'Absence injustifiée', color: '#EF4444', bg: 'rgba(239,68,68,0.15)', emoji: '⚠️' },
  { id: 'formation', label: 'Formation', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)', emoji: '📚' },
  { id: 'deces', label: 'Décès/Deuil', color: '#6B7280', bg: 'rgba(107,114,128,0.15)', emoji: '🕊️' },
  { id: 'autre', label: 'Autre', color: '#9CA3AF', bg: 'rgba(156,163,175,0.15)', emoji: '📋' },
]

// ⚠️ Les statuts sontstockés en français dans la base : 'en_attente',
//    'approuve', 'refuse'. Jamais 'pending' / 'approved' / 'rejected'.
export const STATUTS_ABSENCE = {
  en_attente: { id: 'en_attente', label: 'En attente', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  approuve: { id: 'approuve', label: 'Approuvé', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  refuse: { id: 'refuse', label: 'Refusé', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
}

export const MOTIF_PAR_DEFAUT = MOTIFS[MOTIFS.length - 1]

/**
 * Type MIME porté par le glisser-déposer d'un motif depuis le dock.
 * `text/plain` sert de repli : tous les navigateurs le remplissent.
 */
export const DATA_TRANSFER_MOTIF = 'application/x-encheck-motif'

export const getMotifConfig = (id) => MOTIFS.find((m) => m.id === id) || MOTIF_PAR_DEFAUT

export const getStatutConfig = (id) => STATUTS_ABSENCE[id] || STATUTS_ABSENCE.en_attente

// ═══════════════════════════════════════════════════════════
// Apparence d'une barre d'absence dans le calendrier mensuel.
//
// Règle : la COULEUR dit le motif, le TRAIT dit le statut.
//   • approuvée  → fond plein aux couleurs du motif
//   • en attente → contour pointillé, fond vide (probable, pas acquis)
//   • refusée    → fond rouge barré, texte barré
// Ainsi un congé, une maladie et une formation restent discernables
// quel que soit leur statut.
// ═══════════════════════════════════════════════════════════
export function styleBarreAbsence(absence) {
  const motif = getMotifConfig(absence?.reason)
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
