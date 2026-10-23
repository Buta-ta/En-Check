// ═══════════════════════════════════════════════════════════
// 🗂️ CARTES DU VOLET FISCAL — cotisations et tranches
//
// Une ligne par cotisation, une ligne par tranche du barème.
// Sorties de la page « Configuration fiscale » sans changer une
// virgule de leur rendu.
// ═══════════════════════════════════════════════════════════

import {
  Trash2,
  CheckCircle,
  Edit,
} from 'lucide-react'
import './PaieInteriors.css'
import { useTheme } from '../contexts/ThemeContext'
import { palettePaie, stylesPaie } from '../styles/paieTheme'
import TaxationService from '../services/taxationService'

export function ContributionCard({ contrib, currency, onEdit, onDelete }) {
  const { darkMode } = useTheme()
  const S = stylesPaie(darkMode)
  const isPaidByEmployee = contrib.paid_by === 'employee' || contrib.paid_by === 'both'
  const isPaidByEmployer = contrib.paid_by === 'employer' || contrib.paid_by === 'both'

  return (
    <div style={S.contribCard}>
      <div style={S.contribHeader}>
        <div>
          <h4 style={S.contribName}>{contrib.contribution_name || contrib.name}</h4>
          <p style={S.contribCode}>{contrib.contribution_code || contrib.code}</p>
        </div>

        {contrib.is_mandatory && (
          <span style={S.mandatoryBadge}>
            <CheckCircle size={12} /> Obligatoire
          </span>
        )}
      </div>

      <div style={S.contribBody}>
        <div style={S.contribRow}>
          <span style={S.contribLabel}>Méthode</span>
          <span style={S.contribAmount}>
            {contrib.calculation_method === 'percentage' ? 'Pourcentage' : 'Montant fixe'}
          </span>
        </div>

        {isPaidByEmployee && (
          <div style={S.contribRow}>
            <span style={S.contribLabel}>Part salariale</span>
            <span style={S.contribAmount}>
              {contrib.calculation_method === 'percentage'
                ? `${contrib.rate_employee || 0}%`
                : TaxationService.formatMoney(contrib.fixed_amount || 0, currency)}
            </span>
          </div>
        )}

        {isPaidByEmployer && (
          <div style={S.contribRow}>
            <span style={S.contribLabel}>Part patronale</span>
            <span style={S.contribAmount}>
              {contrib.calculation_method === 'percentage'
                ? `${contrib.rate_employer || 0}%`
                : (contrib.paid_by === 'employer'
                    ? TaxationService.formatMoney(contrib.fixed_amount || 0, currency)
                    : '—')}
            </span>
          </div>
        )}

        {contrib.max_base && (
          <div style={S.contribRow}>
            <span style={S.contribLabel}>Plafond max</span>
            <span style={S.contribAmount}>{TaxationService.formatMoney(contrib.max_base, currency)}</span>
          </div>
        )}
      </div>

      <div style={S.contribActions}>
        <button onClick={onEdit} style={S.editBtn}>
          <Edit size={14} /> Modifier
        </button>
        <button onClick={onDelete} style={S.deleteBtn}>
          <Trash2 size={14} /> Supprimer
        </button>
      </div>
    </div>
  )
}

export function BracketCard({ bracket, currency, onEdit, onDelete }) {
  return (
    <article className="pi-bracket">
      <button className="pi-bracket-edit" onClick={onEdit} aria-label={`Modifier la tranche ${bracket.bracket_name || bracket.bracket_order}`}>
        <span className="pi-bracket-order">{bracket.bracket_order}</span>
        <span className="pi-bracket-range"><strong>{bracket.bracket_name}</strong><span>{TaxationService.formatMoney(bracket.min_amount, currency)} → {bracket.max_amount != null ? TaxationService.formatMoney(bracket.max_amount, currency) : 'Sans limite supérieure'}</span>{bracket.fixed_deduction > 0 && <small>Déduction fixe : {TaxationService.formatMoney(bracket.fixed_deduction, currency)}</small>}</span>
        <span className="pi-bracket-rate">{bracket.tax_rate}<small>%</small></span>
        <Edit size={16} aria-hidden="true"/>
      </button>
      <button onClick={onDelete} className="pi-bracket-delete" aria-label={`Supprimer la tranche ${bracket.bracket_name || bracket.bracket_order}`}><Trash2 size={16}/>Supprimer</button>
    </article>
  )
}
