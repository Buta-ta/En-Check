// ═══════════════════════════════════════════════════════════
// 💳 L'ÉTAT DE PAIEMENT D'UNE PÉRIODE DE BULLETINS
//
// Trois états pour une fiche : calculée, remise, payée. La page
// Fiches de paie n'a pas à connaître les requêtes : ce hook les tient,
// et rend de quoi lire et corriger chaque marque.
//
// Rien n'est deviné : si la base ne connaît pas encore les colonnes de
// paiement, `paiementConnu` passe à false et les écrans le disent.
// ═══════════════════════════════════════════════════════════

import { useCallback, useState } from 'react'
import { chargerPaiementsPeriode } from '../services/paiementBulletins'

export function usePaiementsFiches() {
  const [sentSlips, setSentSlips] = useState(new Set())
  const [paidSlips, setPaidSlips] = useState(new Map())
  const [paiementConnu, setPaiementConnu] = useState(true)

  const recharger = useCallback(async (enterpriseId, periodStart, periodEnd) => {
    try {
      const { envoyees, paiements, paiementConnu: connu } = await chargerPaiementsPeriode({
        enterpriseId,
        dateDebut: periodStart,
        dateFin: periodEnd,
      })
      setSentSlips(envoyees || new Set())
      setPaidSlips(paiements || new Map())
      setPaiementConnu(connu)
    } catch (err) {
      console.error('Erreur chargement fiches envoyées:', err)
    }
  }, [])

  const marquerEnvoyees = useCallback((ids = []) => {
    setSentSlips(prev => new Set([...prev, ...ids]))
  }, [])

  const retirerEnvoyee = useCallback((employeeId) => {
    setSentSlips(prev => {
      const suivant = new Set(prev)
      suivant.delete(employeeId)
      return suivant
    })
    // Une fiche retirée ne peut plus être « payée » : la marque tombe avec elle.
    setPaidSlips(prev => {
      const suivant = new Map(prev)
      suivant.delete(employeeId)
      return suivant
    })
  }, [])

  const setPaiement = useCallback((employeeId, paiement) => {
    setPaidSlips(prev => {
      const suivant = new Map(prev)
      if (paiement) suivant.set(employeeId, paiement)
      else suivant.delete(employeeId)
      return suivant
    })
  }, [])

  return { sentSlips, paidSlips, paiementConnu, recharger, marquerEnvoyees, retirerEnvoyee, setPaiement }
}

export default usePaiementsFiches
