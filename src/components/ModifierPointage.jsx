// ═══════════════════════════════════════════════════════════
// ✏️ MODAL MODIFICATION POINTAGE - AFROFUTURISTE (AVEC NUIT & AUDIT)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import FeatureService, { FEATURES } from '../services/featureService'
import JournalPointage from './JournalPointage'
import { utcVersHeureLocale, heureLocaleVersUTC } from '../utils/timezoneUtils'
import { 
  Clock, X, Sparkles, AlertTriangle, Plus, Trash2, 
  Shield, Zap, Check, ChevronDown, Edit3, Save,
  LogIn, LogOut, Moon
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function ModifierPointage({ employeeId, selectedDate, pointagesJournee, onClose, onSuccess }) {
  const [hasAccess, setHasAccess] = useState(null)
  const [loading, setLoading] = useState(false)
  const [pointages, setPointages] = useState([])
  const [motif, setMotif] = useState('')
  // `admin` (localStorage) n'est plus utilisé pour l'écriture : voir handleSubmit.

  useEffect(() => {
    
    if (pointagesJournee && pointagesJournee.length > 0) {
      checkAccess(pointagesJournee[0].enterprise_id)
      initPointages()
    }
  }, [pointagesJournee])

  const checkAccess = async (enterpriseId) => {
    const access = await FeatureService.hasFeature(
      enterpriseId,
      FEATURES.MODIFICATION_POINTAGES
    )
    setHasAccess(access)
  }

  const initPointages = () => {
    const formatted = pointagesJournee.map(p => {
      // ⭐ LIVRAISON 04 : l'administrateur doit voir l'heure LOCALE de son
      // entreprise, pas l'heure UTC. Un pointage de 08:00 à Cotonou était
      // affiché « 07:00 » dans ce formulaire.
      const { heures, minutes, secondes, jourISO } = utcVersHeureLocale(p.check_time)

      // Le décalage « J+1 » (travail de nuit) se compare en jours LOCAUX :
      // sur le jour UTC, un pointage de fin de soirée basculerait de date.
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
        original_time: p.check_time // Pour l'audit log
      }
    })
    
    setPointages(formatted.sort((a, b) => {
      // Tri en prenant en compte le J+1
      const dayOffsetA = a.isNextDay ? 1 : 0
      const dayOffsetB = b.isNextDay ? 1 : 0
      
      if (dayOffsetA !== dayOffsetB) return dayOffsetA - dayOffsetB
      
      const timeA = `${a.heures}:${a.minutes}:${a.secondes}`
      const timeB = `${b.heures}:${b.minutes}:${b.secondes}`
      return timeA.localeCompare(timeB)
    }))
  }

  const ajouterPointage = () => {
    setPointages([...pointages, {
      id: `new_${Date.now()}`,
      type: 'in',
      date: selectedDate,
      heures: '08',
      minutes: '00',
      secondes: '00',
      isNextDay: false, // Par défaut le même jour
      isExisting: false
    }])
  }

  const supprimerPointage = (index) => {
    setPointages(pointages.filter((_, i) => i !== index))
  }

  const modifierPointage = (index, field, value) => {
    const updated = [...pointages]
    
    if (field === 'heures' && (value < 0 || value > 23)) return
    if ((field === 'minutes' || field === 'secondes') && (value < 0 || value > 59)) return
    
    // Si on toggle le jour (même jour vs lendemain) ou le type (in/out)
    if (field === 'isNextDay' || field === 'type') {
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
      const enterpriseId = pointagesJournee[0].enterprise_id

      // 1. Préparer les nouvelles données (avec gestion du J+1)
      const nouveauxPointages = pointages.map(p => {
        // « Lendemain » coché : on décale le JOUR du calendrier, sans jamais
        // passer par un objet Date local (aucun risque de saut d'heure).
        let finalDateStr = selectedDate
        if (p.isNextDay) {
          const d = new Date(`${selectedDate}T00:00:00Z`)
          d.setUTCDate(d.getUTCDate() + 1)
          finalDateStr = d.toISOString().split('T')[0]
        }

        return {
          // ⚠️ `modifie_le` et `modifie_par` ne sont plus envoyés par le
          // navigateur : le serveur les renseigne lui-même (now() et
          // l'administrateur déduit du JWT). Un auteur déclaré par le client
          // n'a aucune valeur probante.
          check_type: p.type,
          // ⭐ LIVRAISON 04 : l'heure saisie est une heure LOCALE de
          // l'entreprise. On la convertit vers l'instant UTC réellement
          // stocké en base. Avant, on collait « +00:00 » dessus : corriger un
          // pointage à 08:00 le déplaçait à 07:00, c'est-à-dire qu'on créait
          // le décalage qu'on cherchait à corriger.
          check_time: heureLocaleVersUTC(finalDateStr, p.heures, p.minutes, p.secondes),
        }
      })

      // ═══════════════════════════════════════════════════════════════════
      // 2 → 5 : UN SEUL APPEL SERVEUR, ATOMIQUE (livraison 03)
      // ═══════════════════════════════════════════════════════════════════
      // AVANT : un DELETE puis un INSERT, séparés par un aller-retour réseau.
      //   Conséquences constatées :
      //     • les photos de pointage (liées par une clé étrangère en CASCADE)
      //       étaient DÉTRUITES — la preuve disparaissait au moment où on la
      //       contestait ;
      //     • si l'INSERT échouait, la journée entière était perdue (le DELETE
      //       était déjà validé) ;
      //     • l'auteur de la modification venait du localStorage, donc
      //       modifiable dans le navigateur.
      //
      // MAINTENANT : tout se joue dans UNE transaction PostgreSQL.
      //   • soit tout réussit, soit rien ne change : la journée est toujours
      //     dans un état cohérent ;
      //   • les photos survivent et gardent leur sens (employé + heure
      //     recopiés sur la photo) ;
      //   • chaque suppression et chaque création est écrite dans
      //     `attendance_history`, une table en lecture seule que personne ne
      //     peut modifier ni supprimer depuis l'application ;
      //   • l'auteur (`admin`) est déduit du JWT côté serveur, pas du
      //     navigateur.
      const idsToDelete = pointagesJournee.map(p => p.id)

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

  // Chargement
  if (hasAccess === null) {
    return (
      <>
        <style>{modalStyles}</style>
        <div className="modal-overlay" style={styles.overlay}>
          <div className="modal-content" style={styles.loadingModal}>
            <div style={styles.loadingSpinner}></div>
            <p style={styles.loadingText}>Vérification des permissions...</p>
          </div>
        </div>
      </>
    )
  }

  // Pas d'accès : Modal Premium
  if (!hasAccess) {
    return (
      <>
        <style>{modalStyles}</style>
        <div className="modal-overlay" style={styles.overlay} onClick={onClose}>
          <div className="modal-content" style={styles.premiumModal} onClick={(e) => e.stopPropagation()}>
            <button onClick={onClose} className="close-btn" style={styles.closeBtn}>
              <X size={20} />
            </button>

            <div style={styles.premiumHeader}>
              <div style={styles.premiumIconWrap}>
                <div style={styles.premiumIconGlow}></div>
                <Sparkles size={32} color="#F59E0B" />
              </div>
              <h2 style={styles.premiumTitle}>Fonctionnalité Premium</h2>
              <p style={styles.premiumSubtitle}>
                La modification des pointages nécessite un abonnement Pro ou Entreprise
              </p>
            </div>

            <div style={styles.premiumFeatures}>
              {[
                { icon: <Edit3 size={16} />, text: 'Modifier les heures de pointage' },
                { icon: <Clock size={16} />, text: 'Contrôle heures, minutes, secondes' },
                { icon: <Plus size={16} />, text: 'Ajouter / Supprimer des pointages' },
                { icon: <Shield size={16} />, text: 'Traçabilité complète des modifications' },
              ].map((feature, i) => (
                <div key={i} style={styles.premiumFeatureItem}>
                  <div style={styles.premiumFeatureIcon}>{feature.icon}</div>
                  <span style={styles.premiumFeatureText}>{feature.text}</span>
                </div>
              ))}
            </div>

            <div style={styles.premiumFooter}>
              <p style={styles.premiumContactText}>
                Contactez votre administrateur système pour activer cette fonctionnalité
              </p>
              <button onClick={onClose} style={styles.premiumOkBtn}>
                <Check size={18} />
                J'ai compris
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  // A accès : Formulaire de modification
  return (
    <>
      <style>{modalStyles}</style>
      <div className="modal-overlay" style={styles.overlay} onClick={onClose}>
        <div className="modal-content" style={styles.modal} onClick={(e) => e.stopPropagation()}>
          <button onClick={onClose} className="close-btn" style={styles.closeBtn}>
            <X size={20} />
          </button>

          {/* Header */}
          <div style={styles.header}>
            <div style={styles.headerIcon}>
              <Clock size={24} color="#F59E0B" />
            </div>
            <div>
              <h2 style={styles.title}>Modifier les pointages</h2>
              <p style={styles.subtitle}>
                {new Date(selectedDate).toLocaleDateString('fr-FR', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                })}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            {/* Liste des pointages */}
            <div style={styles.pointagesSection}>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionTitle}>Pointages de la journée</span>
                <span style={styles.sectionCount}>{pointages.length}</span>
              </div>

              <div style={styles.pointagesList}>
                {pointages.map((p, index) => (
                  <div 
                    key={p.id} 
                    className="pointage-row"
                    style={{
                      ...styles.pointageRow,
                      borderLeftColor: p.type === 'in' ? '#10B981' : '#F59E0B',
                    }}
                  >
                    {/* Type Badge */}
                    <div style={styles.typeBadgeWrap}>
                      <button
                        type="button"
                        onClick={() => modifierPointage(index, 'type', p.type === 'in' ? 'out' : 'in')}
                        style={{
                          ...styles.typeBadge,
                          background: p.type === 'in' 
                            ? 'rgba(16, 185, 129, 0.12)' 
                            : 'rgba(245, 158, 11, 0.12)',
                          color: p.type === 'in' ? '#10B981' : '#F59E0B',
                          borderColor: p.type === 'in' 
                            ? 'rgba(16, 185, 129, 0.25)' 
                            : 'rgba(245, 158, 11, 0.25)',
                        }}
                      >
                        {p.type === 'in' ? <LogIn size={14} /> : <LogOut size={14} />}
                        <span>{p.type === 'in' ? 'Entrée' : 'Sortie'}</span>
                        <ChevronDown size={12} style={{ opacity: 0.5 }} />
                      </button>
                    </div>

                    {/* Time Inputs */}
                    <div style={styles.timeInputsWrap}>
                      <div style={styles.timeFieldGroup}>
                        <label style={styles.timeFieldLabel}>H</label>
                        <input
                          type="number"
                          min="0"
                          max="23"
                          value={p.heures}
                          onChange={(e) => modifierPointage(index, 'heures', e.target.value)}
                          style={styles.timeInput}
                        />
                      </div>
                      <span style={styles.timeSeparator}>:</span>
                      <div style={styles.timeFieldGroup}>
                        <label style={styles.timeFieldLabel}>M</label>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          value={p.minutes}
                          onChange={(e) => modifierPointage(index, 'minutes', e.target.value)}
                          style={styles.timeInput}
                        />
                      </div>
                      <span style={styles.timeSeparator}>:</span>
                      <div style={styles.timeFieldGroup}>
                        <label style={styles.timeFieldLabel}>S</label>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          value={p.secondes}
                          onChange={(e) => modifierPointage(index, 'secondes', e.target.value)}
                          style={styles.timeInput}
                        />
                      </div>
                    </div>

                    {/* Toggle Jour +1 (Travail de nuit) */}
                    <div style={styles.nextDayToggleWrap}>
                      <button
                        type="button"
                        onClick={() => modifierPointage(index, 'isNextDay', !p.isNextDay)}
                        style={{
                          ...styles.nextDayToggle,
                          background: p.isNextDay ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                          color: p.isNextDay ? '#6366F1' : '#666',
                          borderColor: p.isNextDay ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255,255,255,0.1)',
                        }}
                        title={
                          p.isNextDay
                            ? 'Lendemain (J+1) activé — cliquez pour remettre au jour même (Jour J)'
                            : 'Jour même (Jour J) — cliquez si ce pointage a eu lieu le lendemain après minuit (J+1)'
                        }
                      >
                        <Moon size={14} />
                        <span style={styles.nextDayText}>{p.isNextDay ? 'J+1' : 'Jour J'}</span>
                      </button>
                    </div>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => supprimerPointage(index)}
                      className="delete-row-btn"
                      style={styles.deleteRowBtn}
                      title="Supprimer ce pointage"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}

                {pointages.length === 0 && (
                  <div style={styles.emptyPointages}>
                    <Clock size={32} color="#555" />
                    <p>Aucun pointage</p>
                  </div>
                )}
              </div>

              {/* Add Button */}
              <button
                type="button"
                onClick={ajouterPointage}
                className="add-btn"
                style={styles.addBtn}
              >
                <Plus size={18} />
                <span>Ajouter un pointage</span>
              </button>
            </div>

            {/* Motif */}
            <div style={styles.motifSection}>
              <label style={styles.motifLabel}>
                <AlertTriangle size={14} color="#F59E0B" />
                Motif de la modification *
              </label>
              <textarea
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                style={styles.motifTextarea}
                rows="2"
                placeholder="Ex: Oubli de sortie de l'employé"
                required
              />
            </div>

            {/* Warning */}
            <div style={styles.warningBox}>
              <AlertTriangle size={18} color="#F59E0B" style={{flexShrink:0}}/>
              <p style={styles.warningText}>
                Cette action remplace les anciens pointages. Elle est enregistrée dans le journal ci-dessous,
                avec votre nom et l'heure du geste — et signalée dans la cloche.
              </p>
            </div>

            {/* Le journal de la journée : qui a écrit, modifié ou supprimé quoi */}
            <JournalPointage
              pointageIds={(pointages || []).filter((p) => p.isExisting && p.id).map((p) => p.id)}
              employeeId={employeeId}
              jour={selectedDate}
            />

            {/* Buttons */}
            <div style={styles.buttonsRow}>
              <button 
                type="button" 
                onClick={onClose} 
                style={styles.cancelBtn}
                disabled={loading}
              >
                Annuler
              </button>
              <button 
                type="submit" 
                className="submit-btn"
                style={styles.submitBtn}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div style={styles.btnSpinner}></div>
                    <span>Enregistrement...</span>
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    <span>Enregistrer</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════
// 🎨 CSS ANIMATIONS & STYLES (Identiques, avec ajout bouton J+1)
// ═══════════════════════════════════════════════════════════

const modalStyles = `
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(30px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 0%, 100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.1); } }
  .modal-overlay { animation: fadeIn 0.25s ease; }
  .modal-content { animation: slideUp 0.35s cubic-bezier(0.4, 0, 0.2, 1); }
  .close-btn:hover { background: rgba(239, 68, 68, 0.15) !important; color: #EF4444 !important; }
  .pointage-row { transition: all 0.2s ease; }
  .pointage-row:hover { background: rgba(255, 255, 255, 0.04) !important; }
  .delete-row-btn:hover { background: rgba(239, 68, 68, 0.15) !important; color: #EF4444 !important; transform: scale(1.1); }
  .add-btn:hover { background: rgba(16, 185, 129, 0.12) !important; border-color: rgba(16, 185, 129, 0.4) !important; }
  .submit-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(245, 158, 11, 0.35); }
  input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  input[type="number"] { -moz-appearance: textfield; }
  textarea:focus, input:focus { border-color: rgba(245, 158, 11, 0.5) !important; box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1) !important; }
`

const styles = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(6, 6, 12, 0.92)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' },
  loadingModal: { background: '#0F0F18', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)', padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' },
  loadingSpinner: { width: '32px', height: '32px', border: '3px solid rgba(245, 158, 11, 0.2)', borderTopColor: '#F59E0B', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  loadingText: { color: '#888', fontSize: '14px', margin: 0 },
  premiumModal: { background: '#0F0F18', borderRadius: '24px', border: '1px solid rgba(245, 158, 11, 0.15)', maxWidth: '440px', width: '100%', padding: '32px', position: 'relative', boxShadow: '0 30px 80px rgba(0,0,0,0.5)' },
  premiumHeader: { textAlign: 'center', marginBottom: '24px' },
  premiumIconWrap: { position: 'relative', width: '72px', height: '72px', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '20px', border: '1px solid rgba(245, 158, 11, 0.2)' },
  premiumIconGlow: { position: 'absolute', inset: '-10px', borderRadius: '30px', background: 'radial-gradient(circle, rgba(245, 158, 11, 0.15), transparent 70%)', animation: 'pulse 3s ease-in-out infinite' },
  premiumTitle: { color: '#FFFFFF', fontSize: '22px', fontWeight: '700', margin: '0 0 8px 0' },
  premiumSubtitle: { color: '#888', fontSize: '14px', margin: 0, lineHeight: '1.5' },
  premiumFeatures: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '20px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)', marginBottom: '24px' },
  premiumFeatureItem: { display: 'flex', alignItems: 'center', gap: '12px' },
  premiumFeatureIcon: { width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  premiumFeatureText: { color: '#E5E5E5', fontSize: '14px', fontWeight: '500' },
  premiumFooter: { textAlign: 'center' },
  premiumContactText: { color: '#666', fontSize: '12px', marginBottom: '16px' },
  premiumOkBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '14px', background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#000', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '700', cursor: 'pointer' },
  modal: { background: '#0F0F18', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.08)', maxWidth: '600px', width: '100%', maxHeight: '90vh', overflow: 'auto', position: 'relative', padding: '24px', boxShadow: '0 30px 80px rgba(0,0,0,0.5)' },
  closeBtn: { position: 'absolute', top: '16px', right: '16px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#888', zIndex: 10, transition: 'all 0.2s ease' },
  header: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px', paddingRight: '50px' },
  headerIcon: { width: '50px', height: '50px', borderRadius: '14px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { color: '#FFFFFF', fontSize: '20px', fontWeight: '700', margin: 0 },
  subtitle: { color: '#F59E0B', fontSize: '13px', margin: '4px 0 0 0', textTransform: 'capitalize' },
  form: { display: 'flex', flexDirection: 'column', gap: '20px' },
  pointagesSection: { display: 'flex', flexDirection: 'column', gap: '12px' },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#888', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' },
  sectionCount: { background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '10px' },
  pointagesList: { display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflow: 'auto', padding: '4px' },
  pointageRow: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', padding: '12px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.05)', borderLeft: '3px solid' },
  typeBadgeWrap: { flex: '0 0 auto' },
  typeBadge: { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', borderRadius: '10px', border: '1px solid', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },
  timeInputsWrap: { display: 'flex', alignItems: 'center', gap: '4px', flex: '0 0 auto' },
  timeFieldGroup: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' },
  timeFieldLabel: { fontSize: '9px', color: '#666', fontWeight: '600', textTransform: 'uppercase' },
  timeInput: { width: '40px', padding: '8px 4px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', fontSize: '15px', fontWeight: '700', fontFamily: "'SF Mono', 'Fira Code', monospace", textAlign: 'center', color: '#FFFFFF', outline: 'none' },
  timeSeparator: { fontSize: '18px', fontWeight: '300', color: '#555', marginTop: '12px' },
  
  // NOUVEAU STYLE : Bouton J+1
  nextDayToggleWrap: { flex: '1 1 auto', display: 'flex', justifyContent: 'center' },
  nextDayToggle: { display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '8px', border: '1px solid', cursor: 'pointer', transition: 'all 0.2s' },
  nextDayText: { fontSize: '11px', fontWeight: '700' },

  deleteRowBtn: { background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '8px', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  emptyPointages: { textAlign: 'center', padding: '40px 20px', color: '#555' },
  addBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', background: 'rgba(16, 185, 129, 0.06)', color: '#10B981', border: '2px dashed rgba(16, 185, 129, 0.25)', borderRadius: '14px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' },
  motifSection: { display: 'flex', flexDirection: 'column', gap: '8px' },
  motifLabel: { display: 'flex', alignItems: 'center', gap: '8px', color: '#888', fontSize: '13px', fontWeight: '600' },
  motifTextarea: { padding: '14px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', fontSize: '14px', color: '#E5E5E5', outline: 'none', resize: 'vertical', fontFamily: 'inherit', minHeight: '60px' },
  warningBox: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.15)', borderRadius: '12px' },
  warningText: { fontSize: '12px', color: '#F59E0B', margin: 0, lineHeight: '1.4', flex: 1 },
  buttonsRow: { display: 'flex', gap: '12px', flexDirection: 'column' },
  cancelBtn: { flex: 1, padding: '14px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#E5E5E5', borderRadius: '12px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' },
  submitBtn: { flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '14px', background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#000', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '700', cursor: 'pointer' },
  btnSpinner: { width: '18px', height: '18px', border: '2px solid rgba(0, 0, 0, 0.2)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
}

if (typeof window !== 'undefined' && window.innerWidth > 768) {
  Object.assign(styles, {
    buttonsRow: { ...styles.buttonsRow, flexDirection: 'row' },
  })
}