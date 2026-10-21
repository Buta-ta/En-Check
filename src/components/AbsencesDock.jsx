// ═══════════════════════════════════════════════════════════
// 🧲 DOCK DE MOTIFS — GLISSER-DÉPOSER
//
// Même geste que le dock « Modèles à glisser-déposer » du Planning :
// on attrape un motif et on le dépose sur la ligne d'un employé,
// au jour voulu. Un simple clic ouvre le formulaire.
//
// Le dock ne crée rien : il émet un motif, la page décide.
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { GripVertical } from 'lucide-react'
import { DATA_TRANSFER_MOTIF } from '../constants/motifsAbsence'
import { useMotifsAbsence } from '../hooks/useMotifsAbsence'

export default function AbsencesDock({ onDeclarer }) {
  const { motifs } = useMotifsAbsence()
  const [motifGlisse, setMotifGlisse] = useState(null)

  return (
    <aside className="abs-panel abs-dock" aria-label="Motifs à glisser-déposer">
      <p className="abs-dock-title">
        <GripVertical size={13} /> Motifs à glisser-déposer
      </p>

      {motifs.map((m) => (
        <div
          key={m.id}
          className={`abs-dock-card${motifGlisse === m.id ? ' is-dragging' : ''}`}
          role="button"
          tabIndex={0}
          draggable
          data-motif={m.id}
          aria-label={`Déclarer : ${m.label}`}
          onDragStart={(e) => {
            e.dataTransfer.setData(DATA_TRANSFER_MOTIF, m.id)
            e.dataTransfer.setData('text/plain', m.id) // repli navigateur
            e.dataTransfer.effectAllowed = 'copy'
            setMotifGlisse(m.id)
          }}
          onDragEnd={() => setMotifGlisse(null)}
          onClick={() => onDeclarer?.({ motifId: m.id })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onDeclarer?.({ motifId: m.id })
            }
          }}
          style={{ borderLeft: `3px solid ${m.color}` }}
        >
          <span className="abs-dock-grip" aria-hidden="true">⠿</span>
          <span className="abs-dock-emoji" aria-hidden="true">{m.emoji}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {m.label}
          </span>
          <i
            aria-hidden="true"
            style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: 999, background: m.color, flexShrink: 0 }}
          />
        </div>
      ))}

      <p className="abs-dock-hint">
        Glissez un motif sur la ligne d’un employé pour déclarer une absence au jour choisi.
        Un clic ouvre simplement le formulaire.
      </p>
    </aside>
  )
}
