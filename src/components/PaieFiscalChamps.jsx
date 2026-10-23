// ═══════════════════════════════════════════════════════════
// 🧾 ÉTIQUETTES ET AIDES DE SAISIE DU VOLET FISCAL
//
// Sortis de la page « Configuration fiscale » : ce sont des blocs
// de saisie, pas de la fiscalité. Ils gardent exactement le même
// rendu — ils changent seulement de fichier.
// ═══════════════════════════════════════════════════════════

import { useId, useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { palettePaie, stylesPaie } from '../styles/paieTheme'
import './PaieInteriors.css'

export function FieldHelp({ text, example }) {
  const { darkMode } = useTheme()
  const [show, setShow] = useState(false)
  const id = useId()
  return <span className="pw-field-help" data-theme={darkMode ? 'dark' : 'light'}>
    <button type="button" aria-label={`Aide : ${text}`} aria-expanded={show} aria-controls={id}
      onClick={event => { event.preventDefault(); setShow(value => !value) }}
      onKeyDown={event => { if (event.key === 'Escape' && show) { event.stopPropagation(); setShow(false) } }}>
      <HelpCircle size={16} aria-hidden="true"/>
    </button>
    {show && <span id={id} className="pw-field-explanation"><span>{text}</span>{example && <span className="pw-field-example"><strong>Exemple</strong> {example}</span>}</span>}
  </span>
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
