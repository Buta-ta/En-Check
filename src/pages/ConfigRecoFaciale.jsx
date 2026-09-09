// ═══════════════════════════════════════════════════════════
// 🤖 PAGE CONFIGURATION RECONNAISSANCE FACIALE
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import {
  Save, Settings, Shield, AlertTriangle,
  CheckCircle2, Info, ChevronDown
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function ConfigRecoFaciale() {
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [enterpriseId, setEnterpriseId] = useState(null)
  const [enterpriseName, setEnterpriseName] = useState('')

  const [config, setConfig] = useState({
    confidence_threshold: 0.80,
    liveness_required: true,
    admin_approval_required: true,
    fallback_allowed: true,
    max_attempts: 3,
    kiosk_mode_enabled: false,
    pointage_mode: 'free',
  })

  useEffect(() => {
    const adminData = JSON.parse(localStorage.getItem('admin') || '{}')
    setAdmin(adminData)

    const selectedId = localStorage.getItem('selected_enterprise_id')
    const entId = selectedId ||
      adminData.selectedEnterprise?.id ||
      adminData.enterprise_id

    const entName = adminData.selectedEnterprise?.name ||
      adminData.enterprise_name || ''

    setEnterpriseName(entName)

    if (entId) {
      setEnterpriseId(entId)
      loadConfig(entId)
    } else {
      setLoading(false)
    }
  }, [])

  // ═══════════════════════════════════════════════════════════
  // 📊 CHARGER LA CONFIG
  // ═══════════════════════════════════════════════════════════

  const loadConfig = async (entId) => {
    try {
      const { data } = await supabase
        .from('face_recognition_config')
        .select('*')
        .eq('enterprise_id', entId)
        .maybeSingle()

      if (data) {
        setConfig({
          confidence_threshold: data.confidence_threshold ?? 0.80,
          liveness_required: data.liveness_required ?? true,
          admin_approval_required: data.admin_approval_required ?? true,
          fallback_allowed: data.fallback_allowed ?? true,
          max_attempts: data.max_attempts ?? 3,
          kiosk_mode_enabled: data.kiosk_mode_enabled ?? false,
          pointage_mode: data.pointage_mode ?? 'free',
        })
      }
    } catch (err) {
      console.error('Erreur chargement config:', err)
    }
    setLoading(false)
  }

  // ═══════════════════════════════════════════════════════════
  // 💾 SAUVEGARDER LA CONFIG
  // ═══════════════════════════════════════════════════════════

  const sauvegarder = async () => {
    if (!enterpriseId) return
    setSaving(true)

    try {
      const dataToSave = {
        enterprise_id: enterpriseId,
        ...config,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('face_recognition_config')
        .upsert(dataToSave, { onConflict: 'enterprise_id' })

      if (error) throw error
      toast.success('Configuration sauvegardée')
    } catch (err) {
      console.error('Erreur sauvegarde:', err)
      toast.error('Erreur lors de la sauvegarde')
    }
    setSaving(false)
  }

  // ═══════════════════════════════════════════════════════════
  // 🖥️ RENDER
  // ═══════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0A0A0F',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <p style={{ color: '#888' }}>Chargement...</p>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <PageHeader
        title="Configuration Reconnaissance Faciale"
        subtitle="Paramètres du module de pointage biométrique"
      />

      {/* BANDEAU ENTREPRISE */}
      {enterpriseName && (
        <div style={styles.banner}>
          <Shield size={16} color="#6366F1" />
          <span style={styles.bannerName}>{enterpriseName}</span>
        </div>
      )}

      <div style={styles.grid}>

        {/* ═══ SÉCURITÉ ═══ */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <Shield size={18} color="#6366F1" />
            <h3 style={styles.sectionTitle}>Sécurité</h3>
          </div>

          {/* Seuil de confiance */}
          <div style={styles.field}>
            <div style={styles.fieldHeader}>
              <label style={styles.label}>
                Seuil de confiance
              </label>
              <span style={styles.valueDisplay}>
                {(config.confidence_threshold * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0.60"
              max="0.95"
              step="0.01"
              value={config.confidence_threshold}
              onChange={e => setConfig({
                ...config,
                confidence_threshold: parseFloat(e.target.value)
              })}
              style={styles.slider}
            />
            <div style={styles.sliderLabels}>
              <span style={{ color: '#10B981' }}>60% — Souple</span>
              <span style={{ color: '#F59E0B' }}>80% — Recommandé</span>
              <span style={{ color: '#EF4444' }}>95% — Strict</span>
            </div>
            <div style={styles.info}>
              <Info size={14} color="#888" />
              <span>
                Score minimum pour valider une reconnaissance.
                Plus élevé = plus sécurisé mais plus de faux rejets.
              </span>
            </div>
          </div>

          {/* Liveness */}
          <div style={styles.field}>
            <div style={styles.toggleRow}>
              <div>
                <label style={styles.label}>Liveness obligatoire</label>
                <p style={styles.fieldDesc}>
                  Vérifie que c'est un vrai visage (pas une photo ou un écran)
                </p>
              </div>
              <label style={styles.toggle}>
                <input
                  type="checkbox"
                  checked={config.liveness_required}
                  onChange={e => setConfig({
                    ...config, liveness_required: e.target.checked
                  })}
                  style={{ display: 'none' }}
                />
                <div style={{
                  ...styles.toggleTrack,
                  background: config.liveness_required ? '#6366F1' : 'rgba(255,255,255,0.1)',
                }}>
                  <div style={{
                    ...styles.toggleThumb,
                    transform: config.liveness_required
                      ? 'translateX(20px)'
                      : 'translateX(2px)',
                  }} />
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* ═══ ENRÔLEMENT ═══ */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <CheckCircle2 size={18} color="#10B981" />
            <h3 style={styles.sectionTitle}>Enrôlement</h3>
          </div>

          {/* Validation admin */}
          <div style={styles.field}>
            <div style={styles.toggleRow}>
              <div>
                <label style={styles.label}>
                  Validation admin requise
                </label>
                <p style={styles.fieldDesc}>
                  Chaque nouvel enrôlement doit être approuvé avant utilisation
                </p>
              </div>
              <label style={styles.toggle}>
                <input
                  type="checkbox"
                  checked={config.admin_approval_required}
                  onChange={e => setConfig({
                    ...config, admin_approval_required: e.target.checked
                  })}
                  style={{ display: 'none' }}
                />
                <div style={{
                  ...styles.toggleTrack,
                  background: config.admin_approval_required
                    ? '#10B981'
                    : 'rgba(255,255,255,0.1)',
                }}>
                  <div style={{
                    ...styles.toggleThumb,
                    transform: config.admin_approval_required
                      ? 'translateX(20px)'
                      : 'translateX(2px)',
                  }} />
                </div>
              </label>
            </div>
          </div>

          {/* Mode borne */}
          <div style={styles.field}>
            <div style={styles.toggleRow}>
              <div>
                <label style={styles.label}>
                  Mode borne (tablette partagée)
                </label>
                <p style={styles.fieldDesc}>
                  Active le mode pour un appareil commun à tous les employés.
                  Les vecteurs de tous les employés sont téléchargés en local.
                </p>
              </div>
              <label style={styles.toggle}>
                <input
                  type="checkbox"
                  checked={config.kiosk_mode_enabled}
                  onChange={e => setConfig({
                    ...config, kiosk_mode_enabled: e.target.checked
                  })}
                  style={{ display: 'none' }}
                />
                <div style={{
                  ...styles.toggleTrack,
                  background: config.kiosk_mode_enabled
                    ? '#F59E0B'
                    : 'rgba(255,255,255,0.1)',
                }}>
                  <div style={{
                    ...styles.toggleThumb,
                    transform: config.kiosk_mode_enabled
                      ? 'translateX(20px)'
                      : 'translateX(2px)',
                  }} />
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* ═══ EN CAS D'ÉCHEC ═══ */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <AlertTriangle size={18} color="#F59E0B" />
            <h3 style={styles.sectionTitle}>En cas d'échec</h3>
          </div>

          {/* Max tentatives */}
          <div style={styles.field}>
            <div style={styles.fieldHeader}>
              <label style={styles.label}>
                Tentatives avant fallback
              </label>
              <div style={styles.numberInput}>
                <button
                  onClick={() => setConfig({
                    ...config,
                    max_attempts: Math.max(1, config.max_attempts - 1)
                  })}
                  style={styles.numberBtn}
                >
                  −
                </button>
                <span style={styles.numberValue}>{config.max_attempts}</span>
                <button
                  onClick={() => setConfig({
                    ...config,
                    max_attempts: Math.min(10, config.max_attempts + 1)
                  })}
                  style={styles.numberBtn}
                >
                  +
                </button>
              </div>
            </div>
            <div style={styles.info}>
              <Info size={14} color="#888" />
              <span>
                Nombre d'essais avant de proposer un autre mode de pointage
              </span>
            </div>
          </div>

          {/* Fallback autorisé */}
          <div style={styles.field}>
            <div style={styles.toggleRow}>
              <div>
                <label style={styles.label}>Fallback autorisé</label>
                <p style={styles.fieldDesc}>
                  Si activé, l'employé peut pointer par PIN ou QR Code
                  après les tentatives échouées.
                  Si désactivé, aucun pointage sans reconnaissance réussie.
                </p>
              </div>
              <label style={styles.toggle}>
                <input
                  type="checkbox"
                  checked={config.fallback_allowed}
                  onChange={e => setConfig({
                    ...config, fallback_allowed: e.target.checked
                  })}
                  style={{ display: 'none' }}
                />
                <div style={{
                  ...styles.toggleTrack,
                  background: config.fallback_allowed
                    ? '#10B981'
                    : 'rgba(255,255,255,0.1)',
                }}>
                  <div style={{
                    ...styles.toggleThumb,
                    transform: config.fallback_allowed
                      ? 'translateX(20px)'
                      : 'translateX(2px)',
                  }} />
                </div>
              </label>
            </div>

            {/* Avertissement si fallback désactivé */}
            {!config.fallback_allowed && (
              <div style={styles.warning}>
                <AlertTriangle size={16} color="#F59E0B" />
                <span>
                  Sans fallback, les employés non reconnus ne pourront
                  pas pointer du tout. À utiliser avec précaution.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ═══ MODE DE POINTAGE ═══ */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <Settings size={18} color="#EC4899" />
            <h3 style={styles.sectionTitle}>Mode de pointage</h3>
          </div>

          <div style={styles.field}>
            <p style={styles.fieldDesc}>
              Définit comment la reconnaissance faciale s'intègre
              dans le flux de pointage.
            </p>

            <div style={styles.modeOptions}>
              {[
                {
                  value: 'free',
                  label: 'Libre',
                  desc: 'L\'employé choisit son mode (PIN, QR ou Visage)',
                  color: '#10B981',
                },
                {
                  value: 'face_required',
                  label: 'Visage obligatoire',
                  desc: 'La reconnaissance faciale est le mode principal. Fallback possible si échec.',
                  color: '#F59E0B',
                },
                {
                  value: 'face_exclusive',
                  label: 'Visage exclusif',
                  desc: 'Uniquement par reconnaissance faciale. Aucun fallback.',
                  color: '#EF4444',
                },
              ].map(option => (
                <label
                  key={option.value}
                  style={{
                    ...styles.modeOption,
                    borderColor: config.pointage_mode === option.value
                      ? option.color
                      : 'rgba(255,255,255,0.06)',
                    background: config.pointage_mode === option.value
                      ? `${option.color}10`
                      : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="pointage_mode"
                    value={option.value}
                    checked={config.pointage_mode === option.value}
                    onChange={() => setConfig({
                      ...config, pointage_mode: option.value
                    })}
                    style={{ display: 'none' }}
                  />
                  <div style={{
                    ...styles.radioIndicator,
                    borderColor: option.color,
                    background: config.pointage_mode === option.value
                      ? option.color
                      : 'transparent',
                  }} />
                  <div>
                    <div style={{
                      ...styles.modeLabel,
                      color: config.pointage_mode === option.value
                        ? option.color
                        : '#E5E5E5',
                    }}>
                      {option.label}
                    </div>
                    <div style={styles.modeDesc}>{option.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* BOUTON SAUVEGARDER */}
      <div style={styles.footer}>
        <button
          onClick={sauvegarder}
          disabled={saving}
          style={styles.saveBtn}
        >
          <Save size={18} />
          {saving ? 'Sauvegarde...' : 'Enregistrer la configuration'}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// 🎨 STYLES
// ═══════════════════════════════════════════════════════════

const styles = {
  container: {
    padding: '30px',
    minHeight: '100vh',
    background: '#0A0A0F',
  },
  banner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'rgba(99,102,241,0.08)',
    border: '1px solid rgba(99,102,241,0.2)',
    borderRadius: '12px',
    padding: '10px 16px',
    marginBottom: '24px',
  },
  bannerName: {
    color: '#6366F1',
    fontSize: '14px',
    fontWeight: '600',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))',
    gap: '20px',
    marginBottom: '24px',
  },
  section: {
    background: 'rgba(20,20,35,0.8)',
    backdropFilter: 'blur(10px)',
    borderRadius: '20px',
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '24px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: '16px',
    fontWeight: '700',
    margin: 0,
  },
  field: {
    marginBottom: '24px',
  },
  fieldHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  label: {
    display: 'block',
    color: '#E5E5E5',
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '4px',
  },
  fieldDesc: {
    color: '#666',
    fontSize: '13px',
    margin: '4px 0 12px 0',
    lineHeight: '1.5',
  },
  valueDisplay: {
    color: '#6366F1',
    fontSize: '20px',
    fontWeight: '700',
  },
  slider: {
    width: '100%',
    height: '8px',
    borderRadius: '5px',
    outline: 'none',
    cursor: 'pointer',
    accentColor: '#6366F1',
    marginBottom: '8px',
  },
  sliderLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    fontWeight: '600',
    marginBottom: '8px',
  },
  info: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.04)',
  },
  toggleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
  },
  toggle: {
    cursor: 'pointer',
    flexShrink: 0,
  },
  toggleTrack: {
    width: '44px',
    height: '24px',
    borderRadius: '12px',
    position: 'relative',
    transition: 'background 0.3s ease',
  },
  toggleThumb: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: '#FFFFFF',
    position: 'absolute',
    top: '2px',
    transition: 'transform 0.3s ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  },
  warning: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '10px 14px',
    background: 'rgba(245,158,11,0.08)',
    borderRadius: '10px',
    border: '1px solid rgba(245,158,11,0.2)',
    color: '#F59E0B',
    fontSize: '13px',
    marginTop: '10px',
    lineHeight: '1.5',
  },
  numberInput: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    padding: '4px',
  },
  numberBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.06)',
    border: 'none',
    color: '#E5E5E5',
    fontSize: '20px',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberValue: {
    color: '#FFFFFF',
    fontSize: '20px',
    fontWeight: '700',
    minWidth: '32px',
    textAlign: 'center',
  },
  modeOptions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  modeOption: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
    padding: '16px',
    borderRadius: '14px',
    border: '1px solid',
    transition: 'all 0.2s ease',
  },
  radioIndicator: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    border: '2px solid',
    flexShrink: 0,
    marginTop: '2px',
    transition: 'all 0.2s ease',
  },
  modeLabel: {
    fontSize: '14px',
    fontWeight: '700',
    marginBottom: '4px',
    transition: 'color 0.2s ease',
  },
  modeDesc: {
    fontSize: '13px',
    color: '#666',
    lineHeight: '1.5',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  saveBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 28px',
    background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
    border: 'none',
    borderRadius: '14px',
    color: '#FFF',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(99,102,241,0.3)',
  },
}