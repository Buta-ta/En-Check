import { useRef, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formaterHeureLocale } from '../utils/timezoneUtils'

// Première livraison : observation uniquement. Ni réécriture ni validation
// financière tant que planning/historique n'ont pas été confrontés aux indices.
export default function AnalysePointage({ sourceId }) {
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])

  async function analyser() {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('encheck_analyser_pointage', { p_source: sourceId })
      if (rpcError) throw rpcError
      if (!data || typeof data.kind !== 'string') throw new Error('Réponse d’analyse invalide')
      if (active.current) setResult(data)
    } catch (e) {
      if (active.current) setError(`Analyse indisponible : ${e.message}. Vérifiez que la migration 000007 est appliquée.`)
    } finally {
      if (active.current) setLoading(false)
    }
  }

  return (
    <section style={{ padding: 10, marginTop: 8, border: '1px solid #94A3B8', borderRadius: 8, fontSize: 12 }}>
      <button type="button" onClick={analyser} disabled={loading}>
        {loading ? 'Analyse…' : 'Analyser les indices du groupe'}
      </button>
      <div>Mode observation — aucun badge ni montant modifié.</div>
      {error && <p role="alert">{error}</p>}
      {result && (
        <div role="status">
          <p>{result.reason}</p>
          {result.proposed_out && <p>
            {result.kind === 'depart_probable' ? 'Badge de départ possible' : 'Sortie collective proposée'} :{' '}
            {formaterHeureLocale(result.proposed_out).slice(0, 5)}
            {result.kind === 'sortie_cohorte' ? ' environ' : ''}
          </p>}
          {result.kind === 'depart_probable' && <p>Entrée inconnue — durée indéterminée. Confirmer auprès du responsable.</p>}
          {result.colleagues > 0 && <p>{result.colleagues} collègues distincts dans la même entreprise.</p>}
          {result.evidence?.length > 0 && <details>
            <summary>Voir les horaires utilisés</summary>
            <ul>{result.evidence.map((item) => <li key={item.id || item.sortie_id}>
              {item.entree ? `${formaterHeureLocale(item.entree)} → ` : 'Départ : '}
              {formaterHeureLocale(item.sortie)}
            </li>)}</ul>
          </details>}
          <p>Hypothèse à vérifier, non validable depuis ce panneau. Les badges originaux restent inchangés.</p>
        </div>
      )}
    </section>
  )
}
