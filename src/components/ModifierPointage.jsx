// ═══════════════════════════════════════════════════════════
// ✏️ MODAL MODIFICATION POINTAGE V2 — AFRO-TECH + THÈME DYNAMIQUE
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import FeatureService, { FEATURES } from '../services/featureService'
import JournalPointage from './JournalPointage'
import { utcVersHeureLocale, heureLocaleVersUTC } from '../utils/timezoneUtils'
import { estLigneHorsCalcul, estIdentifiantDeBase } from '../services/seuilsPointage'
import { useTheme } from '../contexts/ThemeContext'
import {
  AdinkraWatermarkSvg,
  KenteWovenTapestrySvg,
  WovenKenteBadgeSvg,
} from './AfroCulturalSvg'
import {
  Clock,
  X,
  Sparkles,
  Plus,
  Trash2,
  Shield,
  Check,
  Edit3,
  Save,
  LogIn,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react'
import toast from 'react-hot-toast'
import '../pages/PointagesAfroTech.css'

const MOTIFS_RAPIDES = [
  'Oubli de badge',
  'Erreur de saisie',
  'Mission externe',
  'Garde de nuit',
  'Correction RH',
]

export default function ModifierPointage({
  employeeId,
  employee: employeeProp = null,
  enterpriseId: enterpriseIdProp = null,
  selectedDate,
  pointagesJournee,
  onClose,
  onSuccess,
}) {
  const { darkMode = true } = useTheme() || { darkMode: true }
  const [hasAccess, setHasAccess] = useState(null)
  const [loading, setLoading] = useState(false)
  const [pointages, setPointages] = useState([])
  const [motif, setMotif] = useState('')
  const [employeeInfo, setEmployeeInfo] = useState(employeeProp)

  // ════════════════════════════════════════════════════════════════════════
  //  SEULES LES LIGNES EXPLOITABLES S'ÉDITENT ICI (cas MADEDE, 16/10/2026)
  // ════════════════════════════════════════════════════════════════════════
  const lignesEditables = (pointagesJournee || []).filter(
    (p) => estIdentifiantDeBase(p.id) && !estLigneHorsCalcul(p)
  )

  const initPointages = () => {
    const formatted = lignesEditables.map(p => {
      const { heures, minutes, secondes, jourISO } = utcVersHeureLocale(p.check_time)
      const isNextDay = Boolean(jourISO && selectedDate && jourISO > selectedDate)

      return {
        id: p.id,
        type: p.check_type,
        date: selectedDate,
        heures: String(heures).padStart(2, '0'),
        minutes: String(minutes).padStart(2, '0'),
        secondes: String(secondes).padStart(2, '0'),
        isNextDay: isNextDay,
        isExisting: true,
        original_time: p.check_time,
        __estimation: Boolean(p.is_auto_closed || p.estimation_source_id || p.estimation_validee_le),
        __sourceId: p.estimation_source_id || null,
        __estimationEtat: p.estimation_validee_le ? 'validee' : 'a_statuer',
      }
    })

    setPointages(formatted.sort((a, b) => {
      const dayOffsetA = a.isNextDay ? 1 : 0
      const dayOffsetB = b.isNextDay ? 1 : 0
      if (dayOffsetA !== dayOffsetB) return dayOffsetA - dayOffsetB
      const timeA = `${a.heures}:${a.minutes}:${a.secondes}`
      const timeB = `${b.heures}:${b.minutes}:${b.secondes}`
      return timeA.localeCompare(timeB)
    }))
  }

  useEffect(() => {
    initPointages()

    let cancelled = false
    const resolveAndCheck = async () => {
      let currentEmp = employeeProp
      if (!currentEmp && employeeId) {
        try {
          const { data } = await supabase
            .from('employees')
            .select('id, first_name, last_name, matricule, photo_url, enterprise_id, position, department')
            .eq('id', employeeId)
            .maybeSingle()
          if (!cancelled && data) {
            currentEmp = data
            setEmployeeInfo(data)
          }
        } catch {
          // ignore
        }
      } else if (employeeProp) {
        setEmployeeInfo(employeeProp)
      }

      // Super Admin a toujours accès
      try {
        const rawAdmin = window.localStorage.getItem('admin')
        const parsedAdmin = rawAdmin ? JSON.parse(rawAdmin) : null
        if (parsedAdmin?.role === 'super_admin') {
          if (!cancelled) setHasAccess(true)
          return
        }
      } catch {
        // ignore
      }

      const targetEid =
        pointagesJournee?.[0]?.enterprise_id ||
        enterpriseIdProp ||
        currentEmp?.enterprise_id ||
        null

      if (!targetEid) {
        if (!cancelled) setHasAccess(true)
        return
      }

      try {
        const access = await FeatureService.hasFeature(
          targetEid,
          FEATURES.MODIFICATION_POINTAGES
        )
        if (!cancelled) setHasAccess(Boolean(access))
      } catch {
        if (!cancelled) setHasAccess(true)
      }
    }

    resolveAndCheck()
    return () => {
      cancelled = true
    }
  }, [employeeId, employeeProp, enterpriseIdProp, pointagesJournee])

  // Calcul en temps réel de la durée totale à partir des lignes saisies
  const liveDurationLabel = useMemo(() => {
    let totalSec = 0
    let openInSec = null
    for (const p of pointages) {
      const h = Math.max(0, Math.min(23, parseInt(p.heures, 10) || 0))
      const m = Math.max(0, Math.min(59, parseInt(p.minutes, 10) || 0))
      const s = Math.max(0, Math.min(59, parseInt(p.secondes, 10) || 0))
      const offsetSec = (p.isNextDay ? 86400 : 0) + h * 3600 + m * 60 + s
      if (p.type === 'in') {
        openInSec = offsetSec
      } else if (p.type === 'out' && openInSec !== null) {
        const diff = offsetSec - openInSec
        if (diff > 0) totalSec += diff
        openInSec = null
      }
    }
    const hrs = Math.floor(totalSec / 3600)
    const mins = Math.floor((totalSec % 3600) / 60)
    return `${String(hrs).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`
  }, [pointages])

  const ajouterPointage = () => {
    const lastRow = pointages[pointages.length - 1]
    const nextType = lastRow && lastRow.type === 'in' ? 'out' : 'in'
    const defaultHour = nextType === 'in' ? '08' : '17'
    setPointages([
      ...pointages,
      {
        id: `new_${Date.now()}`,
        type: nextType,
        date: selectedDate,
        heures: defaultHour,
        minutes: '00',
        secondes: '00',
        isNextDay: false,
        isExisting: false,
      },
    ])
  }

  const supprimerPointage = (index) => {
    setPointages(pointages.filter((_, i) => i !== index))
  }

  const modifierPointage = (index, field, value) => {
    const updated = [...pointages]

    if (field === 'heures' && (value < 0 || value > 23)) return
    if ((field === 'minutes' || field === 'secondes') && (value < 0 || value > 59)) return

    if (field === 'isNextDay' || field === 'type') {
      if (field === 'isNextDay' && value === true) {
        const lendemain = new Date(`${selectedDate}T00:00:00Z`)
        lendemain.setUTCDate(lendemain.getUTCDate() + 1)
        const aujourdhui = new Date()
        const lendemainISO = lendemain.toISOString().split('T')[0]
        const aujourdhuiISO = `${aujourdhui.getFullYear()}-${String(aujourdhui.getMonth() + 1).padStart(2, '0')}-${String(aujourdhui.getDate()).padStart(2, '0')}`
        if (lendemainISO > aujourdhuiISO) {
          toast.error(
            `« J+1 » mettrait ce pointage le ${lendemainISO}, dans le futur. ` +
              'Ce bouton est fait pour un pointage survenu après minuit, le lendemain du jour affiché.'
          )
          return
        }
      }
      updated[index][field] = value
    } else {
      updated[index][field] = String(value).padStart(2, '0')
    }

    setPointages(updated)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!hasAccess) {
      toast.error('Cette fonctionnalité nécessite un abonnement premium')
      return
    }

    if (!motif.trim()) {
      toast.error('Le motif est obligatoire')
      return
    }

    setLoading(true)

    try {
      const enterpriseId =
        pointagesJournee?.[0]?.enterprise_id ||
        enterpriseIdProp ||
        employeeInfo?.enterprise_id

      const lignesPresumees = pointages.filter(p => p.__estimation)
      const lignesBadges = pointages.filter(p => !p.__estimation)

      const nouveauxPointages = lignesBadges.map(p => {
        let finalDateStr = selectedDate
        if (p.isNextDay) {
          const d = new Date(`${selectedDate}T00:00:00Z`)
          d.setUTCDate(d.getUTCDate() + 1)
          finalDateStr = d.toISOString().split('T')[0]
        }

        return {
          check_type: p.type,
          check_time: heureLocaleVersUTC(finalDateStr, p.heures, p.minutes, p.secondes),
        }
      })

      const TOLERANCE_FUTUR_MS = 10 * 60 * 1000
      const maintenantMs = Date.now()
      const pointageFutur = nouveauxPointages.find(
        p => p.check_time && new Date(p.check_time).getTime() > maintenantMs + TOLERANCE_FUTUR_MS
      )
      if (pointageFutur) {
        toast.error(
          'Refusé : ce pointage serait enregistré dans le futur. ' +
            'Le bouton « J+1 » ajoute un jour à la date affichée — cliquez-le seulement ' +
            'pour un pointage réellement survenu le lendemain après minuit.'
        )
        setLoading(false)
        return
      }

      const idsToDelete = lignesEditables
        .filter(p => !p.__estimation)
        .map(p => p.id)

      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        'replace_attendance_day',
        {
          p_employee_id: employeeId,
          p_enterprise_id: enterpriseId,
          p_delete_ids: idsToDelete,
          p_rows: nouveauxPointages.map(p => ({
            check_type: p.check_type,
            check_time: p.check_time,
          })),
          p_reason: motif.trim(),
        },
      )

      if (rpcError) throw rpcError

      const remplaces = rpcResult?.remplaces ?? 0
      const crees = rpcResult?.crees ?? nouveauxPointages.length
      const photos = rpcResult?.photos_conservees ?? 0

      const idsPresumesAvant = lignesEditables
        .filter(p => p.__estimation)
        .map(p => p.id)

      for (const p of lignesPresumees) {
        let jourFinal = selectedDate
        if (p.isNextDay) {
          const d = new Date(`${selectedDate}T00:00:00Z`)
          d.setUTCDate(d.getUTCDate() + 1)
          jourFinal = d.toISOString().split('T')[0]
        }
        const nouvelleHeure = heureLocaleVersUTC(jourFinal, p.heures, p.minutes, p.secondes)
        if (nouvelleHeure && nouvelleHeure !== p.original_time) {
          const { error: errDeplace } = await supabase.rpc('encheck_estimation_deplacer', {
            p_id: p.id,
            p_heure: nouvelleHeure,
            p_type: p.type,
            p_motif: motif.trim() || null,
          })
          if (errDeplace) throw errDeplace
        }
      }

      const idsPresumesRestants = new Set(lignesPresumees.map(p => p.id))
      for (const id of idsPresumesAvant.filter((id) => !idsPresumesRestants.has(id))) {
        const origine = lignesEditables.find(p => p.id === id)
        const { error: errEcarte } = await supabase.rpc('encheck_estimation_decider', {
          p_id: id,
          p_source: origine?.__sourceId || null,
          p_decision: 'rejeter',
          p_heure_sortie: origine?.check_time || null,
          p_motif: motif.trim() || null,
        })
        if (errEcarte) throw errEcarte
      }

      toast.success(
        `✅ ${crees} pointage${crees > 1 ? 's' : ''} enregistré${crees > 1 ? 's' : ''}` +
          (remplaces > 0 ? ` — ${remplaces} remplacé${remplaces > 1 ? 's' : ''}` : '') +
          (photos > 0 ? `, ${photos} photo${photos > 1 ? 's' : ''} conservée${photos > 1 ? 's' : ''}` : ''),
      )
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error('Erreur modification:', error)
      toast.error('Erreur lors de la modification')
    } finally {
      setLoading(false)
    }
  }

  if (!pointagesJournee) return null

  const fullName =
    `${employeeInfo?.first_name || ''} ${employeeInfo?.last_name || ''}`.trim() ||
    'Collaborateur En-Check'
  const initials =
    `${employeeInfo?.first_name?.[0] || ''}${employeeInfo?.last_name?.[0] || ''}`.toUpperCase() ||
    'EC'
  const matriculeLabel = employeeInfo?.matricule ? `#${employeeInfo.matricule}` : ''
  const formattedDate = selectedDate
    ? new Date(`${selectedDate}T12:00:00`).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : ''
  const capitalizedDate = formattedDate
    ? formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)
    : selectedDate

  if (hasAccess === null) {
    return (
      <div
        className="fiche-v2-overlay"
        data-theme={darkMode ? 'dark' : 'light'}
        onClick={onClose}
      >
        <div
          className="modif-pt-v2-modal"
          style={{ maxWidth: 420, padding: 28, textAlign: 'center', alignItems: 'center' }}
          onClick={(e) => e.stopPropagation()}
        >
          <Clock size={28} color="#F59E0B" />
          <p style={{ margin: '12px 0 0', fontWeight: 700 }}>
            Vérification des permissions…
          </p>
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div
        className="fiche-v2-overlay"
        data-theme={darkMode ? 'dark' : 'light'}
        onClick={onClose}
      >
        <div
          className="modif-pt-v2-modal"
          style={{ maxWidth: 480 }}
          onClick={(e) => e.stopPropagation()}
        >
          <KenteWovenTapestrySvg className="fiche-v2-kente-top" />
          <header className="fiche-v2-header">
            <div className="fiche-v2-header-left">
              <Sparkles size={22} color="#F59E0B" />
              <div className="fiche-v2-header-title">
                <h2>Fonctionnalité Premium</h2>
                <span>Abonnement Pro ou Entreprise requis</span>
              </div>
            </div>
            <button type="button" className="fiche-v2-close-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </header>
          <div className="modif-pt-v2-body">
            <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.5 }}>
              La modification manuelle des heures de pointage avec piste d’audit complète nécessite l’activation du module sur votre entreprise.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { icon: <Edit3 size={15} />, text: 'Modifier les heures d’entrée et de sortie' },
                { icon: <Clock size={15} />, text: 'Contrôle précis heures, minutes, secondes & J+1' },
                { icon: <Plus size={15} />, text: 'Ajouter ou retirer des pointages sur la journée' },
                { icon: <Shield size={15} />, text: 'Traçabilité immuable dans le journal d’audit' },
              ].map((feat, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 12px',
                    borderRadius: 10,
                    border: '1px solid var(--fv-border)',
                    background: 'var(--fv-surface-soft)',
                    fontSize: '0.82rem',
                  }}
                >
                  <span style={{ color: '#F59E0B', display: 'inline-flex' }}>{feat.icon}</span>
                  <span>{feat.text}</span>
                </div>
              ))}
            </div>
          </div>
          <footer className="fiche-v2-footer">
            <button type="button" className="fiche-v2-btn-save" onClick={onClose}>
              <Check size={16} />
              <span>J’ai compris</span>
            </button>
          </footer>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fiche-v2-overlay"
      data-theme={darkMode ? 'dark' : 'light'}
      role="presentation"
      onClick={onClose}
    >
      <section
        className="modif-pt-v2-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Modifier les pointages de ${fullName}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Frise textile africaine Kente */}
        <KenteWovenTapestrySvg className="fiche-v2-kente-top" />

        {/* En-tête de la modale */}
        <header className="fiche-v2-header">
          <div className="fiche-v2-header-left">
            <WovenKenteBadgeSvg variant={4} size={36} />
            <div className="fiche-v2-header-title">
              <h2>Modifier les pointages</h2>
              <span> Ajustement horaire avec traçabilité RH En-Check</span>
            </div>
          </div>
          <button
            type="button"
            className="fiche-v2-close-btn"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
          <div className="modif-pt-v2-body">
            {/* Bandeau récapitulatif de l'employé + Durée calculée en direct */}
            <div className="modif-pt-v2-emp-banner">
              <AdinkraWatermarkSvg className="fiche-v2-watermark" />
              <div className="modif-pt-v2-emp-left">
                <span className="modif-pt-v2-avatar">
                  {employeeInfo?.photo_url ? (
                    <img src={employeeInfo.photo_url} alt={fullName} />
                  ) : (
                    initials
                  )}
                </span>
                <div className="modif-pt-v2-emp-meta">
                  <strong>{fullName}</strong>
                  <span>
                    {matriculeLabel ? `Matricule ${matriculeLabel} · ` : ''}
                    {capitalizedDate}
                  </span>
                </div>
              </div>

              <span className="modif-pt-v2-duration-pill">
                <Clock size={14} />
                <span>Durée calculée : {liveDurationLabel}</span>
              </span>
            </div>

            {/* Section : Pointages de la journée */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <strong style={{ fontSize: '0.86rem', color: 'var(--fv-text)' }}>
                  Pointages de la journée
                </strong>
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    padding: '2px 9px',
                    borderRadius: 999,
                    background: 'rgba(245, 158, 11, 0.14)',
                    color: 'var(--fv-copper)',
                  }}
                >
                  {pointages.length} ligne{pointages.length > 1 ? 's' : ''}
                </span>
              </div>

              {pointages.length === 0 ? (
                <div
                  style={{
                    padding: '18px 14px',
                    textAlign: 'center',
                    borderRadius: 12,
                    border: '1px dashed var(--fv-border)',
                    color: 'var(--fv-muted)',
                    fontSize: '0.82rem',
                    marginBottom: 10,
                  }}
                >
                  Aucun pointage enregistré sur cette journée. Cliquez ci-dessous pour ajouter une Entrée ou une Sortie.
                </div>
              ) : (
                <div className="modif-pt-v2-rows" style={{ marginBottom: 10 }}>
                  {pointages.map((p, index) => (
                    <div key={p.id} className="modif-pt-v2-row">
                      {/* Sélecteur segmenté Entrée / Sortie */}
                      <div className="modif-pt-v2-seg" role="group" aria-label="Type de pointage">
                        <button
                          type="button"
                          className={`modif-pt-v2-seg-btn is-in${p.type === 'in' ? ' is-active' : ''}`}
                          onClick={() => modifierPointage(index, 'type', 'in')}
                        >
                          <LogIn size={13} />
                          <span>Entrée</span>
                        </button>
                        <button
                          type="button"
                          className={`modif-pt-v2-seg-btn is-out${p.type === 'out' ? ' is-active' : ''}`}
                          onClick={() => modifierPointage(index, 'type', 'out')}
                        >
                          <LogOut size={13} />
                          <span>Sortie</span>
                        </button>
                      </div>

                      {/* Saisie HH : MM : SS */}
                      <div className="modif-pt-v2-time-group">
                        <input
                          type="number"
                          min="0"
                          max="23"
                          className="modif-pt-v2-time-input"
                          value={p.heures}
                          onChange={(e) => modifierPointage(index, 'heures', e.target.value)}
                          aria-label="Heures"
                        />
                        <span style={{ fontWeight: 800, color: 'var(--fv-muted)' }}>:</span>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          className="modif-pt-v2-time-input"
                          value={p.minutes}
                          onChange={(e) => modifierPointage(index, 'minutes', e.target.value)}
                          aria-label="Minutes"
                        />
                        <span style={{ fontWeight: 800, color: 'var(--fv-muted)' }}>:</span>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          className="modif-pt-v2-time-input"
                          value={p.secondes}
                          onChange={(e) => modifierPointage(index, 'secondes', e.target.value)}
                          aria-label="Secondes"
                        />
                      </div>

                      {/* Toggle Même jour / Lendemain (J+1) */}
                      <button
                        type="button"
                        className={`modif-pt-v2-day-pill${p.isNextDay ? ' is-next-day' : ''}`}
                        onClick={() => modifierPointage(index, 'isNextDay', !p.isNextDay)}
                        title={
                          p.isNextDay
                            ? 'Pointage effectué le lendemain après minuit (garde de nuit)'
                            : 'Cliquer si ce pointage a eu lieu le lendemain après minuit (J+1)'
                        }
                      >
                        {p.isNextDay ? <Moon size={13} /> : <Sun size={13} />}
                        <span>{p.isNextDay ? 'Lendemain (J+1)' : 'Même jour'}</span>
                      </button>

                      {/* Marque explicite si ligne présumée */}
                      {p.__estimation && (
                        <span
                          style={{
                            fontSize: '0.73rem',
                            fontWeight: 750,
                            padding: '4px 10px',
                            borderRadius: 999,
                            color: p.__estimationEtat === 'validee' ? '#10B981' : '#F59E0B',
                            border: `1px solid ${p.__estimationEtat === 'validee' ? 'rgba(16,185,129,0.4)' : 'rgba(245,158,11,0.4)'}`,
                            background:
                              p.__estimationEtat === 'validee'
                                ? 'rgba(16,185,129,0.12)'
                                : 'rgba(245,158,11,0.12)',
                          }}
                          title="Sortie présumée par le moteur : la supprimer équivaut à l'écarter"
                        >
                          {p.__estimationEtat === 'validee'
                            ? '✅ Sortie présumée validée'
                            : '⏳ Sortie présumée — à statuer'}
                        </span>
                      )}

                      {/* Supprimer la ligne */}
                      <button
                        type="button"
                        className="modif-pt-v2-del-btn"
                        onClick={() => supprimerPointage(index)}
                        title="Supprimer cette ligne de pointage"
                        aria-label="Supprimer cette ligne de pointage"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Bouton + Ajouter un pointage */}
              <button
                type="button"
                className="modif-pt-v2-add-btn"
                onClick={ajouterPointage}
              >
                <Plus size={16} />
                <span>+ Ajouter un pointage (Entrée ou Sortie)</span>
              </button>
            </div>

            {/* Motif obligatoire + Puces rapides */}
            <div className="fiche-v2-field">
              <label style={{ color: 'var(--fv-copper)' }}>
                Motif de la modification *
              </label>
              <input
                type="text"
                required
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Indiquez la raison de cet ajustement (obligatoire pour l’audit RH)…"
              />
              <div className="modif-pt-v2-reason-chips">
                {MOTIFS_RAPIDES.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className={`modif-pt-v2-reason-chip${motif === chip ? ' is-active' : ''}`}
                    onClick={() => setMotif(chip)}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Journal des modifications (Audit Trail) */}
            <JournalPointage employeeId={employeeId} date={selectedDate} />
          </div>

          {/* Pied de modale */}
          <footer className="fiche-v2-footer">
            <button
              type="button"
              className="fiche-v2-btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="fiche-v2-btn-save"
              disabled={loading || !motif.trim()}
            >
              <Save size={16} />
              <span>
                {loading ? 'Enregistrement…' : 'Enregistrer les modifications'}
              </span>
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
