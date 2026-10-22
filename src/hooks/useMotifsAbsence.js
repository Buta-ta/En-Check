// ═══════════════════════════════════════════════════════════
// 🪝 LECTURE DES MOTIFS D'ABSENCE
//
// Séparé du fournisseur : un fichier ne doit exporter QUE des
// composants pour que le rechargement à chaud fonctionne.
//
// Utilisable SANS fournisseur : renvoie alors les 7 motifs
// d'origine. Aucun écran ne se vide si le contexte est absent.
// ═══════════════════════════════════════════════════════════

import { createContext, useContext } from 'react'
import { MOTIFS_PAR_DEFAUT } from '../constants/motifsAbsence'

export const MotifsAbsenceContext = createContext(null)

export function useMotifsAbsence() {
  const ctx = useContext(MotifsAbsenceContext)
  if (ctx) return ctx
  return {
    motifs: MOTIFS_PAR_DEFAUT,
    chargement: false,
    toutesEntreprises: false,
    recharger: async () => {},
    creer: async () => {},
    modifier: async () => {},
    supprimer: async () => {},
    usages: async () => 0,
    // sans fournisseur : les 7 motifs d'origine, résolus par code
    motifPour: (absence) => {
      const code = typeof absence === 'string' ? absence : absence?.reason
      return MOTIFS_PAR_DEFAUT.find((m) => (m.code || m.id) === code) || null
    },
  }
}

export default useMotifsAbsence
