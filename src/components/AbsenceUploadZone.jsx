// ═══════════════════════════════════════════════════════════
// 📎 JUSTIFICATIF D'ABSENCE — ZONE DE DÉPÔT
//
// Mêmes règles qu'avant (PDF, JPG, PNG, WebP · 5 Mo max), mais
// dessinée dans la charte de la page : cadre ambre, retour visuel
// pendant le glisser, aperçu du fichier choisi.
//
// Aucune API du navigateur au montage : le composant reste rendable
// côté serveur (tests et aperçus).
// ═══════════════════════════════════════════════════════════

import { useRef, useState } from 'react'
import { Upload, FileImage, File, Eye, Trash2, Paperclip } from 'lucide-react'
import toast from 'react-hot-toast'
import { MAX_FILE_SIZE, ALLOWED_TYPES, typeDeFichier, nomDuFichier, tailleLisible } from '../utils/fichiersAbsence'

export default function AbsenceUploadZone({ file, existingUrl, onFileSelect, onRemove, uploading = false, darkMode = true }) {
  const inputRef = useRef(null)
  const [dragActive, setDragActive] = useState(false)

  const texte = darkMode ? '#F5F2EB' : '#1D1713'
  const doux = darkMode ? '#d6c7b7' : '#4E3D2E'
  const bordure = darkMode ? 'rgba(245,158,11,0.16)' : 'rgba(29,23,19,0.12)'

  const gererGlisser = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    else if (e.type === 'dragleave') setDragActive(false)
  }

  const gererDepot = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const f = e.dataTransfer?.files?.[0]
    if (f) valider(f)
  }

  const valider = (f) => {
    if (!ALLOWED_TYPES.includes(f.type)) {
      toast.error('Format non supporté. JPG, PNG, WebP ou PDF.')
      return
    }
    if (f.size > MAX_FILE_SIZE) {
      toast.error('Fichier trop volumineux (max 5 Mo)')
      return
    }
    onFileSelect(f)
  }

  const aUnFichier = file || existingUrl
  const estImage = file ? file.type.startsWith('image/') : typeDeFichier(existingUrl) === 'image'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ color: texte, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Paperclip size={14} /> Justificatif
        <span style={{ color: doux, fontWeight: 400, fontSize: 12 }}>(optionnel)</span>
      </label>

      {!aUnFichier ? (
        <div
          data-testid="abs-upload-zone"
          onDragEnter={gererGlisser}
          onDragLeave={gererGlisser}
          onDragOver={gererGlisser}
          onDrop={gererDepot}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragActive ? '#F59E0B' : bordure}`,
            borderRadius: 14,
            padding: '22px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            background: dragActive ? 'rgba(245,158,11,0.08)' : (darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(29,23,19,0.02)'),
            transition: 'all .2s ease',
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) valider(f) }}
            style={{ display: 'none' }}
          />
          <Upload size={26} color={dragActive ? '#F59E0B' : doux} />
          <p style={{ color: texte, fontSize: 13, margin: 0, textAlign: 'center' }}>
            <span style={{ color: 'var(--abs-amber)', fontWeight: 700 }}>Cliquez</span> ou glissez un fichier
          </p>
          <p style={{ color: doux, fontSize: 11, margin: 0 }}>PDF, JPG, PNG, WebP · 5 Mo maximum</p>
        </div>
      ) : (
        <div
          data-testid="abs-upload-fichier"
          style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
            background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(29,23,19,0.02)',
            border: `1px solid ${bordure}`, borderRadius: 14,
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: 11, flexShrink: 0,
            background: estImage ? 'rgba(16,185,129,0.12)' : 'rgba(59,130,246,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {estImage ? <FileImage size={22} color="var(--abs-emerald)" /> : <File size={22} color="var(--abs-indigo)" />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              color: texte, fontSize: 13, fontWeight: 600, margin: 0,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {file ? file.name : nomDuFichier(existingUrl)}
            </p>
            <p style={{ color: doux, fontSize: 11, margin: '2px 0 0 0' }}>
              {file ? tailleLisible(file.size) : 'Document déjà joint'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {existingUrl && !file && (
              <button
                type="button"
                onClick={() => window.open(existingUrl, '_blank')}
                aria-label="Voir le justificatif"
                style={{
                  background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.22)',
                  borderRadius: 9, width: 34, height: 34, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', color: 'var(--abs-indigo)', cursor: 'pointer',
                }}
              >
                <Eye size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={onRemove}
              disabled={uploading}
              aria-label="Retirer le justificatif"
              style={{
                background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.22)',
                borderRadius: 9, width: 34, height: 34, display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: 'var(--abs-coral)', cursor: 'pointer',
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
