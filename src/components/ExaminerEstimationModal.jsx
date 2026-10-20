import { useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  RefreshCw,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatConfianceEstimation } from '../services/seuilsPointage'
import {
  calculerDureeSecondes,
  formaterDureeComplete,
  formaterHeureLocale,
} from '../utils/timezoneUtils'

const formatPunchMethodLabel = (method) => {
  const m = String(method || '').toLowerCase()
  if (m.includes('qr')) return 'QR Code'
  if (m.includes('face')) return 'Reconnaissance faciale'
  if (m.includes('poste')) return 'Poste de pointage'
  if (m.includes('pin') || m.includes('code')) return 'Code PIN'
  return 'Badge enregistré'
}

export default function ExaminerEstimationModal({
  pointage,
  selectedDate,
  canEdit = false,
  statuerEstimation,
  estimationEnCours,
  onModify,
  onClose,
}) {
  const [liveAnalysis, setLiveAnalysis] = useState(null)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [analysisError, setAnalysisError] = useState('')

  if (!pointage || !pointage.lastOut) return null

  const fullName = `${pointage.employee?.first_name || ''} ${pointage.employee?.last_name || ''}`.trim() || 'Employé'
  const matricule = pointage.employee?.matricule || ''
  const entryTimeLabel = pointage.firstIn?.check_time ? formaterHeureLocale(pointage.firstIn.check_time) : '—'
  const entryMethodLabel = formatPunchMethodLabel(pointage.firstIn?.method)
  const proposedOutLabel = formaterHeureLocale(pointage.lastOut.check_time)

  const presumedDurationSec =
    pointage.totalSecondesPresumes > 0
      ? pointage.totalSecondesPresumes
      : pointage.firstIn?.check_time && pointage.lastOut?.check_time
        ? calculerDureeSecondes(pointage.firstIn.check_time, pointage.lastOut.check_time)
        : 0

  const context = liveAnalysis || pointage.contexteProposition || pointage.lastOut?.estimation_detail || null
  const evidence = Array.isArray(context?.evidence) ? context.evidence.filter(Boolean) : []
  const niveau = Number(pointage.lastOut?.estimation_niveau)
  const confiance = formatConfianceEstimation(pointage.lastOut?.estimation_confiance)
  const sched = pointage.scheduleInfo || { mode: 'none', label: 'Planning non disponible dans En-Check' }

  // Véritable origine de l'estimation (sans fabriquer de justification)
  let origineTexte = 'Sortie présumée générée suite à l’absence de badge de sortie réel sur la session.'
  if (context?.reason && typeof context.reason === 'string') {
    origineTexte = context.reason
  } else if (niveau === 1) {
    origineTexte = 'Calculée à partir de l’heure de fin prévue par le planning applicable.'
  } else if (niveau === 2) {
    origineTexte = 'Proposition calculée à partir des indices observés (groupe ou historique personnel).'
  } else if (niveau === 3) {
    origineTexte = 'Clôture automatique au seuil configuré pour l’entreprise.'
  }

  const planningDisponibilite =
    sched.mode !== 'none' && sched.startTime && sched.endTime
      ? `${sched.label} (${sched.startTime} – ${sched.endTime})`
      : context?.planning
        ? `Fin théorique : ${formaterHeureLocale(context.planning)}`
        : 'Planning non disponible dans En-Check'

  const historiqueDisponibilite =
    context?.history_count != null
      ? `${context.history_count} journée(s) comparable(s)${context.history_out ? ` · Sortie habituelle : ${formaterHeureLocale(context.history_out)}` : ''}`
      : 'Aucun historique personnel mobilisé sur cette estimation.'

  const informationsManquantes = []
  informationsManquantes.push('Aucun badge de sortie réel n’a été enregistré par le salarié pour clôturer cette entrée.')
  if (sched.mode === 'none') {
    informationsManquantes.push('Aucun planning de référence n’est disponible dans En-Check pour ce salarié.')
  }
  if (pointage.conflictData) {
    informationsManquantes.push(`Contradiction : une absence est déclarée sur cette journée (${pointage.absenceReason || 'motif non précisé'}).`)
  }
  if (context && context.eligible === false && context.kind === 'indisponible') {
    informationsManquantes.push(context.reason || 'L’analyse contextuelle du groupe n’a pas pu aboutir.')
  }

  const sourceId =
    pointage.sourceProposition ||
    pointage.lastOut?.estimation_source_id ||
    (typeof pointage.lastOut?.id === 'string' && pointage.lastOut.id.startsWith('virtual-out-')
      ? pointage.lastOut.id.slice('virtual-out-'.length)
      : pointage.firstIn?.id || null)

  const chargerIndicesGroupe = async () => {
    if (!sourceId || loadingAnalysis) return
    setLoadingAnalysis(true)
    setAnalysisError('')
    try {
      const { data, error } = await supabase.rpc('encheck_analyser_pointage', { p_source: sourceId })
      if (error) throw error
      if (!data || typeof data.kind !== 'string') throw new Error('Réponse d’analyse invalide')
      setLiveAnalysis(data)
    } catch (err) {
      setAnalysisError(err.message || 'Impossible de charger les indices du groupe.')
    } finally {
      setLoadingAnalysis(false)
    }
  }

  const handleDecision = async (action) => {
    if (!canEdit || !statuerEstimation) return
    if (action === 'ajuster' && !pointage.lastOut?.__contextuelle && onModify) {
      onClose()
      onModify(pointage?.employee?.id || pointage)
      return
    }
    await statuerEstimation(pointage.lastOut, action)
    onClose()
  }

  return (
    <div className="pointages-fiche-overlay" role="presentation" onClick={onClose}>
      <section
        className="pointages-estimation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="examiner-estimation-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="pointages-estimation-header">
          <div>
            <span className="pointages-fiche-eyebrow">EXAMINER LA SORTIE PRÉSUMÉE</span>
            <h2 id="examiner-estimation-title">{fullName}</h2>
            <p>
              {matricule ? `${matricule} · ` : ''}Journée du {selectedDate}
            </p>
          </div>
          <button
            type="button"
            className="pointages-drawer-close"
            onClick={onClose}
            aria-label="Fermer sans décider"
          >
            <X size={16} />
          </button>
        </header>

        <div className="pointages-estimation-body">
          {/* COMPARAISON ENTRÉE RÉELLE / SORTIE PROPOSÉE */}
          <div className="pointages-estimation-times-grid">
            <div className="pointages-estimation-time-card is-real">
              <span>Entrée réelle (badgée)</span>
              <strong>{entryTimeLabel}</strong>
              <small>{entryMethodLabel}</small>
            </div>

            <div className="pointages-estimation-time-card is-proposed">
              <span>⏳ Sortie proposée (présumée)</span>
              <strong>{proposedOutLabel}</strong>
              <small>
                Durée présumée : {formaterDureeComplete(presumedDurationSec)}
                {confiance ? ` · Confiance : ${confiance}` : ''}
              </small>
            </div>
          </div>

          {/* POURQUOI CETTE PROPOSITION ? */}
          <div className="pointages-estimation-reasons">
            <h3>Pourquoi cette proposition ?</h3>

            <div className="pointages-estimation-reason-block">
              <strong>• Origine de l’estimation</strong>
              <p>{origineTexte}</p>
            </div>

            <div className="pointages-estimation-reason-block">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <strong>• Horaires des collègues utilisés</strong>
                {sourceId && !evidence.length && (
                  <button
                    type="button"
                    className="pointages-card-fiche-btn"
                    disabled={loadingAnalysis}
                    onClick={chargerIndicesGroupe}
                  >
                    <RefreshCw size={11} />
                    <span>{loadingAnalysis ? 'Recherche…' : 'Vérifier les collègues'}</span>
                  </button>
                )}
              </div>
              {evidence.length > 0 ? (
                <div className="pointages-estimation-evidence-list">
                  {context?.colleagues > 0 && (
                    <span className="pointages-estimation-peers-count">
                      <Users size={12} /> {context.colleagues} collègue(s) distinct(s) dans la même entreprise
                    </span>
                  )}
                  {evidence.map((item, idx) => (
                    <div className="pointages-estimation-evidence-row" key={item.id || item.sortie_id || idx}>
                      <span>Repère {idx + 1}</span>
                      <span>
                        {item.entree ? `${formaterHeureLocale(item.entree)} → ` : ''}
                        <strong>{formaterHeureLocale(item.sortie)}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p>
                  {analysisError || 'Aucun horaire de collègue n’a été utilisé pour construire cette proposition.'}
                </p>
              )}
            </div>

            <div className="pointages-estimation-reason-block">
              <strong>• Planning et historique disponibles</strong>
              <p>
                Planning : {planningDisponibilite}.<br />
                Historique : {historiqueDisponibilite}
              </p>
            </div>

            <div className="pointages-estimation-reason-block">
              <strong>• Informations manquantes ou contradictions</strong>
              <ul>
                {informationsManquantes.map((info, idx) => (
                  <li key={idx}>{info}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* CONSÉQUENCE */}
          <div className="pointages-estimation-consequence">
            <ShieldCheck size={17} />
            <div>
              <strong>Conséquence :</strong>
              <span>
                Valider comptera cette durée ({formaterDureeComplete(presumedDurationSec)}) en paie tout en conservant le libellé « Sortie présumée validée ». Écarter retirera cette estimation et laissera la journée sans sortie payée.
              </span>
            </div>
          </div>

          {/* BOUTONS DE DÉCISION */}
          {canEdit ? (
            <div className="pointages-estimation-decision-actions">
              <button
                type="button"
                className="pointages-drawer-btn is-good"
                disabled={Boolean(estimationEnCours)}
                onClick={() => handleDecision('valider')}
              >
                <CheckCircle2 size={15} />
                <span>Valider cette heure</span>
              </button>

              <button
                type="button"
                className="pointages-drawer-btn is-copper"
                disabled={Boolean(estimationEnCours)}
                onClick={() => handleDecision('ajuster')}
              >
                <Clock size={15} />
                <span>Ajuster puis valider</span>
              </button>

              <button
                type="button"
                className="pointages-drawer-btn is-danger"
                disabled={Boolean(estimationEnCours)}
                onClick={() => handleDecision('rejeter')}
              >
                <AlertTriangle size={15} />
                <span>Écarter l’estimation</span>
              </button>

              <button
                type="button"
                className="pointages-drawer-btn is-outline"
                onClick={onClose}
              >
                <span>Fermer sans décider</span>
                <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <div className="pointages-estimation-decision-actions">
              <button type="button" className="pointages-drawer-btn is-outline" onClick={onClose}>
                Fermer
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
