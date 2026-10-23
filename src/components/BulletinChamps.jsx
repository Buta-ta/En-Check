// ═══════════════════════════════════════════════════════════
// 🧱 LES PETITES BRIQUES DU BULLETIN
//
// Avatar, étiquette, infobulle, champ étiqueté, recherche.
// Sortis de la page « Fiches de paie » : ce sont des éléments
// d'interface sans logique métier, réutilisables ailleurs.
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import {
  HelpCircle, Search, X,
} from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { palettePaie } from '../styles/paieTheme'
import { stylesBulletins } from '../styles/paieThemeBulletins'
import { initialesDe } from '../utils/initiales'

export function AvatarSalarie({ employe, taille = 34 }) {
  const { darkMode } = useTheme()
  const P = palettePaie(darkMode)
  const nom = `${employe?.first_name || ''} ${employe?.last_name || ''}`.trim()
  const style = { width: taille, height: taille, fontSize: Math.round(taille * 0.36) }

  if (employe?.photo_url) {
    return (
      <img
        src={employe.photo_url}
        alt={nom || 'Salarié'}
        className="pay-avatar"
        style={{ ...style, objectFit: 'cover', borderRadius: '50%', border: `1px solid ${P.ambre4}` }}
        loading="lazy"
      />
    )
  }

  return (
    <span
      className="pay-avatar"
      title={nom || 'Salarié'}
      aria-hidden={nom ? undefined : 'true'}
      data-testid="avatar-initiales"
      style={{
        ...style,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        fontWeight: 800,
        color: P.ambreClair,
        background: P.ambre4,
        border: `1px solid ${P.ambre7}`,
        flexShrink: 0,
      }}
    >
      {initialesDe(employe?.first_name, employe?.last_name)}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════
// COMPOSANTS UTILITAIRES
// ═══════════════════════════════════════════════════════════

export function FieldHelp({ text, example }) {
  const { darkMode } = useTheme()
  const S = stylesBulletins(darkMode)
  const P = palettePaie(darkMode)
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <HelpCircle size={14} color={P.texteFaint} style={{ cursor: 'pointer', marginLeft: 6, flexShrink: 0 }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} />
      {show && (
        <div style={S.tooltip}>
          <p style={{ color: P.texteDoux, fontSize: 12, margin: '0 0 6px 0', lineHeight: 1.5 }}>{text}</p>
          {example && <div style={S.tooltipExample}><span style={{ color: P.texteDoux2, fontSize: 10, display: 'block', marginBottom: 3, fontWeight: 700, textTransform: 'uppercase' }}>Exemple</span><span style={{ color: P.ambre, fontSize: 12, fontWeight: 600 }}>{example}</span></div>}
          <div style={S.tooltipArrow} />
        </div>
      )}
    </span>
  )
}

export function FormLabel({ children, help, example, required }) {
  const { darkMode } = useTheme()
  const S = stylesBulletins(darkMode)
  const P = palettePaie(darkMode)
  return <label style={S.labelSmall}>{children}{required && <span style={{ color: P.rouge, marginLeft: 2 }}>*</span>}{help && <FieldHelp text={help} example={example} />}</label>
}

export function Badge({ children, color = '#F59E0B' }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: `${color}20`, border: `1px solid ${color}30`, color, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999 }}>{children}</span>
}

export function CategoryBadge({ category }) {
  const config = { transport: { label: 'Transport', color: '#3B82F6' }, housing: { label: 'Logement', color: '#8B5CF6' }, food: { label: 'Repas', color: '#F59E0B' }, seniority: { label: 'Ancienneté', color: '#10B981' }, responsibility: { label: 'Responsabilité', color: '#6366F1' }, performance: { label: 'Performance', color: '#EC4899' }, exceptional: { label: 'Exceptionnel', color: '#EF4444' }, representation: { label: 'Représentation', color: '#14B8A6' }, advance: { label: 'Avance', color: '#F97316' }, loan: { label: 'Prêt', color: '#EF4444' }, discipline: { label: 'Discipline', color: '#DC2626' }, garnishment: { label: 'Saisie', color: '#991B1B' }, voluntary: { label: 'Volontaire', color: '#059669' }, reimbursement: { label: 'Remboursement', color: '#D97706' }, other: { label: 'Autre', color: '#6B7280' } }
  const c = config[category] || config.other
  return <Badge color={c.color}>{c.label}</Badge>
}

export function SearchBar({ value, onChange, placeholder = 'Rechercher...' }) {
  const { darkMode } = useTheme()
  const S = stylesBulletins(darkMode)
  const P = palettePaie(darkMode)
  return (
    <div style={S.searchWrap}>
      <Search size={16} color={P.texteFaint} style={{ flexShrink: 0 }} />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={S.searchInput} />
      {value && <button onClick={() => onChange('')} style={S.searchClear}><X size={14} /></button>}
    </div>
  )
}
