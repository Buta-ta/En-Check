// ═══════════════════════════════════════════════════════════
// 🎨 FOURNISSEUR DES MOTIFS D'ABSENCE
//
// Les motifs sont des données : créables, modifiables, supprimables.
// Ce fournisseur les charge une fois et les diffuse au calendrier,
// au dock, au tiroir, au formulaire, aux filtres et aux KPI.
//
// Si la base ne répond pas, on garde les 7 motifs d'origine :
// l'écran ne se vide jamais.
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { MotifsAbsenceContext } from '../hooks/useMotifsAbsence'
import MotifsAbsenceService from '../services/motifsAbsenceService'
import { MOTIFS_PAR_DEFAUT } from '../constants/motifsAbsence'

export function MotifsAbsenceProvider({ enterpriseId, children }) {
  const [motifs, setMotifs] = useState(MOTIFS_PAR_DEFAUT)
  const [chargement, setChargement] = useState(false)
  // Vue « toutes entreprises » : on montre les motifs globaux, non personnalisables
  const toutesEntreprises = !enterpriseId || enterpriseId === 'all'

  // Chargement initial : l'état n'est posé qu'après le retour réseau
  useEffect(() => {
    let annule = false
    const charger = async () => {
      try {
        const actifs = await MotifsAbsenceService.lister(enterpriseId)
        if (annule) return
        if (actifs && actifs.length > 0) setMotifs(actifs)
      } catch (err) {
        if (annule) return
        console.error('[motifs] chargement impossible, repli sur les motifs d\u2019origine', err)
        setMotifs(MOTIFS_PAR_DEFAUT)
      }
    }
    charger()
    return () => { annule = true }
  }, [enterpriseId])

  // Rechargement à la demande (après une création, une modification, une suppression…)
  const recharger = useCallback(async () => {
    try {
      setChargement(true)
      const actifs = await MotifsAbsenceService.lister(enterpriseId)
      if (actifs && actifs.length > 0) setMotifs(actifs)
    } catch (err) {
      console.error('[motifs] rechargement impossible', err)
    } finally {
      setChargement(false)
    }
  }, [enterpriseId])

  const creer = useCallback(async (donnees) => {
    const cree = await MotifsAbsenceService.creer({ ...donnees, enterpriseId })
    await recharger()
    toast.success(`Motif « ${cree.label} » créé`)
    return cree
  }, [enterpriseId, recharger])

  const modifier = useCallback(async (id, patch) => {
    const maj = await MotifsAbsenceService.modifier(id, patch)
    await recharger()
    toast.success('Motif modifié — le calendrier suit aussitôt')
    return maj
  }, [recharger])

  const supprimer = useCallback(async ({ rowId, codeSource, codeCible = null }) => {
    if (codeCible) await MotifsAbsenceService.reassigner({
      codeSource,
      codeCible,
      enterpriseId,
    })
    await MotifsAbsenceService.supprimer(rowId)
    await recharger()
    toast.success(codeCible ? 'Motif supprimé, absences transférées' : 'Motif supprimé')
  }, [enterpriseId, recharger])

  const usages = useCallback((code) => MotifsAbsenceService.usages(code, enterpriseId), [enterpriseId])

  const valeur = useMemo(() => ({
    motifs, chargement, toutesEntreprises, recharger, creer, modifier, supprimer, usages,
  }), [motifs, chargement, toutesEntreprises, recharger, creer, modifier, supprimer, usages])

  return (
    <MotifsAbsenceContext.Provider value={valeur}>
      {children}
    </MotifsAbsenceContext.Provider>
  )
}

export default MotifsAbsenceProvider
