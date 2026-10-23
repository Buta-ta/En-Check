// ═══════════════════════════════════════════════════════════
// ✍️ SIGNATURES ET CACHET
//
// Le pavé de signature (un canvas), le gestionnaire d'une
// signature enregistrée, et le cachet de l'entreprise.
//
// ⚠️ Le canvas est du PAPIER : il reste blanc dans les deux thèmes,
//    même quand tout le reste passe en sombre.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react'
import {
  CheckCircle, Image, Info, PenTool, RefreshCw, RotateCcw, Stamp, Trash2, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'
import { palettePaie } from '../styles/paieTheme'
import './PaieInteriors.css'
import { stylesBulletins } from '../styles/paieThemeBulletins'

// ═══════════════════════════════════════════════════════════
// COMPOSANT SIGNATURE PAD
// ═══════════════════════════════════════════════════════════

export function SignaturePad({ onSave, onCancel }) {
  const { darkMode } = useTheme()
  const S = stylesBulletins(darkMode)
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    ctx.scale(2, 2)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1a1a2e'
    ctx.lineWidth = 2.5
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, rect.width, rect.height)
    ctx.beginPath()
    ctx.strokeStyle = '#E5E7EB'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.moveTo(30, rect.height - 40)
    ctx.lineTo(rect.width - 30, rect.height - 40)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.strokeStyle = '#1a1a2e'
    ctx.lineWidth = 2.5
  }, [])

  const getPos = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const startDrawing = (e) => { e.preventDefault(); const ctx = canvasRef.current.getContext('2d'); const pos = getPos(e); ctx.beginPath(); ctx.moveTo(pos.x, pos.y); setIsDrawing(true); setHasDrawn(true) }
  const draw = (e) => { e.preventDefault(); if (!isDrawing) return; const ctx = canvasRef.current.getContext('2d'); const pos = getPos(e); ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 2.5; ctx.lineTo(pos.x, pos.y); ctx.stroke() }
  const stopDrawing = (e) => { if (e) e.preventDefault(); setIsDrawing(false) }

  const clearCanvas = () => {
    const canvas = canvasRef.current; const ctx = canvas.getContext('2d'); const rect = canvas.getBoundingClientRect()
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, rect.width, rect.height)
    ctx.beginPath(); ctx.strokeStyle = '#E5E7EB'; ctx.lineWidth = 1; ctx.setLineDash([4, 4])
    ctx.moveTo(30, rect.height - 40); ctx.lineTo(rect.width - 30, rect.height - 40); ctx.stroke()
    ctx.setLineDash([]); ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 2.5; setHasDrawn(false)
  }

  const handleSave = () => { if (!hasDrawn) { toast.error('Veuillez dessiner votre signature'); return }; onSave(canvasRef.current.toDataURL('image/png')) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: '2px solid rgba(245,158,11,0.25)', background: '#FFF' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: 200, cursor: 'crosshair', touchAction: 'none', display: 'block' }}
          onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
          onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
        <div style={{ position: 'absolute', bottom: 8, left: 12, color: '#BBB', fontSize: 10, fontStyle: 'italic', pointerEvents: 'none' }}>Dessinez votre signature ici</div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={clearCanvas} style={S.sigClearBtn}><RotateCcw size={14} /><span>Effacer</span></button>
        {onCancel && <button onClick={onCancel} style={S.sigCancelBtn}><X size={14} /><span>Annuler</span></button>}
        <button onClick={handleSave} style={S.sigSaveBtn}><CheckCircle size={14} /><span>Valider</span></button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// GESTIONNAIRE DE SIGNATURE UNIQUE (pour 1 signataire)
// ═══════════════════════════════════════════════════════════

export function SingleSignatureManager({ label, signature, onSignatureChange, sigName, onSigNameChange, sigTitle, onSigTitleChange, enterpriseId, color = '#F59E0B' }) {
  const { darkMode } = useTheme()
  const S = stylesBulletins(darkMode)
  const P = palettePaie(darkMode)
  const [mode, setMode] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const uploadToStorage = async (base64Data) => {
    if (!enterpriseId) return base64Data
    setUploading(true)
    try {
      const response = await fetch(base64Data)
      const blob = await response.blob()
      const fileName = `signatures/${enterpriseId}/sig_${Date.now()}.png`
      if (signature && signature.startsWith('http')) {
        try { const oldPath = signature.split('/storage/v1/object/public/payroll-assets/')[1]; if (oldPath) await supabase.storage.from('payroll-assets').remove([oldPath]) } catch (e) { console.warn(e) }
      }
      const { data, error } = await supabase.storage.from('payroll-assets').upload(fileName, blob, { contentType: 'image/png', upsert: true })
      if (error) { console.warn('Storage non disponible, utilisation base64:', error); setUploading(false); return base64Data }
      const { data: publicData } = supabase.storage.from('payroll-assets').getPublicUrl(fileName)
      setUploading(false)
      return publicData?.publicUrl || base64Data
    } catch (err) { console.warn('Erreur upload storage, fallback base64:', err); setUploading(false); return base64Data }
  }

  const handleImport = async (event) => {
    const file = event.target.files?.[0]; if (!file) return
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) { toast.error('Format non supporté. Utilisez PNG, JPG ou WebP.'); return }
    if (file.size > 2 * 1024 * 1024) { toast.error('Fichier trop volumineux (max 2 Mo)'); return }
    const reader = new FileReader()
    reader.onload = async (e) => { const url = await uploadToStorage(e.target.result); onSignatureChange(url); setMode(null); toast.success('Signature importée') }
    reader.onerror = () => toast.error('Erreur de lecture du fichier')
    reader.readAsDataURL(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDrawSave = async (dataURL) => { const url = await uploadToStorage(dataURL); onSignatureChange(url); setMode(null); toast.success('Signature enregistrée') }

  const handleRemove = async () => {
    if (signature && signature.startsWith('http')) {
      try { const path = signature.split('/storage/v1/object/public/payroll-assets/')[1]; if (path) await supabase.storage.from('payroll-assets').remove([path]) } catch (e) { console.warn(e) }
    }
    onSignatureChange(''); toast.success('Signature supprimée')
  }

  return (
    <div className="pw-signature-card" style={{ padding: 14, borderRadius: 14, background: `${color}08`, border: `1px solid ${color}18` }}>
      <p style={{ color: P.texte, fontSize: 13, fontWeight: 700, margin: '0 0 10px 0' }}>{label}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 10, marginBottom: 12 }}>
        <div>
          <label style={S.labelSmall}>Nom</label>
          <input value={sigName || ''} onChange={e => onSigNameChange(e.target.value)} style={S.input} placeholder="Ex: Jean Dupont" />
        </div>
        <div>
          <label style={S.labelSmall}>Titre / Fonction</label>
          <input value={sigTitle || ''} onChange={e => onSigTitleChange(e.target.value)} style={S.input} placeholder="Ex: Directeur RH" />
        </div>
      </div>

      {signature && !mode && (
        <div style={{ marginBottom: 12 }}>
          <div style={S.signaturePreview}>
            <img src={signature} alt="Signature" style={{ maxWidth: '100%', maxHeight: 100, objectFit: 'contain' }} />
            {sigName && <p style={{ color: '#374151', fontSize: 11, fontWeight: 600, margin: '6px 0 0 0', borderTop: '1px solid #E5E7EB', paddingTop: 6 }}>{sigName}</p>}
            {sigTitle && <p style={{ color: '#6B7280', fontSize: 10, margin: '2px 0 0 0' }}>{sigTitle}</p>}
          </div>
        </div>
      )}

      {!mode && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setMode('draw')} style={{ ...S.sigActionBtn, borderColor: `${color}30`, background: `${color}15`, color }} disabled={uploading}>
            <PenTool size={14} /><span>{signature ? 'Redessiner' : 'Dessiner'}</span>
          </button>
          <button onClick={() => fileInputRef.current?.click()} style={{ ...S.sigActionBtn, borderColor: 'rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.1)', color: P.indigoClair }} disabled={uploading}>
            <Image size={14} /><span>{signature ? 'Remplacer' : 'Importer'}</span>
          </button>
          {signature && (
            <button onClick={handleRemove} style={{ ...S.sigActionBtn, borderColor: 'rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.1)', color: '#EF4444' }} disabled={uploading}>
              <Trash2 size={14} /><span>Supprimer</span>
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={handleImport} style={{ display: 'none' }} />
        </div>
      )}

      {uploading && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}><RefreshCw size={14} color={color} style={{ animation: 'spin 0.9s linear infinite' }} /><span style={{ color, fontSize: 12 }}>Upload en cours...</span></div>}
      {mode === 'draw' && <div style={{ marginTop: 8 }}><SignaturePad onSave={handleDrawSave} onCancel={() => setMode(null)} /></div>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// GESTIONNAIRE CACHET / TAMPON
// ═══════════════════════════════════════════════════════════

export function StampManager({ stamp, onStampChange, enterpriseId }) {
  const { darkMode } = useTheme()
  const S = stylesBulletins(darkMode)
  const P = palettePaie(darkMode)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const handleImport = async (event) => {
    const file = event.target.files?.[0]; if (!file) return
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) { toast.error('Format non supporté.'); return }
    if (file.size > 3 * 1024 * 1024) { toast.error('Fichier trop volumineux (max 3 Mo)'); return }
    setUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const base64 = e.target.result
        if (enterpriseId) {
          try {
            const response = await fetch(base64); const blob = await response.blob()
            const fileName = `stamps/${enterpriseId}/stamp_${Date.now()}.png`
            const { error } = await supabase.storage.from('payroll-assets').upload(fileName, blob, { contentType: 'image/png', upsert: true })
            if (!error) {
              const { data: publicData } = supabase.storage.from('payroll-assets').getPublicUrl(fileName)
              onStampChange(publicData?.publicUrl || base64); setUploading(false); toast.success('Cachet importé'); return
            }
          } catch (err) { console.warn('Storage non disponible:', err) }
        }
        onStampChange(base64); setUploading(false); toast.success('Cachet importé')
      }
      reader.readAsDataURL(file)
    } catch { toast.error('Erreur import'); setUploading(false) }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemove = () => { onStampChange(''); toast.success('Cachet supprimé') }

  return (
    <div className="pw-signature-card" style={{ padding: 14, borderRadius: 14, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ ...S.cardIcon, background: 'rgba(139,92,246,0.12)' }}><Stamp size={18} color="#8B5CF6" /></div>
        <div>
          <p style={{ color: P.texte, fontSize: 13, fontWeight: 700, margin: 0 }}>Cachet / Tampon de l'entreprise</p>
          <p style={{ color: P.texteDoux2, fontSize: 11, margin: '2px 0 0 0' }}>Image PNG avec fond transparent recommandé</p>
        </div>
      </div>

      {stamp && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ ...S.signaturePreview, padding: 20 }}>
            <img src={stamp} alt="Cachet" style={{ maxWidth: '100%', maxHeight: 120, objectFit: 'contain' }} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => fileInputRef.current?.click()} style={{ ...S.sigActionBtn, borderColor: 'rgba(139,92,246,0.25)', background: 'rgba(139,92,246,0.1)', color: P.violetClair }} disabled={uploading}>
          <Image size={14} /><span>{stamp ? 'Remplacer le cachet' : 'Importer un cachet'}</span>
        </button>
        {stamp && (
          <button onClick={handleRemove} style={{ ...S.sigActionBtn, borderColor: 'rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
            <Trash2 size={14} /><span>Supprimer</span>
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={handleImport} style={{ display: 'none' }} />
      </div>

      {uploading && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}><RefreshCw size={14} color="#8B5CF6" style={{ animation: 'spin 0.9s linear infinite' }} /><span style={{ color: '#8B5CF6', fontSize: 12 }}>Upload en cours...</span></div>}

      <div style={S.signatureInfo}>
        <Info size={13} color={P.texteDoux2} style={{ flexShrink: 0 }} />
        <span style={{ color: P.texteDoux2, fontSize: 11, lineHeight: 1.5 }}>Formats : PNG, JPG, WebP (max 3 Mo). Le cachet apparaîtra entre les signatures sur le bulletin.</span>
      </div>
    </div>
  )
}
