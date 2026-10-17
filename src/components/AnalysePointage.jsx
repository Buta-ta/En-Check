import { useRef, useState, useEffect } from 'react'
import { Sparkles, Users, ArrowRight, ShieldCheck, RefreshCw, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formaterHeureLocale, formaterHeureLocaleShort } from '../utils/timezoneUtils'
import './AnalysePointage.css'

// Présentation seule : les indices ne remplacent pas une décision de paie.
export function ResultatAnalysePointage({ result, currentOut, contextual = false }) {
  const departure = result.kind === 'depart_probable'
  const evidence = Array.isArray(result.evidence) ? result.evidence.filter(Boolean) : []
  return (
    <div className="analyse-pointage__result" role="status">
      {result.proposed_out ? (
        <>
          <div className="analyse-pointage__comparison">
            <div className="analyse-pointage__time-box">
              <span className="analyse-pointage__label">Sortie affichée sur la carte</span>
              <strong className="analyse-pointage__current-time">{formaterHeureLocale(currentOut)}</strong>
              <span className="analyse-pointage__muted">{contextual && result.eligible ? 'Proposition retenue · non payée' : 'Inchangée par cette analyse'}</span>
            </div>
            <div className="analyse-pointage__time-box analyse-pointage__time-box--proposal">
              <span className="analyse-pointage__label">{departure ? 'Départ possible' : 'Proposition du groupe'}</span>
              <strong className="analyse-pointage__proposed-time">
                {departure ? formaterHeureLocale(result.proposed_out) : formaterHeureLocaleShort(result.proposed_out)}
                {!departure && <small> environ</small>}
              </strong>
              <span className="analyse-pointage__muted">{departure ? 'Badge existant · sens à confirmer' : (contextual && result.eligible ? 'À valider sur la carte' : 'Hypothèse · non appliquée')}</span>
            </div>
          </div>
          {result.colleagues > 0 && <div className="analyse-pointage__peers">
            <Users size={15} aria-hidden="true" />
            <span>{result.colleagues} collègues distincts dans la même entreprise</span>
          </div>}
        </>
      ) : <strong className="analyse-pointage__empty-title">Pas de proposition fiable pour le moment</strong>}

      <p className="analyse-pointage__reason">{result.reason}</p>
      {contextual && <div className="analyse-pointage__muted">
        Planning : {result.planning ? formaterHeureLocale(result.planning) : 'non disponible ou non applicable'}.
        {' '}Historique personnel : {result.history_count || 0} journée(s) comparable(s).
        {result.history_out && ` Sortie habituelle : ${formaterHeureLocale(result.history_out)}.`}
      </div>}
      {departure && <p className="analyse-pointage__warning">
        Entrée inconnue : durée indéterminée. À confirmer auprès du responsable.
      </p>}

      {evidence.length > 0 && <details className="analyse-pointage__evidence" open>
        <summary>Horaires utilisés <span>{evidence.length}</span></summary>
        <div className="analyse-pointage__evidence-rows">
          {evidence.map((item, index) => (
            <div className="analyse-pointage__evidence-row" key={item.id || item.sortie_id || index}>
              <span className="analyse-pointage__peer-label">Repère {index + 1}</span>
              <div className="analyse-pointage__evidence-times">
                {item.entree && <><span><small>Entrée</small><time dateTime={item.entree}>{formaterHeureLocale(item.entree)}</time></span>
                  <ArrowRight size={14} aria-hidden="true" /></>}
                <span><small>Sortie</small><time dateTime={item.sortie || undefined}>{formaterHeureLocale(item.sortie)}</time></span>
              </div>
            </div>
          ))}
        </div>
      </details>}
      <div className="analyse-pointage__notice">
        <ShieldCheck size={16} aria-hidden="true" />
        <span>{contextual && result.eligible ? 'Cette proposition est maintenant affichée sur la carte. Valider ou ajuster la comptera en paie ; Écarter la retirera sans supprimer les traces.' : currentOut
          ? <>Les boutons <strong>Valider / Écarter</strong> de la carte concernent toujours <strong>{formaterHeureLocale(currentOut)}</strong>, pas cette proposition.</>
          : 'Aucun horaire ajouté. Cette hypothèse ne peut pas encore être validée depuis ce panneau.'}</span>
      </div>
    </div>
  )
}

export default function AnalysePointage({ sourceId, currentOut = null, context = null }) {
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])

  async function analyser() {
    if (loading) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('encheck_analyser_pointage', { p_source: sourceId })
      if (rpcError) throw rpcError
      if (!data || typeof data.kind !== 'string') throw new Error('Réponse d’analyse invalide')
      if (active.current) setResult(data)
    } catch (e) {
      if (active.current) setError(e.message || 'La connexion a échoué.')
    } finally {
      if (active.current) setLoading(false)
    }
  }

  return (
    <section className="analyse-pointage" aria-label="Analyse des indices du groupe" aria-busy={loading}>
      <header className="analyse-pointage__header">
        <div className="analyse-pointage__title"><Sparkles size={17} aria-hidden="true" /><strong>Indices du groupe</strong></div>
        <span className="analyse-pointage__badge">{context?.eligible ? 'À statuer' : context ? 'Vérification' : 'Observation'}</span>
      </header>
      <p className="analyse-pointage__intro">{context ? 'Analyse automatique du groupe et du contexte. Aucune heure payée sans validation.' : 'Comparez les badges des collègues. Aucun horaire ni montant n’est modifié.'}</p>
      {!context && <button className="analyse-pointage__button" type="button" onClick={analyser} disabled={loading}>
        {loading || result ? <RefreshCw size={15} aria-hidden="true" /> : <Users size={15} aria-hidden="true" />}
        {loading ? 'Analyse en cours…' : result ? 'Actualiser l’analyse' : error ? 'Réessayer l’analyse' : 'Analyser les indices du groupe'}
      </button>}
      {loading && <p className="analyse-pointage__muted" role="status">Recherche des pointages comparables…</p>}
      {error && <div className="analyse-pointage__error" role="alert">
        <AlertCircle size={17} aria-hidden="true" />
        <div><strong>Analyse indisponible</strong><p>{error}</p><small>Réessayez. Si l’erreur persiste, vérifiez que la migration 000007 est appliquée.</small></div>
      </div>}
      {(context || result) && <ResultatAnalysePointage result={context || result} currentOut={currentOut} contextual={Boolean(context)} />}
    </section>
  )
}
