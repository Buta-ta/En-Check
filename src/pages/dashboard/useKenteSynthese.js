// ═══════════════════════════════════════════════════════════
// TABLEAU DE BORD — SYNTHÈSE KENTE (RPC encheck_dashboard_synthese)
// Série, heatmap, tendance, santé, bornes. La tuile vedette,
// les sparklines des KPI et la barre « pointages 7 jours »
// partagent ce chargement. Si la RPC est indisponible, les
// surfaces kente se retirent et le reste du tableau fonctionne.
// ═══════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

export function useKenteSynthese({ admin, isSuperAdmin }) {
  const [jours, setJours] = useState(30)
  const [donnees, setDonnees] = useState(null)
  const [echec, setEchec] = useState(false)
  const [chargement, setChargement] = useState(true)

  const scopeId = isSuperAdmin
    ? admin?.selectedEnterprise?.id || null
    : admin?.selectedEnterprise?.id || admin?.enterprise_id || null
  const fuseau = admin?.selectedEnterprise?.timezone || null
  const scopeCle = `${scopeId || 'global'}|${fuseau || 'utc'}`
  const scopeNom = admin?.selectedEnterprise?.name || (isSuperAdmin ? 'Toutes les entreprises' : admin?.enterprise_name || '')

  useEffect(() => {
    let actif = true
    setChargement(true)
    setEchec(false)
    supabase
      .rpc('encheck_dashboard_synthese', {
        p_enterprise_id: scopeId,
        p_jours: jours,
        p_fuseau: fuseau,
      })
      .then(({ data, error }) => {
        if (!actif) return
        if (error || !data?.ok) {
          setEchec(true)
          setDonnees(null)
        } else {
          setDonnees(data)
        }
      })
      .catch(() => {
        if (actif) setEchec(true)
      })
      .finally(() => {
        if (actif) setChargement(false)
      })
    return () => {
      actif = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeCle, jours])

  const serie = useMemo(() => {
    if (!donnees?.serie?.length) return []
    return donnees.serie.map((j) => ({
      date: j.d,
      label: new Date(`${j.d}T00:00:00`).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
      }),
      jourSemaine: j.jour_semaine,
      entrees: j.entrees,
      presents: j.presents,
    }))
  }, [donnees])

  return {
    jours,
    setJours,
    donnees,
    serie,
    echec,
    chargement,
    scopeId,
    scopeNom,
    sante: donnees?.sante || null,
    tendances: donnees?.tendance || null,
    bornes: donnees?.bornes || null,
  }
}
