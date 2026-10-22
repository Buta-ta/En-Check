// ═══════════════════════════════════════════════════════════
// 🧾 ÉTIQUETTES ET AIDES DE SAISIE DU VOLET FISCAL
//
// Sortis de la page « Configuration fiscale » : ce sont des blocs
// de saisie, pas de la fiscalité. Ils gardent exactement le même
// rendu — ils changent seulement de fichier.
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import {
  HelpCircle,
} from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { palettePaie, stylesPaie } from '../styles/paieTheme'

export function FieldHelp({ text, example }) {
  const { darkMode } = useTheme()
  const S = stylesPaie(darkMode)
  const P = palettePaie(darkMode)
  const [show, setShow] = useState(false)

  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <HelpCircle
        size={14}
        color={P.texteFaint}
        style={{ cursor: 'pointer', marginLeft: 6, flexShrink: 0 }}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      />
      {show && (
        <div style={S.tooltip}>
          <p style={{ color: P.contour, fontSize: 12, margin: '0 0 6px 0', lineHeight: 1.5 }}>{text}</p>
          {example && (
            <div style={S.tooltipExample}>
              <span
                style={{
                  color: P.texteDoux2,
                  fontSize: 10,
                  display: 'block',
                  marginBottom: 3,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                Exemple
              </span>
              <span style={{ color: P.ambre, fontSize: 12, fontWeight: 600 }}>{example}</span>
            </div>
          )}
          <div style={S.tooltipArrow} />
        </div>
      )}
    </span>
  )
}

export function FormLabel({ children, help, example, required }) {
  const { darkMode } = useTheme()
  const S = stylesPaie(darkMode)
  const P = palettePaie(darkMode)
  return (
    <label style={S.label}>
      {children}
      {required && <span style={{ color: P.rouge, marginLeft: 3 }}>*</span>}
      {help && <FieldHelp text={help} example={example} />}
    </label>
  )
}

/**
 * `integre` : la page est rendue à l'intérieur de la coque « Paie & fiscalité »,
 * qui fournit alors le bandeau, les KPI et la barre d'onglets. `ongletExterne`
 * indique quel volet afficher (pays | contributions | taxes | rules | preview).
 */
