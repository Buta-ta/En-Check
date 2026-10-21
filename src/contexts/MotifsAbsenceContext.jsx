// ═══════════════════════════════════════════════════════════
// 🎨 FOURNISSEUR DES MOTIFS D'ABSENCE
//
// Les motifs sont des données : créables, modifiables, archivables.
// Ce fournisseur les charge une fois et les diffuse au calendrier,
// au dock, au tiroir, au formulaire et aux KPI.
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
  const [corbeille, setCorbeille] = useState([])
  const [chargement, setChargement] = useState(false)

  // Chargement initial : l'état n'est posé qu'après le retour réseau
  useEffect(() => {
    let annule = false
    const charger = async () => {
      try {
        const [actifs, archives] = await Promise.all([
          MotifsAbsenceService.lister(enterpriseId),
          MotifsAbsenceService.corbeille(enterpriseId),
        ])
        if (annule) return
        if (actifs && actifs.length > 0) setMotifs(actifs)
        setCorbeille(archives || [])
      } catch (err) {
        if (annule) return
        console.error('[motifs] chargement impossible, repli sur les motifs d\u2019origine', err)
        setMotifs(MOTIFS_PAR_DEFAUT)
      }
    }
    charger()
    return () => { annule = true }
  }, [enterpriseId])

  // Rechargement à la demande (après une création, une modification…)
  const recharger = useCallback(async () => {
    try {
      setChargement(true)
      const [actifs, archives] = await Promise.all([
        MotifsAbsenceService.lister(enterpriseId),
        MotifsAbsenceService.corbeille(enterpriseId),
      ])
      if (actifs && actifs.length > 0) setMotifs(actifs)
      setCorbeille(archives || [])
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
    toast.success('Motif modifié')
    return maj
  }, [recharger])

  const archiver = useCallback(async (id) => {
    await MotifsAbsenceService.archiver(id)
    await recharger()
    toast.success('Motif archivé — restaurable depuis la corbeille')
  }, [recharger])

  const restaurer = useCallback(async (id) => {
    await MotifsAbsenceService.restaurer(id)
    await recharger()
    toast.success('Motif restauré')
  }, [recharger])

  const usages = useCallback((code) => MotifsAbsenceService.usages(code), [])

  const valeur = useMemo(() => ({
    motifs, corbeille, chargement, recharger, creer, modifier, archiver, restaurer, usages,
  }), [motifs, corbeille, chargement, recharger, creer, modifier, archiver, restaurer, usages])

  return (
    <MotifsAbsenceContext.Provider value={valeur}>
      {children}
    </MotifsAbsenceContext.Provider>
  )
}

export default MotifsAbsenceProvider
